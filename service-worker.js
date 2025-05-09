// Service Worker per Ore PWS
const CACHE_NAME = 'ore-pws-cache-v1';
const urlsToCache = [
  '/ore-pws/',
  '/ore-pws/index.html',
  '/ore-pws/manifest.json',
  '/ore-pws/icons/icon-192x192.png',
  '/ore-pws/icons/icon-512x512.png'
];

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Gestione delle notifiche
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Apri l'app quando l'utente clicca sulla notifica
  event.waitUntil(
    clients.matchAll({type: 'window'}).then((clientList) => {
      // Se c'è già una finestra aperta, focalizzala
      for (const client of clientList) {
        if (client.url.includes('/ore-pws/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (clients.openWindow) {
        return clients.openWindow('/ore-pws/');
      }
    })
  );
});

// Gestione dei messaggi dal client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, options, timestamp } = event.data;
    
    // Calcola il tempo di attesa
    const timeToWait = timestamp - Date.now();
    
    // Se il tempo è già passato, mostra subito la notifica
    if (timeToWait <= 0) {
      self.registration.showNotification(title, options);
      return;
    }
    
    // Altrimenti pianifica la notifica
    setTimeout(() => {
      self.registration.showNotification(title, options);
    }, timeToWait);
  }
});
