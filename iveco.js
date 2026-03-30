/* ================================================ */
/* ðŸšŒ IVECO ORECCHIA MODE - JavaScript              */
/* Logica completa per la gestione mezzi            */
/* ================================================ */

(function() {
    'use strict';

    // ============================================================
    // COSTANTI E STORAGE
    // ============================================================
    const STORAGE_KEY_VEHICLES   = 'iveco_vehicles';    // Lista mezzi
    const STORAGE_KEY_ATM_NOTES  = 'iveco_atm_notes';   // Note ATM
    const STORAGE_KEY_MODE       = 'iveco_mode_active';  // Stato modalitÃ 

    // ============================================================
    // STATO APPLICAZIONE
    // ============================================================
    let ivecoState = {
        vehicles   : [],   // [{ telaio: '5926', vettura: '1234', done: false, id: 'uuid' }]
        atmNotes   : {},   // { vehicleId: [{ text: '...', done: false, id: 'uuid' }] }
        activeSection: 'elenco',
        excelData  : null, // dati Excel raw
        excelColTelaio : 0,
        excelColVettura: 1,
        excelColStato  : -1, // -1 = non usata
        atmFilter  : 'todo',
        elencoFilter: 'all'  // 'all' | 'done' | 'todo'
    };

    // ============================================================
    // UTILITY
    // ============================================================
    function uuid() {
        return 'iv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    function saveVehicles() {
        try { localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(ivecoState.vehicles)); } catch(e) {}
        if (typeof window.ivecoTriggerBackup === 'function') window.ivecoTriggerBackup();
    }

    function saveAtmNotes() {
        try { localStorage.setItem(STORAGE_KEY_ATM_NOTES, JSON.stringify(ivecoState.atmNotes)); } catch(e) {}
        if (typeof window.ivecoTriggerBackup === 'function') window.ivecoTriggerBackup();
    }

    function loadData() {
        try {
            const v = localStorage.getItem(STORAGE_KEY_VEHICLES);
            if (v) ivecoState.vehicles = JSON.parse(v);
        } catch(e) { ivecoState.vehicles = []; }

        try {
            const n = localStorage.getItem(STORAGE_KEY_ATM_NOTES);
            if (n) ivecoState.atmNotes = JSON.parse(n);
        } catch(e) { ivecoState.atmNotes = {}; }
    }

    // Esponi saveVehicles globalmente per iveco-attachments.js
    window.ivecoSaveVehicles = function() {
        saveVehicles();
    };

    // Esponi loadData globalmente per permettere al restore backup di ricaricare i dati Iveco
    window.ivecoLoadData = function() {
        loadData();
        // Se la modalitÃ  Iveco Ã¨ attiva, ri-renderizza la sezione corrente
        if (document.body.classList.contains('iveco-mode')) {
            if (typeof renderCurrentSection === 'function') renderCurrentSection();
        }
    };

    // Estrai ultimi 4 caratteri dal numero telaio
    function extractTelaio(raw) {
        if (!raw) return '';
        const str = String(raw).trim();
        return str.length > 4 ? str.slice(-4) : str;
    }

    // Normalizza N.Vettura (giÃ  4 cifre)
    function extractVettura(raw) {
        if (!raw) return '';
        return String(raw).trim();
    }

    // Lettera colonna â†’ indice (A=0, B=1, ...)
    function colLetterToIndex(letter) {
        return letter.toUpperCase().charCodeAt(0) - 65;
    }

    // Indice â†’ lettera colonna
    function indexToColLetter(idx) {
        return String.fromCharCode(65 + idx);
    }

    // Mostra toast (usa la funzione del sito principale o fallback)
    function showIvecoToast(msg, type = 'info', duration = 3000) {
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(msg, type, duration);
            return;
        }
        // Fallback toast
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
            padding:0.8rem 1.5rem;border-radius:50px;font-size:0.9rem;font-weight:600;
            z-index:99998;color:white;box-shadow:0 4px 20px rgba(0,0,0,0.3);
            transition:opacity 0.3s;background:${type==='success'?'#2ecc71':type==='error'?'#e74c3c':'#4A90D9'};`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, duration);
    }

    // ============================================================
    // SWIPE DESTRA SUL LOGO PWS â†’ entra in modalitÃ  Iveco
    // ============================================================
    function setupPwsSwipe() {
        const logo = document.getElementById('pws-logo');
        if (!logo) return;

        let startX = 0, startY = 0, tracking = false;

        // --- TOUCH ---
        logo.addEventListener('touchstart', (e) => {
            startX    = e.touches[0].clientX;
            startY    = e.touches[0].clientY;
            tracking  = true;
            logo.style.transition = 'transform 0.1s';
        }, { passive: true });

        logo.addEventListener('touchmove', (e) => {
            if (!tracking) return;
            const dx = e.touches[0].clientX - startX;
            if (dx > 0) {
                logo.style.transform = `translateX(${Math.min(dx * 0.4, 30)}px)`;
            }
        }, { passive: true });

        logo.addEventListener('touchend', (e) => {
            if (!tracking) return;
            tracking = false;
            logo.style.transform = '';
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > 55 && dy < 50) {
                activateIvecoMode();
            }
        }, { passive: true });

        logo.addEventListener('touchcancel', () => {
            tracking = false;
            logo.style.transform = '';
        }, { passive: true });

        // --- MOUSE (desktop) ---
        let mouseStartX = 0, mouseStartY = 0, mouseTracking = false;

        logo.addEventListener('mousedown', (e) => {
            mouseTracking = true;
            mouseStartX   = e.clientX;
            mouseStartY   = e.clientY;
            logo.style.transition = 'transform 0.1s';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!mouseTracking) return;
            const dx = e.clientX - mouseStartX;
            if (dx > 0) {
                logo.style.transform = `translateX(${Math.min(dx * 0.4, 30)}px)`;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (!mouseTracking) return;
            mouseTracking = false;
            logo.style.transform = '';
            const dx = e.clientX - mouseStartX;
            const dy = Math.abs(e.clientY - mouseStartY);
            if (dx > 55 && dy < 50) {
                activateIvecoMode();
            }
        });
    }

    // ============================================================
    // SWIPE DESTRA SUL LOGO IVECO â†’ torna a modalitÃ  PWS
    // ============================================================
    function setupIvecoSwipe() {
        const logoWrap = document.getElementById('iveco-logo-wrap');
        if (!logoWrap) return;

        let startX = 0, startY = 0, tracking = false;

        // --- TOUCH ---
        logoWrap.addEventListener('touchstart', (e) => {
            startX   = e.touches[0].clientX;
            startY   = e.touches[0].clientY;
            tracking = true;
            logoWrap.style.transition = 'transform 0.1s';
        }, { passive: true });

        logoWrap.addEventListener('touchmove', (e) => {
            if (!tracking) return;
            const dx = e.touches[0].clientX - startX;
            if (dx > 0) {
                logoWrap.style.transform = `translateX(${Math.min(dx * 0.4, 30)}px)`;
            }
        }, { passive: true });

        logoWrap.addEventListener('touchend', (e) => {
            if (!tracking) return;
            tracking = false;
            logoWrap.style.transform = '';
            const dx = e.changedTouches[0].clientX - startX;
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > 55 && dy < 50) {
                deactivateIvecoMode();
            }
        }, { passive: true });

        logoWrap.addEventListener('touchcancel', () => {
            tracking = false;
            logoWrap.style.transform = '';
        }, { passive: true });

        // --- MOUSE (desktop) ---
        let mouseStartX = 0, mouseStartY = 0, mouseTracking = false;

        logoWrap.addEventListener('mousedown', (e) => {
            mouseTracking = true;
            mouseStartX   = e.clientX;
            mouseStartY   = e.clientY;
            logoWrap.style.transition = 'transform 0.1s';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!mouseTracking) return;
            const dx = e.clientX - mouseStartX;
            if (dx > 0) {
                logoWrap.style.transform = `translateX(${Math.min(dx * 0.4, 30)}px)`;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (!mouseTracking) return;
            mouseTracking = false;
            logoWrap.style.transform = '';
            const dx = e.clientX - mouseStartX;
            const dy = Math.abs(e.clientY - mouseStartY);
            if (dx > 55 && dy < 50) {
                deactivateIvecoMode();
            }
        });
    }

    // ============================================================
    // ATTIVA / DISATTIVA MODALITÃ€ IVECO
    // ============================================================

    // Elementi PWS da nascondere forzatamente (il dark theme li rimette con !important)
    const PWS_UI_SELECTORS = [
        'header',
        'main',
        'nav.bottom-nav',
        '#pws-particles-container'
    ];

    function hideNativeUI() {
        PWS_UI_SELECTORS.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                el.setAttribute('data-iveco-hidden', 'true');
                el.style.setProperty('display',    'none',   'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity',    '0',      'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.style.setProperty('bottom',     '-9999px','important');
            }
        });
    }

    function showNativeUI() {
        PWS_UI_SELECTORS.forEach(sel => {
            const el = document.querySelector(sel);
            if (el && el.getAttribute('data-iveco-hidden')) {
                el.removeAttribute('data-iveco-hidden');
                el.style.removeProperty('display');
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
                el.style.removeProperty('pointer-events');
                el.style.removeProperty('bottom');
            }
        });
    }

    function activateIvecoMode() {
        loadData();
        document.body.classList.add('iveco-mode');
        hideNativeUI();
        renderCurrentSection();
        localStorage.setItem(STORAGE_KEY_MODE, 'true');
        showIvecoToast('ðŸšŒ ModalitÃ  Iveco Orecchia attivata!', 'success', 2000);
    }

    function deactivateIvecoMode() {
        restoreSettingsFromIveco();
        document.body.classList.remove('iveco-mode');
        showNativeUI();
        localStorage.removeItem(STORAGE_KEY_MODE);
        showIvecoToast('ðŸ‘‹ ModalitÃ  PWS ripristinata!', 'info', 2000);
    }

    // ============================================================
    // NAVIGAZIONE SEZIONI
    // ============================================================
    function navigateTo(section) {
        ivecoState.activeSection = section;

        // Aggiorna nav items
        document.querySelectorAll('#iveco-nav .iveco-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Mostra/nascondi sezioni
        document.querySelectorAll('.iveco-section').forEach(s => {
            s.classList.toggle('active', s.id === 'iveco-' + section);
        });

        renderCurrentSection();
    }

    function renderCurrentSection() {
        switch (ivecoState.activeSection) {
            case 'elenco':     renderElenco();    break;
            case 'note':       renderNoteATM();   break;
            case 'aggiungi':   renderAggiungi();  break;
            case 'impostazioni': renderImpostazioni(); break;
        }
    }

    // ============================================================
    // SEZIONE 1: ELENCO MEZZI
    // ============================================================
    function renderElenco() {
        const container = document.getElementById('iveco-elenco-list');
        const searchInput = document.getElementById('iveco-search');
        if (!container) return;

        const query = searchInput ? searchInput.value.toLowerCase() : '';

        // Mostra/nascondi pulsante X nella search bar
        const clearBtn = document.getElementById('iveco-search-clear');
        if (clearBtn) {
            clearBtn.style.display = query ? 'flex' : 'none';
            // Aggiusta padding input per non sovrapporre il testo con la X
            const inp = document.getElementById('iveco-search');
            if (inp) inp.style.paddingRight = query ? '4.5rem' : '2.5rem';
        }

        // Aggiorna chip attivi
        document.querySelectorAll('.iveco-stat-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === ivecoState.elencoFilter);
        });

        // Filtra e ordina per numero vettura crescente
        let list = [...ivecoState.vehicles];
        if (query) {
            list = list.filter(v =>
                v.vettura.toLowerCase().includes(query) ||
                v.telaio.toLowerCase().includes(query)
            );
        }

        // Applica filtro completato/da fare
        if (ivecoState.elencoFilter === 'done') {
            list = list.filter(v => v.done);
        } else if (ivecoState.elencoFilter === 'todo') {
            list = list.filter(v => !v.done);
        }

        // Ordina per N. Vettura numericamente
        list.sort((a, b) => {
            const na = parseInt(a.vettura) || 0;
            const nb = parseInt(b.vettura) || 0;
            return na - nb;
        });

        // Statistiche
        const total = ivecoState.vehicles.length;
        const done  = ivecoState.vehicles.filter(v => v.done).length;
        const todo  = total - done;

        const statTotal = document.getElementById('iveco-stat-total');
        const statDone  = document.getElementById('iveco-stat-done');
        const statTodo  = document.getElementById('iveco-stat-todo');
        if (statTotal) statTotal.textContent = total;
        if (statDone)  statDone.textContent  = done;
        if (statTodo)  statTodo.textContent  = todo;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="iveco-empty-state">
                    <span class="material-symbols-outlined">directions_bus</span>
                    <p>${query ? 'Nessun mezzo trovato per "' + query + '"' : 'Nessun mezzo caricato.<br>Vai su <strong>Aggiungi</strong> per caricare un file Excel.'}</p>
                </div>`;
            return;
        }

        container.innerHTML = list.map((v, idx) => `
            <div class="iveco-vehicle-item ${v.done ? 'completed' : ''}" data-id="${v.id}">
                <div class="iveco-vehicle-number">${idx + 1}</div>
                <div class="iveco-vehicle-info">
                    <div class="iveco-vehicle-field">
                        <label>Telaio</label>
                        <span>${v.telaio}</span>
                    </div>
                    <div class="iveco-vehicle-field">
                        <label>N. Vettura</label>
                        <span>${v.vettura}</span>
                    </div>
                </div>
                <button class="iveco-gallery-btn" data-id="${v.id}" title="Foto e video allegati">
                    <span class="material-symbols-outlined">photo_library</span>
                    <span class="iveco-gallery-badge" style="display:${(v.attachments && v.attachments.length > 0) ? 'flex' : 'none'}">${(v.attachments && v.attachments.length) || 0}</span>
                </button>
                ${v.done && v.doneDate ? `<div class="iveco-done-date" title="Data completamento"><span class="material-symbols-outlined">event</span>${v.doneDate}</div>` : ''}
                <div class="iveco-check ${v.done ? 'checked' : ''}" data-id="${v.id}" title="${v.done ? 'Lavoro completato' : 'Segna come completato'}">
                    <span class="material-symbols-outlined">${v.done ? 'check' : ''}</span>
                </div>
            </div>
        `).join('');

        // Check listener con popup data
        container.querySelectorAll('.iveco-check').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const v  = ivecoState.vehicles.find(x => x.id === id);
                if (!v) return;

                if (v.done) {
                    // Riapri il mezzo: toglie done e data
                    v.done = false;
                    v.doneDate = null;
                    saveVehicles();
                    renderElenco();
                    showIvecoToast('â†©ï¸ Mezzo riaperto', 'info', 2000);
                } else {
                    // Mostra popup per scegliere la data
                    showVehicleDatePopup(v, null, (selectedDate) => {
                        v.done = true;
                        v.doneDate = selectedDate;
                        saveVehicles();
                        renderElenco();
                        showIvecoToast('âœ… Mezzo completato!', 'success', 2000);
                    });
                }
            });
        });

        // Listener bottone galleria
        container.querySelectorAll('.iveco-gallery-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const v  = ivecoState.vehicles.find(x => x.id === id);
                if (!v) return;
                if (window.ivecoAttachments) {
                    window.ivecoAttachments.openGallery(v);
                }
            });
        });

        // Listener click sul badge data per modificarla
        container.querySelectorAll('.iveco-done-date').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = badge.closest('.iveco-vehicle-item');
                if (!item) return;
                const id = item.dataset.id;
                const v  = ivecoState.vehicles.find(x => x.id === id);
                if (!v) return;
                showVehicleDatePopup(v, v.doneDate, (selectedDate) => {
                    v.doneDate = selectedDate;
                    saveVehicles();
                    renderElenco();
                    showIvecoToast('ðŸ“… Data aggiornata!', 'success', 2000);
                });
            });
        });
    }

    // ============================================================
    // POPUP DATA COMPLETAMENTO VEICOLO
    // ============================================================
    function showVehicleDatePopup(vehicle, initialDate, onConfirm) {
        // Rimuovi popup precedente se esiste
        const existing = document.getElementById('iveco-date-popup-overlay');
        if (existing) existing.remove();

        // Data di oggi nel formato YYYY-MM-DD per l'input
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Converti initialDate da DD/MM/YYYY a YYYY-MM-DD se presente
        let initialStr = todayStr;
        if (initialDate) {
            const parts = initialDate.split('/');
            if (parts.length === 3) {
                initialStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        // Data formattata in italiano per la visualizzazione
        const formatDate = (dateStr) => {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        };

        const overlay = document.createElement('div');
        overlay.id = 'iveco-date-popup-overlay';
        overlay.innerHTML = `
            <div id="iveco-date-popup">
                <div class="iveco-date-popup-header">
                    <span class="material-symbols-outlined">event_available</span>
                    <h3>Data di completamento</h3>
                </div>
                <p class="iveco-date-popup-sub">Vettura <strong>${escapeHtml(vehicle.vettura)}</strong> Â· Telaio <strong>${escapeHtml(vehicle.telaio)}</strong></p>
                <div class="iveco-date-popup-input-wrap">
                    <label for="iveco-date-input">Seleziona data</label>
                    <input type="date" id="iveco-date-input" value="${initialStr}" max="${todayStr}" />
                </div>
                <div class="iveco-date-popup-actions">
                    <button id="iveco-date-cancel" class="iveco-date-btn cancel">Annulla</button>
                    <button id="iveco-date-confirm" class="iveco-date-btn confirm">
                        <span class="material-symbols-outlined">check</span> Conferma
                    </button>
                </div>

                <div class="iveco-date-popup-upload-section">
                    <div class="iveco-date-popup-upload-divider">
                        <span>Vuoi allegare foto o video?</span>
                    </div>
                    <label class="iveco-date-popup-upload-btn">
                        <span class="material-symbols-outlined">add_photo_alternate</span>
                        Aggiungi foto/video
                        <input type="file" id="iveco-date-file-input" accept="image/*,video/*" multiple style="display:none">
                    </label>
                    <div id="iveco-date-upload-progress" style="display:none">
                        <div class="iveco-date-progress-bar"><div class="iveco-date-progress-fill" id="iveco-date-progress-fill"></div></div>
                        <small id="iveco-date-progress-label">Caricamento...</small>
                    </div>
                    <div id="iveco-date-upload-list" class="iveco-date-upload-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Anima apertura
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const closePopup = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 280);
        };

        document.getElementById('iveco-date-cancel').addEventListener('click', closePopup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });

        document.getElementById('iveco-date-confirm').addEventListener('click', () => {
            const input = document.getElementById('iveco-date-input');
            const selected = input.value;
            if (!selected) {
                input.style.borderColor = '#e74c3c';
                return;
            }
            closePopup();
            onConfirm(formatDate(selected));
        });

        // Upload rapido dal popup data
        const fileInput = document.getElementById('iveco-date-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (!files.length || !window.ivecoAttachments) return;

                const progressWrap = document.getElementById('iveco-date-upload-progress');
                const progressFill = document.getElementById('iveco-date-progress-fill');
                const progressLabel = document.getElementById('iveco-date-progress-label');
                const uploadList   = document.getElementById('iveco-date-upload-list');

                progressWrap.style.display = 'block';
                if (!vehicle.attachments) vehicle.attachments = [];

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    progressLabel.textContent = `${i + 1}/${files.length}: ${file.name}`;
                    progressFill.style.width = '0%';
                    try {
                        const driveId = await window.ivecoAttachments._uploadFile(file, vehicle.id, (pct) => {
                            progressFill.style.width = pct + '%';
                        });
                        const att = { driveId, name: file.name, mimeType: file.type, uploadedAt: new Date().toISOString() };
                        vehicle.attachments.push(att);
                        window.ivecoSaveVehicles();
                        window.ivecoAttachments.updateBadge(vehicle);

                        // Mostra file caricato nella lista
                        const item = document.createElement('div');
                        item.className = 'iveco-date-upload-item';
                        item.innerHTML = `<span class="material-symbols-outlined">${file.type.startsWith('video/') ? 'videocam' : 'image'}</span><span>${escapeHtml(file.name)}</span><span class="iveco-date-upload-ok">âœ“</span>`;
                        uploadList.appendChild(item);
                    } catch (err) {
                        const item = document.createElement('div');
                        item.className = 'iveco-date-upload-item error';
                        item.innerHTML = `<span class="material-symbols-outlined">error</span><span>${escapeHtml(file.name)}: ${escapeHtml(err.message)}</span>`;
                        uploadList.appendChild(item);
                    }
                }

                progressFill.style.width = '100%';
                progressLabel.textContent = 'Completato!';
                setTimeout(() => { progressWrap.style.display = 'none'; }, 1500);
                e.target.value = '';
            });
        }
    }

    // ============================================================
    // SEZIONE 2: NOTE ATM
    // ============================================================
    function renderNoteATM() {
        const container = document.getElementById('iveco-atm-list');
        if (!container) return;

        const filter = ivecoState.atmFilter || 'todo';
        const notes  = ivecoState.atmNotes;

        // Trova tutti i vehicleId che hanno note
        let vehicleIds = Object.keys(notes);

        // Filtra: 'all' = tutto, 'todo' = note non completate O nessuna nota, 'done' = solo note completate
        if (filter === 'todo') {
            vehicleIds = vehicleIds.filter(id => {
                const list = notes[id] || [];
                return list.length === 0 || list.some(n => !n.done);
            });
        } else if (filter === 'done') {
            vehicleIds = vehicleIds.filter(id => {
                const list = notes[id] || [];
                return list.length > 0 && list.every(n => n.done);
            });
        }

        if (vehicleIds.length === 0) {
            container.innerHTML = `
                <div class="iveco-empty-state">
                    <span class="material-symbols-outlined">note_alt</span>
                    <p>${filter === 'done' ? 'Nessun lavoro completato ancora.' : filter === 'todo' ? 'Nessun lavoro da fare.' : 'Nessuna nota ancora. Aggiungi un mezzo!'}</p>
                </div>`;
            return;
        }

        container.innerHTML = vehicleIds.map(vehicleId => {
            const vehicle = ivecoState.vehicles.find(v => v.id === vehicleId);
            const vName   = vehicle ? `Vettura ${vehicle.vettura}` : `ID: ${vehicleId}`;
            const vSub    = vehicle ? `Telaio: ${vehicle.telaio}` : '';
            const noteList= notes[vehicleId] || [];

            // Filtra le note in base al filtro
            let visibleNotes = noteList;
            if (filter === 'todo') visibleNotes = noteList.filter(n => !n.done);
            if (filter === 'done') visibleNotes = noteList.filter(n => n.done);

            const notesHtml = visibleNotes.map(note => `
                <div class="iveco-atm-note-item ${note.done ? 'done' : ''}" data-note-id="${note.id}" data-vehicle-id="${vehicleId}">
                    <div class="iveco-check ${note.done ? 'checked' : ''}" data-note-id="${note.id}" data-vehicle-id="${vehicleId}">
                        <span class="material-symbols-outlined">${note.done ? 'check' : ''}</span>
                    </div>
                    <div class="iveco-atm-note-text">${escapeHtml(note.text)}</div>
                </div>
            `).join('');

            return `
                <div class="iveco-atm-vehicle-card" data-vehicle-id="${vehicleId}">
                    <div class="iveco-atm-vehicle-header">
                        <div class="iveco-atm-vehicle-title">
                            <span class="material-symbols-outlined" style="font-size:1rem;">directions_bus</span>
                            ${escapeHtml(vName)}
                            ${vSub ? `<small>(${escapeHtml(vSub)})</small>` : ''}
                        </div>
                        <button class="iveco-btn" style="font-size:0.7rem;padding:0.3rem 0.6rem;" onclick="ivecoDeleteVehicleNotes('${vehicleId}')">
                            <span class="material-symbols-outlined" style="font-size:0.9rem;">delete</span>
                        </button>
                    </div>
                    <div class="iveco-note-items" id="note-items-${vehicleId}">
                        ${notesHtml}
                    </div>
                    <div class="iveco-add-note-row">
                        <input type="text" class="iveco-add-note-input" placeholder="Aggiungi nota lavoro... (Invio per salvare)"
                               data-vehicle-id="${vehicleId}" id="note-input-${vehicleId}">
                        <button class="iveco-add-note-btn" data-vehicle-id="${vehicleId}" title="Aggiungi nota">
                            <span class="material-symbols-outlined">add</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners note
        container.querySelectorAll('.iveco-check[data-note-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId    = btn.dataset.noteId;
                const vehicleId = btn.dataset.vehicleId;
                toggleAtmNote(vehicleId, noteId, btn.closest('.iveco-atm-note-item'));
            });
        });

        // Input note - Invio
        container.querySelectorAll('.iveco-add-note-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addAtmNote(input.dataset.vehicleId, input.value.trim());
                    input.value = '';
                }
            });
        });

        // Pulsante aggiungi nota
        container.querySelectorAll('.iveco-add-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vid   = btn.dataset.vehicleId;
                const input = document.getElementById('note-input-' + vid);
                if (input && input.value.trim()) {
                    addAtmNote(vid, input.value.trim());
                    input.value = '';
                } else if (input) {
                    input.focus();
                }
            });
        });
    }

    function toggleAtmNote(vehicleId, noteId, itemEl) {
        const notes = ivecoState.atmNotes[vehicleId];
        if (!notes) return;
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        note.done = !note.done;
        saveAtmNotes();

        if (note.done) {
            // Animazione di sparizione, poi sposta nella lista "fatto" (in realtÃ  rimane, filtro la gestisce)
            if (itemEl) {
                itemEl.classList.add('removing');
                setTimeout(() => renderNoteATM(), 450);
            } else {
                renderNoteATM();
            }
            showIvecoToast('âœ… Lavoro completato!', 'success', 2000);
        } else {
            renderNoteATM();
        }
    }

    function addAtmNote(vehicleId, text) {
        if (!text) return;
        if (!ivecoState.atmNotes[vehicleId]) ivecoState.atmNotes[vehicleId] = [];
        ivecoState.atmNotes[vehicleId].push({ id: uuid(), text: text, done: false });
        saveAtmNotes();
        renderNoteATM();
    }

    window.ivecoDeleteVehicleNotes = function(vehicleId) {
        if (!confirm('Eliminare tutte le note di questo mezzo?')) return;
        delete ivecoState.atmNotes[vehicleId];
        saveAtmNotes();
        renderNoteATM();
    };

    // Modal aggiunta mezzo alle Note ATM
    function showAddVehicleToNoteModal() {
        const vehicles = ivecoState.vehicles;
        if (vehicles.length === 0) {
            showIvecoToast('Nessun mezzo disponibile. Carica prima un file Excel.', 'error', 3000);
            return;
        }
        const sortedVehicles = vehicles
            .slice()
            .sort((a, b) => (parseInt(a.vettura, 10) || 0) - (parseInt(b.vettura, 10) || 0));
        const backdrop = document.createElement('div');
        backdrop.className = 'iveco-modal-backdrop';
        backdrop.id = 'iveco-add-vehicle-modal';
        backdrop.innerHTML = `
            <div class="iveco-modal-box">
                <h3><span class="material-symbols-outlined">directions_bus</span> Seleziona Mezzo</h3>
                <input type="text" class="iveco-modal-select" id="iveco-search-vehicle-modal" placeholder="Cerca per vettura o telaio..." autocomplete="off">
                <select class="iveco-modal-select" id="iveco-select-vehicle-modal">
                    <option value="">-- Seleziona un mezzo --</option>
                </select>
                <div class="iveco-modal-actions">
                    <button class="iveco-btn" id="iveco-cancel-vehicle-modal">Annulla</button>
                    <button class="iveco-btn primary" id="iveco-confirm-vehicle-modal">Aggiungi</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        const searchInput = backdrop.querySelector('#iveco-search-vehicle-modal');
        const select = backdrop.querySelector('#iveco-select-vehicle-modal');
        function renderVehicleOptions(queryText) {
            const q = (queryText || '').trim().toLowerCase();
            const filtered = !q
                ? sortedVehicles
                : sortedVehicles.filter(v =>
                    String(v.vettura || '').toLowerCase().includes(q) ||
                    String(v.telaio || '').toLowerCase().includes(q)
                );
            const optionsHtml = filtered
                .map(v => `<option value="${v.id}">Vettura: ${escapeHtml(v.vettura)} | Telaio: ${escapeHtml(v.telaio)}</option>`)
                .join('');
            select.innerHTML = `<option value="">-- Seleziona un mezzo --</option>${optionsHtml}`;
            if (filtered.length === 1) {
                select.value = filtered[0].id;
            }
        }
        renderVehicleOptions('');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderVehicleOptions(searchInput.value);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (select) select.focus();
                }
            });
            setTimeout(() => searchInput.focus(), 0);
        }
        backdrop.querySelector('#iveco-cancel-vehicle-modal').addEventListener('click', () => backdrop.remove());
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
        backdrop.querySelector('#iveco-confirm-vehicle-modal').addEventListener('click', () => {
            const sel = select.value;
            if (!sel) {
                showIvecoToast('Seleziona un mezzo!', 'error', 2000);
                return;
            }
            if (!ivecoState.atmNotes[sel]) ivecoState.atmNotes[sel] = [];
            saveAtmNotes();
            backdrop.remove();
            renderNoteATM();
            showIvecoToast('Mezzo aggiunto alle note!', 'success', 2000);
        });
    }
    // SEZIONE 3: AGGIUNGI (Import Excel)
    // ============================================================
    function renderAggiungi() {
        // GiÃ  renderizzato HTML, gestiamo solo i listeners dinamici
        setupExcelHandlers();
    }

    function setupExcelHandlers() {
        // GiÃ  setupExcelUpload Ã¨ chiamato all'inizializzazione, qui solo aggiorniamo eventualmente
    }

    function setupExcelUpload() {
        const fileInput   = document.getElementById('iveco-file-input');
        const uploadZone  = document.getElementById('iveco-upload-zone');
        const importBtn   = document.getElementById('iveco-import-btn');
        const resetBtn    = document.getElementById('iveco-reset-btn');
        const colTelaio   = document.getElementById('iveco-col-telaio');
        const colVettura  = document.getElementById('iveco-col-vettura');
        const colStato    = document.getElementById('iveco-col-stato');

        if (!fileInput || !uploadZone) return;

        // Drag & drop
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) processExcelFile(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) processExcelFile(file);
        });

        // Cambia colonne â†’ aggiorna preview
        if (colTelaio)  colTelaio.addEventListener('change',  () => updatePreview());
        if (colVettura) colVettura.addEventListener('change', () => updatePreview());
        if (colStato)   colStato.addEventListener('change',   () => updatePreview());

        // Importa
        if (importBtn) {
            importBtn.addEventListener('click', () => importVehicles());
        }

        // Reset lista
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!confirm('âš ï¸ Sei sicuro di voler cancellare TUTTA la lista mezzi?\nQuesta operazione Ã¨ irreversibile.')) return;
                ivecoState.vehicles = [];
                ivecoState.atmNotes = {};
                saveVehicles();
                saveAtmNotes();
                ivecoState.excelData = null;
                showIvecoToast('ðŸ—‘ï¸ Lista mezzi eliminata.', 'info', 2500);
                renderAggiungiStatus('info', 'Lista eliminata. Carica un nuovo file Excel.', true);
                const preview = document.getElementById('iveco-preview-container');
                if (preview) preview.style.display = 'none';
                if (fileInput) fileInput.value = '';
            });
        }
    }

    function processExcelFile(file) {
        if (!file) return;

        // Controlla che la libreria XLSX sia disponibile
        if (typeof XLSX === 'undefined') {
            showIvecoToast('âš ï¸ Libreria Excel non ancora caricata. Riprova tra un secondo.', 'error', 4000);
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showIvecoToast('âš ï¸ Formato non supportato. Usa .xlsx, .xls o .csv', 'error', 3000);
            return;
        }

        showIvecoToast('ðŸ“‚ Lettura file in corso...', 'info', 2000);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data     = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet    = workbook.Sheets[workbook.SheetNames[0]];
                const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (!rows || rows.length < 2) {
                    showIvecoToast('âš ï¸ Il file sembra vuoto o ha solo intestazioni.', 'error', 3000);
                    return;
                }

                ivecoState.excelData = rows;

                // Popola i selettori delle colonne
                populateColSelectors(rows[0]); // prima riga = intestazioni

                // Aggiorna preview
                updatePreview();

                showIvecoToast(`âœ… File caricato: ${rows.length - 1} righe trovate.`, 'success', 3000);
            } catch (err) {
                console.error('Errore lettura Excel:', err);
                showIvecoToast('âŒ Errore nel leggere il file: ' + err.message, 'error', 4000);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function populateColSelectors(headerRow) {
        const colTelaio  = document.getElementById('iveco-col-telaio');
        const colVettura = document.getElementById('iveco-col-vettura');
        const colStato   = document.getElementById('iveco-col-stato');
        if (!colTelaio || !colVettura) return;

        const options = (headerRow || []).map((h, i) => {
            const label = h ? `${indexToColLetter(i)} â€“ ${String(h).substring(0,20)}` : indexToColLetter(i);
            return `<option value="${i}">${label}</option>`;
        }).join('');

        // Se non ci sono intestazioni, genera A, B, C, ...
        const fallback = Array.from({ length: 26 }, (_, i) =>
            `<option value="${i}">${indexToColLetter(i)}</option>`
        ).join('');

        colTelaio.innerHTML  = options || fallback;
        colVettura.innerHTML = options || fallback;
        if (colStato) {
            colStato.innerHTML = `<option value="-1">â€” Non usare â€”</option>` + (options || fallback);
        }

        // Default: Telaio = col 0 (A), Vettura = col 1 (B), Stato = non usata
        colTelaio.value  = '0';
        colVettura.value = '1';
        if (colStato) colStato.value = '-1';

        ivecoState.excelColTelaio  = 0;
        ivecoState.excelColVettura = 1;
        ivecoState.excelColStato   = -1;
    }

    function updatePreview() {
        const rows = ivecoState.excelData;
        if (!rows || rows.length < 2) return;

        const colT  = parseInt(document.getElementById('iveco-col-telaio')?.value  || '0');
        const colV  = parseInt(document.getElementById('iveco-col-vettura')?.value || '1');
        const colS  = parseInt(document.getElementById('iveco-col-stato')?.value   ?? '-1');

        ivecoState.excelColTelaio  = colT;
        ivecoState.excelColVettura = colV;
        ivecoState.excelColStato   = colS;

        // Aggiorna intestazione tabella anteprima in base alla colonna stato
        const thStato = document.getElementById('iveco-preview-th-stato');
        if (thStato) thStato.style.display = colS >= 0 ? '' : 'none';

        // Skip intestazione (riga 0)
        const dataRows = rows.slice(1);

        // Costruisci preview (max 10 righe)
        const preview    = dataRows.slice(0, 10);
        const existingIds = new Set(ivecoState.vehicles.map(v => v.telaio + '_' + v.vettura));

        const tableRows = preview.map(row => {
            const rawT = row[colT] !== undefined ? String(row[colT]) : '';
            const rawV = row[colV] !== undefined ? String(row[colV]) : '';
            const rawS = colS >= 0 && row[colS] !== undefined ? String(row[colS]).trim() : '';
            const telaio  = extractTelaio(rawT);
            const vettura = extractVettura(rawV);
            const key     = telaio + '_' + vettura;
            const isDup   = existingIds.has(key);
            const isOk    = rawS.toLowerCase() === 'ok';

            return `
                <tr>
                    <td>${escapeHtml(rawT.length > 12 ? '...' + rawT.slice(-6) : rawT)}</td>
                    <td><strong>${escapeHtml(telaio)}</strong></td>
                    <td>${escapeHtml(rawV)}</td>
                    <td><strong>${escapeHtml(vettura)}</strong></td>
                    ${colS >= 0 ? `<td>${isOk ? '<span class="badge-ok">âœ… OK</span>' : '<span style="color:var(--text-secondary);font-size:0.75rem;">' + escapeHtml(rawS || 'â€”') + '</span>'}</td>` : ''}
                    <td>${isDup ? '<span class="badge-dup">DUPLICATO</span>' : '<span class="badge-new">NUOVO</span>'}</td>
                </tr>
            `;
        }).join('');

        const totalRows = dataRows.length;
        const dupCount  = dataRows.filter(row => {
            const t = extractTelaio(row[colT] !== undefined ? String(row[colT]) : '');
            const v = extractVettura(row[colV] !== undefined ? String(row[colV]) : '');
            return existingIds.has(t + '_' + v);
        }).length;
        const okCount = colS >= 0 ? dataRows.filter(row => {
            const s = row[colS] !== undefined ? String(row[colS]).trim().toLowerCase() : '';
            return s === 'ok';
        }).length : 0;

        const previewContainer = document.getElementById('iveco-preview-container');
        const previewBody      = document.getElementById('iveco-preview-body');
        const previewInfo      = document.getElementById('iveco-preview-info');

        if (previewContainer) previewContainer.style.display = 'block';
        if (previewBody)      previewBody.innerHTML = tableRows;
        if (previewInfo) {
            previewInfo.innerHTML = `
                ðŸ“Š <strong>${totalRows}</strong> righe trovate
                ${okCount > 0 ? ` Â· <span style="color:#2ecc71">âœ… ${okCount} giÃ  completati (colonna OK)</span>` : ''}
                ${dupCount > 0 ? ` Â· <span style="color:#e74c3c">âš ï¸ ${dupCount} duplicati (verranno ignorati)</span>` : ''}
                ${preview.length < totalRows ? ` Â· (anteprima primi 10 di ${totalRows})` : ''}
            `;
        }
    }

    function importVehicles() {
        const rows = ivecoState.excelData;
        if (!rows || rows.length < 2) {
            showIvecoToast('âš ï¸ Nessun dato da importare. Carica prima un file Excel.', 'error', 3000);
            return;
        }

        const colT = ivecoState.excelColTelaio;
        const colV = ivecoState.excelColVettura;

        // Chiave univoca = telaio(4) + vettura
        const existingKeys = new Set(ivecoState.vehicles.map(v => v.telaio + '_' + v.vettura));

        const colS = ivecoState.excelColStato;
        let added = 0, skipped = 0, markedDone = 0;

        // Salta riga 0 (intestazione)
        rows.slice(1).forEach(row => {
            const rawT = row[colT] !== undefined ? String(row[colT]).trim() : '';
            const rawV = row[colV] !== undefined ? String(row[colV]).trim() : '';
            if (!rawT && !rawV) return; // riga vuota

            const telaio  = extractTelaio(rawT);
            const vettura = extractVettura(rawV);
            const key     = telaio + '_' + vettura;

            // Leggi colonna stato
            const rawS  = colS >= 0 && row[colS] !== undefined ? String(row[colS]).trim().toLowerCase() : '';
            const isDone = rawS === 'ok';

            if (existingKeys.has(key)) {
                // Se esiste giÃ  e ora ha ok, aggiorna il flag done
                const existing = ivecoState.vehicles.find(v => v.telaio === telaio && v.vettura === vettura);
                if (existing && isDone && !existing.done) {
                    existing.done = true;
                    markedDone++;
                }
                skipped++;
                return;
            }

            if (isDone) markedDone++;

            ivecoState.vehicles.push({
                id     : uuid(),
                telaio : telaio,
                vettura: vettura,
                done   : isDone,
                doneDate: null
            });

            existingKeys.add(key);
            added++;
        });

        saveVehicles();

        let msg = `âœ… Importati ${added} mezzi`;
        if (markedDone > 0) msg += ` Â· ðŸŸ¢ ${markedDone} segnati come fatti (OK)`;
        if (skipped > 0) msg += ` Â· ${skipped} duplicati ignorati`;
        showIvecoToast(msg, 'success', 4000);
        renderAggiungiStatus('success', msg, false);

        // Aggiorna preview per mostrare i nuovi duplicati
        updatePreview();

        // Svuota file input
        const fileInput = document.getElementById('iveco-file-input');
        if (fileInput) fileInput.value = '';
        ivecoState.excelData = null;

        const previewContainer = document.getElementById('iveco-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
    }

    function renderAggiungiStatus(type, msg, clearExcel) {
        const statusEl = document.getElementById('iveco-import-status');
        if (!statusEl) return;
        statusEl.className = 'iveco-status-msg ' + type;
        statusEl.innerHTML = `<span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : 'info'}</span> ${msg}`;
        statusEl.style.display = 'flex';
        if (clearExcel) {
            const previewContainer = document.getElementById('iveco-preview-container');
            if (previewContainer) previewContainer.style.display = 'none';
        }
    }

    // ============================================================
    // SEZIONE 4: IMPOSTAZIONI (usa quelle del sito PWS)
    // ============================================================
    function renderImpostazioni() {
        // GiÃ  copiato l'HTML nella sezione, non serve re-render
    }

    // ============================================================
    // UTILITY HTML
    // ============================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ============================================================
    // COSTRUZIONE DOM IVECO
    // ============================================================
    function buildIvecoDOM() {
        // App principale
        if (!document.getElementById('iveco-app')) {
            const app = document.createElement('div');
            app.id = 'iveco-app';
            app.innerHTML = buildIvecoAppHTML();
            document.body.appendChild(app);
        }
    }

    function buildIvecoAppHTML() {
        return `
        <!-- Header Iveco -->
        <header id="iveco-header">
            <!-- Riga 1: logo + pulsante tema -->
            <div id="iveco-header-top">
                <div class="iveco-header-logo" id="iveco-logo-wrap" style="position:relative;">
                    <img src="icons/iveco.png" alt="Iveco Logo" draggable="false">
                    <div style="line-height:1.1;">
                        <div class="iveco-header-title">
                            Gestione Mezzi Iveco
                        </div>
                    </div>
                    <div class="press-ring"></div>
                </div>
                <div class="iveco-header-actions">
                    <button id="iveco-theme-toggle" title="Cambia tema">
                        <span class="material-symbols-outlined theme-icon-light">light_mode</span>
                        <span class="material-symbols-outlined theme-icon-dark" style="display:none;">dark_mode</span>
                    </button>
                </div>
            </div>

            <!-- Riga 2: bus animato a tutta larghezza -->
            <div id="iveco-bus-track">
                <div id="iveco-bus-wrap">
                    <svg id="iveco-bus-svg" viewBox="0 0 120 58" xmlns="http://www.w3.org/2000/svg" fill="none">
                        <!-- Ombra a terra -->
                        <ellipse id="bus-shadow" cx="60" cy="56" rx="44" ry="3" fill="rgba(0,0,0,0.13)"/>
                        <!-- Carrozzeria principale -->
                        <rect x="4" y="10" width="112" height="38" rx="7" fill="#1565C0"/>
                        <!-- Fascia gialla laterale -->
                        <rect x="4" y="28" width="112" height="6" fill="#FFC107"/>
                        <!-- Tetto arrotondato -->
                        <rect x="8" y="6" width="104" height="12" rx="6" fill="#1976D2"/>
                        <!-- Parte anteriore (muso) -->
                        <rect x="96" y="14" width="18" height="30" rx="5" fill="#0D47A1"/>
                        <!-- Parte posteriore -->
                        <rect x="6" y="14" width="14" height="30" rx="4" fill="#0D47A1"/>
                        <!-- Parabrezza anteriore -->
                        <rect x="99" y="15" width="12" height="14" rx="3" fill="#B3E5FC" opacity="0.9"/>
                        <!-- Finestrino 1 -->
                        <rect x="78" y="13" width="16" height="11" rx="3" fill="#B3E5FC" opacity="0.85"/>
                        <!-- Finestrino 2 -->
                        <rect x="58" y="13" width="16" height="11" rx="3" fill="#B3E5FC" opacity="0.85"/>
                        <!-- Finestrino 3 -->
                        <rect x="38" y="13" width="16" height="11" rx="3" fill="#B3E5FC" opacity="0.85"/>
                        <!-- Finestrino 4 (piccolo posteriore) -->
                        <rect x="20" y="13" width="12" height="11" rx="3" fill="#B3E5FC" opacity="0.85"/>
                        <!-- Porta -->
                        <rect x="62" y="30" width="14" height="16" rx="2" fill="#1A237E" opacity="0.6"/>
                        <line x1="69" y1="30" x2="69" y2="46" stroke="#B3E5FC" stroke-width="0.8" opacity="0.5"/>
                        <!-- Faro anteriore -->
                        <ellipse cx="111" cy="38" rx="4" ry="3" fill="#FFF9C4"/>
                        <ellipse cx="111" cy="38" rx="2.5" ry="2" fill="#FFEB3B"/>
                        <!-- Fanale posteriore -->
                        <rect x="6" y="34" width="6" height="8" rx="2" fill="#EF5350"/>
                        <!-- Specchietto -->
                        <rect x="112" y="18" width="5" height="3" rx="1" fill="#90CAF9"/>
                        <!-- Dettagli tetto: aria condizionata -->
                        <rect x="30" y="4" width="22" height="4" rx="2" fill="#1565C0"/>
                        <rect x="55" y="3" width="30" height="4" rx="2" fill="#1565C0"/>
                        <!-- Numero bus -->
                        <rect x="68" y="7" width="18" height="6" rx="1" fill="#FFC107"/>
                        <text x="77" y="13" font-size="4.5" fill="#1A237E" text-anchor="middle" font-family="monospace" font-weight="bold">ATM</text>

                        <!-- RUOTA ANTERIORE â€” cerchi centrati su (94,48) nel viewBox -->
                        <g id="bus-wheel-front">
                            <circle cx="94" cy="48" r="8.5" fill="#212121"/>
                            <circle cx="94" cy="48" r="6" fill="#424242"/>
                            <circle cx="94" cy="48" r="3.5" fill="#616161"/>
                            <circle cx="94" cy="48" r="1.8" fill="#9E9E9E"/>
                            <!-- Raggi: coordinate assolute dal centro (94,48) -->
                            <line x1="94" y1="42.2" x2="94" y2="45" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="94" y1="51" x2="94" y2="53.8" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="88.2" y1="48" x2="91" y2="48" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="97" y1="48" x2="99.8" y2="48" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="89.9" y1="43.9" x2="91.9" y2="45.9" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="96.1" y1="50.1" x2="98.1" y2="52.1" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="98.1" y1="43.9" x2="96.1" y2="45.9" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="91.9" y1="50.1" x2="89.9" y2="52.1" stroke="#9E9E9E" stroke-width="1.2"/>
                        </g>

                        <!-- RUOTA POSTERIORE â€” cerchi centrati su (26,48) nel viewBox -->
                        <g id="bus-wheel-rear">
                            <circle cx="26" cy="48" r="8.5" fill="#212121"/>
                            <circle cx="26" cy="48" r="6" fill="#424242"/>
                            <circle cx="26" cy="48" r="3.5" fill="#616161"/>
                            <circle cx="26" cy="48" r="1.8" fill="#9E9E9E"/>
                            <line x1="26" y1="42.2" x2="26" y2="45" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="26" y1="51" x2="26" y2="53.8" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="20.2" y1="48" x2="23" y2="48" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="29" y1="48" x2="31.8" y2="48" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="21.9" y1="43.9" x2="23.9" y2="45.9" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="28.1" y1="50.1" x2="30.1" y2="52.1" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="30.1" y1="43.9" x2="28.1" y2="45.9" stroke="#9E9E9E" stroke-width="1.2"/>
                            <line x1="23.9" y1="50.1" x2="21.9" y2="52.1" stroke="#9E9E9E" stroke-width="1.2"/>
                        </g>
                    </svg>
                </div>
            </div>
        </header>

        <!-- Contenuto -->
        <div id="iveco-content">

            <!-- SEZIONE 1: ELENCO -->
            <div id="iveco-elenco" class="iveco-section active">
                <div class="iveco-card">
                    <h2><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:.3rem;">directions_bus</span>Elenco Mezzi</h2>

                    <div class="iveco-search-bar">
                        <input type="text" id="iveco-search" placeholder="Cerca telaio o vettura...">
                        <button id="iveco-search-clear" class="iveco-search-clear" style="display:none" title="Cancella ricerca">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                        <span class="material-symbols-outlined search-icon">search</span>
                    </div>

                    <div class="iveco-stats-bar">
                        <div class="iveco-stat-chip active" data-filter="all">
                            <span class="stat-num" id="iveco-stat-total">0</span>
                            Totale
                        </div>
                        <div class="iveco-stat-chip done" data-filter="done">
                            <span class="stat-num" id="iveco-stat-done">0</span>
                            Completati
                        </div>
                        <div class="iveco-stat-chip todo" data-filter="todo">
                            <span class="stat-num" id="iveco-stat-todo">0</span>
                            Da fare
                        </div>
                    </div>

                    <div class="iveco-vehicle-list" id="iveco-elenco-list">
                        <div class="iveco-empty-state">
                            <span class="material-symbols-outlined">directions_bus</span>
                            <p>Nessun mezzo caricato.<br>Vai su <strong>Aggiungi</strong> per caricare un file Excel.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEZIONE 2: NOTE ATM -->
            <div id="iveco-note" class="iveco-section">
                <div class="iveco-card">
                    <h2><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:.3rem;">note_alt</span>Note ATM</h2>

                    <div class="iveco-filter-bar">
                        <select class="iveco-filter-select" id="iveco-atm-filter">
                            <option value="all">&#128203; Tutti i lavori</option>
                            <option value="todo">&#128295; Da fare</option>
                            <option value="done">&#9989; Gi&agrave; fatto</option>
                        </select>
                    </div>

                    <button class="iveco-add-vehicle-btn" id="iveco-add-vehicle-note-btn">
                        <span class="material-symbols-outlined">add</span>
                        Aggiungi mezzo
                    </button>

                    <div class="iveco-atm-list" id="iveco-atm-list">
                        <div class="iveco-empty-state">
                            <span class="material-symbols-outlined">note_alt</span>
                            <p>Nessuna nota ancora.<br>Aggiungi un mezzo con il pulsante sopra.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEZIONE 3: AGGIUNGI -->
            <div id="iveco-aggiungi" class="iveco-section">
                <div class="iveco-card">
                    <h2><span class="material-symbols-outlined" style="vertical-align:middle;margin-right:.3rem;">upload_file</span>Importa Lista Mezzi</h2>

                    <div id="iveco-import-status" class="iveco-status-msg info" style="display:none;"></div>

                    <!-- Upload zone -->
                    <div class="iveco-upload-zone" id="iveco-upload-zone">
                        <input type="file" id="iveco-file-input" accept=".xlsx,.xls,.csv">
                        <span class="material-symbols-outlined">table_view</span>
                        <p><strong>Trascina qui il file Excel</strong></p>
                        <p>oppure clicca per selezionarlo</p>
                        <small>Formati supportati: .xlsx, .xls, .csv</small>
                    </div>

                    <!-- Configurazione colonne -->
                    <div class="iveco-card" style="margin-bottom:1rem;">
                        <h3 style="font-size:0.9rem;margin-bottom:0.5rem;">âš™ï¸ Configurazione Colonne</h3>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.8rem;">
                            Seleziona da quale colonna del file Excel prendere i dati.
                            <br><em>Il Telaio usa solo gli ultimi 4 caratteri.</em>
                        </p>
                        <div class="iveco-col-config">
                            <div class="iveco-col-field">
                                <label>ðŸ”‘ Colonna Telaio</label>
                                <select id="iveco-col-telaio">
                                    <option value="0">A</option>
                                    <option value="1">B</option>
                                </select>
                            </div>
                            <div class="iveco-col-field">
                                <label>ðŸšŒ Colonna N. Vettura</label>
                                <select id="iveco-col-vettura">
                                    <option value="0">A</option>
                                    <option value="1" selected>B</option>
                                </select>
                            </div>
                            <div class="iveco-col-field">
                                <label>âœ… Colonna Stato (OK)</label>
                                <select id="iveco-col-stato">
                                    <option value="-1">â€” Non usare â€”</option>
                                    <option value="2">C</option>
                                </select>
                            </div>
                        </div>
                        <p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem;">
                            ðŸ’¡ Se selezioni la colonna Stato, i mezzi con valore <strong>OK</strong> verranno importati giÃ  come <strong>completati</strong>.
                        </p>
                    </div>

                    <!-- Preview -->
                    <div id="iveco-preview-container" style="display:none;">
                        <div class="iveco-card" style="margin-bottom:1rem;overflow-x:auto;">
                            <h3 style="font-size:0.9rem;margin-bottom:0.5rem;">ðŸ‘ï¸ Anteprima (prime 10 righe)</h3>
                            <div id="iveco-preview-info" style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.5rem;"></div>
                            <table class="iveco-preview-table">
                                <thead>
                                    <tr>
                                        <th>Telaio (raw)</th>
                                        <th>Telaio (ultimi 4)</th>
                                        <th>Vettura (raw)</th>
                                        <th>N. Vettura</th>
                                        <th id="iveco-preview-th-stato" style="display:none;">Stato</th>
                                        <th>Import</th>
                                    </tr>
                                </thead>
                                <tbody id="iveco-preview-body"></tbody>
                            </table>
                        </div>

                        <div class="iveco-import-actions">
                            <button class="iveco-import-btn" id="iveco-import-btn">
                                <span class="material-symbols-outlined">download</span>
                                Importa nella lista
                            </button>
                        </div>
                    </div>

                    <!-- Azioni pericolose -->
                    <div class="iveco-card" style="margin-top:1.5rem;">
                        <h3 style="font-size:0.9rem;margin-bottom:0.5rem;color:#e74c3c;">âš ï¸ Zona Pericolo</h3>
                        <div class="iveco-import-actions">
                            <button class="iveco-import-btn danger" id="iveco-reset-btn">
                                <span class="material-symbols-outlined">delete_forever</span>
                                Cancella tutta la lista
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SEZIONE 4: IMPOSTAZIONI -->
            <div id="iveco-impostazioni" class="iveco-section">
                <div id="iveco-settings-content">
                    <!-- Contenuto copiato dinamicamente dalle impostazioni PWS -->
                </div>
            </div>

        </div>

        <!-- Navigazione inferiore -->
        <nav id="iveco-nav">
            <a class="iveco-nav-item active" data-section="elenco">
                <span class="material-symbols-outlined">directions_bus</span>
                <span>Elenco</span>
            </a>
            <a class="iveco-nav-item" data-section="note">
                <span class="material-symbols-outlined">note_alt</span>
                <span>Note ATM</span>
            </a>
            <a class="iveco-nav-item" data-section="aggiungi">
                <span class="material-symbols-outlined">upload_file</span>
                <span>Aggiungi</span>
            </a>
            <a class="iveco-nav-item" data-section="impostazioni">
                <span class="material-symbols-outlined">settings</span>
                <span>Impostazioni</span>
            </a>
        </nav>
        `;
    }

    // ============================================================
    // IMPOSTAZIONI PWS: sposta/ripristina il nodo reale (conserva i listener)
    // ============================================================
    function copySettingsToIveco() {
        const settingsSection = document.getElementById('settings-section');
        const ivecoSettings   = document.getElementById('iveco-settings-content');
        if (!settingsSection || !ivecoSettings) return;

        // Segna il parent originale se non giÃ  fatto
        if (!settingsSection.dataset.ivecoOriginalParent) {
            settingsSection.dataset.ivecoOriginalParent = 'main > .container';
        }

        // GiÃ  dentro iveco-settings-content, niente da fare
        if (settingsSection.parentElement === ivecoSettings) return;

        // Sposta il nodo REALE (con tutti i listener giÃ  attaccati)
        settingsSection.style.display = 'block';
        settingsSection.classList.add('active');
        ivecoSettings.innerHTML = '';
        ivecoSettings.appendChild(settingsSection);
    }

    function restoreSettingsFromIveco() {
        const settingsSection = document.getElementById('settings-section');
        if (!settingsSection) return;

        const ivecoSettings = document.getElementById('iveco-settings-content');
        // Se il nodo Ã¨ dentro il container Iveco, riportalo a main
        if (ivecoSettings && settingsSection.parentElement === ivecoSettings) {
            const mainContainer = document.querySelector('main > .container');
            if (mainContainer) {
                settingsSection.style.display = '';
                settingsSection.classList.remove('active');
                mainContainer.appendChild(settingsSection);
                ivecoSettings.innerHTML = '';
            }
        }
    }

    // ============================================================
    // SETUP EVENTI
    // ============================================================
    function setupIvecoEvents() {
        // Navigazione
        document.querySelectorAll('#iveco-nav .iveco-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Se si lascia la tab impostazioni, ripristina il nodo originale
                if (ivecoState.activeSection === 'impostazioni' && item.dataset.section !== 'impostazioni') {
                    restoreSettingsFromIveco();
                }

                navigateTo(item.dataset.section);

                // Sposta le impostazioni reali quando si clicca su impostazioni
                if (item.dataset.section === 'impostazioni') {
                    setTimeout(copySettingsToIveco, 50);
                }
            });
        });

        // Filtro Note ATM
        const atmFilter = document.getElementById('iveco-atm-filter');
        if (atmFilter) {
            atmFilter.value = ivecoState.atmFilter || 'todo';
            atmFilter.addEventListener('change', () => {
                ivecoState.atmFilter = atmFilter.value;
                renderNoteATM();
            });
        }

        // Aggiungi mezzo alle note
        const addVehicleNoteBtn = document.getElementById('iveco-add-vehicle-note-btn');
        if (addVehicleNoteBtn) {
            addVehicleNoteBtn.addEventListener('click', showAddVehicleToNoteModal);
        }

        // Ricerca elenco
        const searchInput = document.getElementById('iveco-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => renderElenco());
        }

        // Pulsante X cancella ricerca â€” event delegation (funziona anche se l'elemento Ã¨ nascosto al bind)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#iveco-search-clear')) {
                const inp = document.getElementById('iveco-search');
                if (inp) { inp.value = ''; inp.focus(); }
                renderElenco();
            }
        });

        // Chip filtro elenco (Totale / Completati / Da fare)
        document.querySelectorAll('.iveco-stat-chip[data-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                ivecoState.elencoFilter = chip.dataset.filter;
                renderElenco();
            });
        });

        // Theme toggle Iveco
        const themeToggleIveco = document.getElementById('iveco-theme-toggle');
        if (themeToggleIveco) {
            themeToggleIveco.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                const isDark = document.body.classList.contains('dark-theme');
                localStorage.setItem('darkTheme', isDark ? 'true' : 'false');
                // Aggiorna icone
                document.querySelectorAll('.theme-icon-light').forEach(el => el.style.display = isDark ? 'none' : 'inline');
                document.querySelectorAll('.theme-icon-dark').forEach(el => el.style.display = isDark ? 'inline' : 'none');
            });
        }

        // Swipe destra logo Iveco (per uscire)
        setupIvecoSwipe();

        // Bus animato
        setupBusAnimation();

        // Setup Excel upload
        setupExcelUpload();

        // Quando il tema cambia (dark/light) e siamo in modalitÃ  Iveco,
        // riesegui hideNativeUI perchÃ© il CSS del dark theme rimette display:flex !important
        document.addEventListener('themeChange', () => {
            if (document.body.classList.contains('iveco-mode')) {
                setTimeout(hideNativeUI, 50);
            }
        });

        // Osserva anche il cambio classe su body (per intercettare il toggle tema)
        const bodyObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class' &&
                    document.body.classList.contains('iveco-mode')) {
                    setTimeout(hideNativeUI, 30);
                }
            });
        });
        bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // ============================================================
    // ðŸšŒ BUS ANIMATO â€” tutto gestito via requestAnimationFrame
    // ============================================================
    function setupBusAnimation() {
        const wrap  = document.getElementById('iveco-bus-wrap');
        const track = document.getElementById('iveco-bus-track');
        const svg   = document.getElementById('iveco-bus-svg');
        if (!wrap || !track || !svg) return;

        // ---- Riferimenti agli elementi SVG delle ruote e ombra ----
        const wf  = document.getElementById('bus-wheel-front');
        const wr  = document.getElementById('bus-wheel-rear');
        const shd = document.getElementById('bus-shadow');

        const WF_CX = 94, WF_CY = 48;  // centro ruota anteriore nel viewBox
        const WR_CX = 26, WR_CY = 48;  // centro ruota posteriore nel viewBox

        const BUS_W    = 80;    // larghezza elemento wrap in px (aggiornato)
        const PAUSE_MS = 1000; // sosta al capolinea in ms
        const MAX_SPEED = 120;  // px/s velocitÃ  massima (+50%)

        let pos       = 0;      // posizione px corrente
        let dir       = 1;      // 1=destra, -1=sinistra
        let phase     = 'drive'; // 'drive' | 'pause'
        let tripDone  = 1;      // inizia con 1 per evitare speedFactor=0 all'avvio
        let tripLen   = 0;
        let lastTs    = null;
        let wheelAngle = 0;    // angolo ruote in gradi
        let pauseStart  = null;
        let bounceT     = 0;    // timer sospensioni indipendente

        function easeInOut(t) {
            // Clamp per sicurezza
            t = Math.max(0, Math.min(1, t));
            return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
        }

        // VelocitÃ  istantanea: derivata numerica dell'easing, normalizzata.
        // Aggiunge un minimo (0.08) per non bloccarsi mai a speedFactor=0.
        function getSpeedFactor(progress) {
            const eps = 0.005;
            const d = (easeInOut(progress + eps) - easeInOut(progress - eps)) / (2 * eps);
            // d max â‰ˆ 1.5 al centro, 0 agli estremi â†’ normalizziamo
            return Math.max(0.08, Math.min(1, d / 1.5));
        }

        // Ruota un gruppo SVG attorno a (cx,cy) nel sistema di coordinate del viewBox.
        function rotateGroup(el, cx, cy, angle) {
            if (!el) return;
            el.setAttribute('transform', `rotate(${angle.toFixed(2)},${cx},${cy})`);
        }

        function getTrackLen() {
            return Math.max(0, track.offsetWidth - BUS_W);
        }

        function loop(ts) {
            if (!lastTs) lastTs = ts;
            const dt = Math.min(ts - lastTs, 50);
            lastTs = ts;

            tripLen = getTrackLen();
            bounceT += dt;

            if (phase === 'pause') {
                if (!pauseStart) pauseStart = ts;
                // Ruote ferme
                rotateGroup(wf, WF_CX, WF_CY, wheelAngle);
                rotateGroup(wr, WR_CX, WR_CY, wheelAngle);
                // Applica bounce anche da fermo (piccolo tremolio motore)
                const b = Math.sin(bounceT * 0.018) * 0.4;
                wrap.style.transform = `translateY(${b}px)`;

                if (ts - pauseStart >= PAUSE_MS) {
                    // Riparte in direzione opposta
                    dir      = -dir;
                    tripDone = 0;
                    phase    = 'drive';
                    pauseStart = null;
                    lastTs = ts;
                    // Flip del SVG
                    svg.style.transform = dir === 1 ? 'scaleX(1)' : 'scaleX(-1)';
                }
                requestAnimationFrame(loop);
                return;
            }

            // === FASE DRIVE ===
            const progress = tripLen > 0 ? Math.min(tripDone / tripLen, 1) : 0;
            const speedFactor = getSpeedFactor(progress);
            const speed       = MAX_SPEED * speedFactor;

            // Aggiorna posizione
            const step = speed * (dt / 1000);
            tripDone += step;
            pos = dir === 1 ? tripDone : (tripLen - tripDone);
            pos = Math.max(0, Math.min(tripLen, pos));
            wrap.style.left = pos + 'px';

            // === RUOTE â€” angolo proporzionale alla distanza percorsa ===
            const viewboxRatio = 120 / BUS_W;
            wheelAngle += step * viewboxRatio * (360 / 53.4);
            wheelAngle %= 360;
            rotateGroup(wf, WF_CX, WF_CY, wheelAngle);
            rotateGroup(wr, WR_CX, WR_CY, wheelAngle);

            // === SOSPENSIONI â€” bounce sinusoidale multi-frequenza ===
            const b1 = Math.sin(bounceT * 0.022) * 1.6 * speedFactor;
            const b2 = Math.sin(bounceT * 0.041) * 0.7 * speedFactor;
            const bounce = b1 + b2;
            wrap.style.transform = `translateY(${bounce}px)`;

            // === OMBRA â€” si schiaccia con la velocitÃ  ===
            if (shd) {
                const sx = 1 + speedFactor * 0.1;
                const sy = Math.max(0.5, 1 - speedFactor * 0.35);
                shd.setAttribute('rx', 44 * sx);
                shd.setAttribute('ry', 3 * sy);
                shd.setAttribute('opacity', 0.55 - speedFactor * 0.2);
            }

            if (progress >= 1) {
                phase = 'pause';
                requestAnimationFrame(loop);
                return;
            }

            requestAnimationFrame(loop);
        }

        // Avvio: flip iniziale e primo frame
        svg.style.transform = 'scaleX(1)';
        requestAnimationFrame(loop);
    }

    // ============================================================
    // INIZIALIZZAZIONE PRINCIPALE
    // ============================================================
    function init() {
        // Costruisci il DOM Iveco
        buildIvecoDOM();

        // Setup eventi
        setupIvecoEvents();

        // Swipe destra logo PWS (per entrare in Iveco)
        setupPwsSwipe();

        // Controlla se era attiva la modalitÃ  Iveco
        if (localStorage.getItem(STORAGE_KEY_MODE) === 'true') {
            loadData();
            document.body.classList.add('iveco-mode');
            // Aspetta che il sito finisca di applicare i suoi stili, poi nascondi la UI PWS
            setTimeout(hideNativeUI, 100);
            renderCurrentSection();
        }

        console.log('ðŸšŒ Iveco Orecchia Mode: inizializzato!');
    }

    // Avvia quando il DOM Ã¨ pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();



