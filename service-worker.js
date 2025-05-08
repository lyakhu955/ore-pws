// Nome della cache
const CACHE_NAME = 'ore-pws-cache-v3';

// Percorso base del repository GitHub Pages
const REPO_NAME = 'ore-pws';

// Versione della cache - incrementare quando si aggiornano i file
const CACHE_VERSION = '3';

// Timestamp per forzare aggiornamenti frequenti durante lo sviluppo
const CACHE_TIMESTAMP = new Date().getTime();

// Funzione per ottenere il percorso corretto in base all'ambiente
function getPath(path) {
  // Rimuovi il punto iniziale se presente
  if (path.startsWith('./')) {
    path = path.substring(2);
  } else if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // In ambiente di sviluppo locale
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return './' + path;
  }
  
  // In GitHub Pages
  return '/' + REPO_NAME + '/' + path;
}

// File da mettere in cache
const urlsToCache = [
  getPath('./'),
  getPath('./index.html'),
  getPath('./manifest.json'),
  getPath('./pwa-head.html'),
  getPath('./icons/icon-72x72.png'),
  getPath('./icons/icon-96x96.png'),
  getPath('./icons/icon-128x128.png'),
  getPath('./icons/icon-144x144.png'),
  getPath('./icons/icon-152x152.png'),
  getPath('./icons/icon-192x192.png'),
  getPath('./icons/icon-384x384.png'),
  getPath('./icons/icon-512x512.png'),
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js'
];

// Installazione del service worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installazione in corso');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installazione completata');
        return self.skipWaiting(); // Forza l'attivazione immediata
      })
  );
});

// Attivazione del service worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Attivazione in corso');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('Service Worker: Pulizia delle cache vecchie');
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Elimina le cache vecchie
            console.log('Service Worker: Eliminazione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Attivazione completata, prendendo il controllo');
      return self.clients.claim(); // Prende il controllo di tutte le pagine aperte
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', event => {
  // Per le richieste HTML, usa la strategia "Network First, Cache Fallback"
  if (event.request.url.includes('index.html') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clona la risposta
          const responseToCache = response.clone();
          
          // Aggiorna la cache con la nuova versione
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        })
        .catch(() => {
          // Se la rete fallisce, usa la cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Se non c'è nulla in cache, prova con la pagina principale
              return caches.match(getPath('./index.html'));
            });
        })
    );
    return;
  }
  
  // Per tutte le altre richieste, usa la strategia "Cache First, Network Fallback"
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          // Prova comunque ad aggiornare la cache in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, networkResponse.clone());
                  });
              }
            })
            .catch(() => {
              // Ignora errori di rete per aggiornamenti in background
            });
            
          return response;
        }

        // Clona la richiesta
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then(response => {
            // Controlla se abbiamo ricevuto una risposta valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Aggiungi la risposta alla cache
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Se la rete fallisce, prova a servire la pagina offline
            if (event.request.mode === 'navigate') {
              return caches.match(getPath('./index.html'));
            }
          });
      })
  );
});// Nome della cache
const CACHE_NAME = 'ore-pws-cache-v3';

// Percorso base del repository GitHub Pages
const REPO_NAME = 'ore-pws';

// Funzione per ottenere il percorso corretto in base all'ambiente
function getPath(path) {
  // Rimuovi il punto iniziale se presente
  if (path.startsWith('./')) {
    path = path.substring(2);
  } else if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // In ambiente di sviluppo locale
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return './' + path;
  }
  
  // In GitHub Pages
  return '/' + REPO_NAME + '/' + path;
}

// File da mettere in cache
const urlsToCache = [
  getPath('./'),
  getPath('./index.html'),
  getPath('./manifest.json'),
  getPath('./pwa-head.html'),
  getPath('./icons/icon-72x72.png'),
  getPath('./icons/icon-96x96.png'),
  getPath('./icons/icon-128x128.png'),
  getPath('./icons/icon-144x144.png'),
  getPath('./icons/icon-152x152.png'),
  getPath('./icons/icon-192x192.png'),
  getPath('./icons/icon-384x384.png'),
  getPath('./icons/icon-512x512.png'),
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js'
];

// Installazione del service worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installazione in corso');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installazione completata');
        return self.skipWaiting(); // Forza l'attivazione immediata
      })
  );
});

// Attivazione del service worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Attivazione in corso');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('Service Worker: Pulizia delle cache vecchie');
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Elimina le cache vecchie
            console.log('Service Worker: Eliminazione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Attivazione completata, prendendo il controllo');
      return self.clients.claim(); // Prende il controllo di tutte le pagine aperte
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

        // Clona la richiesta
        const fetchRequest = event.request.clone();

        // Fai la richiesta di rete
        return fetch(fetchRequest)
          .then(response => {
            // Controlla se abbiamo ricevuto una risposta valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta
            const responseToCache = response.clone();

            // Aggiungi la risposta alla cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});
