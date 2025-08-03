// Service Worker per Ore PWS - Versione base per GitHub Pages
const CACHE_NAME = 'ore-pws-cache-v1';

// Ottieni il percorso base per GitHub Pages
const getBasePath = () => {
  return self.location.pathname.replace(/\/[^\/]*$/, '/');
};

// Crea URL relativi al percorso base
const urlsToCache = [
  getBasePath(),
  getBasePath() + 'index.html',
  getBasePath() + 'manifest.json',
  getBasePath() + 'icons/icon-72x72.png',
  getBasePath() + 'icons/icon-96x96.png',
  getBasePath() + 'icons/icon-128x128.png',
  getBasePath() + 'icons/icon-144x144.png',
  getBasePath() + 'icons/icon-152x152.png',
  getBasePath() + 'icons/icon-192x192.png',
  getBasePath() + 'icons/icon-384x384.png',
  getBasePath() + 'icons/icon-512x512.png'
];



// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installazione in corso');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installazione completata');
        return self.skipWaiting(); // Forza l'attivazione immediata
      })
  );
});

// Funzione segnaposto per retrocompatibilità - Notifiche disabilitate
function checkScheduledNotifications() {
  console.log('Service Worker: Funzionalità notifiche disabilitata');
}

// Funzione segnaposto per retrocompatibilità - Notifiche disabilitate
function scheduleNextCheck() {
  // Non fa nulla - funzionalità disabilitata
}

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Attivazione in corso');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Rimozione vecchia cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Attivazione completata');
      
      // Funzione segnaposto per retrocompatibilità - Notifiche disabilitate
      function loadScheduledNotifications() {
        console.log('Service Worker: Caricamento notifiche disabilitato');
        return Promise.resolve(); // Restituisce una promessa risolta
      }
      
      // Carica le notifiche programmate (funzione disabilitata)
      return loadScheduledNotifications();
    })
    .then(() => {
      console.log('Service Worker: Notifiche caricate, avvio controllo periodico');
      
      // Esegui un controllo immediato
      checkScheduledNotifications();
      
      // Registra un evento periodico per il controllo delle notifiche
      if ('periodicSync' in self.registration) {
        // Verifica se il permesso è già stato concesso
        self.registration.periodicSync.getTags()
          .then(tags => {
            // Se non ci sono tag registrati, prova a registrarne uno nuovo
            if (!tags.includes('check-notifications')) {
              console.log('Service Worker: Tentativo di registrazione Periodic Sync');
              
              // Usa Periodic Sync API se disponibile
              return self.registration.periodicSync.register('check-notifications', {
                minInterval: 15 * 60 * 1000 // Minimo 15 minuti (limitazione del browser)
              });
            }
            return Promise.resolve();
          })
          .then(() => {
            console.log('Service Worker: Periodic Sync registrato con successo');
          })
          .catch(error => {
            // Gestione specifica per errori di permesso
            if (error.name === 'NotAllowedError') {
              console.log('Service Worker: Permesso per Periodic Sync negato. Questo è normale su GitHub Pages o se il sito non è installato come PWA.');
              console.log('Service Worker: Utilizzo fallback con setInterval');
            } else {
              console.error('Service Worker: Errore nella registrazione di Periodic Sync', error);
            }
            // Fallback a setInterval in ogni caso di errore
            setInterval(checkScheduledNotifications, 5 * 60 * 1000);
          });
      } else {
        // Fallback a setInterval
        console.log('Service Worker: Periodic Sync non supportato, uso setInterval');
        setInterval(checkScheduledNotifications, 5 * 60 * 1000);
      }
      
      return self.clients.claim(); // Prendi il controllo di tutti i client
    })
  );
});

// Gestione dell'evento periodic sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    console.log('Service Worker: Periodic Sync - controllo notifiche');
    event.waitUntil(checkScheduledNotifications());
  }
});

// Gestione dell'evento di skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Richiesta di skip waiting ricevuta');
    self.skipWaiting();
  }
});

// Gestione delle richieste di rete
self.addEventListener('fetch', (event) => {
  // Ignora le richieste HEAD che non possono essere memorizzate nella cache
  if (event.request.method === 'HEAD') {
    return; // Non gestire le richieste HEAD
  }
  
  // Strategia Cache First con fallback su rete
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Memorizza nella cache solo se è una risposta valida e non è una richiesta HEAD
            if (response && response.status === 200 && response.type === 'basic' && event.request.method !== 'HEAD') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  try {
                    cache.put(event.request, responseToCache);
                  } catch (error) {
                    console.error('Errore durante la memorizzazione nella cache:', error);
                  }
                });
            }
            return response;
          })
          .catch(() => {
            // Fallback per pagine offline
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return null;
          });
      })
  );
});

// Gestione delle notifiche push - Disabilitata ma mantenuta per compatibilità
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notifica push ricevuta ma funzionalità disabilitata');
  // Non mostra più notifiche per migliorare le prestazioni
});

// Gestione del click sulle notifiche - Mantenuta per compatibilità
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Click su notifica', event.notification.tag);
  event.notification.close();
  
  // Ottieni l'URL da aprire
  const basePath = getBasePath();
  let urlToOpen = basePath;
  
  // Se la notifica contiene un URL specifico, usalo
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }
  
  // Apri l'app quando l'utente clicca sulla notifica
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Verifica se c'è già una finestra aperta
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          console.log('Service Worker: Apertura nuova finestra con URL:', urlToOpen);
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Funzione segnaposto per retrocompatibilità - Notifiche disabilitate
function scheduleNotification(title, options, timestamp) {
  console.log('Service Worker: Funzionalità notifiche disabilitata');
  return timestamp; // Mantiene la stessa interfaccia per retrocompatibilità
}

// Gestione dei messaggi
self.addEventListener('message', (event) => {
  console.log('Service Worker: Messaggio ricevuto', event.data);
  
  // Gestione dello skip waiting
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Richiesta di skip waiting ricevuta');
    self.skipWaiting();
  }
  
  // Rispondi ai messaggi di notifica con un messaggio di funzionalità disabilitata
  if (event.data && (
      event.data.type === 'SCHEDULE_NOTIFICATION' || 
      event.data.type === 'CANCEL_NOTIFICATIONS' || 
      event.data.type === 'TEST_NOTIFICATION')) {
    
    console.log('Service Worker: Richiesta di notifica ricevuta ma funzionalità disabilitata');
    
    // Invia un messaggio di risposta per evitare che il client rimanga in attesa
    if (event.source) {
      event.source.postMessage({
        type: 'NOTIFICATION_DISABLED',
        message: 'La funzionalità di notifica è stata disabilitata per migliorare le prestazioni'
      });
    }
    
    // Gestione specifica per il test delle notifiche (per retrocompatibilità)
    if (event.data.type === 'TEST_NOTIFICATION') {
      // Ottieni il percorso base per le icone
      const basePath = getBasePath();
      const iconPath = basePath + 'icons/icon-192x192.png';
      const badgePath = basePath + 'icons/icon-72x72.png';
      
      const options = {
        body: 'Questa è una notifica di test. Se la vedi, le notifiche funzionano correttamente!',
        icon: iconPath,
        badge: badgePath,
        tag: 'ore-pws-test',
        requireInteraction: true,
        vibrate: [100, 50, 100],
        data: {
          url: basePath,
          test: true
        },
        actions: [
          {
            action: 'open-app',
            title: 'Apri App'
          },
          {
            action: 'dismiss',
            title: 'Chiudi'
          }
        ]
      };
      
      self.registration.showNotification('Test Notifica Ore PWS', options)
        .then(() => {
          if (event.source) {
            event.source.postMessage({
              type: 'TEST_NOTIFICATION_SENT',
              success: true
            });
          }
        })
        .catch(error => {
          console.error('Service Worker: Errore nel test della notifica', error);
          if (event.source) {
            event.source.postMessage({
              type: 'TEST_NOTIFICATION_SENT',
              success: false,
              error: error.message
            });
          }
        });
    }
  }
});
