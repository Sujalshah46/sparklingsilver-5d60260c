import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { usePreventScreenCapture } from 'expo-screen-capture';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const SITE_URL = 'https://sparklingsilver.in';

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
  usePreventScreenCapture();

  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pushToken, setPushToken] = useState(null);
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.contentContainer}>
          <WebView
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
            onMessage={onWebMessage}
            onNavigationStateChange={(nav) => {
              setCanGoBack(nav.canGoBack);
              // A full page load resets the injected bridge state.
              if (nav.loading) webReadyRef.current = false;
            }}
            style={styles.webview}
          />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentContainer: { flex: 1, backgroundColor: '#ffffff' },
  webview: { flex: 1, backgroundColor: '#ffffff' },
});
