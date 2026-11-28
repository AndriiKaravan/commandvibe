// Web push service worker. The config below is the public web config of the
// commandvibe-ks Firebase project, the same as in lib/core/app_config.dart.
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDOmyJ7nQnR4c9uYRAFi24etu0yqWUteJs',
  appId: '1:889388170734:web:d0ee567d6dd598c4cce2ff',
  messagingSenderId: '889388170734',
  projectId: 'commandvibe-ks',
  storageBucket: 'commandvibe-ks.firebasestorage.app',
});

// Notification messages are shown by the SDK while no tab is in focus.
firebase.messaging();

// The server sends only an in-app route; open or focus the app there.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data && event.notification.data.FCM_MSG;
  const route = payload && payload.data && payload.data.route;
  if (typeof route !== 'string' || !route.startsWith('/g/')) {
    return;
  }
  const target = new URL(route, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
