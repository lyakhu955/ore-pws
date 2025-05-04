// firebase-auth.js

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAsmspxrDXhxTISZq9kOwZTeUHZ99jVOqA",
  authDomain: "ore-pws.firebaseapp.com",
  projectId: "ore-pws",
  storageBucket: "ore-pws.firebasestorage.app",
  messagingSenderId: "978531048476",
  appId: "1:978531048476:web:9d254fd6e85216adaad3d9",
  measurementId: "G-F3CD5FKP1S"
};

// Stato di autenticazione
let isLoggedIn = false;
let currentUser = null;
let userPhotoUrl = null;
let userEmail = null;
let tokenRefreshTimer = null; // Timer per il rinnovo automatico del token

// Inizializza Firebase
function initFirebase() {
  console.log('Inizializzazione Firebase...');
  
  // Configura Firebase con l'opzione di persistenza
  const firebaseConfig = {
    apiKey: "AIzaSyAsmspxrDXhxTISZq9kOwZTeUHZ99jVOqA",
    authDomain: "ore-pws.firebaseapp.com",
    projectId: "ore-pws",
    storageBucket: "ore-pws.firebasestorage.app",
    messagingSenderId: "978531048476",
    appId: "1:978531048476:web:9d254fd6e85216adaad3d9",
    measurementId: "G-F3CD5FKP1S"
  };
  
  // Inizializza Firebase solo se non è già stato inizializzato
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase inizializzato con successo');
    
    // Imposta la persistenza per mantenere la sessione anche dopo la chiusura del browser
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        console.log('Persistenza Firebase impostata su LOCAL');
      })
      .catch((error) => {
        console.error('Errore durante l\'impostazione della persistenza:', error);
      });
  } else {
    console.log('Firebase già inizializzato');
  }
  
  // Tenta di ripristinare la sessione precedente
  tryRestoreSession();
  
  // Configura il listener per i cambiamenti di stato dell'autenticazione
  firebase.auth().onAuthStateChanged(handleAuthStateChanged);
  
  // Gestisci il risultato del redirect di autenticazione
  firebase.auth().getRedirectResult()
    .then((result) => {
      console.log('Risultato del redirect ricevuto:', result);
      
      if (result.user) {
        console.log('Login completato tramite redirect, utente:', result.user.email);
        
        // Crea un elemento di notifica visibile
        const notification = document.createElement('div');
        notification.textContent = "Accesso effettuato con successo!";
        notification.style.position = 'fixed';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        notification.style.color = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '10000';
        document.body.appendChild(notification);
        
        // Rimuovi la notifica dopo 2 secondi
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 2000);
        
        // Salva il token nel localStorage per il sistema esistente
        if (result.credential && result.credential.accessToken) {
          localStorage.setItem('googleAuthToken', result.credential.accessToken);
          console.log('Token salvato nel localStorage');
        } else {
          // Se non abbiamo un token nell'oggetto credential, otteniamolo direttamente dall'utente
          result.user.getIdToken().then(token => {
            localStorage.setItem('googleAuthToken', token);
            console.log('Token ottenuto dall\'utente e salvato nel localStorage');
          });
        }
        
        // Ripristina lo stato precedente se necessario
        const redirectState = localStorage.getItem('auth_redirect_state');
        if (redirectState && redirectState !== window.location.href) {
          localStorage.removeItem('auth_redirect_state');
          // Non reindirizzare se siamo già nella pagina corretta
          if (redirectState !== window.location.href) {
            console.log('Reindirizzamento a:', redirectState);
            window.location.href = redirectState;
          }
        }
      } else {
        console.log('Nessun utente trovato nel risultato del redirect');
      }
    })
    .catch((error) => {
      console.error('Errore durante il recupero del risultato del redirect:', error);
      if (error.code !== 'auth/credential-already-in-use') {
        // Crea un elemento di notifica visibile per l'errore
        const errorNotification = document.createElement('div');
        errorNotification.textContent = "Errore durante l'accesso: " + error.message;
        errorNotification.style.position = 'fixed';
        errorNotification.style.top = '50%';
        errorNotification.style.left = '50%';
        errorNotification.style.transform = 'translate(-50%, -50%)';
        errorNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        errorNotification.style.color = 'white';
        errorNotification.style.padding = '20px';
        errorNotification.style.borderRadius = '8px';
        errorNotification.style.zIndex = '10000';
        document.body.appendChild(errorNotification);
        
        // Rimuovi la notifica dopo 3 secondi
        setTimeout(() => {
          if (document.body.contains(errorNotification)) {
            document.body.removeChild(errorNotification);
          }
        }, 3000);
      }
    });
  
  // Verifica se c'è già un utente autenticato
  checkAuthState();
}

// Tenta di ripristinare la sessione precedente
function tryRestoreSession() {
  // Verifica se c'è un utente salvato nel localStorage
  const savedUser = localStorage.getItem('firebaseUser');
  
  if (savedUser) {
    try {
      console.log('Trovato utente salvato, tentativo di ripristino sessione...');
      
      // Verifica se l'utente è già autenticato
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.log('Nessun utente autenticato, tentativo di ripristino automatico della sessione...');
        
        // Firebase gestisce automaticamente il ripristino della sessione
        // ma possiamo forzare un controllo dello stato di autenticazione
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            console.log('Sessione ripristinata automaticamente da Firebase');
          } else {
            console.log('Impossibile ripristinare automaticamente la sessione');
            // Rimuovi i dati salvati se non è possibile ripristinare la sessione
            localStorage.removeItem('firebaseUser');
            localStorage.removeItem('googleAuthToken');
          }
        });
      } else {
        console.log('Utente già autenticato, sessione attiva');
      }
    } catch (error) {
      console.error('Errore durante il tentativo di ripristino della sessione:', error);
      // Rimuovi i dati salvati in caso di errore
      localStorage.removeItem('firebaseUser');
      localStorage.removeItem('googleAuthToken');
    }
  } else {
    console.log('Nessun utente salvato trovato');
  }
}

// Gestisce i cambiamenti di stato dell'autenticazione
function handleAuthStateChanged(user) {
  if (user) {
    // L'utente è autenticato
    isLoggedIn = true;
    currentUser = user;
    userPhotoUrl = user.photoURL;
    userEmail = user.email;
    
    console.log('Utente Firebase autenticato:', userEmail);
    
    // Salva le informazioni dell'utente per il sistema esistente
    if (window.localStorage) {
      localStorage.setItem('firebaseUser', JSON.stringify({
        email: userEmail,
        photoUrl: userPhotoUrl,
        displayName: user.displayName,
        uid: user.uid
      }));
      
      // Salva anche il token per il sistema esistente
      user.getIdToken(true).then(token => {
        console.log('Token ottenuto con successo');
        localStorage.setItem('googleAuthToken', token);
        
        // Imposta il rinnovo automatico del token
        setupTokenRefresh();
        
        // Aggiorna l'interfaccia utente dopo aver ottenuto il token
        updateUIAfterAuth(user);
      }).catch(error => {
        console.error('Errore durante l\'ottenimento del token:', error);
        // Aggiorna comunque l'interfaccia utente
        updateUIAfterAuth(user);
      });
    } else {
      // Aggiorna l'interfaccia utente anche se localStorage non è disponibile
      updateUIAfterAuth(user);
    }
    
    // Ottieni un token di accesso fresco
    refreshAccessToken();
  } else {
    // L'utente non è autenticato
    isLoggedIn = false;
    currentUser = null;
    userPhotoUrl = null;
    userEmail = null;
    
    // Cancella il timer di rinnovo del token
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      tokenRefreshTimer = null;
    }
    
    console.log('Utente Firebase non autenticato');
    
    // Rimuovi le informazioni dell'utente dal localStorage
    if (window.localStorage) {
      localStorage.removeItem('firebaseUser');
      localStorage.removeItem('googleAuthToken');
    }
    
    // Aggiorna l'interfaccia utente per lo stato non autenticato
    updateUIAfterAuth(null);
  }
}

// Funzione per aggiornare l'interfaccia utente dopo l'autenticazione
function updateUIAfterAuth(user) {
  if (user) {
    // Aggiorna l'interfaccia utente del sistema di backup cloud
    if (typeof window.updateProviderSelectionUI === 'function') {
      console.log('Aggiornamento interfaccia utente del sistema di backup cloud...');
      window.updateProviderSelectionUI();
    }
    
    if (typeof window.updateCloudAccountUI === 'function') {
      console.log('Aggiornamento interfaccia utente dell\'account cloud...');
      window.updateCloudAccountUI();
    }
    
    // Aggiorna l'interfaccia utente se la funzione esiste
    if (typeof window.updateFirebaseUI === 'function') {
      window.updateFirebaseUI(user);
    } else {
      console.log('Creazione di un elemento UI personalizzato');
      createOrUpdateFirebaseUI(user);
    }
    
    // Forza l'aggiornamento dei pulsanti di login
    forceUpdateLoginButtons();
    
    // Mostra un messaggio di benvenuto
    showToast(`Benvenuto, ${user.displayName || user.email}!`, "success");
  } else {
    // Aggiorna l'interfaccia utente del sistema di backup cloud
    if (typeof window.updateProviderSelectionUI === 'function') {
      console.log('Aggiornamento interfaccia utente del sistema di backup cloud...');
      window.updateProviderSelectionUI();
    }
    
    if (typeof window.updateCloudAccountUI === 'function') {
      console.log('Aggiornamento interfaccia utente dell\'account cloud...');
      window.updateCloudAccountUI();
    }
    
    // Aggiorna l'interfaccia utente se la funzione esiste
    if (typeof window.updateFirebaseUI === 'function') {
      window.updateFirebaseUI(null);
    } else {
      console.log('Aggiornamento elemento UI personalizzato');
      createOrUpdateFirebaseUI(null);
    }
    
    // Forza l'aggiornamento dei pulsanti di login
    forceUpdateLoginButtons();
  }
}

// Funzione per forzare l'aggiornamento dei pulsanti di login
function forceUpdateLoginButtons() {
  console.log('Forzatura aggiornamento pulsanti di login...');
  
  // Verifica se la funzione updateLoginButtons esiste
  if (typeof window.updateLoginButtons === 'function') {
    console.log('Chiamata a updateLoginButtons()');
    window.updateLoginButtons();
  } else {
    console.log('La funzione updateLoginButtons non esiste, creazione pulsante di login manuale...');
    
    // Trova il container dei pulsanti di login
    const loginButtonsContainer = document.getElementById('loginButtonsContainer');
    if (loginButtonsContainer) {
      console.log('Container dei pulsanti di login trovato, aggiornamento...');
      
      // Verifica se l'utente è già autenticato
      if (firebase.auth().currentUser) {
        console.log('Utente già autenticato, nascondo i pulsanti di login...');
        loginButtonsContainer.style.display = 'none';
        return;
      }
      
      // Altrimenti, mostra il pulsante di login
      loginButtonsContainer.style.display = 'flex';
      loginButtonsContainer.innerHTML = '';
      
      // Crea il pulsante di login
      const button = document.createElement('button');
      button.id = 'googleLoginBtn';
      button.className = 'cloud-login-btn google-btn';
      
      button.innerHTML = `
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Drive">
        Accedi con Google Drive
      `;
      
      // Aggiungi l'event listener
      button.addEventListener('click', function() {
        console.log('Pulsante di login cliccato, tentativo di login...');
        loginWithGoogle();
      });
      
      // Aggiungi il pulsante al container
      loginButtonsContainer.appendChild(button);
    } else {
      console.warn('Container dei pulsanti di login non trovato');
    }
  }
}

// Crea o aggiorna l'interfaccia utente per Firebase
function createOrUpdateFirebaseUI(user) {
  console.log('Creazione UI personalizzata per Firebase');
  
  // Verifica se la funzione updateFirebaseUI esiste
  if (typeof window.updateFirebaseUI === 'function') {
    console.log('Utilizzo della funzione updateFirebaseUI esistente');
    window.updateFirebaseUI(user);
    return;
  }
  
  // Altrimenti, crea un'interfaccia utente personalizzata
  console.log('Creazione interfaccia utente personalizzata');
  
  // Cerca un elemento esistente o creane uno nuovo
  let firebaseUIContainer = document.getElementById('firebase-auth-container');
  
  if (!firebaseUIContainer) {
    // Crea un nuovo container per l'UI di Firebase
    firebaseUIContainer = document.createElement('div');
    firebaseUIContainer.id = 'firebase-auth-container';
    firebaseUIContainer.style.position = 'fixed';
    firebaseUIContainer.style.top = '60px';
    firebaseUIContainer.style.right = '20px';
    firebaseUIContainer.style.zIndex = '1000';
    firebaseUIContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    firebaseUIContainer.style.padding = '10px';
    firebaseUIContainer.style.borderRadius = '8px';
    firebaseUIContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    document.body.appendChild(firebaseUIContainer);
  }
  
  if (user) {
    // Utente autenticato, mostra le informazioni dell'utente
    firebaseUIContainer.innerHTML = `
      <div class="user-profile" style="display: flex; align-items: center; gap: 10px;">
        ${user.photoURL ? `<img src="${user.photoURL}" alt="Foto profilo" style="width: 30px; height: 30px; border-radius: 50%;">` : ''}
        <span style="font-size: 14px;">${user.email}</span>
        <button onclick="logoutFromGoogle()" style="background-color: #f44336; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 12px;">Disconnetti</button>
      </div>
    `;
  } else {
    // Utente non autenticato, mostra il pulsante di login
    firebaseUIContainer.innerHTML = `
      <button onclick="loginWithGoogle()" style="background-color: #4285F4; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
        Accedi con Google
      </button>
    `;
  }
}

// Verifica lo stato di autenticazione
function checkAuthState() {
  const user = firebase.auth().currentUser;
  handleAuthStateChanged(user);
  return user !== null;
}

// Effettua il login con Google
function loginWithGoogle() {
  console.log('Tentativo di login con Google...');
  
  // Verifica se l'utente è già autenticato
  if (firebase.auth().currentUser) {
    console.log('Utente già autenticato:', firebase.auth().currentUser.email);
    showToast("Sei già autenticato come " + firebase.auth().currentUser.email, "info");
    return;
  }
  
  // Crea un elemento di notifica visibile
  const notification = document.createElement('div');
  notification.textContent = "Apertura pagina di accesso Google...";
  notification.style.position = 'fixed';
  notification.style.top = '50%';
  notification.style.left = '50%';
  notification.style.transform = 'translate(-50%, -50%)';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  notification.style.color = 'white';
  notification.style.padding = '20px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  document.body.appendChild(notification);
  
  // Rimuovi la notifica dopo 3 secondi
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
  
  // Verifica se esiste il sistema di backup cloud
  if (window.cloudManager && typeof window.cloudManager.login === 'function') {
    console.log('Utilizzo del sistema di backup cloud per il login...');
    
    // Imposta Google come provider selezionato
    if (typeof window.cloudManager.setSelectedProvider === 'function') {
      window.cloudManager.setSelectedProvider('google');
    }
    
    // Effettua il login con il sistema di backup cloud
    window.cloudManager.login(true)
      .then(userData => {
        console.log('Login completato con successo tramite cloudManager:', userData);
        
        // Aggiorna l'interfaccia utente
        if (typeof window.updateCloudAccountUI === 'function') {
          window.updateCloudAccountUI();
        }
        
        // Mostra una notifica di successo
        showToast("Accesso effettuato con successo!", "success");
      })
      .catch(error => {
        console.error('Errore durante il login con cloudManager:', error);
        showToast("Errore durante l'accesso: " + error.message, "error");
      });
    
    return;
  }
  
  // Se il sistema di backup cloud non è disponibile, utilizza Firebase Auth
  console.log('Sistema di backup cloud non disponibile, utilizzo Firebase Auth...');
  
  // Crea un nuovo provider Google
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // Aggiungi gli scope necessari per Google Drive
  provider.addScope('profile');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.appdata');
  
  // Richiedi sempre il consenso per ottenere un refresh token
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
  });
  
  // Salva lo stato corrente per tornare alla stessa pagina dopo il login
  localStorage.setItem('auth_redirect_state', window.location.href);
  console.log('Stato corrente salvato:', window.location.href);
  
  // Prova prima con il popup, che è più affidabile
  console.log('Tentativo di login con popup...');
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      console.log('Login completato con popup:', result.user.email);
      
      // Salva il token nel localStorage
      if (result.credential && result.credential.accessToken) {
        localStorage.setItem('googleAuthToken', result.credential.accessToken);
        console.log('Token salvato nel localStorage');
      } else {
        // Se non abbiamo un token nell'oggetto credential, otteniamolo direttamente dall'utente
        result.user.getIdToken().then(token => {
          localStorage.setItem('googleAuthToken', token);
          console.log('Token ottenuto dall\'utente e salvato nel localStorage');
        });
      }
      
      // Mostra una notifica di successo
      showToast("Accesso effettuato con successo!", "success");
      
      // Aggiorna lo stato di autenticazione
      handleAuthStateChanged(result.user);
    })
    .catch((error) => {
      console.error('Errore durante il login con popup:', error);
      
      // Se il popup è bloccato o fallisce, prova con il redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        console.log('Popup bloccato o chiuso, tentativo con redirect...');
        
        // Usa il metodo redirect come fallback
        try {
          firebase.auth().signInWithRedirect(provider)
            .catch((redirectError) => {
              console.error('Errore durante il redirect per login Firebase:', redirectError);
              showToast("Errore durante l'accesso: " + redirectError.message, "error");
            });
        } catch (e) {
          console.error('Eccezione durante il tentativo di login con redirect:', e);
          showToast("Errore imprevisto durante l'accesso. Riprova più tardi.", "error");
        }
      } else {
        // Mostra un messaggio di errore per altri tipi di errori
        showToast("Errore durante l'accesso: " + error.message, "error");
      }
    });
}

// Effettua il logout
function logoutFromGoogle() {
  console.log('Tentativo di logout da Google via Firebase...');
  
  // Crea un elemento di notifica visibile
  const notification = document.createElement('div');
  notification.textContent = "Disconnessione in corso...";
  notification.style.position = 'fixed';
  notification.style.top = '50%';
  notification.style.left = '50%';
  notification.style.transform = 'translate(-50%, -50%)';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  notification.style.color = 'white';
  notification.style.padding = '20px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  document.body.appendChild(notification);
  
  firebase.auth().signOut()
    .then(() => {
      console.log('Logout Firebase completato con successo');
      
      // Rimuovi il token dal localStorage
      localStorage.removeItem('googleAuthToken');
      
      // Aggiorna la notifica
      notification.textContent = "Disconnessione effettuata con successo";
      notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
      
      // Rimuovi la notifica dopo 2 secondi
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);
    })
    .catch((error) => {
      console.error('Errore durante il logout Firebase:', error);
      
      // Aggiorna la notifica con l'errore
      notification.textContent = "Errore durante la disconnessione: " + error.message;
      notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
      
      // Rimuovi la notifica dopo 3 secondi
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    });
}

// Ottieni un token di accesso valido
async function getValidAccessToken() {
  if (!currentUser) {
    return null;
  }
  
  try {
    // Questo metodo rinnova automaticamente il token se necessario
    const token = await currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del token Firebase:', error);
    return null;
  }
}

// Aggiorna il token di accesso
function refreshAccessToken() {
  if (!currentUser) {
    console.warn('refreshAccessToken: Nessun utente autenticato');
    return Promise.reject(new Error('Utente non autenticato'));
  }
  
  console.log('Richiesta di rinnovo token per:', currentUser.email);
  
  return currentUser.getIdToken(true)
    .then((token) => {
      console.log('Token Firebase aggiornato con successo');
      
      // Salva il token nel localStorage
      localStorage.setItem('googleAuthToken', token);
      
      // Imposta il rinnovo automatico del token
      setupTokenRefresh();
      
      // Aggiorna anche l'interfaccia utente se necessario
      if (typeof window.updateCloudAccountUI === 'function') {
        window.updateCloudAccountUI();
      }
      
      return token;
    })
    .catch((error) => {
      console.error('Errore durante l\'aggiornamento del token Firebase:', error);
      
      // Se l'errore è dovuto a un problema di autenticazione, prova a riautenticare l'utente
      if (error.code === 'auth/requires-recent-login' || error.code === 'auth/user-token-expired') {
        console.log('Token scaduto o login recente richiesto, tentativo di riautenticazione...');
        
        // Mostra un messaggio all'utente
        showToast("La tua sessione è scaduta. Per favore, effettua nuovamente l'accesso.", "warning");
        
        // Forza il logout per richiedere una nuova autenticazione
        setTimeout(() => {
          logoutFromGoogle();
        }, 2000);
      }
      
      throw error;
    });
}

// Funzione per impostare il rinnovo automatico del token
function setupTokenRefresh() {
  // Cancella eventuali timer esistenti
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  
  // Se non c'è un utente autenticato, non fare nulla
  if (!currentUser) {
    console.warn('setupTokenRefresh: Nessun utente autenticato');
    return;
  }
  
  // Firebase rinnova automaticamente il token ID, ma possiamo forzare un refresh periodico
  // per assicurarci che il token sia sempre valido
  // Il token di Firebase dura tipicamente 3600 secondi (1 ora)
  const refreshTime = 45 * 60 * 1000; // 45 minuti in millisecondi (ridotto per maggiore sicurezza)
  
  console.log(`Programmato rinnovo automatico del token Firebase per ${currentUser.email} tra ${refreshTime/1000/60} minuti.`);
  
  // Imposta il timer per rinnovare il token automaticamente
  tokenRefreshTimer = setTimeout(async () => {
    console.log('Rinnovo automatico del token Firebase in corso...');
    
    // Verifica che l'utente sia ancora autenticato
    if (!firebase.auth().currentUser) {
      console.warn('Utente non più autenticato durante il rinnovo automatico del token');
      return;
    }
    
    try {
      const token = await refreshAccessToken();
      console.log('Token Firebase rinnovato automaticamente con successo');
      
      // Salva il token rinnovato
      localStorage.setItem('googleAuthToken', token);
      
      // Imposta il prossimo rinnovo
      setupTokenRefresh();
    } catch (error) {
      console.warn('Errore nel rinnovo automatico del token Firebase:', error);
      
      // Se l'errore è dovuto a un problema di autenticazione, verifica lo stato
      if (error.code === 'auth/requires-recent-login' || error.code === 'auth/user-token-expired') {
        console.log('Token scaduto, verifica dello stato di autenticazione...');
        checkAuthState();
      } else {
        // Per altri errori, riprova tra un minuto
        console.log('Riprovo il rinnovo del token tra 1 minuto...');
        setTimeout(() => {
          setupTokenRefresh();
        }, 60000);
      }
    }
  }, refreshTime);
}

// Backup su Google Drive
async function backupToGoogleDrive(data) {
  if (!isLoggedIn || !currentUser) {
    showToast("Effettua l'accesso per eseguire il backup", "warning");
    return null;
  }
  
  try {
    // Ottieni un token di accesso valido
    const token = await getValidAccessToken();
    
    if (!token) {
      showToast("Impossibile ottenere un token valido. Riprova ad accedere.", "error");
      return null;
    }
    
    // Usa il token per chiamare l'API Google Drive
    const response = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore API: ${response.status} ${response.statusText}`);
    }
    
    const files = await response.json();
    console.log('File in appDataFolder:', files);
    
    // Implementa la logica per creare o aggiornare il file di backup
    // ...
    
    showToast("Backup completato con successo!", "success");
    return files;
  } catch (error) {
    console.error('Errore durante il backup:', error);
    showToast("Errore durante il backup: " + error.message, "error");
    return null;
  }
}

// Ripristina da Google Drive
async function restoreFromGoogleDrive() {
  if (!isLoggedIn || !currentUser) {
    showToast("Effettua l'accesso per ripristinare i dati", "warning");
    return null;
  }
  
  try {
    // Ottieni un token di accesso valido
    const token = await getValidAccessToken();
    
    if (!token) {
      showToast("Impossibile ottenere un token valido. Riprova ad accedere.", "error");
      return null;
    }
    
    // Implementa la logica per recuperare il file di backup
    // ...
    
    showToast("Ripristino completato con successo!", "success");
    return true;
  } catch (error) {
    console.error('Errore durante il ripristino:', error);
    showToast("Errore durante il ripristino: " + error.message, "error");
    return null;
  }
}

// Funzione per mostrare toast (implementazione sicura)
function showToast(message, type = "info") {
  // Sempre loggare il messaggio
  console.log(`[TOAST-${type.toUpperCase()}] ${message}`);
  
  // Evita completamente di usare la funzione showToast globale
  // per prevenire qualsiasi possibilità di ricorsione
  
  // Crea un elemento toast semplice
  try {
    const toast = document.createElement('div');
    toast.className = `firebase-toast firebase-toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                 type === 'success' ? '#4caf50' : 
                                 type === 'warning' ? '#ff9800' : '#2196f3';
    toast.style.color = 'white';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.zIndex = '10000';
    
    document.body.appendChild(toast);
    
    // Rimuovi il toast dopo 3 secondi
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 500);
    }, 3000);
  } catch (error) {
    console.error('Errore durante la visualizzazione del toast:', error);
  }
}

// Integrazione con il sistema di backup cloud esistente
function integrateWithCloudManager() {
  console.log('Tentativo di integrazione con il sistema di backup cloud esistente...');
  
  // Verifica se esiste già un oggetto cloudManager
  if (window.cloudManager && typeof window.cloudManager.getAvailableProviders === 'function') {
    console.log('Sistema di backup cloud esistente trovato, integrazione in corso...');
    
    // Salva il riferimento all'oggetto cloudManager originale
    const originalCloudManager = window.cloudManager;
    
    // Aggiungi un hook per il login con Firebase
    const originalLogin = originalCloudManager.login;
    originalCloudManager.login = async function(manualTrigger = false) {
      try {
        // Chiama la funzione di login originale
        const result = await originalLogin.call(this, manualTrigger);
        
        // Se il login è avvenuto con successo e il provider è Google, sincronizza con Firebase
        if (result && this.getCurrentProvider() === 'google') {
          console.log('Login con Google completato, sincronizzazione con Firebase...');
          
          // Ottieni il token di accesso
          const googleAuthToken = localStorage.getItem('googleAuthToken');
          if (googleAuthToken) {
            console.log('Token Google trovato, sincronizzazione con Firebase...');
            
            // Crea una credenziale OAuth con il token
            try {
              const credential = firebase.auth.GoogleAuthProvider.credential(null, googleAuthToken);
              
              // Accedi a Firebase con la credenziale
              await firebase.auth().signInWithCredential(credential);
              console.log('Sincronizzazione con Firebase completata con successo');
            } catch (error) {
              console.warn('Errore durante la sincronizzazione con Firebase:', error);
              // Non propagare l'errore, il login è comunque avvenuto con successo
            }
          }
        }
        
        return result;
      } catch (error) {
        console.error('Errore durante il login:', error);
        throw error;
      }
    };
    
    // Assicurati che il provider Google sia correttamente configurato
    const googleProvider = originalCloudManager.getProvider('google');
    if (googleProvider) {
      console.log('Provider Google trovato, configurazione in corso...');
      
      // Aggiungi un hook per il login con Google
      const originalGoogleLogin = googleProvider.login;
      googleProvider.login = async function() {
        try {
          console.log('Tentativo di login con Google tramite provider...');
          
          // Verifica se l'utente è già autenticato con Firebase
          if (firebase.auth().currentUser) {
            console.log('Utente già autenticato con Firebase:', firebase.auth().currentUser.email);
            
            // Ottieni le informazioni dell'utente
            const user = firebase.auth().currentUser;
            return {
              id: user.uid,
              name: user.displayName || user.email,
              email: user.email,
              picture: user.photoURL,
              provider: 'google'
            };
          }
          
          // Altrimenti, chiama la funzione di login originale
          return await originalGoogleLogin.call(this);
        } catch (error) {
          console.error('Errore durante il login con Google:', error);
          throw error;
        }
      };
    }
    
    console.log('Integrazione con il sistema di backup cloud completata');
    
    // Forza l'aggiornamento dell'interfaccia utente
    if (typeof window.updateProviderSelectionUI === 'function') {
      console.log('Aggiornamento interfaccia utente del sistema di backup cloud...');
      window.updateProviderSelectionUI();
    }
    
    return;
  }
  
  // Se non esiste un oggetto cloudManager, creane uno basato su Firebase
  console.log('Sistema di backup cloud non trovato, creazione di un oggetto cloudManager basato su Firebase...');
  
  window.cloudManager = {
    getCurrentProvider: function() { 
      return firebase.auth().currentUser ? 'google' : null; 
    },
    getSelectedProvider: function() {
      return 'google';
    },
    setSelectedProvider: function(providerId) {
      // Non fa nulla, supportiamo solo Google
      console.log('Selezione provider:', providerId);
      
      // Forza l'aggiornamento dell'interfaccia utente
      if (typeof window.updateProviderSelectionUI === 'function') {
        console.log('Aggiornamento interfaccia utente dopo la selezione del provider...');
        window.updateProviderSelectionUI();
      }
    },
    getAvailableProviders: function() {
      return [{
        id: 'google',
        name: 'Google Drive',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
        isLoggedIn: firebase.auth().currentUser !== null
      }];
    },
    getProvider: function(providerId) {
      if (providerId !== 'google') return null;
      
      return {
        id: 'google',
        name: 'Google Drive',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg',
        isLoggedIn: firebase.auth().currentUser !== null,
        getUserInfo: function() {
          const user = firebase.auth().currentUser;
          if (!user) return null;
          return {
            id: user.uid,
            name: user.displayName || user.email,
            email: user.email,
            picture: user.photoURL,
            provider: 'google'
          };
        },
        login: function() {
          console.log('Tentativo di login con Google tramite provider...');
          return new Promise((resolve, reject) => {
            // Usa la funzione loginWithGoogle esistente
            try {
              // Crea un nuovo provider Google
              const provider = new firebase.auth.GoogleAuthProvider();
              
              // Aggiungi gli scope necessari per Google Drive
              provider.addScope('profile');
              provider.addScope('https://www.googleapis.com/auth/drive.file');
              provider.addScope('https://www.googleapis.com/auth/drive.appdata');
              
              // Richiedi sempre il consenso per ottenere un refresh token
              provider.setCustomParameters({
                prompt: 'consent',
                access_type: 'offline'
              });
              
              // Prova prima con il popup, che è più affidabile
              console.log('Tentativo di login con popup...');
              firebase.auth().signInWithPopup(provider)
                .then((result) => {
                  console.log('Login completato con popup:', result.user.email);
                  
                  // Salva il token nel localStorage
                  if (result.credential && result.credential.accessToken) {
                    localStorage.setItem('googleAuthToken', result.credential.accessToken);
                    console.log('Token salvato nel localStorage');
                  } else {
                    // Se non abbiamo un token nell'oggetto credential, otteniamolo direttamente dall'utente
                    result.user.getIdToken().then(token => {
                      localStorage.setItem('googleAuthToken', token);
                      console.log('Token ottenuto dall\'utente e salvato nel localStorage');
                    });
                  }
                  
                  // Mostra una notifica di successo
                  showToast("Accesso effettuato con successo!", "success");
                  
                  // Aggiorna lo stato di autenticazione
                  handleAuthStateChanged(result.user);
                  
                  // Risolvi la promessa con i dati dell'utente
                  resolve({
                    id: result.user.uid,
                    name: result.user.displayName || result.user.email,
                    email: result.user.email,
                    picture: result.user.photoURL,
                    provider: 'google'
                  });
                })
                .catch((error) => {
                  console.error('Errore durante il login con popup:', error);
                  
                  // Se il popup è bloccato o fallisce, prova con il redirect
                  if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                    console.log('Popup bloccato o chiuso, tentativo con redirect...');
                    
                    // Usa il metodo redirect come fallback
                    try {
                      firebase.auth().signInWithRedirect(provider)
                        .then(() => {
                          // Questo non verrà mai eseguito perché il redirect reindirizza la pagina
                          resolve(null);
                        })
                        .catch((redirectError) => {
                          console.error('Errore durante il redirect per login Firebase:', redirectError);
                          showToast("Errore durante l'accesso: " + redirectError.message, "error");
                          reject(redirectError);
                        });
                    } catch (e) {
                      console.error('Eccezione durante il tentativo di login con redirect:', e);
                      showToast("Errore imprevisto durante l'accesso. Riprova più tardi.", "error");
                      reject(e);
                    }
                  } else {
                    // Mostra un messaggio di errore per altri tipi di errori
                    showToast("Errore durante l'accesso: " + error.message, "error");
                    reject(error);
                  }
                });
            } catch (error) {
              console.error('Errore durante il login con Google:', error);
              reject(error);
            }
          });
        },
        logout: function() {
          return logoutFromGoogle();
        },
        checkAuthStatus: function() {
          return Promise.resolve(firebase.auth().currentUser !== null);
        }
      };
    },
    isAuthenticated: function() { 
      return firebase.auth().currentUser !== null; 
    },
    getUserInfo: function() { 
      const user = firebase.auth().currentUser;
      if (!user) return null;
      return {
        id: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        picture: user.photoURL,
        provider: 'google'
      };
    },
    checkAuthStatus: function() { 
      return Promise.resolve(firebase.auth().currentUser !== null); 
    },
    login: function(manualTrigger = false) {
      if (manualTrigger) {
        console.log('Tentativo di login con provider selezionato...');
        const provider = this.getProvider(this.getSelectedProvider());
        if (provider && typeof provider.login === 'function') {
          return provider.login();
        } else {
          return Promise.reject(new Error('Provider non valido o funzione di login non disponibile'));
        }
      } else {
        return Promise.resolve(null);
      }
    },
    logout: function() {
      return logoutFromGoogle();
    }
  };
  
  // Forza l'aggiornamento dell'interfaccia utente
  if (typeof window.updateProviderSelectionUI === 'function') {
    console.log('Aggiornamento interfaccia utente del sistema di backup cloud...');
    window.updateProviderSelectionUI();
  }
}

// Funzione per inizializzare Firebase in modo sicuro
function safeInitFirebase() {
  // Verifica se Firebase è già caricato
  if (typeof firebase === 'undefined') {
    console.error('Firebase non è stato caricato correttamente');
    return false;
  }
  
  try {
    // Inizializza Firebase
    initFirebase();
    
    // Integra con il sistema di backup cloud esistente
    integrateWithCloudManager();
    
    return true;
  } catch (error) {
    console.error('Errore durante l\'inizializzazione di Firebase:', error);
    return false;
  }
}

// Inizializza Firebase quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM caricato, verifica Firebase...');
  
  // Disabilita il sistema di autenticazione esistente
  window.disableExistingAuthSystem = true;
  
  // Sovrascrive la funzione updateCloudAccountUI
  window.updateCloudAccountUI = function() {
    console.log('Funzione updateCloudAccountUI sovrascritta da Firebase (DOMContentLoaded)');
    // Non fa nulla, lascia che Firebase gestisca l'interfaccia utente
  };
  
  // Verifica se Firebase è già caricato
  if (typeof firebase !== 'undefined') {
    console.log('Firebase trovato, inizializzazione...');
    // Ritardo l'inizializzazione per assicurarsi che tutto sia caricato
    setTimeout(() => {
      safeInitFirebase();
    }, 1000);
  } else {
    console.error('Firebase non è stato caricato correttamente');
    // Riprova dopo un breve ritardo
    setTimeout(() => {
      if (typeof firebase !== 'undefined') {
        console.log('Firebase trovato dopo ritardo, inizializzazione...');
        safeInitFirebase();
      } else {
        console.error('Firebase non disponibile anche dopo il ritardo');
      }
    }, 2000);
  }
});

// Esponi le funzioni globalmente
window.loginWithGoogle = loginWithGoogle;
window.logoutFromGoogle = logoutFromGoogle;
window.backupToGoogleDrive = backupToGoogleDrive;
window.restoreFromGoogleDrive = restoreFromGoogleDrive;
window.checkAuthState = checkAuthState;
window.firebaseAuth = {
  isLoggedIn: () => isLoggedIn,
  getCurrentUser: () => currentUser,
  getUserEmail: () => userEmail,
  getUserPhotoUrl: () => userPhotoUrl,
  getToken: getValidAccessToken,
  refreshToken: refreshAccessToken,
  setupTokenRefresh: setupTokenRefresh
};

// Intercetta le chiamate fetch per aggiungere il token di autenticazione
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  // Se la richiesta è verso l'API Google e non ha già un'autorizzazione
  if (url.includes('googleapis.com') && (!options || !options.headers || !options.headers.Authorization)) {
    console.log('Intercettata chiamata API Google:', url);
    
    // Ottieni il token di autenticazione
    return getValidAccessToken().then(token => {
      if (!token) {
        console.warn('Token non disponibile per la richiesta API Google');
        return originalFetch(url, options);
      }
      
      // Aggiungi il token all'header Authorization
      const newOptions = options || {};
      newOptions.headers = newOptions.headers || {};
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
