import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenCapture from 'expo-screen-capture';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const SITE_URL = 'https://sparklingsilver.in';
// Hosts that stay inside the WebView (the app itself + its auth/CDN origins).
const INTERNAL_HOST_SUFFIXES = ['sparklingsilver.in', 'lovable.app', 'supabase.co'];

function isInternalUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return INTERNAL_HOST_SUFFIXES.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

async function openExternal(url) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.warn('could not open url externally', url, err);
  }
}

// Native foreground presentation — real OS notifications, not web push.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6D1F2E',
    });
  }

  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return token?.data ?? null;
}

export default function App() {
  // Screenshot / screen-recording protection.
  // Android: FLAG_SECURE blocks screenshots and recordings outright.
  // iOS: the OS gives no way to block a screenshot, so we detect it and cover
  // the content with a privacy shield the moment one is taken.
  const [screenshotBlocked, setScreenshotBlocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    const enable = () => {
      ScreenCapture.preventScreenCaptureAsync('ss-global').catch(() => {});
    };
    enable();

    // Re-assert on every foreground: some OEM flows drop the secure flag.
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') enable();
    });

    let captureSub = null;
    (async () => {
      try {
        const perm = await ScreenCapture.requestPermissionsAsync?.();
        if (perm && perm.status !== 'granted') return;
      } catch {
        /* not required on all platforms */
      }
      if (!mounted) return;
      try {
        captureSub = ScreenCapture.addScreenshotListener(() => {
          setScreenshotBlocked(true);
          setTimeout(() => setScreenshotBlocked(false), 4000);
        });
      } catch {
        /* listener unavailable */
      }
    })();

    return () => {
      mounted = false;
      appSub.remove();
      captureSub?.remove?.();
      ScreenCapture.allowScreenCaptureAsync('ss-global').catch(() => {});
    };
  }, []);

  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const webReadyRef = useRef(false);
  const pendingUrlRef = useRef(null);

  const post = useCallback((payload) => {
    const js = `(function(){try{var d=${JSON.stringify(
      JSON.stringify(payload),
    )};window.dispatchEvent(new MessageEvent('message',{data:d}));}catch(e){}})();true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const sendToken = useCallback(
    (token) => {
      if (!token) return;
      post({
        type: 'ss-native-push-token',
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? undefined,
      });
    },
    [post],
  );

  // Register for native push once on launch.
  useEffect(() => {
    let mounted = true;
    registerForPushNotificationsAsync()
      .then((token) => {
        if (mounted && token) setPushToken(token);
      })
      .catch((err) => console.warn('push registration failed', err));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (pushToken && webReadyRef.current) sendToken(pushToken);
  }, [pushToken, sendToken]);

  // Notification tap -> deep link inside the web app.
  useEffect(() => {
    const navigateTo = (url) => {
      if (!url) return;
      if (webReadyRef.current) post({ type: 'ss-native-navigate', url });
      else pendingUrlRef.current = url;
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const url = response?.notification?.request?.content?.data?.url;
        if (url) navigateTo(url);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      navigateTo(url);
    });
    return () => sub.remove();
  }, [post]);

  // Clear the badge when the app is opened.
  useEffect(() => {
    Notifications.setBadgeCountAsync(0).catch(() => {});
  }, []);

  // Android hardware back -> WebView back
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onWebMessage = useCallback(
    (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (msg?.type === 'ss-web-ready') {
        webReadyRef.current = true;
        if (pushToken) sendToken(pushToken);
        if (pendingUrlRef.current) {
          post({ type: 'ss-native-navigate', url: pendingUrlRef.current });
          pendingUrlRef.current = null;
        }
      }
    },
    [post, pushToken, sendToken],
  );

  // WhatsApp / tel: / mailto: / Instagram must leave the WebView, otherwise
  // those buttons silently do nothing (a common App Review rejection).
  const onShouldStartLoad = useCallback((request) => {
    const url = request?.url ?? '';
    if (!url || url === 'about:blank') return true;
    if (isInternalUrl(url)) return true;
    openExternal(url);
    return false;
  }, []);

  const retry = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    webReadyRef.current = false;
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.contentContainer}>
          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Can’t reach Sparkling Silver</Text>
              <Text style={styles.errorBody}>
                Please check your internet connection and try again.
              </Text>
              <Pressable style={styles.retryBtn} onPress={retry} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <WebView
                key={reloadKey}
                ref={webViewRef}
                source={{ uri: SITE_URL }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                databaseEnabled
                cacheEnabled={true}
                cacheMode="LOAD_DEFAULT"
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                allowsBackForwardNavigationGestures
                pullToRefreshEnabled={true}
                androidHardwareAccelerationDisabled={false}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                startInLoadingState={false}
                setSupportMultipleWindows={false}
                onMessage={onWebMessage}
                onShouldStartLoadWithRequest={onShouldStartLoad}
                onOpenWindow={(event) => {
                  const url = event?.nativeEvent?.targetUrl;
                  if (!url) return;
                  if (isInternalUrl(url)) webViewRef.current?.injectJavaScript(
                    `window.location.assign(${JSON.stringify(url)});true;`,
                  );
                  else openExternal(url);
                }}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={({ nativeEvent }) => {
                  setLoading(false);
                  setLoadError(nativeEvent?.description ?? 'load failed');
                }}
                onHttpError={({ nativeEvent }) => {
                  // Only a failed main-document load should surface the error UI.
                  if (
                    nativeEvent?.url?.startsWith(SITE_URL) &&
                    nativeEvent?.statusCode >= 500
                  ) {
                    setLoading(false);
                    setLoadError(`server error ${nativeEvent.statusCode}`);
                  }
                }}
                onNavigationStateChange={(nav) => {
                  setCanGoBack(nav.canGoBack);
                  // A full page load resets the injected bridge state.
                  if (nav.loading) webReadyRef.current = false;
                }}
                style={styles.webview}
              />
              {screenshotBlocked && (
                <View style={styles.shield}>
                  <Text style={styles.shieldTitle}>Screenshots are not allowed</Text>
                  <Text style={styles.shieldBody}>
                    Sparkling Silver catalogue images and pricing are confidential.
                    Please do not capture or record this screen.
                  </Text>
                </View>
              )}
              {loading && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color="#6D1F2E" />
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentContainer: { flex: 1, backgroundColor: '#ffffff' },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F2',
  },
  shield: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#6D1F2E',
  },
  shieldTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  shieldBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F3E6E9',
    textAlign: 'center',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FAF7F2',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1f1f',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#5b5b5b',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#6D1F2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
