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

// Funzione per verificare periodicamente le notifiche programmate
function checkScheduledNotifications() {
  console.log('Service Worker: Verifica notifiche programmate', new Date().toLocaleString());
  
  const now = Date.now();
  
  // Carica le notifiche da IndexedDB
  loadScheduledNotifications()
    .then(() => {
      // Filtra le notifiche scadute
      const expiredNotifications = scheduledNotifications.filter(n => n.timestamp <= now);
      
      console.log(`Service Worker: Trovate ${expiredNotifications.length} notifiche scadute su ${scheduledNotifications.length} totali`);
      
      // Mostra le notifiche scadute
      expiredNotifications.forEach(notification => {
        // Verifica se è un giorno valido (se specificato nelle opzioni)
        let shouldShow = true;
        if (notification.options && notification.options.data && notification.options.data.days) {
          const today = new Date().getDay();
          shouldShow = notification.options.data.days.includes(today);
        }
        
        if (shouldShow) {
          console.log('Service Worker: Invio notifica programmata (verifica periodica)', notification.title);
          
          // Assicurati che le opzioni contengano i percorsi corretti per le icone
          if (notification.options) {
            const basePath = getBasePath();
            
            // Aggiorna i percorsi delle icone se necessario
            if (notification.options.icon && notification.options.icon.startsWith('./')) {
              notification.options.icon = basePath + notification.options.icon.substring(2);
            }
            if (notification.options.badge && notification.options.badge.startsWith('./')) {
              notification.options.badge = basePath + notification.options.badge.substring(2);
            }
            
            // Assicurati che ci siano i dati per l'URL
            notification.options.data = notification.options.data || {};
            notification.options.data.url = notification.options.data.url || basePath;
          }
          
          self.registration.showNotification(notification.title, notification.options)
            .catch(error => {
              console.error('Service Worker: Errore nell\'invio della notifica', error);
            });
        } else {
          console.log('Service Worker: Notifica non mostrata perché oggi non è un giorno valido');
        }
      });
      
      // Rimuovi le notifiche scadute
      if (expiredNotifications.length > 0) {
        scheduledNotifications = scheduledNotifications.filter(n => n.timestamp > now);
        saveScheduledNotifications();
      }
      
      // Pianifica il prossimo controllo
      scheduleNextCheck();
    })
    .catch(error => {
      console.error('Service Worker: Errore nel caricamento delle notifiche', error);
    });
}

// Funzione per pianificare il prossimo controllo delle notifiche
function scheduleNextCheck() {
  // Controlla ogni minuto quando il Service Worker è attivo
  setTimeout(checkScheduledNotifications, 60 * 1000);
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
      
      // Carica le notifiche programmate
      return loadScheduledNotifications();
    })
    .then(() => {
      console.log('Service Worker: Notifiche caricate, avvio controllo periodico');
      
      // Esegui un controllo immediato
      checkScheduledNotifications();
      
      // Registra un evento periodico per il controllo delle notifiche
      if ('periodicSync' in self.registration) {
        // Usa Periodic Sync API se disponibile
        try {
          self.registration.periodicSync.register('check-notifications', {
            minInterval: 15 * 60 * 1000 // Minimo 15 minuti (limitazione del browser)
          }).then(() => {
            console.log('Service Worker: Periodic Sync registrato');
          }).catch(error => {
            console.error('Service Worker: Errore nella registrazione di Periodic Sync', error);
            // Fallback a setInterval
            setInterval(checkScheduledNotifications, 5 * 60 * 1000);
          });
        } catch (error) {
          console.error('Service Worker: Errore nella registrazione di Periodic Sync', error);
          // Fallback a setInterval
          setInterval(checkScheduledNotifications, 5 * 60 * 1000);
        }
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
  // Gestisci le richieste HEAD separatamente
  if (event.request.method === 'HEAD') {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response('', { status: 200, statusText: 'OK' }))
    );
    return;
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
            if (response && response.status === 200 && response.type === 'basic' && 
                event.request.method !== 'HEAD') {
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

// Gestione delle notifiche push
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notifica push ricevuta');
  
  // Ottieni il percorso base per le icone
  const basePath = getBasePath();
  const iconPath = basePath + 'icons/icon-192x192.png';
  const badgePath = basePath + 'icons/icon-72x72.png';
  
  let notificationData = {};
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'Ore PWS',
        body: event.data.text(),
        icon: iconPath
      };
    }
  } else {
    notificationData = {
      title: 'Ore PWS',
      body: 'Ricordati di segnare le ore di oggi!',
      icon: iconPath
    };
  }
  
  const options = {
    body: notificationData.body || 'Ricordati di segnare le ore di oggi!',
    icon: notificationData.icon || iconPath,
    badge: badgePath,
    tag: notificationData.tag || 'ore-pws-reminder',
    data: notificationData.data || { url: basePath },
    requireInteraction: true,
    actions: [
      {
        action: 'open-app',
        title: 'Apri App'
      },
      {
        action: 'dismiss',
        title: 'Chiudi'
      }
    ],
    // Vibrazione personalizzata per attirare l'attenzione
    vibrate: [100, 50, 100, 50, 100]
  };
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'Ore PWS', options)
  );
});

// Gestione del click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Click su notifica', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
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

// Funzione per programmare una notifica
function scheduleNotification(title, options, timestamp) {
  // Calcola il tempo di attesa
  const now = Date.now();
  const timeToWait = Math.max(0, timestamp - now);
  
  console.log(`Service Worker: Programmazione notifica per ${new Date(timestamp).toLocaleString('it-IT')}, attesa di ${Math.round(timeToWait / 1000 / 60)} minuti`);
  
  // Se il tempo è già passato, mostra subito la notifica
  if (timeToWait <= 0) {
    // Verifica se è un giorno valido (se specificato nelle opzioni)
    let shouldShow = true;
    if (options.data && options.data.days) {
      const today = new Date().getDay();
      shouldShow = options.data.days.includes(today);
    }
    
    if (shouldShow) {
      self.registration.showNotification(title, options);
    } else {
      console.log('Service Worker: Notifica non mostrata perché oggi non è un giorno valido');
    }
    return;
  }
  
  // Aggiungi la notifica all'elenco delle notifiche programmate
  const notificationData = {
    title,
    options,
    timestamp,
    created: Date.now()
  };
  
  // Verifica se esiste già una notifica simile
  const existingIndex = scheduledNotifications.findIndex(n => 
    n.timestamp === timestamp && 
    n.title === title && 
    (n.options.tag === options.tag || (!n.options.tag && !options.tag))
  );
  
  if (existingIndex >= 0) {
    // Aggiorna la notifica esistente
    scheduledNotifications[existingIndex] = notificationData;
    console.log('Service Worker: Aggiornata notifica esistente');
  } else {
    // Aggiungi la nuova notifica
    scheduledNotifications.push(notificationData);
    console.log('Service Worker: Aggiunta nuova notifica');
  }
  
  // Salva le notifiche programmate
  saveScheduledNotifications()
    .then(() => {
      console.log('Service Worker: Notifiche salvate con successo');
      
      // Invia un messaggio a tutti i client per confermare la programmazione
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_SCHEDULED',
            timestamp: timestamp
          });
        });
      });
    })
    .catch(error => {
      console.error('Service Worker: Errore nel salvataggio delle notifiche', error);
    });
  
  // Pianifica un controllo immediato se il tempo di attesa è breve (meno di 5 minuti)
  if (timeToWait < 5 * 60 * 1000) {
    setTimeout(() => {
      checkScheduledNotifications();
    }, timeToWait + 1000); // Aggiungi 1 secondo per sicurezza
  }
  
  return timestamp; // Usa il timestamp come ID
}

// Gestione delle notifiche programmate
self.addEventListener('message', (event) => {
  console.log('Service Worker: Messaggio ricevuto', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, options, timestamp } = event.data;
    
    // Ottieni il percorso base per le icone
    const basePath = getBasePath();
    
    // Aggiorna i percorsi delle icone per GitHub Pages
    if (options.icon && options.icon.startsWith('./')) {
      options.icon = basePath + options.icon.substring(2);
    }
    if (options.badge && options.badge.startsWith('./')) {
      options.badge = basePath + options.badge.substring(2);
    }
    
    // Aggiungi i giorni della settimana alle opzioni se presenti
    if (event.data.days) {
      options.data = options.data || {};
      options.data.days = event.data.days;
    }
    
    // Aggiungi l'URL base alle opzioni
    options.data = options.data || {};
    options.data.url = basePath;
    
    // Programma la notifica
    scheduleNotification(title, options, timestamp);
    
    // Conferma la ricezione del messaggio
    if (event.source) {
      event.source.postMessage({
        type: 'NOTIFICATION_SCHEDULED',
        timestamp: timestamp
      });
    }
  }
  
  // Gestione della cancellazione delle notifiche
  if (event.data && event.data.type === 'CANCEL_NOTIFICATIONS') {
    console.log('Service Worker: Cancellazione notifiche richiesta');
    
    // Cancella tutte le notifiche programmate
    scheduledNotifications = [];
    saveScheduledNotifications();
    
    // Conferma la cancellazione
    if (event.source) {
      event.source.postMessage({
        type: 'NOTIFICATIONS_CANCELLED'
      });
    }
  }
  
  // Gestione della richiesta di test delle notifiche
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    console.log('Service Worker: Test notifica richiesto');
    
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
});
