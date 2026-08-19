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
import * as Network from 'expo-network';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

const SITE_URL = 'https://sparklingsilver.in';
// Hosts that stay inside the WebView (the app itself + its auth/CDN origins).
const INTERNAL_HOST_SUFFIXES = ['sparklingsilver.in', 'lovable.app', 'supabase.co'];

// Runs before any page script: guarantees the document is laid out at the
// device width even if a cached/older HTML shell ships a stale viewport tag,
// so the UI always fits the screen with no horizontal panning.
const VIEWPORT_LOCK_JS = `(function () {
  function lock() {
    var content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      (document.head || document.documentElement).appendChild(meta);
    }
    if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
  }
  lock();
  document.addEventListener('DOMContentLoaded', lock);
})();
true;`;

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
  // Capture protection, applied globally (the whole app is one WebView screen,
  // so this covers every screen at all times).
  //  * Android: FLAG_SECURE blocks screenshots AND screen recording outright,
  //    and also blacks out the app-switcher thumbnail.
  //  * iOS: the OS does not permit blocking capture, so we (a) shield the
  //    content the instant a screenshot is taken, (b) shield it for as long as
  //    a screen recording / AirPlay mirroring session is active, and (c) shield
  //    it whenever the app leaves the foreground so the app-switcher snapshot
  //    and any background capture show nothing.
  // The web layer can exempt specific accounts (e.g. the App Store review
  // account) from capture protection via an 'ss-web-capture-policy' message.
  const [captureAllowed, setCaptureAllowed] = useState(false);
  const captureAllowedRef = useRef(false);
  const [captureShield, setCaptureShield] = useState(null); // 'screenshot' | 'recording' | 'background'
  const recordingRef = useRef(false);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    if (captureAllowed) {
      // Exempt account: lift the secure flag and never shield the content.
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      recordingRef.current = false;
      setCaptureShield(null);
      ScreenCapture.allowScreenCaptureAsync('ss-global').catch(() => {});
      return () => {
        mounted = false;
      };
    }
    const enable = () => {
      ScreenCapture.preventScreenCaptureAsync('ss-global').catch(() => {});
    };
    enable();

    const showFlash = () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setCaptureShield('screenshot');
      flashTimerRef.current = setTimeout(() => {
        if (!mounted) return;
        setCaptureShield(recordingRef.current ? 'recording' : null);
      }, 4000);
    };

    // Re-assert on every foreground: some OEM flows drop the secure flag.
    // While not active, cover the content so the OS snapshot is blank (iOS).
    const appSub = AppState.addEventListener('change', (state) => {
      if (captureAllowedRef.current) {
        setCaptureShield(null);
        return;
      }
      if (state === 'active') {
        enable();
        setCaptureShield(recordingRef.current ? 'recording' : null);
      } else if (Platform.OS === 'ios') {
        setCaptureShield('background');
      }
    });

    let captureSub = null;
    let recordingSub = null;
    (async () => {
      try {
        const perm = await ScreenCapture.requestPermissionsAsync?.();
        if (perm && perm.status !== 'granted') return;
      } catch {
        /* not required on all platforms */
      }
      if (!mounted) return;
      try {
        captureSub = ScreenCapture.addScreenshotListener(showFlash);
      } catch {
        /* listener unavailable */
      }
      // Screen-recording / mirroring observer (iOS). Feature-detected so the
      // app keeps working on runtimes that don't expose it.
      try {
        const addRecordingListener =
          ScreenCapture.addScreenRecordingListener ??
          ScreenCapture.addScreenCaptureListener;
        if (typeof addRecordingListener === 'function') {
          recordingSub = addRecordingListener((event) => {
            const active =
              typeof event === 'boolean'
                ? event
                : (event?.isCaptured ?? event?.isBeingCaptured ?? true);
            recordingRef.current = !!active;
            setCaptureShield(active ? 'recording' : null);
          });
        }
      } catch {
        /* observer unavailable */
      }
    })();

    return () => {
      mounted = false;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      appSub.remove();
      captureSub?.remove?.();
      recordingSub?.remove?.();
      ScreenCapture.allowScreenCaptureAsync('ss-global').catch(() => {});
    };
  }, [captureAllowed]);


  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const webReadyRef = useRef(false);
  const pendingUrlRef = useRef(null);
  const [isOffline, setIsOffline] = useState(false);
  const wasOfflineRef = useRef(false);

  // Connectivity: show a banner while offline and auto-reload once the
  // connection comes back so the WebView never sits on a dead page.
  useEffect(() => {
    let mounted = true;
    let sub = null;
    const apply = (state) => {
      if (!mounted) return;
      const online =
        !!state?.isConnected && state?.isInternetReachable !== false;
      setIsOffline(!online);
      if (!online) {
        wasOfflineRef.current = true;
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        webReadyRef.current = false;
        setLoadError(null);
        webViewRef.current?.reload();
      }
    };

    Network.getNetworkStateAsync().then(apply).catch(() => {});
    try {
      sub = Network.addNetworkStateListener?.(apply) ?? null;
    } catch {
      /* listener unavailable on this runtime */
    }
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // Over-the-air updates: fetch and apply silently on cold start.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let mounted = true;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!mounted || !result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        /* offline or no update channel configured — keep the bundled app */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
      if (msg?.type === 'ss-web-capture-policy') {
        const allow = !!msg.allow;
        captureAllowedRef.current = allow;
        setCaptureAllowed(allow);
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
                scalesPageToFit={false}
                automaticallyAdjustContentInsets={false}
                contentInsetAdjustmentBehavior="never"
                bounces={false}
                directionalLockEnabled={true}
                textZoom={100}
                setBuiltInZoomControls={false}
                setDisplayZoomControls={false}
                injectedJavaScriptBeforeContentLoaded={VIEWPORT_LOCK_JS}
                injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
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
              {captureShield && (
                <View style={styles.shield}>
                  <Text style={styles.shieldTitle}>
                    {captureShield === 'recording'
                      ? 'Screen recording is not allowed'
                      : 'Screen capture is not allowed'}
                  </Text>
                  <Text style={styles.shieldBody}>
                    Sparkling Silver catalogue images and pricing are confidential.
                    {captureShield === 'recording'
                      ? ' Stop the recording or mirroring session to continue browsing.'
                      : ' Please do not capture or record this screen.'}
                  </Text>
                </View>
              )}

              {isOffline && (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineText}>
                    You’re offline — showing the last loaded page. We’ll refresh
                    automatically when you’re back online.
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
