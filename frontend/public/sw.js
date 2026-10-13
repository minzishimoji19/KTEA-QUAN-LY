// KTEA CRM - Web Push Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'KTEA CRM', body: event.data.text() };
    }
  }

  const title = data.title || 'KTEA CRM — Thông báo';
  const options = {
    body: data.body || 'Bạn có thông báo mới từ KTEA CRM.',
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: data.tag || `ktea-notification-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              return client.navigate(targetUrl);
            }
            return client;
          }
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
