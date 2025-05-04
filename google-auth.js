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
  
  // Ottieni il token corrente
  const savedTokenStr = localStorage.getItem('googleAuthToken');
  if (savedTokenStr) {
    try {
      const tokenData = JSON.parse(savedTokenStr);
      
      // Revoca il token
      google.accounts.oauth2.revoke(tokenData.access_token, done => {
        console.log('Revoca token completata:', done);
        
        // Pulisci i dati di autenticazione
        clearAuthData();
        
        // Aggiorna l'interfaccia utente
        updateUI(false);
        
        // Mostra un messaggio di successo
        showToast('Disconnessione effettuata con successo', 'info');
      });
    } catch (error) {
      console.error('Errore durante la revoca del token:', error);
      
      // Pulisci comunque i dati di autenticazione
      clearAuthData();
      
      // Aggiorna l'interfaccia utente
      updateUI(false);
      
      // Mostra un messaggio di errore
      showToast('Errore durante la disconnessione', 'error');
    }
  } else {
    // Pulisci comunque i dati di autenticazione
    clearAuthData();
    
    // Aggiorna l'interfaccia utente
    updateUI(false);
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
  // Aggiorna l'interfaccia utente in base allo stato di autenticazione
  if (typeof window.updateCloudAccountUI === 'function') {
    window.updateCloudAccountUI();
  }
  
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
      logoutBtn.onclick = logoutFromGoogle;
    } else {
      accountSection.style.display = 'none';
      accountInfo.innerHTML = '';
      logoutBtn.style.display = 'none';
    }
  }
}

// Mostra un toast
function showToast(message, type = 'info', duration = 3000, onClick = null) {
  // Verifica se esiste già una funzione showToast
  if (typeof window.showToast === 'function') {
    window.showToast(message, type, duration);
    return;
  }
  
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
}

// Ottieni un token di accesso valido
async function getValidAccessToken() {
  const savedTokenStr = localStorage.getItem('googleAuthToken');
  
  if (!savedTokenStr) {
    console.warn('Nessun token salvato trovato');
    return null;
  }
  
  try {
    const tokenData = JSON.parse(savedTokenStr);
    
    // Verifica se il token è ancora valido
    if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
      return tokenData.access_token;
    }
    
    console.warn('Token scaduto');
    return null;
  } catch (error) {
    console.error('Errore durante il parsing del token salvato:', error);
    return null;
  }
}

// Integrazione con il sistema di backup cloud
function integrateWithCloudManager() {
  console.log('Integrazione con il sistema di backup cloud...');
  
  // Verifica se esiste già un oggetto cloudManager
  if (window.cloudManager && typeof window.cloudManager.getAvailableProviders === 'function') {
    console.log('Sistema di backup cloud esistente trovato, integrazione in corso...');
    
    // Aggiungi un provider Google
    window.cloudManager.addProvider({
      id: 'google',
      name: 'Google Drive',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
      isLoggedIn: isLoggedIn,
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
          // Salva la funzione di callback
          const originalCallback = tokenClient.callback;
          
          // Sovrascrive temporaneamente la callback
          tokenClient.callback = (response) => {
            // Ripristina la callback originale
            tokenClient.callback = originalCallback;
            
            // Gestisci la risposta
            if (response && response.access_token) {
              // Ottieni informazioni sull'utente
              fetchUserInfo(response.access_token)
                .then(userData => {
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
                })
                .catch(error => {
                  reject(error);
                });
            } else {
              reject(new Error('Token non valido'));
            }
          };
          
          // Richiedi il token
          loginWithGoogle();
        });
      },
      logout: async () => {
        logoutFromGoogle();
        return true;
      },
      checkAuthStatus: async () => {
        const token = await getValidAccessToken();
        return !!token;
      },
      backup: async (data, silent = false) => {
        const token = await getValidAccessToken();
        
        if (!token) {
          throw new Error('Token non valido');
        }
        
        // Trova o crea il file di backup
        const backupFile = await findOrCreateBackupFile(token);
        
        // Aggiorna il contenuto del file
        await updateBackupFile(backupFile.id, data, token);
        
        return {
          success: true,
          fileId: backupFile.id,
          timestamp: new Date().toISOString()
        };
      },
      restore: async (silent = false) => {
        const token = await getValidAccessToken();
        
        if (!token) {
          throw new Error('Token non valido');
        }
        
        // Trova il file di backup
        const backupFile = await findBackupFile(token);
        
        if (!backupFile) {
          throw new Error('Nessun backup trovato');
        }
        
        // Ottieni il contenuto del file
        const data = await getBackupFileContent(backupFile.id, token);
        
        return {
          success: true,
          data: data,
          timestamp: backupFile.modifiedTime
        };
      }
    });
  } else {
    console.warn('Sistema di backup cloud non trovato');
  }
}

// Trova o crea il file di backup
async function findOrCreateBackupFile(token) {
  try {
    // Cerca il file di backup esistente
    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27backup.json%27%20and%20trashed%3Dfalse', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      // Restituisci il file esistente
      return data.files[0];
    }
    
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
      throw new Error(`Errore HTTP: ${createResponse.status}`);
    }
    
    return await createResponse.json();
  } catch (error) {
    console.error('Errore durante la ricerca/creazione del file di backup:', error);
    throw error;
  }
}

// Trova il file di backup
async function findBackupFile(token) {
  try {
    // Cerca il file di backup esistente
    const response = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27backup.json%27%20and%20trashed%3Dfalse', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      // Restituisci il file esistente
      return data.files[0];
    }
    
    return null;
  } catch (error) {
    console.error('Errore durante la ricerca del file di backup:', error);
    throw error;
  }
}

// Aggiorna il contenuto del file di backup
async function updateBackupFile(fileId, data, token) {
  try {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del file di backup:', error);
    throw error;
  }
}

// Ottieni il contenuto del file di backup
async function getBackupFileContent(fileId, token) {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Errore durante il recupero del contenuto del file di backup:', error);
    throw error;
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
  logout: logoutFromGoogle,
  isLoggedIn: () => isLoggedIn,
  getCurrentUser: () => currentUser,
  getUserEmail: () => userEmail,
  getUserPhotoUrl: () => userPhotoUrl,
  getToken: getValidAccessToken,
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
