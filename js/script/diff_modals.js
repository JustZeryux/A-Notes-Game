/* ==========================================================
   DIFF_MODALS.JS - FILTRO DE TECLAS INTELIGENTE (FIXED V4)
   ========================================================== */

window.showEmptyMapModal = function(k, songData) {
    if(document.getElementById('modal-empty-map')) document.getElementById('modal-empty-map').remove();
    
    const modalHTML = `
    <div id="modal-empty-map" class="modal-overlay" style="display:flex; z-index: 9999999; backdrop-filter: blur(10px);">
        <div class="modal-panel" style="max-width: 450px; text-align: center; border: 2px solid #ff66aa; box-shadow: 0 0 30px rgba(255,102,170,0.3);">
            <div class="modal-neon-header" style="border-bottom: none;">
                <h2 class="modal-neon-title" style="color: #ff66aa; font-size: 2rem;">⚠️ PISTA VACÍA</h2>
            </div>
            <div class="modal-neon-content" style="padding: 10px 20px 30px 20px;">
                <p style="color: #ccc; font-size: 1.1rem; margin-bottom: 25px;">Esta canción no tiene notas mapeadas en ${k}K. ¿Qué deseas hacer?</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="action" id="btn-empty-play" style="width: 100%; background: #00ffff; color: black; font-weight: 900;">🎮 JUGAR (AUTO-MAPEO)</button>
                    <button class="action secondary" id="btn-empty-edit" style="width: 100%; color: #ff66aa; border-color: #ff66aa;">✏️ MAPEAR (EDITOR)</button>
                    <button class="action secondary" onclick="document.getElementById('modal-empty-map').remove()" style="width: 100%; color: #F9393F; border-color: #F9393F;">❌ CANCELAR</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-empty-play').onclick = () => {
        document.getElementById('modal-empty-map').remove();
        window.forceAutomap = true; 
        if (typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
    };

    document.getElementById('btn-empty-edit').onclick = () => {
        document.getElementById('modal-empty-map').remove();
        if (typeof window.openEditor === 'function') window.openEditor(songData, k, 'mania');
    };
};

window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    
    if(titleEl) titleEl.innerText = song.title;
    if(coverEl) {
        coverEl.style.backgroundImage = `url('${song.imageURL}')`;
        coverEl.innerHTML = ''; 
    }

    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; 
    
    let cleanId = String(song.id).replace('osu_', '');
    const standardModes = [4, 6, 7, 9];
    
    let isCharted = song.keysAvailable && song.keysAvailable.length > 0;
    
    let allModes = !isCharted ? standardModes : [...new Set([...standardModes, ...song.keysAvailable])].sort((a,b)=>a-b);

    const colors = {4: '#00FFFF', 6: '#12FA05', 7: '#FFD700', 9: '#F9393F'};
    const labels = {4: 'EASY', 6: 'NORMAL', 7: 'INSANE', 9: 'DEMON'};

    allModes.forEach(k => {
        let btn = document.createElement('div'); btn.className = 'diff-card';
        
        let isAvailable = false;
        if (song.isOsu) {
            isAvailable = (song.keysAvailable || []).includes(k);
        } else {
            // Siempre se permiten modos estándar en comunidad
            isAvailable = standardModes.includes(k) || (song.keysAvailable || []).includes(k);
        }

        let c = colors[k] || '#ff66aa';
        let l = labels[k] || 'CUSTOM';

        if (isAvailable) {
            btn.style.borderColor = c; btn.style.color = c;
            btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num">${k}K</div><div class="diff-label">${l}</div>`;
            btn.onclick = () => {
                window.closeModal('diff');
                if(song.isOsu) { 
                    downloadAndPlayOsu(cleanId, song.title, song.imageURL, k); 
                } else {
                    window.curSongData = song.raw || song;
                    
                    let mapData = window.curSongData[`notes_mania_${k}k`];
                    
                    // Solo usa curSongData.notes como backup para el modo 4K
                    if (!mapData && k === 4 && window.curSongData.notes) {
                        mapData = window.curSongData.notes;
                    }

                    if (!mapData || mapData.length === 0) {
                        window.showEmptyMapModal(k, window.curSongData);
                    } else {
                        window.prepareAndPlaySong(k);
                    }
                }
            };
        } else {
            btn.style.opacity = "0.2"; btn.style.cursor = "not-allowed"; btn.style.filter = "grayscale(1)";
            btn.innerHTML = `<div class="diff-bg-icon">🔒</div><div class="diff-num">${k}K</div><div class="diff-label">BLOQUEADO</div>`;
        }
        grid.appendChild(btn);
    });

    if (!song.isOsu) {
        let editBtn = document.createElement('div'); editBtn.className = 'diff-card'; editBtn.style.gridColumn = "1 / -1";
        editBtn.style.borderColor = "#ff66aa"; editBtn.style.color = "#ff66aa"; editBtn.style.marginTop = "10px";
        editBtn.innerHTML = `<div class="diff-num" style="font-size:1.5rem;">✏️ EDITOR STUDIO</div><div class="diff-label">Crea o modifica notas</div>`;
        editBtn.onclick = () => { window.closeModal('diff'); openEditor(song.raw || song, 4); };
        grid.appendChild(editBtn);
    }
    
    if (typeof window.openModal === 'function') window.openModal('diff');
    else { const modal = document.getElementById('modal-diff'); if(modal) modal.style.display = 'flex'; }
};
