// Nome della cache
const CACHE_NAME = 'ore-pws-cache-v1';

// Percorso base per GitHub Pages
const BASE_PATH = '/ore-pws';

// File da mettere in cache
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icons/icon-72x72.png`,
  `${BASE_PATH}/icons/icon-96x96.png`,
  `${BASE_PATH}/icons/icon-128x128.png`,
  `${BASE_PATH}/icons/icon-144x144.png`,
  `${BASE_PATH}/icons/icon-152x152.png`,
  `${BASE_PATH}/icons/icon-192x192.png`,
  `${BASE_PATH}/icons/icon-384x384.png`,
  `${BASE_PATH}/icons/icon-512x512.png`,
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
];

// Installazione del Service Worker
self.addEventListener('install', event => {
  // Esegui l'installazione in modo asincrono
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Elimina le cache vecchie che non sono nella whitelist
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          return response;
        }
        
        // Clona la richiesta perché è un flusso che può essere consumato solo una volta
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Controlla se abbiamo ricevuto una risposta valida
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona la risposta perché è un flusso che può essere consumato solo una volta
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Aggiungi la risposta alla cache
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        );
      })
  );
});// Nome della cache
const CACHE_NAME = 'ore-pws-cache-v1';

// File da mettere in cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css'
];

// Installazione del Service Worker
self.addEventListener('install', event => {
  // Esegui l'installazione in modo asincrono
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Elimina le cache vecchie che non sono nella whitelist
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          return response;
        }
        
        // Clona la richiesta perché è un flusso che può essere consumato solo una volta
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Controlla se abbiamo ricevuto una risposta valida
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona la risposta perché è un flusso che può essere consumato solo una volta
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Aggiungi la risposta alla cache
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        );
      })
  );
});