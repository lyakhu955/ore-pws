// Integrazione di Whisper Web per il riconoscimento vocale avanzato
// Versione semplificata che utilizza la Web Speech API con fallback

// Funzione per registrare audio e restituire un blob
function recordAudio(timeLimit = 5000) { // Ridotto a 5 secondi per default
    return new Promise(async (resolve, reject) => {
        try {
            // Opzioni ottimizzate per velocità
            const constraints = { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000, // Ridotta per elaborazione più veloce
                    channelCount: 1    // Mono invece di stereo
                } 
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Usa un bitrate più basso per elaborazione più veloce
            const options = { 
                audioBitsPerSecond: 16000,
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            };
            
            const mediaRecorder = new MediaRecorder(stream, options);
            const audioChunks = [];
            
            // Inizia a raccogliere dati più frequentemente
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: options.mimeType });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Ferma tutti i track dello stream
                stream.getTracks().forEach(track => track.stop());
                
                resolve({ audioBlob, audioUrl });
            });
            
            // Inizia la registrazione
            mediaRecorder.start(100); // Raccoglie dati ogni 100ms invece del default
            
            // Imposta un timeout per fermare la registrazione
            setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }, timeLimit);
        } catch (error) {
            console.warn('Errore nella registrazione audio:', error);
            reject(error);
        }
    });
}

// Funzione principale per il riconoscimento vocale avanzato
async function advancedVoiceRecognition(timeLimit = 3000) { // Ridotto a 3 secondi per velocizzare
    try {
        // Mostra un indicatore di registrazione
        showRecordingIndicator();
        
        // Usa il riconoscimento diretto se siamo su mobile per maggiore velocità
        if (window.WhisperAI.isMobile()) {
            return await new Promise((resolve, reject) => {
                directSpeechRecognition(resolve, reject, timeLimit);
            });
        }
        
        // Registra l'audio (solo su desktop)
        const { audioBlob, audioUrl } = await recordAudio(timeLimit);
        
        // Nascondi l'indicatore di registrazione
        hideRecordingIndicator();
        
        // Utilizza direttamente la Web Speech API senza riprodurre l'audio
        return new Promise((resolve, reject) => {
            // Utilizza direttamenteCrea un oggetto SpeechRecognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                // Se SpeechRecognition non è disponibile, prova a usare il riconoscimento diretto
                return directSpeechRecognition(resolve, reject);
            // Se SpeechRecognition non è disponibile, prova a usare il riconoscimento diretto
                return directSpeechRecognition(resolve, reject, timeLimit)}
            resolve("");
                    }, timeLimit + 1000); // Solo 1 secondo extra
                    resolve(""); // Risolvi con stringa vuota in caso di timeout
                } catch (e) {
                    console.error("Errore durante il timeout:", e);
            const recognition = new SpeechRecognition();
            recognition.lang = 'it-IT';
            recognition.continuous = false;
                if (recognition.interimResults = false;
           Imposta un timeout più breve
            const timeoutId = setTimeout(() => {
                clearTimeout(timeoutId);
                            // Imposta un timeout di sicurezza
            const timeoutId = setTimeout(() => {
                try {
                    if (recognition.state !== 'inactive') {
                        recognition.stop();
                    }
                    resolve(""); // Risolvi con stringa vuota in caso di timeout
                } catch (e) {
                    console.error("Errore durante il timeout:", e);
                    resolve("");
                }
            }, timeLimit + 2000); // Aggiungi 2 secondi al timeout per sicurezza
            
            recognition.onresult = (event) => {
                clearTimeout(timeoutId);
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                resolve(transcript);
            };
            
            recognition.onerror = (event) => {
                clearTimeout(timeoutId);
                console.warn(`Errore nel riconoscimento vocale: ${event.error}`);
                // Invece di fallire, prova il metodo diretto
                directSpeechRecognition(resolve, reject);
            };
            
            // Avvia direttamente il riconoscimento senza riprodurre l'audio
            try {
                recognition.start();
            } catch (e) {
                clearTimeout(timeoutId);
                console.warn("Errore nell'avvio del riconoscimento:", e);
                directSpeechRecognition(resolve, reject);
            }
        });
    } catch (error) {
        console.error('Errore nel riconoscimento vocale avanzato:', error);
        hideRecordingIndicator();
        return null;
    }
}

// Funzione di fallback per il riconoscimento vocale diretto
function directSpeechRecognition(resolve, reject) {
    // Usa direttamente il riconoscimento vocale del browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        resolve(""); // Se non è supportato, ritorna stringa vuota
        return;
    }
    clearTimeout(timeoutId);
                console.warn(`Errore nel riconoscimento vocale: ${event.error}`);
                // Invece di fallire, prova il metodo diretto
                directSpeechRecognition(resolve, reject, timeLimit);
            };
            
            // Avvia direttamente il riconoscimento senza riprodurre l'audio
            try {
                recognition.start();
            } catch (e) {
                clearTimeout(timeoutId);
                console.warn("Errore nell'avvio del riconoscimento:", e);
                directSpeechRecognition(resolve, reject, timeLimit);
            }
        });
    } catch (error) {
        console.error('Errore nel riconoscimento vocale avanzato:', error);
        hideRecordingIndicator();
        return null;
    }
}

// Funzione di fallback per il riconoscimento vocale diretto
function directSpeechRecognition(resolve, reject, timeLimit = 3000) {
    // Usa direttamente il riconoscimento vocale del browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        hideRecordingIndicator();
        resolve(""); // Se non è supportato, ritorna stringa vuota
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // Configurazioni per velocizzare il riconoscimento
    recognition.maxAlternatives = 1; // Riduci le alternative per velocizzare
    
    // Timeout più breve
    const timeoutId = setTimeout(() => {
        try {
            if (recognition.state !== 'inactive') {
                recognition.stop();
            }
            hideRecordingIndicator();
            resolve(""); // Risolvi con stringa vuota in caso di timeout
        } catch (e) {
            hideRecordingIndicator();
            resolve("");
        }
    }, timeLimit);
    
    recognition.onresult = (event) => {
        clearTimeout(timeoutId);
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        hideRecordingIndicator();
        resolve(transcript);
    };
    
    recognition.onend = () => {
        clearTimeout(timeoutId);
        hideRecordingIndicator();
    };
    
    recognition.onerror = (event) => {
        clearTimeout(timeoutId);
        console.warn(`Errore nel riconoscimento vocale diretto: ${event.error}`);
        hideRecordingIndicator();
        resolve(""); // Risolvi con stringa vuota in caso di errore
    };
    
    try {
        recognition.start();
    } catch (e) {
        clearTimeout(timeoutId);
        console.error("Impossibile avviare il riconoscimento vocale:", e);
        hideRecordingIndicator();
        resolve("");
    }
}

// Funzioni di supporto per l'interfaccia utente
function showRecordingIndicator() {
    // Crea o mostra un indicatore di registrazione
    let indicator = document.getElementById('whisper-recording-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'whisper-recording-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '80px'; // Posizionato più in alto per evitare sovrapposizioni
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.85)';
        indicator.style.color = 'white';
        indicator.style.padding = '12px 24px';
        indicator.style.borderRadius = '24px';
        indicator.style.zIndex = '9999';
        indicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        indicator.style.fontWeight = 'bold';
        indicator.style.fontSize = '16px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.gap = '10px';
        
        // Aggiungi un'animazione pulsante
        indicator.innerHTML = `
            <div style="width: 12px; height: 12px; background-color: white; border-radius: 50%; 
                        animation: pulse 1s infinite alternate;">
            </div>
            <span>Registrazione in corso...</span>
        `;
        
        // Aggiungi lo stile dell'animazione
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(0.8); opacity: 0.7; }
                100% { transform: scale(1.2); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
    } else {
        indicator.style.display = 'flex';
    }
    
    // Vibrazione sul telefono (se supportata)
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]); // Vibrazione breve per feedback
    }
}

function hideRecordingIndicator() {
    const indicator = document.getElementById('whisper-recording-indicator');
    if (indicator) {
        // Aggiungi una transizione di fade-out
        indicator.style.transition = 'opacity 0.5s ease';
        indicator.style.opacity = '0';
        
        // Rimuovi l'elemento dopo la transizione
        setTimeout(() => {
            indicator.style.display = 'none';
            indicator.style.opacity = '1';
        }, 500);
    }
    
    // Vibrazione sul telefono (se supportata) per indicare la fine
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// Esporta le funzioni
window.WhisperAI = {
    transcribe: advancedVoiceRecognition,
    
    // Funzione di inizializzazione migliorata
    init: function() {
        return new Promise((resolve, reject) => {
            // Verifica se il browser supporta le API necessarie
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Il browser non supporta mediaDevices.getUserMedia');
                resolve(false);
                return;
            }
            
            // Verifica se il riconoscimento vocale è supportato
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('Il browser non supporta SpeechRecognition');
                resolve(false);
                return;
            }
            
            // Richiedi il permesso per il microfono in anticipo
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Ferma lo stream subito dopo aver ottenuto il permesso
                    stream.getTracks().forEach(track => track.stop());
                    console.log('Permesso microfono ottenuto con successo');
                    resolve(true);
                })
                .catch(err => {
                    console.warn('Errore nell\'ottenere il permesso per il microfono:', err);
                    resolve(false);
                });
        });
    },
    
    // Metodo per verificare se il dispositivo è mobile
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        resolve(transcript);
    };
    
    recognition.onerror = (event) => {
        console.warn(`Errore nel riconoscimento vocale diretto: ${event.error}`);
        resolve(""); // Risolvi con stringa vuota in caso di errore
    };
    
    try {
        recognition.start();
    } catch (e) {
        console.error("Impossibile avviare il riconoscimento vocale:", e);
        resolve("");
    }
}

// Funzioni di supporto per l'interfaccia utente
function showRecordingIndicator() {
    // Crea o mostra un indicatore di registrazione
    let indicator = document.getElementById('whisper-recording-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'whisper-recording-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '80px'; // Posizionato più in alto per evitare sovrapposizioni
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.85)';
        indicator.style.color = 'white';
        indicator.style.padding = '12px 24px';
        indicator.style.borderRadius = '24px';
        indicator.style.zIndex = '9999';
        indicator.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        indicator.style.fontWeight = 'bold';
        indicator.style.fontSize = '16px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.gap = '10px';
        
        // Aggiungi un'animazione pulsante
        indicator.innerHTML = `
            <div style="width: 12px; height: 12px; background-color: white; border-radius: 50%; 
                        animation: pulse 1s infinite alternate;">
            </div>
            <span>Registrazione in corso...</span>
        `;
        
        // Aggiungi lo stile dell'animazione
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(0.8); opacity: 0.7; }
                100% { transform: scale(1.2); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
    } else {
        indicator.style.display = 'flex';
    }
    
    // Vibrazione sul telefono (se supportata)
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]); // Vibrazione breve per feedback
    }
}

function hideRecordingIndicator() {
    const indicator = document.getElementById('whisper-recording-indicator');
    if (indicator) {
        // Aggiungi una transizione di fade-out
        indicator.style.transition = 'opacity 0.5s ease';
        indicator.style.opacity = '0';
        
        // Rimuovi l'elemento dopo la transizione
        setTimeout(() => {
            indicator.style.display = 'none';
            indicator.style.opacity = '1';
        }, 500);
    }
    
    // Vibrazione sul telefono (se supportata) per indicare la fine
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// Esporta le funzioni
window.WhisperAI = {
    transcribe: advancedVoiceRecognition,
    
    // Funzione di inizializzazione migliorata
    init: function() {
        return new Promise((resolve, reject) => {
            // Verifica se il browser supporta le API necessarie
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Il browser non supporta mediaDevices.getUserMedia');
                resolve(false);
                return;
            }
            
            // Verifica se il riconoscimento vocale è supportato
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('Il browser non supporta SpeechRecognition');
                resolve(false);
                return;
            }
            
            // Richiedi il permesso per il microfono in anticipo
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Ferma lo stream subito dopo aver ottenuto il permesso
                    stream.getTracks().forEach(track => track.stop());
                    console.log('Permesso microfono ottenuto con successo');
                    resolve(true);
                })
                .catch(err => {
                    console.warn('Errore nell\'ottenere il permesso per il microfono:', err);
                    resolve(false);
                });
        });
    },
    
    // Metodo per verificare se il dispositivo è mobile
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
};
