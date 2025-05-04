// google-auth.js - Sistema di autenticazione Google semplificato

// Configurazione
const CLIENT_ID = '927051615660-tfhk7s28v2ni4nsbmlbimaon5mg582o8.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file openid profile email';

// Variabili di stato
let tokenClient = null;
let isLoggedIn = false;
let currentUser = null;
let userPhotoUrl = null;
let userEmail = null;
let tokenRefreshTimer = null;

// Inizializza il client di autenticazione Google
function initGoogleAuth() {
  console.log('Inizializzazione Google Auth...');
  
  // Carica le librerie Google necessarie
  loadGoogleLibraries()
    .then(() => {
      console.log('Librerie Google caricate con successo');
      
      // Inizializza il client di token
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
        error_callback: handleTokenError
      });
      
      // Verifica se c'è già un token salvato
      checkSavedToken();
    })
    .catch(error => {
      console.error('Errore durante il caricamento delle librerie Google:', error);
    });
}

// Carica le librerie Google necessarie
function loadGoogleLibraries() {
  return new Promise((resolve, reject) => {
    // Verifica se le librerie sono già caricate
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      resolve();
      return;
    }
    
    // Carica la libreria Google Identity Services
    const script1 = document.createElement('script');
    script1.src = 'https://accounts.google.com/gsi/client';
    script1.onload = () => {
      // Carica la libreria Google API Client
      const script2 = document.createElement('script');
      script2.src = 'https://apis.google.com/js/api.js';
      script2.onload = () => {
        // Inizializza la libreria gapi
        gapi.load('client', () => {
          gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
          }).then(() => {
            resolve();
          }).catch(error => {
            reject(error);
          });
        });
      };
      script2.onerror = () => reject(new Error('Impossibile caricare Google API Client'));
      document.head.appendChild(script2);
    };
    script1.onerror = () => reject(new Error('Impossibile caricare Google Identity Services'));
    document.head.appendChild(script1);
  });
}

// Gestisce la risposta del token
function handleTokenResponse(response) {
  console.log('Token response ricevuta:', response);
  
  if (response && response.access_token) {
    // Salva il token
    const tokenData = {
      access_token: response.access_token,
      expires_at: Date.now() + (response.expires_in * 1000)
    };
    
    localStorage.setItem('googleAuthToken', JSON.stringify(tokenData));
    console.log('Token salvato nel localStorage');
    
    // Imposta il token per le richieste API
    gapi.client.setToken({
      access_token: response.access_token
    });
    
    // Ottieni informazioni sull'utente
    fetchUserInfo(response.access_token)
      .then(userData => {
        isLoggedIn = true;
        currentUser = userData;
        userEmail = userData.email;
        userPhotoUrl = userData.picture;
        
        // Salva le informazioni dell'utente
        localStorage.setItem('googleUserInfo', JSON.stringify(userData));
        
        // Aggiorna l'interfaccia utente
        updateUI(true);
        
        // Imposta il timer per il refresh del token
        setupTokenRefresh(tokenData.expires_at);
        
        // Mostra un messaggio di successo
        showToast('Accesso effettuato con successo!', 'success');
      })
      .catch(error => {
        console.error('Errore durante il recupero delle informazioni utente:', error);
        showToast('Errore durante il recupero delle informazioni utente', 'error');
      });
  } else {
    console.warn('Token non valido ricevuto');
    showToast('Errore durante l\'accesso. Riprova più tardi.', 'error');
  }
}

// Gestisce gli errori del token
function handleTokenError(error) {
  console.error('Errore durante l\'ottenimento del token:', error);
  showToast('Errore durante l\'accesso. Riprova più tardi.', 'error');
}

// Ottieni informazioni sull'utente
async function fetchUserInfo(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Errore durante il recupero delle informazioni utente:', error);
    throw error;
  }
}

// Verifica se c'è un token salvato
function checkSavedToken() {
  const savedTokenStr = localStorage.getItem('googleAuthToken');
  const savedUserInfo = localStorage.getItem('googleUserInfo');
  
  if (savedTokenStr && savedUserInfo) {
    try {
      const tokenData = JSON.parse(savedTokenStr);
      const userData = JSON.parse(savedUserInfo);
      
      // Verifica se il token è ancora valido
      if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
        console.log('Token valido trovato, ripristino sessione...');
        
        // Imposta il token per le richieste API
        gapi.client.setToken({
          access_token: tokenData.access_token
        });
        
        // Ripristina le informazioni dell'utente
        isLoggedIn = true;
        currentUser = userData;
        userEmail = userData.email;
        userPhotoUrl = userData.picture;
        
        // Aggiorna l'interfaccia utente
        updateUI(true);
        
        // Imposta il timer per il refresh del token
        setupTokenRefresh(tokenData.expires_at);
        
        // Verifica che il token sia effettivamente valido facendo una richiesta
        validateToken(tokenData.access_token)
          .then(isValid => {
            if (!isValid) {
              console.log('Token non valido, richiedo nuovo token...');
              requestNewToken();
            } else {
              console.log('Sessione ripristinata con successo');
              showToast('Sessione ripristinata', 'info');
            }
          })
          .catch(() => {
            console.log('Errore durante la validazione del token, richiedo nuovo token...');
            requestNewToken();
          });
      } else {
        console.log('Token scaduto, richiedo nuovo token...');
        requestNewToken();
      }
    } catch (error) {
      console.error('Errore durante il parsing del token salvato:', error);
      clearAuthData();
    }
  } else {
    console.log('Nessun token salvato trovato');
    updateUI(false);
  }
}

// Valida il token facendo una richiesta di prova
async function validateToken(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Errore durante la validazione del token:', error);
    return false;
  }
}

// Richiedi un nuovo token
function requestNewToken() {
  // Pulisci i dati di autenticazione
  clearAuthData();
  
  // Richiedi un nuovo token solo se l'utente interagisce con la pagina
  // Non possiamo richiedere automaticamente un nuovo token senza interazione utente
  console.log('In attesa di interazione utente per richiedere un nuovo token...');
}

// Effettua il login con Google
function loginWithGoogle() {
  if (!tokenClient) {
    console.error('Client di token non inizializzato');
    showToast('Errore durante l\'inizializzazione. Riprova più tardi.', 'error');
    return;
  }
  
  console.log('Richiesta token di accesso...');
  tokenClient.requestAccessToken();
}

// Effettua il logout
function logoutFromGoogle() {
  if (!isLoggedIn) {
    console.log('Utente già disconnesso');
    return;
  }
  
  console.log('Tentativo di logout...');
  
  // Pulisci i dati di autenticazione prima di tutto
  clearAuthData();
  
  // Aggiorna direttamente l'interfaccia utente senza chiamare updateUI
  try {
    // Aggiorna il pulsante di login nella barra di navigazione
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
      loginButton.style.display = '';
    }
    
    // Aggiorna i pulsanti di login
    const loginButtonsContainer = document.getElementById('loginButtonsContainer');
    if (loginButtonsContainer) {
      loginButtonsContainer.style.display = 'flex';
    }
    
    // Aggiorna le informazioni dell'account
    const accountSection = document.getElementById('cloudAccountSection');
    const accountInfo = document.getElementById('cloudAccountInfo');
    const logoutBtn = document.getElementById('cloudLogoutBtn');
    
    if (accountSection) {
      accountSection.style.display = 'none';
    }
    
    if (accountInfo) {
      accountInfo.innerHTML = '';
    }
    
    if (logoutBtn) {
      logoutBtn.style.display = 'none';
    }
  } catch (uiError) {
    console.error('Errore durante l\'aggiornamento dell\'interfaccia utente:', uiError);
  }
  
  // Mostra un messaggio di successo
  try {
    console.log('Disconnessione effettuata con successo');
    
    // Usa console.log come fallback sicuro
    console.log('INFO: Disconnessione effettuata con successo');
    
    // Crea un toast manualmente senza usare la funzione showToast
    try {
      const toast = document.createElement('div');
      toast.className = 'toast toast-info';
      toast.textContent = 'Disconnessione effettuata con successo';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.padding = '10px 20px';
      toast.style.borderRadius = '4px';
      toast.style.backgroundColor = '#2196F3';
      toast.style.color = 'white';
      toast.style.zIndex = '10000';
      toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      
      // Aggiungi il toast al documento
      document.body.appendChild(toast);
      
      // Rimuovi il toast dopo 3 secondi
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    } catch (toastError) {
      console.error('Errore durante la creazione del toast:', toastError);
    }
  } catch (error) {
    console.error('Errore durante la visualizzazione del messaggio di logout:', error);
  }
  
  // Ottieni il token corrente e revocalo in background
  try {
    const savedTokenStr = localStorage.getItem('googleAuthToken');
    if (savedTokenStr && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      try {
        const tokenData = JSON.parse(savedTokenStr);
        
        // Revoca il token in background
        google.accounts.oauth2.revoke(tokenData.access_token, done => {
          console.log('Revoca token completata:', done);
        });
      } catch (error) {
        console.error('Errore durante la revoca del token:', error);
      }
    }
  } catch (error) {
    console.error('Errore durante il processo di revoca del token:', error);
  }
}

// Pulisci i dati di autenticazione
function clearAuthData() {
  // Rimuovi il token e le informazioni utente dal localStorage
  localStorage.removeItem('googleAuthToken');
  localStorage.removeItem('googleUserInfo');
  
  // Resetta le variabili di stato
  isLoggedIn = false;
  currentUser = null;
  userEmail = null;
  userPhotoUrl = null;
  
  // Cancella il timer di refresh del token
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  
  // Resetta il token per le richieste API
  if (gapi && gapi.client) {
    gapi.client.setToken(null);
  }
}

// Imposta il timer per il refresh del token
function setupTokenRefresh(expiresAt) {
  // Cancella il timer esistente
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  
  // Calcola il tempo rimanente prima della scadenza del token
  const timeRemaining = expiresAt - Date.now();
  
  // Imposta il timer per richiedere un nuovo token 5 minuti prima della scadenza
  const refreshTime = Math.max(0, timeRemaining - (5 * 60 * 1000));
  
  console.log(`Token scadrà tra ${Math.round(timeRemaining / 60000)} minuti, refresh programmato tra ${Math.round(refreshTime / 60000)} minuti`);
  
  // Imposta il timer
  tokenRefreshTimer = setTimeout(() => {
    console.log('Timer di refresh del token attivato');
    
    // Mostra un messaggio all'utente
    showToast('La sessione sta per scadere. Clicca qui per continuare.', 'warning', 0, () => {
      loginWithGoogle();
    });
  }, refreshTime);
}

// Aggiorna l'interfaccia utente
function updateUI(isAuthenticated) {
  try {
    // Aggiorna il pulsante di login nella barra di navigazione
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
      if (isAuthenticated) {
        loginButton.style.display = 'none';
      } else {
        loginButton.style.display = '';
      }
    }
    
    // Aggiorna i pulsanti di login
    const loginButtonsContainer = document.getElementById('loginButtonsContainer');
    if (loginButtonsContainer) {
      if (isAuthenticated) {
        loginButtonsContainer.style.display = 'none';
      } else {
        loginButtonsContainer.style.display = 'flex';
      }
    }
    
    // Aggiorna le informazioni dell'account
    const accountSection = document.getElementById('cloudAccountSection');
    const accountInfo = document.getElementById('cloudAccountInfo');
    const logoutBtn = document.getElementById('cloudLogoutBtn');
    
    if (accountSection && accountInfo && logoutBtn) {
      if (isAuthenticated && currentUser) {
        accountSection.style.display = 'block';
        
        accountInfo.innerHTML = `
          <div class="user-profile">
            ${currentUser.picture ? `<img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar">` : ''}
            <div class="user-details">
              <div class="user-name">${currentUser.name}</div>
              <div class="user-email">${currentUser.email}</div>
            </div>
          </div>
        `;
        
        logoutBtn.style.display = 'flex';
        // Assegna la funzione di logout direttamente, senza usare logoutFromGoogle
        logoutBtn.onclick = function() {
          // Pulisci i dati di autenticazione
          localStorage.removeItem('googleAuthToken');
          localStorage.removeItem('googleUserInfo');
          
          // Reimposta le variabili globali
          isLoggedIn = false;
          currentUser = null;
          
          // Aggiorna l'interfaccia utente
          if (loginButton) loginButton.style.display = '';
          if (loginButtonsContainer) loginButtonsContainer.style.display = 'flex';
          if (accountSection) accountSection.style.display = 'none';
          if (accountInfo) accountInfo.innerHTML = '';
          if (logoutBtn) logoutBtn.style.display = 'none';
          
          // Mostra un messaggio di successo
          console.log('Disconnessione effettuata con successo');
          
          // Crea un toast manualmente
          try {
            const toast = document.createElement('div');
            toast.className = 'toast toast-info';
            toast.textContent = 'Disconnessione effettuata con successo';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.backgroundColor = '#2196F3';
            toast.style.color = 'white';
            toast.style.zIndex = '10000';
            toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            
            // Aggiungi il toast al documento
            document.body.appendChild(toast);
            
            // Rimuovi il toast dopo 3 secondi
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 3000);
          } catch (toastError) {
            console.error('Errore durante la creazione del toast:', toastError);
          }
          
          // Revoca il token in background
          try {
            const savedTokenStr = localStorage.getItem('googleAuthToken');
            if (savedTokenStr && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
              const tokenData = JSON.parse(savedTokenStr);
              google.accounts.oauth2.revoke(tokenData.access_token, done => {
                console.log('Revoca token completata:', done);
              });
            }
          } catch (error) {
            console.error('Errore durante la revoca del token:', error);
          }
        };
      } else {
        accountSection.style.display = 'none';
        accountInfo.innerHTML = '';
        logoutBtn.style.display = 'none';
      }
    }
    
    // Non chiamiamo più updateCloudAccountUI da qui per evitare ricorsione
    // Invece, aggiorniamo direttamente gli elementi dell'interfaccia utente
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'interfaccia utente:', error);
  }
}

// Mostra un toast
function showToast(message, type = 'info', duration = 3000, onClick = null) {
  // Verifica se esiste già una funzione showToast globale
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    // Usa la funzione globale se esiste ed è diversa da questa
    window.showToast(message, type, duration, onClick);
    return;
  }
  
  // Verifica se esiste la funzione showToastGlobal
  if (typeof window.showToastGlobal === 'function') {
    window.showToastGlobal(message, type, duration);
    return;
  }
  
  // Implementazione di fallback se nessuna funzione globale è disponibile
  try {
    // Crea un elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                                 type === 'error' ? '#F44336' : 
                                 type === 'warning' ? '#FF9800' : '#2196F3';
    toast.style.color = 'white';
    toast.style.zIndex = '10000';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.cursor = onClick ? 'pointer' : 'default';
    
    // Aggiungi l'evento click
    if (onClick) {
      toast.addEventListener('click', onClick);
    }
    
    // Aggiungi il toast al documento
    document.body.appendChild(toast);
    
    // Rimuovi il toast dopo la durata specificata
    if (duration > 0) {
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, duration);
    }
  } catch (error) {
    // In caso di errore, usa console.log come fallback
    console.log(`${type.toUpperCase()}: ${message}`);
    console.error('Errore durante la visualizzazione del toast:', error);
  }
}

// Ottieni un token di accesso valido
async function getValidAccessToken() {
  try {
    const savedTokenStr = localStorage.getItem('googleAuthToken');
    
    if (!savedTokenStr) {
      console.warn('Nessun token salvato trovato');
      return null;
    }
    
    try {
      const tokenData = JSON.parse(savedTokenStr);
      
      // Verifica se il token è ancora valido
      if (tokenData && tokenData.access_token && tokenData.expires_at && tokenData.expires_at > Date.now()) {
        console.log('Token valido trovato, scade tra', Math.round((tokenData.expires_at - Date.now()) / 60000), 'minuti');
        return tokenData.access_token;
      }
      
      console.warn('Token scaduto o non valido');
      return null;
    } catch (parseError) {
      console.error('Errore durante il parsing del token salvato:', parseError);
      // Pulisci il token non valido
      localStorage.removeItem('googleAuthToken');
      return null;
    }
  } catch (error) {
    console.error('Errore durante il recupero del token:', error);
    return null;
  }
}

// Integrazione con il sistema di backup cloud
function integrateWithCloudManager() {
  try {
    console.log('Integrazione con il sistema di backup cloud...');
    
    // Verifica se esiste già un oggetto cloudManager
    if (window.cloudManager && typeof window.cloudManager.getAvailableProviders === 'function') {
      console.log('Sistema di backup cloud esistente trovato, integrazione in corso...');
      
      // Aggiungi un provider Google
      window.cloudManager.addProvider({
        id: 'google',
        name: 'Google Drive',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
        isLoggedIn: () => isLoggedIn,
        getUserInfo: () => {
          return currentUser ? {
            id: currentUser.sub,
            name: currentUser.name,
            email: currentUser.email,
            picture: currentUser.picture
          } : null;
        },
        login: async () => {
          return new Promise((resolve, reject) => {
            try {
              // Salva la funzione di callback
              const originalCallback = tokenClient.callback;
              
              // Sovrascrive temporaneamente la callback
              tokenClient.callback = (response) => {
                try {
                  // Ripristina la callback originale
                  tokenClient.callback = originalCallback;
                  
                  // Gestisci la risposta
                  if (response && response.access_token) {
                    // Ottieni informazioni sull'utente
                    fetchUserInfo(response.access_token)
                      .then(userData => {
                        try {
                          // Chiama la callback originale
                          if (originalCallback) {
                            originalCallback(response);
                          }
                          
                          // Risolvi la promessa con i dati utente
                          resolve({
                            id: userData.sub,
                            name: userData.name,
                            email: userData.email,
                            picture: userData.picture
                          });
                        } catch (error) {
                          console.error('Errore durante la gestione della callback:', error);
                          reject(error);
                        }
                      })
                      .catch(error => {
                        console.error('Errore durante il recupero delle informazioni utente:', error);
                        reject(error);
                      });
                  } else {
                    console.error('Token non valido ricevuto');
                    reject(new Error('Token non valido'));
                  }
                } catch (error) {
                  console.error('Errore durante la gestione della callback:', error);
                  reject(error);
                }
              };
              
              // Richiedi il token
              loginWithGoogle();
            } catch (error) {
              console.error('Errore durante la richiesta del token:', error);
              reject(error);
            }
          });
        },
        logout: async () => {
          try {
            // Usa la versione sicura di logout
            if (window.googleAuth && typeof window.googleAuth.logout === 'function') {
              window.googleAuth.logout();
            } else {
              // Fallback alla versione vecchia
              console.log('Usando il metodo di logout di fallback');
              
              // Pulisci i dati di autenticazione
              localStorage.removeItem('googleAuthToken');
              localStorage.removeItem('googleUserInfo');
              
              // Reimposta le variabili globali
              isLoggedIn = false;
              currentUser = null;
            }
            return true;
          } catch (error) {
            console.error('Errore durante il logout:', error);
            return false;
          }
        },
      checkAuthStatus: async () => {
        try {
          const token = await getValidAccessToken();
          return !!token;
        } catch (error) {
          console.error('Errore durante la verifica dello stato di autenticazione:', error);
          return false;
        }
      },
      backup: async (data, silent = false) => {
        try {
          console.log('Tentativo di backup su Google Drive...');
          
          const token = await getValidAccessToken();
          
          if (!token) {
            console.error('Token non valido per il backup');
            return {
              success: false,
              error: 'Token non valido'
            };
          }
          
          // Trova o crea il file di backup
          console.log('Ricerca o creazione file di backup...');
          const backupFile = await findOrCreateBackupFile(token);
          
          if (!backupFile || !backupFile.id) {
            console.error('Impossibile trovare o creare il file di backup');
            return {
              success: false,
              error: 'Impossibile trovare o creare il file di backup'
            };
          }
          
          // Aggiorna il contenuto del file
          console.log('Aggiornamento contenuto file di backup...');
          await updateBackupFile(backupFile.id, data, token);
          
          console.log('Backup completato con successo');
          
          // Crea un toast manualmente invece di usare la funzione showToast
          if (!silent) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-success';
            toast.textContent = 'Backup completato con successo';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.backgroundColor = '#4CAF50';
            toast.style.color = 'white';
            toast.style.zIndex = '10000';
            toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            
            // Aggiungi il toast al documento
            document.body.appendChild(toast);
            
            // Rimuovi il toast dopo 3 secondi
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 3000);
          }
          
          return {
            success: true,
            fileId: backupFile.id,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error('Errore durante il backup:', error);
          return {
            success: false,
            error: error.message || 'Errore sconosciuto durante il backup'
          };
        }
      },
      restore: async (silent = false) => {
        try {
          console.log('Tentativo di ripristino da Google Drive...');
          
          const token = await getValidAccessToken();
          
          if (!token) {
            console.error('Token non valido per il ripristino');
            return {
              success: false,
              error: 'Token non valido'
            };
          }
          
          // Trova il file di backup
          console.log('Ricerca file di backup...');
          const backupFile = await findBackupFile(token);
          
          if (!backupFile) {
            console.error('Nessun backup trovato');
            return {
              success: false,
              error: 'Nessun backup trovato'
            };
          }
          
          // Ottieni il contenuto del file
          console.log('Recupero contenuto file di backup...');
          const data = await getBackupFileContent(backupFile.id, token);
          
          console.log('Ripristino completato con successo');
          
          // Crea un toast manualmente invece di usare la funzione showToast
          if (!silent) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-success';
            toast.textContent = 'Ripristino completato con successo';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.backgroundColor = '#4CAF50';
            toast.style.color = 'white';
            toast.style.zIndex = '10000';
            toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            
            // Aggiungi il toast al documento
            document.body.appendChild(toast);
            
            // Rimuovi il toast dopo 3 secondi
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 3000);
          }
          
          return {
            success: true,
            data: data,
            timestamp: backupFile.modifiedTime
          };
        } catch (error) {
          console.error('Errore durante il ripristino:', error);
          return {
            success: false,
            error: error.message || 'Errore sconosciuto durante il ripristino'
          };
        }
      }
    });
  } else {
    console.warn('Sistema di backup cloud non trovato');
  }
}

// Trova o crea il file di backup
async function findOrCreateBackupFile(token) {
  try {
    console.log('Ricerca file di backup esistente...');
    // Cerca il file di backup esistente
    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27backup.json%27%20and%20trashed%3Dfalse', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Errore HTTP durante la ricerca del file: ${response.status}`);
      const errorText = await response.text();
      console.error('Dettagli errore:', errorText);
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Risposta ricerca file:', data);
    
    if (data.files && data.files.length > 0) {
      // Restituisci il file esistente
      console.log('File di backup esistente trovato:', data.files[0].id);
      return data.files[0];
    }
    
    console.log('Nessun file di backup esistente trovato, creazione nuovo file...');
    // Crea un nuovo file di backup
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'backup.json',
        mimeType: 'application/json'
      })
    });
    
    if (!createResponse.ok) {
      console.error(`Errore HTTP durante la creazione del file: ${createResponse.status}`);
      const errorText = await createResponse.text();
      console.error('Dettagli errore:', errorText);
      throw new Error(`Errore HTTP: ${createResponse.status}`);
    }
    
    const newFile = await createResponse.json();
    console.log('Nuovo file di backup creato:', newFile.id);
    return newFile;
  } catch (error) {
    console.error('Errore durante la ricerca/creazione del file di backup:', error);
    // Restituisci un oggetto vuoto invece di lanciare un'eccezione
    return { id: null };
  }
}

// Trova il file di backup
async function findBackupFile(token) {
  try {
    console.log('Ricerca file di backup...');
    // Cerca il file di backup esistente
    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27backup.json%27%20and%20trashed%3Dfalse', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Errore HTTP durante la ricerca del file: ${response.status}`);
      const errorText = await response.text();
      console.error('Dettagli errore:', errorText);
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Risposta ricerca file:', data);
    
    if (data.files && data.files.length > 0) {
      // Restituisci il file esistente
      console.log('File di backup trovato:', data.files[0].id);
      return data.files[0];
    }
    
    console.log('Nessun file di backup trovato');
    return null;
  } catch (error) {
    console.error('Errore durante la ricerca del file di backup:', error);
    return null;
  }
}

// Aggiorna il contenuto del file di backup
async function updateBackupFile(fileId, data, token) {
  try {
    if (!fileId) {
      console.error('ID file non valido per l\'aggiornamento');
      throw new Error('ID file non valido');
    }
    
    console.log('Aggiornamento contenuto file di backup:', fileId);
    
    // Converti i dati in stringa JSON se non lo sono già
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: jsonData
    });
    
    if (!response.ok) {
      console.error(`Errore HTTP durante l'aggiornamento del file: ${response.status}`);
      const errorText = await response.text();
      console.error('Dettagli errore:', errorText);
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('File aggiornato con successo:', result);
    return result;
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del file di backup:', error);
    return { error: error.message };
  }
}

// Ottieni il contenuto del file di backup
async function getBackupFileContent(fileId, token) {
  try {
    if (!fileId) {
      console.error('ID file non valido per il recupero del contenuto');
      throw new Error('ID file non valido');
    }
    
    console.log('Recupero contenuto file di backup:', fileId);
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error(`Errore HTTP durante il recupero del contenuto: ${response.status}`);
      const errorText = await response.text();
      console.error('Dettagli errore:', errorText);
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    // Prova a interpretare la risposta come JSON
    try {
      const jsonData = await response.json();
      console.log('Contenuto file recuperato con successo (JSON)');
      return jsonData;
    } catch (jsonError) {
      // Se non è JSON, restituisci il testo
      console.log('Contenuto file non è JSON, restituisco come testo');
      const textData = await response.text();
      return textData;
    }
  } catch (error) {
    console.error('Errore durante il recupero del contenuto del file di backup:', error);
    return null;
  }
}

// Intercetta le chiamate fetch per aggiungere il token di autenticazione
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  // Se la richiesta è verso l'API Google e non ha già un'autorizzazione
  if (url.includes('googleapis.com') && (!options || !options.headers || !options.headers.Authorization)) {
    console.log('Intercettata chiamata API Google:', url);
    
    // Ottieni il token di accesso
    return getValidAccessToken().then(token => {
      if (!token) {
        console.warn('Token non disponibile per la richiesta API Google');
        return originalFetch(url, options);
      }
      
      // Aggiungi il token all'header Authorization
      const newOptions = { ...options } || {};
      newOptions.headers = { ...newOptions.headers } || {};
      newOptions.headers.Authorization = `Bearer ${token}`;
      
      console.log('Aggiunto token di autenticazione alla richiesta API Google');
      return originalFetch(url, newOptions);
    }).catch(error => {
      console.error('Errore durante il recupero del token per la richiesta API Google:', error);
      return originalFetch(url, options);
    });
  }
  
  // Altrimenti, usa il fetch originale
  return originalFetch(url, options);
};

// Esporta le funzioni pubbliche
window.googleAuth = {
  init: initGoogleAuth,
  login: loginWithGoogle,
  // Implementazione sicura di logout che non causa ricorsione
  logout: function() {
    if (!isLoggedIn) {
      console.log('Utente già disconnesso');
      return;
    }
    
    console.log('Tentativo di logout sicuro...');
    
    // Pulisci i dati di autenticazione
    localStorage.removeItem('googleAuthToken');
    localStorage.removeItem('googleUserInfo');
    
    // Reimposta le variabili globali
    isLoggedIn = false;
    currentUser = null;
    
    // Aggiorna direttamente l'interfaccia utente
    try {
      // Aggiorna il pulsante di login nella barra di navigazione
      const loginButton = document.getElementById('loginButton');
      if (loginButton) {
        loginButton.style.display = '';
      }
      
      // Aggiorna i pulsanti di login
      const loginButtonsContainer = document.getElementById('loginButtonsContainer');
      if (loginButtonsContainer) {
        loginButtonsContainer.style.display = 'flex';
      }
      
      // Aggiorna le informazioni dell'account
      const accountSection = document.getElementById('cloudAccountSection');
      const accountInfo = document.getElementById('cloudAccountInfo');
      const logoutBtn = document.getElementById('cloudLogoutBtn');
      
      if (accountSection) {
        accountSection.style.display = 'none';
      }
      
      if (accountInfo) {
        accountInfo.innerHTML = '';
      }
      
      if (logoutBtn) {
        logoutBtn.style.display = 'none';
      }
      
      // Mostra un messaggio di successo
      console.log('Disconnessione effettuata con successo');
      
      // Crea un toast manualmente
      const toast = document.createElement('div');
      toast.className = 'toast toast-info';
      toast.textContent = 'Disconnessione effettuata con successo';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.padding = '10px 20px';
      toast.style.borderRadius = '4px';
      toast.style.backgroundColor = '#2196F3';
      toast.style.color = 'white';
      toast.style.zIndex = '10000';
      toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      
      // Aggiungi il toast al documento
      document.body.appendChild(toast);
      
      // Rimuovi il toast dopo 3 secondi
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'interfaccia utente:', error);
    }
    
    // Revoca il token in background
    try {
      const savedTokenStr = localStorage.getItem('googleAuthToken');
      if (savedTokenStr && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        const tokenData = JSON.parse(savedTokenStr);
        google.accounts.oauth2.revoke(tokenData.access_token, done => {
          console.log('Revoca token completata:', done);
        });
      }
    } catch (error) {
      console.error('Errore durante la revoca del token:', error);
    }
  },
  isLoggedIn: () => isLoggedIn,
  getCurrentUser: () => currentUser,
  getUserEmail: () => userEmail,
  getUserPhotoUrl: () => userPhotoUrl,
  getToken: async function() {
    try {
      return await getValidAccessToken();
    } catch (error) {
      console.error('Errore durante il recupero del token:', error);
      return null;
    }
  },
  integrateWithCloudManager: integrateWithCloudManager
};

// Inizializza automaticamente quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM caricato, inizializzazione Google Auth...');
  initGoogleAuth();
  
  // Configura il pulsante di login nella barra di navigazione
  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', (event) => {
      event.preventDefault();
      loginWithGoogle();
    });
  }
});
