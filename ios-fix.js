// 🍎 iOS Datepicker Fix
// Questo script applica correzioni specifiche per iOS al datepicker

// iOS Detection
window.isIOS = function() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Patch per Flatpickr su iOS
if (window.isIOS()) {
    console.log('🍎 iOS rilevato - Applicando correzioni datepicker');
    
    // Quando Flatpickr è caricato, applica le correzioni
    document.addEventListener('DOMContentLoaded', function() {
        // Aspetta che Flatpickr sia disponibile
        const checkFlatpickr = setInterval(() => {
            if (typeof flatpickr !== 'undefined') {
                clearInterval(checkFlatpickr);
                
                // Override della configurazione Flatpickr per iOS
                const originalFlatpickr = window.flatpickr;
                window.flatpickr = function(element, options = {}) {
                    // Su iOS, usa il picker native
                    options.disableMobile = false;
                    console.log('🍎 iOS: Usando picker nativo per', element);
                    return originalFlatpickr(element, options);
                };
                
                // Mantieni le proprietà originali
                Object.setPrototypeOf(window.flatpickr, originalFlatpickr);
                Object.assign(window.flatpickr, originalFlatpickr);
            }
        }, 100);
    });
}