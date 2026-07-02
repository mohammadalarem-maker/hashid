// Firebase Messaging Service Worker (FCM SW)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// The worker can read configurations dynamically or fall back safely.
// Initializing with standard configuration placeholder values. We can also dynamically intercept or register.
const defaultFirebaseConfig = {
  apiKey: "mock_api_key_fcm_sw_placeholder_safe",
  authDomain: "alhosam-phone.firebaseapp.com",
  projectId: "alhosam-phone",
  storageBucket: "alhosam-phone.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:mockappid0123"
};

try {
  // Let the browser load the configuration. In production environments, client register steps pass config via search params or register config.
  const urlParams = new URL(location).searchParams;
  const configParam = urlParams.get('config');
  const firebaseConfig = configParam ? JSON.parse(decodeURIComponent(configParam)) : defaultFirebaseConfig;

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);
    const notificationTitle = payload.notification?.title || 'تنبيه نظام الحسام فون';
    const notificationOptions = {
      body: payload.notification?.body || 'لديك إشعار نظام معلق بحاجة للمراجعة.',
      icon: '/assets/images/app_icon_1781726496895.jpg',
      badge: '/assets/images/app_icon_1781726496895.jpg',
      data: payload.data,
      dir: 'rtl',
      tag: payload.data?.type || 'general_alert',
      renotify: true
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.error('Error in FCM Service Worker initialization:', e);
}

// Intercept clicks on notifications to open or focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
