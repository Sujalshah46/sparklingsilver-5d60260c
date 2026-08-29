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
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenCapture from 'expo-screen-capture';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNavigationAction } from './src/navigationPolicy';

const SITE_URL = 'https://sparklingsilver.in';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('EAS projectId is missing');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn('Error fetching Expo push token', err);
    return null;
  }
}

export default function App() {
  const [captureAllowed, setCaptureAllowed] = useState(false);
  const captureAllowedRef = useRef(false);
  const [captureShield, setCaptureShield] = useState(null); // 'screenshot' | 'recording' | 'background'
  const recordingRef = useRef(false);
  const flashTimerRef = useRef(null);

  const [session, setSession] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('shop'); // 'shop' | 'orders'
  const [isOffline, setIsOffline] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [showLoginNotice, setShowLoginNotice] = useState(false);
  const hasShownLoginNoticeRef = useRef(false);

  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const webReadyRef = useRef(false);

  // Subscribe to network connection changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Fetch orders from Supabase
  const fetchOrders = useCallback(async (token, userId) => {
    try {
      const response = await fetch(
        `https://gihusjkvwzxcrilrbmww.supabase.co/rest/v1/orders?user_id=eq.${userId}&select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': 'sb_publishable_w-zu7Y7vidH12zFVXa4Ekw_6xnmf1nI',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
        AsyncStorage.setItem('ss_orders', JSON.stringify(data)).catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to fetch fresh orders', err);
    }
  }, []);

  // Load cached auth and order details on mount
  useEffect(() => {
    async function loadCachedData() {
      try {
        const cachedSession = await AsyncStorage.getItem('ss_session');
        const cachedOrders = await AsyncStorage.getItem('ss_orders');
        if (cachedSession) {
          const parsedSession = JSON.parse(cachedSession);
          setSession(parsedSession);
          if (cachedOrders) {
            setOrders(JSON.parse(cachedOrders));
          }
          // Query fresh orders
          fetchOrders(parsedSession.access_token, parsedSession.user.id);
        }
      } catch (e) {
        console.warn('Failed to load cached session or orders', e);
      }
    }
    loadCachedData();
  }, [fetchOrders]);

  // Screen capture & recording protection
  useEffect(() => {
    let mounted = true;
    if (captureAllowed) {
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
      } catch {}
      if (!mounted) return;
      try {
        captureSub = ScreenCapture.addScreenshotListener(showFlash);
      } catch {}
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
      } catch {}
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

  // Request notification permissions and fetch push token
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setPushToken(token);
      }
    });
  }, []);

  // Listen to deep-link redirects from push notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const url = data?.url || data?.path;
      if (url && webViewRef.current) {
        const cleanUrl = url.startsWith('/') ? url : `/${url}`;
        const script = `window.postMessage(JSON.stringify({ type: "ss-native-navigate", url: ${JSON.stringify(cleanUrl)} }), "*"); true;`;
        webViewRef.current.injectJavaScript(script);
        setActiveTab('shop');
      }
    });
    return () => subscription.remove();
  }, []);

  // Safety timer for loading overlay
  useEffect(() => {
    setLoading(true);
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3500);
    return () => clearTimeout(safetyTimer);
  }, [reloadKey]);

  // Shared handler for deep links and OAuth redirects
  const handleDeepLink = useCallback((incomingUrl) => {
    if (!incomingUrl) return;
    try {
      let relativePath = incomingUrl;
      if (incomingUrl.startsWith('sparklingsilver://')) {
        const raw = incomingUrl.replace(/^sparklingsilver:\/\/?/, '');
        relativePath = raw.startsWith('/') ? raw : `/${raw}`;
      } else if (incomingUrl.startsWith('http://') || incomingUrl.startsWith('https://')) {
        try {
          const parsed = new URL(incomingUrl);
          relativePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
          relativePath = incomingUrl;
        }
      }
      
      if (webViewRef.current) {
        // Dispatch SPA client-side navigation directly to TanStack router to avoid WKWebView URL preview bar
        webViewRef.current.injectJavaScript(
          `window.postMessage(JSON.stringify({ type: "ss-native-navigate", url: ${JSON.stringify(relativePath)} }), "*"); true;`
        );
      }
    } catch (err) {
      console.warn('Error handling deep link:', err);
    }
  }, []);

  // Open OAuth flows (Google, Apple, Lovable) in Chrome Custom Tab / ASWebAuthenticationSession
  const openOAuthSession = useCallback(
    async (authUrl) => {
      try {
        console.log('[OAuth] Launching WebBrowser auth session for:', authUrl);
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          'sparklingsilver://auth-callback'
        );
        console.log('[OAuth] Result received:', JSON.stringify(result));
        if (result.type === 'success' && result.url) {
          handleDeepLink(result.url);
        }
      } catch (err) {
        console.warn('Error during OAuth web browser session:', err);
      }
    },
    [handleDeepLink],
  );

  // Handle incoming App Links & Custom Scheme URLs
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => sub.remove();
  }, [handleDeepLink]);

  // Android hardware back -> WebView back
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab === 'orders') {
        setActiveTab('shop');
        return true;
      }
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, activeTab]);

  const sendPushTokenToWeb = useCallback((token) => {
    if (token && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.postMessage(JSON.stringify({
          type: "ss-native-push-token",
          token: ${JSON.stringify(token)},
          platform: ${JSON.stringify(Platform.OS)},
          deviceName: ${JSON.stringify(Device.modelName || 'Device')}
        }), "*"); true;`
      );
    }
  }, []);

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
        setLoading(false);
        if (pushToken) {
          sendPushTokenToWeb(pushToken);
        }
      }
      if (msg?.type === 'ss-session') {
        const s = msg.session;
        setSession(s);
        if (s) {
          AsyncStorage.setItem('ss_session', JSON.stringify(s)).catch(() => {});
          fetchOrders(s.access_token, s.user.id);
        } else {
          AsyncStorage.removeItem('ss_session').catch(() => {});
          AsyncStorage.removeItem('ss_orders').catch(() => {});
          setOrders([]);
        }
      }
    },
    [pushToken, sendPushTokenToWeb, fetchOrders],
  );

  const onShouldStartLoad = useCallback(
    (request) => {
      const url = request?.url ?? '';
      const action = getNavigationAction(url, SITE_URL);
      if (action === 'ALLOW') {
        return true;
      }
      if (action === 'AUTH') {
        openOAuthSession(url);
        return false;
      }
      if (action === 'EXTERNAL') {
        Linking.openURL(url).catch(() => {});
        return false;
      }
      return false;
    },
    [openOAuthSession],
  );

  const retry = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    webReadyRef.current = false;
    setReloadKey((k) => k + 1);
  }, []);

  const renderOrderItem = ({ item }) => {
    const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    
    // Status pill style mappings
    let badgeColor = '#E2E8F0';
    let textColor = '#475569';
    if (item.status === 'completed' || item.status === 'confirmed') {
      badgeColor = '#DEF7EC';
      textColor = '#03543F';
    } else if (item.status === 'pending') {
      badgeColor = '#FEF08A';
      textColor = '#713F12';
    } else if (item.status === 'dispatched') {
      badgeColor = '#E0F2FE';
      textColor = '#0369A1';
    } else if (item.status === 'cancelled') {
      badgeColor = '#FDE8E8';
      textColor = '#9B1C1C';
    }

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderCardHeader}>
          <Text style={styles.orderNo}>Order #{item.order_no || item.id.slice(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
            <Text style={[styles.statusText, { color: textColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.orderDate}>{dateStr}</Text>
        <View style={styles.orderFooter}>
          <Text style={styles.orderTotalLabel}>Total Amount:</Text>
          <Text style={styles.orderTotalValue}>₹{item.total.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  const handleNavigationStateChange = (nav) => {
    setCanGoBack(nav.canGoBack);
    if (nav.loading) webReadyRef.current = false;

    // Detect first launch after login to trigger screen capture warning notification banner
    const isAuthPage = nav.url.includes('/auth') || nav.url.includes('/reset-password');
    if (!isAuthPage && !nav.loading && nav.url !== 'about:blank') {
      if (!hasShownLoginNoticeRef.current) {
        hasShownLoginNoticeRef.current = true;
        setShowLoginNotice(true);
        setTimeout(() => {
          setShowLoginNotice(false);
        }, 5000);
      }
    }
  };

  const showWebView = activeTab === 'shop' && !loadError && !isOffline;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.contentContainer}>
          {isOffline || loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Can’t reach Sparkling Silver</Text>
              <Text style={styles.errorBody}>
                {isOffline
                  ? 'Your device appears to be offline. Please connect to the internet to check the catalogue.'
                  : (loadError || 'Unable to load page')}
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Retry loading catalog"
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* WebView Layout */}
              <View style={[styles.tabContent, { display: showWebView ? 'flex' : 'none' }]}>
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
                  pullToRefreshEnabled={Platform.OS === 'ios'}
                  androidHardwareAccelerationDisabled={false}
                  overScrollMode="never"
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  startInLoadingState={false}
                  setSupportMultipleWindows={true}
                  onOpenWindow={(syntheticEvent) => {
                    const { targetUrl } = syntheticEvent.nativeEvent;
                    if (targetUrl) {
                      const action = getNavigationAction(targetUrl, SITE_URL);
                      if (action === 'AUTH') {
                        openOAuthSession(targetUrl);
                      } else if (action === 'EXTERNAL') {
                        Linking.openURL(targetUrl).catch(() => {});
                      } else if (action === 'ALLOW' && webViewRef.current) {
                        try {
                          const parsed = new URL(targetUrl);
                          const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
                          webViewRef.current.injectJavaScript(
                            `window.postMessage(JSON.stringify({ type: "ss-native-navigate", url: ${JSON.stringify(path)} }), "*"); true;`
                          );
                        } catch {
                          webViewRef.current.injectJavaScript(
                            `window.postMessage(JSON.stringify({ type: "ss-native-navigate", url: ${JSON.stringify(targetUrl)} }), "*"); true;`
                          );
                        }
                      }
                    }
                  }}
                  scalesPageToFit={false}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  bounces={false}
                  directionalLockEnabled={true}
                  textZoom={100}
                  setBuiltInZoomControls={false}
                  setDisplayZoomControls={false}
                  mixedContentMode="compatibility"
                  onMessage={onWebMessage}
                  onShouldStartLoadWithRequest={onShouldStartLoad}
                  onNavigationStateChange={handleNavigationStateChange}
                  onLoadProgress={({ nativeEvent }) => {
                    if (nativeEvent.progress > 0.5) {
                      setLoading(false);
                    }
                  }}
                  onLoadEnd={() => setLoading(false)}
                  onError={({ nativeEvent }) => {
                    setLoading(false);
                    if (!webReadyRef.current) {
                      setLoadError(nativeEvent?.description ?? 'Failed to load page');
                    }
                  }}
                  onHttpError={({ nativeEvent }) => {
                    if (nativeEvent?.statusCode >= 500 && nativeEvent?.url?.includes('sparklingsilver.in')) {
                      setLoading(false);
                      setLoadError(`Server error (${nativeEvent.statusCode})`);
                    }
                  }}
                  style={styles.webview}
                />
              </View>

              {/* Native Orders History Screen */}
              {activeTab === 'orders' && (
                <View style={styles.ordersScreen}>
                  <Text style={styles.screenHeader}>Order History</Text>
                  {isOffline && (
                    <View style={styles.offlineBanner}>
                      <Text style={styles.offlineBannerText}>Viewing cached data offline</Text>
                    </View>
                  )}
                  {orders.length === 0 ? (
                    <View style={styles.emptyOrders}>
                      <Text style={styles.emptyText}>No orders found.</Text>
                      <Text style={styles.emptySub}>Browse the shop catalogue to assemble your first quotation request.</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={orders}
                      renderItem={renderOrderItem}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.ordersList}
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </View>
              )}
              
              {/* Screen Capture Block Overlay */}
              {captureShield && (
                <View style={styles.shield}>
                  <Text style={styles.shieldTitle}>
                    {captureShield === 'recording'
                      ? 'Screen recording is not allowed'
                      : 'Screen capture is not allowed'}
                  </Text>
                  <Text style={styles.shieldBody}>
                    To protect catalog designs, capturing or recording is blocked in this application.
                    {captureShield === 'recording'
                      ? ' Stop recording or AirPlay mirroring to continue.'
                      : ''}
                  </Text>
                </View>
              )}

              {/* Translucent Banner Notification */}
              {showLoginNotice && (
                <View style={styles.noticeBanner}>
                  <Text style={styles.noticeText}>
                    Screenshots are disabled to protect proprietary designs.
                  </Text>
                </View>
              )}

              {/* Loading Overlay */}
              {loading && activeTab === 'shop' && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color="#6D1F2E" />
                </View>
              )}
            </>
          )}
        </View>

        {/* Tab Navigation (Only visible when user is logged in) */}
        {session && !loadError && !isOffline && (
          <View style={styles.tabBar}>
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab('shop')}
              accessibilityRole="tab"
              accessibilityLabel="Shop Catalogue"
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'shop' ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                👜 Shop
              </Text>
            </Pressable>
            <Pressable
              style={styles.tabItem}
              onPress={() => setActiveTab('orders')}
              accessibilityRole="tab"
              accessibilityLabel="Order History"
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'orders' ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                📜 My Orders
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentContainer: { flex: 1, backgroundColor: '#ffffff' },
  tabContent: { flex: 1 },
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
    zIndex: 99999,
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
  noticeBanner: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  noticeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  retryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  
  // Native Orders Screen Styling
  ordersScreen: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    padding: 16,
  },
  screenHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6D1F2E',
    marginBottom: 16,
  },
  offlineBanner: {
    backgroundColor: '#FEF08A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  offlineBannerText: {
    fontSize: 12,
    color: '#713F12',
    fontWeight: '600',
    textAlign: 'center',
  },
  ordersList: {
    paddingBottom: 80,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  orderDate: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    paddingTop: 10,
  },
  orderTotalLabel: {
    fontSize: 14,
    color: '#4A5568',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6D1F2E',
  },
  emptyOrders: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Tab Bar navigation
  tabBar: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#6D1F2E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#D4AF37',
  },
  tabLabelInactive: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
