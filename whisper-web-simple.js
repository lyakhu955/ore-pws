// Integrazione di Whisper Web per il riconoscimento vocale avanzato
// Versione semplificata che utilizza la Web Speech API con fallback

// Funzione per registrare audio e restituire un blob
function recordAudio(timeLimit = 10000) { // Limite di 10 secondi per default
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Ferma tutti i track dello stream
                stream.getTracks().forEach(track => track.stop());
                
                resolve({ audioBlob, audioUrl });
            });
            
            // Inizia la registrazione
            mediaRecorder.start();
            
            // Imposta un timeout per fermare la registrazione
            setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }, timeLimit);
        } catch (error) {
            reject(error);
        }
    });
}

// Funzione principale per il riconoscimento vocale avanzato
async function advancedVoiceRecognition(timeLimit = 5000) {
    try {
        // Mostra un indicatore di registrazione
        showRecordingIndicator();
        
        // Registra l'audio
        const { audioBlob, audioUrl } = await recordAudio(timeLimit);
        
        // Nascondi l'indicatore di registrazione
        hideRecordingIndicator();
        
        // Crea un elemento audio per riprodurre l'audio registrato (opzionale)
        const audioElement = new Audio(audioUrl);
        
        // Utilizza la Web Speech API per trascrivere l'audio
        return new Promise((resolve, reject) => {
            // Crea un oggetto SpeechRecognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                reject(new Error('Il riconoscimento vocale non è supportato in questo browser'));
                return;
            }
            
            const recognition = new SpeechRecognition();
            recognition.lang = 'it-IT';
            recognition.continuous = false;
            recognition.interimResults = false;
            
            // Riproduci l'audio registrato e avvia il riconoscimento
            audioElement.onplay = () => {
                recognition.start();
            };
            
            audioElement.onended = () => {
                // Se il riconoscimento è ancora attivo, fermalo
                if (recognition.state !== 'inactive') {
                    recognition.stop();
                }
            };
            
            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                resolve(transcript);
            };
            
            recognition.onerror = (event) => {
                reject(new Error(`Errore nel riconoscimento vocale: ${event.error}`));
            };
            
            // Avvia la riproduzione dell'audio
            audioElement.play();
        });
    } catch (error) {
        console.error('Errore nel riconoscimento vocale avanzato:', error);
        hideRecordingIndicator();
        return null;
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
        indicator.style.bottom = '20px';
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        indicator.style.color = 'white';
        indicator.style.padding = '10px 20px';
        indicator.style.borderRadius = '20px';
        indicator.style.zIndex = '9999';
        indicator.textContent = 'Registrazione in corso...';
        document.body.appendChild(indicator);
    } else {
        indicator.style.display = 'block';
    }
}

function hideRecordingIndicator() {
    const indicator = document.getElementById('whisper-recording-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Esporta le funzioni
window.WhisperAI = {
    transcribe: advancedVoiceRecognition,
    init: () => Promise.resolve(true) // Funzione fittizia per compatibilità
};