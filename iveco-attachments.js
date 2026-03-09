/* ================================================ */
/* 📸 IVECO ATTACHMENTS — Google Drive API         */
/* Gestione foto/video allegati per ogni mezzo     */
/* ================================================ */

(function() {
    'use strict';

    // ============================================================
    // COSTANTI
    // ============================================================
    const DRIVE_UPLOAD_URL   = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const DRIVE_FILES_URL    = 'https://www.googleapis.com/drive/v3/files';
    const ROOT_FOLDER_NAME   = 'ore-pws';
    const ATT_FOLDER_NAME    = 'iveco_allegati';
    const MIME_FOLDER        = 'application/vnd.google-apps.folder';

    // Cache folder IDs per evitare ricerche ripetute
    let _rootFolderId = null;
    let _attFolderId  = null;
    let _vehicleFolderCache = {}; // { vehicleId: folderId }

    // ============================================================
    // UTILITY — token Google
    // ============================================================
    function getToken() {
        try {
            const raw = localStorage.getItem('googleAuthToken');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.access_token || null;
        } catch { return null; }
    }

    function authHeaders() {
        const token = getToken();
        if (!token) throw new Error('Nessun token Google disponibile. Accedi prima.');
        return { 'Authorization': `Bearer ${token}` };
    }

    // ============================================================
    // DRIVE — Cerca o crea cartella
    // ============================================================
    async function findOrCreateFolder(name, parentId) {
        const token = getToken();
        if (!token) throw new Error('Non autenticato');

        // Cerca la cartella
        const qParts = [`name='${name}'`, `mimeType='${MIME_FOLDER}'`, `trashed=false`];
        if (parentId) qParts.push(`'${parentId}' in parents`);
        const q = qParts.join(' and ');

        const searchRes = await fetch(
            `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`,
            { headers: authHeaders() }
        );
        if (!searchRes.ok) throw new Error(`Errore ricerca cartella: ${searchRes.status}`);
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        // Crea la cartella
        const meta = { name, mimeType: MIME_FOLDER };
        if (parentId) meta.parents = [parentId];

        const createRes = await fetch(DRIVE_FILES_URL, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(meta)
        });
        if (!createRes.ok) throw new Error(`Errore creazione cartella: ${createRes.status}`);
        const created = await createRes.json();
        return created.id;
    }

    // ============================================================
    // DRIVE — Ottieni cartella del veicolo (con cache)
    // ============================================================
    async function getVehicleFolder(vehicleId) {
        if (_vehicleFolderCache[vehicleId]) return _vehicleFolderCache[vehicleId];

        if (!_rootFolderId) {
            _rootFolderId = await findOrCreateFolder(ROOT_FOLDER_NAME, null);
        }
        if (!_attFolderId) {
            _attFolderId = await findOrCreateFolder(ATT_FOLDER_NAME, _rootFolderId);
        }

        const folderId = await findOrCreateFolder(vehicleId, _attFolderId);
        _vehicleFolderCache[vehicleId] = folderId;
        return folderId;
    }

    // ============================================================
    // DRIVE — Upload file
    // ============================================================
    async function uploadFileToDrive(file, vehicleId, onProgress) {
        const folderId = await getVehicleFolder(vehicleId);
        const token = getToken();

        // Usa resumable upload per file grandi (>5MB), multipart per piccoli
        if (file.size > 5 * 1024 * 1024) {
            return await resumableUpload(file, folderId, token, onProgress);
        } else {
            return await multipartUpload(file, folderId, token, onProgress);
        }
    }

    async function multipartUpload(file, folderId, token, onProgress) {
        const meta = {
            name: file.name,
            parents: [folderId]
        };

        const boundary = 'iveco_boundary_' + Date.now();
        const metaStr  = JSON.stringify(meta);
        const fileData = await file.arrayBuffer();

        const body = new Blob([
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaStr}\r\n`,
            `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
            fileData,
            `\r\n--${boundary}--`
        ]);

        if (onProgress) onProgress(50);

        const res = await fetch(DRIVE_UPLOAD_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Upload fallito: ${res.status} — ${err}`);
        }

        if (onProgress) onProgress(100);
        const data = await res.json();
        return data.id;
    }

    async function resumableUpload(file, folderId, token, onProgress) {
        const meta = { name: file.name, parents: [folderId] };

        // Step 1: Avvia la sessione resumable
        const initRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': file.type,
                'X-Upload-Content-Length': file.size
            },
            body: JSON.stringify(meta)
        });

        if (!initRes.ok) throw new Error(`Errore avvio upload: ${initRes.status}`);
        const sessionUri = initRes.headers.get('Location');

        // Step 2: Carica il file
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', sessionUri);
            xhr.setRequestHeader('Content-Type', file.type);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data.id);
                    } catch { reject(new Error('Risposta non valida dal server')); }
                } else {
                    reject(new Error(`Upload fallito: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Errore di rete durante upload'));
            xhr.send(file);
        });
    }

    // ============================================================
    // DRIVE — Ottieni thumbnail / URL di visualizzazione
    // ============================================================
    async function getFileMetadata(driveId) {
        const res = await fetch(
            `${DRIVE_FILES_URL}/${driveId}?fields=id,name,mimeType,thumbnailLink,webContentLink,size`,
            { headers: authHeaders() }
        );
        if (!res.ok) throw new Error(`Errore metadati file: ${res.status}`);
        return await res.json();
    }

    // ============================================================
    // DRIVE — Scarica file come Blob URL (per visualizzazione in-app)
    // ============================================================
    async function getBlobUrl(driveId, mimeType) {
        const res = await fetch(
            `${DRIVE_FILES_URL}/${driveId}?alt=media`,
            { headers: authHeaders() }
        );
        if (!res.ok) throw new Error(`Errore download file: ${res.status}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }

    // ============================================================
    // DRIVE — Elimina file
    // ============================================================
    async function deleteFile(driveId) {
        const res = await fetch(`${DRIVE_FILES_URL}/${driveId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok && res.status !== 204) throw new Error(`Errore eliminazione: ${res.status}`);
    }

    // ============================================================
    // UI — Popup galleria allegati
    // ============================================================
    async function openGalleryPopup(vehicle) {
        // Rimuovi popup precedente
        const existing = document.getElementById('iveco-gallery-overlay');
        if (existing) existing.remove();

        const attachments = vehicle.attachments || [];

        const overlay = document.createElement('div');
        overlay.id = 'iveco-gallery-overlay';
        overlay.innerHTML = `
            <div id="iveco-gallery-popup">
                <div class="iveco-gallery-header">
                    <div class="iveco-gallery-title">
                        <span class="material-symbols-outlined">photo_library</span>
                        <div>
                            <h3>Galleria allegati</h3>
                            <small>Vettura ${escHtml(vehicle.vettura)} · Telaio ${escHtml(vehicle.telaio)}</small>
                        </div>
                    </div>
                    <button class="iveco-gallery-close" id="iveco-gallery-close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="iveco-gallery-body">
                    ${attachments.length === 0 ? `
                        <div class="iveco-gallery-empty">
                            <span class="material-symbols-outlined">image_not_supported</span>
                            <p>Nessun allegato ancora</p>
                        </div>
                    ` : `
                        <div class="iveco-gallery-grid" id="iveco-gallery-grid">
                            ${attachments.map(att => buildAttachmentThumb(att)).join('')}
                        </div>
                    `}
                </div>

                <div class="iveco-gallery-footer">
                    <label class="iveco-gallery-upload-btn" id="iveco-gallery-upload-label">
                        <span class="material-symbols-outlined">add_photo_alternate</span>
                        Aggiungi foto/video
                        <input type="file" id="iveco-gallery-file-input" accept="image/*,video/*" multiple style="display:none">
                    </label>
                </div>

                <div id="iveco-gallery-progress-wrap" style="display:none">
                    <div class="iveco-gallery-progress-bar">
                        <div class="iveco-gallery-progress-fill" id="iveco-gallery-progress-fill"></div>
                    </div>
                    <small id="iveco-gallery-progress-label">Caricamento...</small>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const closePopup = () => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('iveco-gallery-close').addEventListener('click', closePopup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });

        // Listener thumbnail (visualizzazione + elimina)
        bindGalleryEvents(overlay, vehicle);

        // Upload
        document.getElementById('iveco-gallery-file-input').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            await handleUpload(files, vehicle, overlay);
            e.target.value = '';
        });
    }

    function buildAttachmentThumb(att) {
        const isVideo = att.mimeType && att.mimeType.startsWith('video/');
        return `
            <div class="iveco-gallery-thumb" data-att-id="${att.driveId}">
                <div class="iveco-gallery-thumb-inner">
                    ${isVideo
                        ? `<div class="iveco-gallery-thumb-video-placeholder">
                               <span class="material-symbols-outlined">play_circle</span>
                               <span class="iveco-gallery-thumb-label">${escHtml(att.name)}</span>
                           </div>`
                        : `<img src="" data-drive-id="${att.driveId}" alt="${escHtml(att.name)}" loading="lazy">`
                    }
                    <div class="iveco-gallery-thumb-overlay">
                        <button class="iveco-gallery-thumb-delete" data-att-id="${att.driveId}" title="Elimina">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </div>
                <span class="iveco-gallery-thumb-name">${escHtml(att.name)}</span>
            </div>
        `;
    }

    function bindGalleryEvents(overlay, vehicle) {
        // Carica thumbnail immagini (lazy, in background)
        overlay.querySelectorAll('img[data-drive-id]').forEach(async (img) => {
            try {
                const blobUrl = await getBlobUrl(img.dataset.driveId, 'image/*');
                img.src = blobUrl;
                img.dataset.blobUrl = blobUrl;
            } catch (err) {
                img.src = '';
                img.alt = 'Errore caricamento';
            }
        });

        // Click su thumbnail → apri lightbox/player
        overlay.querySelectorAll('.iveco-gallery-thumb-inner').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                if (e.target.closest('.iveco-gallery-thumb-delete')) return;
                const container = thumb.closest('.iveco-gallery-thumb');
                const driveId = container.dataset.attId;
                const att = (vehicle.attachments || []).find(a => a.driveId === driveId);
                if (!att) return;
                openLightbox(att);
            });
        });

        // Elimina
        overlay.querySelectorAll('.iveco-gallery-thumb-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const driveId = btn.dataset.attId;
                if (!confirm('Eliminare questo allegato?')) return;
                btn.disabled = true;
                try {
                    await deleteFile(driveId);
                    vehicle.attachments = (vehicle.attachments || []).filter(a => a.driveId !== driveId);
                    saveVehiclesExternal();
                    // Rimuovi thumb dalla griglia
                    const thumb = overlay.querySelector(`.iveco-gallery-thumb[data-att-id="${driveId}"]`);
                    if (thumb) {
                        thumb.style.animation = 'fadeSlideOut 0.3s ease forwards';
                        setTimeout(() => { thumb.remove(); updateGalleryEmpty(overlay, vehicle); updateBadge(vehicle); }, 300);
                    }
                } catch (err) {
                    alert('Errore durante eliminazione: ' + err.message);
                    btn.disabled = false;
                }
            });
        });
    }

    function updateGalleryEmpty(overlay, vehicle) {
        const grid = overlay.querySelector('.iveco-gallery-grid');
        if (grid && grid.children.length === 0) {
            const body = overlay.querySelector('.iveco-gallery-body');
            if (body) body.innerHTML = `
                <div class="iveco-gallery-empty">
                    <span class="material-symbols-outlined">image_not_supported</span>
                    <p>Nessun allegato ancora</p>
                </div>`;
        }
    }

    // ============================================================
    // UI — Lightbox (foto a schermo intero / player video)
    // ============================================================
    async function openLightbox(att) {
        const isVideo = att.mimeType && att.mimeType.startsWith('video/');

        const lb = document.createElement('div');
        lb.id = 'iveco-lightbox';
        lb.innerHTML = `
            <div id="iveco-lightbox-inner">
                <button id="iveco-lightbox-close">
                    <span class="material-symbols-outlined">close</span>
                </button>
                <div id="iveco-lightbox-loading">
                    <div class="iveco-spinner"></div>
                    <p>Caricamento...</p>
                </div>
                <div id="iveco-lightbox-content" style="display:none"></div>
                <div id="iveco-lightbox-name">${escHtml(att.name)}</div>
            </div>
        `;
        document.body.appendChild(lb);
        requestAnimationFrame(() => lb.classList.add('visible'));

        const closeLb = () => {
            // Revoca blob url se presente
            const el = lb.querySelector('img, video');
            if (el && el.src && el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
            lb.classList.remove('visible');
            setTimeout(() => lb.remove(), 280);
        };

        document.getElementById('iveco-lightbox-close').addEventListener('click', closeLb);
        lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });

        try {
            const blobUrl = await getBlobUrl(att.driveId, att.mimeType);
            const contentEl = document.getElementById('iveco-lightbox-content');
            const loadingEl = document.getElementById('iveco-lightbox-loading');

            if (isVideo) {
                contentEl.innerHTML = `<video controls autoplay src="${blobUrl}"></video>`;
            } else {
                contentEl.innerHTML = `<img src="${blobUrl}" alt="${escHtml(att.name)}">`;
            }

            loadingEl.style.display = 'none';
            contentEl.style.display = 'flex';
        } catch (err) {
            document.getElementById('iveco-lightbox-loading').innerHTML =
                `<p style="color:#e74c3c">Errore: ${escHtml(err.message)}</p>`;
        }
    }

    // ============================================================
    // UI — Gestione upload con progress
    // ============================================================
    async function handleUpload(files, vehicle, overlay) {
        const progressWrap = document.getElementById('iveco-gallery-progress-wrap');
        const progressFill = document.getElementById('iveco-gallery-progress-fill');
        const progressLabel = document.getElementById('iveco-gallery-progress-label');

        progressWrap.style.display = 'block';

        if (!vehicle.attachments) vehicle.attachments = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressLabel.textContent = `Caricamento ${i + 1}/${files.length}: ${file.name}`;
            progressFill.style.width = '0%';

            try {
                const driveId = await uploadFileToDrive(file, vehicle.id, (pct) => {
                    progressFill.style.width = pct + '%';
                });

                const att = {
                    driveId,
                    name: file.name,
                    mimeType: file.type,
                    uploadedAt: new Date().toISOString()
                };
                vehicle.attachments.push(att);
                saveVehiclesExternal();
                updateBadge(vehicle);

                // Aggiungi thumbnail nella griglia
                addThumbToGrid(overlay, att, vehicle);

            } catch (err) {
                alert(`Errore caricamento "${file.name}": ${err.message}`);
            }
        }

        progressFill.style.width = '100%';
        progressLabel.textContent = 'Completato!';
        setTimeout(() => { progressWrap.style.display = 'none'; }, 1500);
    }

    function addThumbToGrid(overlay, att, vehicle) {
        let grid = overlay.querySelector('.iveco-gallery-grid');

        // Se c'era lo stato empty, sostituiscilo con la grid
        if (!grid) {
            const body = overlay.querySelector('.iveco-gallery-body');
            if (body) {
                body.innerHTML = `<div class="iveco-gallery-grid" id="iveco-gallery-grid"></div>`;
                grid = body.querySelector('.iveco-gallery-grid');
            }
        }
        if (!grid) return;

        const div = document.createElement('div');
        div.innerHTML = buildAttachmentThumb(att);
        const thumb = div.firstElementChild;
        grid.appendChild(thumb);

        // Carica immagine se è una foto
        if (att.mimeType && att.mimeType.startsWith('image/')) {
            const img = thumb.querySelector('img');
            if (img) {
                getBlobUrl(att.driveId, att.mimeType).then(blobUrl => {
                    img.src = blobUrl;
                    img.dataset.blobUrl = blobUrl;
                }).catch(() => {});
            }
        }

        // Re-bind eventi sul nuovo thumb
        const deleteBtn = thumb.querySelector('.iveco-gallery-thumb-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const driveId = deleteBtn.dataset.attId;
                if (!confirm('Eliminare questo allegato?')) return;
                deleteBtn.disabled = true;
                try {
                    await deleteFile(driveId);
                    vehicle.attachments = (vehicle.attachments || []).filter(a => a.driveId !== driveId);
                    saveVehiclesExternal();
                    thumb.style.animation = 'fadeSlideOut 0.3s ease forwards';
                    setTimeout(() => { thumb.remove(); updateGalleryEmpty(overlay, vehicle); updateBadge(vehicle); }, 300);
                } catch (err) {
                    alert('Errore eliminazione: ' + err.message);
                    deleteBtn.disabled = false;
                }
            });
        }

        const thumbInner = thumb.querySelector('.iveco-gallery-thumb-inner');
        if (thumbInner) {
            thumbInner.addEventListener('click', (e) => {
                if (e.target.closest('.iveco-gallery-thumb-delete')) return;
                openLightbox(att);
            });
        }
    }

    // ============================================================
    // UI — Aggiorna badge contatore sulla card veicolo
    // ============================================================
    function updateBadge(vehicle) {
        const count = (vehicle.attachments || []).length;
        const btn = document.querySelector(`.iveco-gallery-btn[data-id="${vehicle.id}"]`);
        if (!btn) return;
        const badge = btn.querySelector('.iveco-gallery-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // ============================================================
    // BRIDGE — Chiama saveVehicles() di iveco.js
    // ============================================================
    function saveVehiclesExternal() {
        if (typeof window.ivecoSaveVehicles === 'function') {
            window.ivecoSaveVehicles();
        }
    }

    // ============================================================
    // UTILITY
    // ============================================================
    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ============================================================
    // API PUBBLICA
    // ============================================================
    window.ivecoAttachments = {
        openGallery: openGalleryPopup,
        handleUpload,
        updateBadge,
        _uploadFile: uploadFileToDrive   // usato dal popup data per upload rapido
    };

})();
