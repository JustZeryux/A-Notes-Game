/* ==========================================================
   DIFF_MODALS.JS - FIX DE CANDADOS PARA MAPAS CHARTED
   ========================================================== */

window.showEmptyMapModal = function(k, songData) {
    if(document.getElementById('modal-empty-map')) document.getElementById('modal-empty-map').remove();
    
    const modalHTML = `
    <div id="modal-empty-map" class="modal-overlay" style="display:flex; z-index: 9999999; backdrop-filter: blur(10px);">
        <div class="modal-panel" style="max-width: 450px; text-align: center; border: 2px solid #ff66aa; box-shadow: 0 0 30px rgba(255,102,170,0.3);">
            <div class="modal-neon-header" style="border-bottom: none;"><h2 class="modal-neon-title" style="color: #ff66aa; font-size: 2rem;">⚠️ PISTA VACÍA</h2></div>
            <div class="modal-neon-content" style="padding: 10px 20px 30px 20px;">
                <p style="color: #ccc; font-size: 1.1rem; margin-bottom: 25px;">Esta canción no tiene notas mapeadas en ${k}K. ¿Qué deseas hacer?</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="action" id="btn-empty-play" style="width: 100%; background: #00ffff; color: black; font-weight: 900;">🎮 JUGAR (AUTO-MAPEO)</button>
                    <button class="action secondary" id="btn-empty-edit" style="width: 100%; color: #ff66aa; border-color: #ff66aa; font-weight: bold;">✏️ MAPEAR (EDITOR)</button>
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
    if(coverEl) { coverEl.style.backgroundImage = `url('${song.imageURL}')`; coverEl.innerHTML = ''; }

    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; 
    
    let safeMode = song.originalMode || 'mania';
    let cleanId = String(song.id).replace('osu_', '');
    let engineSong = Object.assign({}, song);
    engineSong.id = cleanId;

    // 🚨 BOTÓN LARGO PARA STANDARD, TAIKO Y CATCH
    if (safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        btn.style.gridColumn = "1 / -1"; 
        
        let icon = safeMode === 'standard' ? "🎯" : (safeMode === 'taiko' ? "🥁" : "🍎");
        let color = safeMode === 'standard' ? "#ff44b9" : (safeMode === 'taiko' ? "#f95555" : "#44b9ff");
        let stars = song.isOsu ? parseFloat(song.starRating || 0).toFixed(1) : "0.0"; 
        // Intenta sacar las estrellas si es custom
        if(!song.isOsu && song.raw) {
            let nc = 0; if(song.raw.notes) nc = song.raw.notes.length;
            Object.keys(song.raw).forEach(k => { if(k.startsWith('notes_') && Array.isArray(song.raw[k])) nc = Math.max(nc, song.raw[k].length); });
            stars = nc === 0 ? "0.0" : ((nc / 200) + 1).toFixed(1);
        }

        btn.style.borderColor = color;
        btn.style.boxShadow = `0 0 20px ${color}44`;
        btn.style.display = "flex"; btn.style.justifyContent = "space-between"; btn.style.alignItems = "center"; btn.style.padding = "20px";
        btn.innerHTML = `
            <div style="text-align:left;">
                <div style="font-size:2rem; font-weight:900; color:${color}; text-shadow: 0 0 10px ${color}88;">${icon} ${safeMode.toUpperCase()}</div>
                <div style="opacity:0.7; color:white; font-weight:bold;">${song.isOsu ? 'Mapa Original de Osu!' : 'Mapa de la Comunidad'}</div>
            </div>
            <div style="font-size:1.8rem; font-weight:900; color:gold; text-shadow:0 0 15px rgba(255,215,0,0.5);">⭐ ${stars}</div>
        `;

        btn.onclick = () => {
            window.closeModal('diff');
            if(safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(engineSong);
            else if(safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(engineSong);
            else if(safeMode === 'catch' && typeof startCatchEngine === 'function') startCatchEngine(engineSong);
        };
        grid.appendChild(btn);
    } 
    else {
        // 🚨 LÓGICA DE MANIA REPARADA (RESPETA LOS MAPAS CHARTED)
        const standardModes = [4, 6, 7, 9];
        const colors = {1: '#ffffff', 2: '#55ff55', 3: '#5555ff', 4: '#00FFFF', 5: '#a200ff', 6: '#12FA05', 7: '#FFD700', 8: '#ff8800', 9: '#F9393F', 10: '#ff0000'};
        const labels = {1: 'RHYTHM', 2: 'BASIC', 3: 'EASY', 4: 'EASY', 5: 'NORMAL', 6: 'NORMAL', 7: 'INSANE', 8: 'EXPERT', 9: 'DEMON', 10: 'IMPOSSIBLE'};

        // Filtramos el 1K fantasma de las teclas reales
        let realKeys = (song.keysAvailable || []).filter(k => k > 1);
        
        // Un mapa está "charteado" si tiene al menos un modo de teclas guardado.
        let isCharted = realKeys.length > 0;

        let allModes = [...new Set([...standardModes, ...realKeys])].sort((a,b)=>a-b);

        allModes.forEach(k => {
            let btn = document.createElement('div'); btn.className = 'diff-card';
            
            let isAvailable = false;
            
            if (song.isOsu) {
                isAvailable = realKeys.includes(k);
            } else {
                if (isCharted) {
                    // 🔥 LA CORRECCIÓN: Si ya hay notas guardadas, SOLO permite jugar las teclas que tienen notas.
                    isAvailable = realKeys.includes(k);
                } else {
                    // Si el mapa es completamente virgen/vacío, abrimos los 4 modos base para crear notas
                    isAvailable = standardModes.includes(k);
                }
            }
            
            let c = colors[k] || '#ff66aa';
            let l = labels[k] || 'CUSTOM';

            if (isAvailable) {
                btn.style.borderColor = c;
                btn.style.boxShadow = `0 0 15px ${c}33`; 
                btn.innerHTML = `
                    <div class="diff-bg-icon" style="color:${c}; opacity:0.15;">${k}K</div>
                    <div class="diff-num" style="color:${c}; text-shadow:0 0 15px ${c}; font-size:2.5rem; font-weight:900;">${k}K</div>
                    <div class="diff-label" style="color:${c}; font-weight:bold; letter-spacing:2px; margin-top:5px;">${l}</div>
                `;
                
                btn.onclick = () => {
                    window.closeModal('diff');
                    if(song.isOsu) downloadAndPlayOsu(cleanId, song.title, song.imageURL, k);
                    else {
                        window.curSongData = song.raw || song;
                        let mapData = window.curSongData[`notes_mania_${k}k`] || window.curSongData.notes || [];
                        if (mapData.length === 0) {
                            if(typeof window.showEmptyMapModal === 'function') window.showEmptyMapModal(k, window.curSongData);
                        } else window.prepareAndPlaySong(k);
                    }
                };
            } else {
                btn.style.opacity = "0.2"; btn.style.cursor = "not-allowed"; btn.style.borderColor = "#333";
                btn.style.boxShadow = "none";
                btn.innerHTML = `
                    <div class="diff-bg-icon" style="color:#fff; opacity:0.05;">🔒</div>
                    <div class="diff-num" style="color:#555;">${k}K</div>
                    <div class="diff-label" style="color:#444;">N/A</div>
                `;
            }
            grid.appendChild(btn);
        });
    }

    // BOTÓN DE EDITOR
    if (!song.isOsu) {
        let editBtn = document.createElement('div'); editBtn.className = 'diff-card'; editBtn.style.gridColumn = "1 / -1";
        editBtn.style.borderColor = "#ff66aa"; 
        editBtn.style.boxShadow = "0 0 20px rgba(255,102,170,0.3)";
        editBtn.innerHTML = `
            <div class="diff-num" style="font-size:1.5rem; color:#ff66aa; text-shadow:0 0 10px #ff66aa;">✏️ EDITOR STUDIO</div>
            <div class="diff-label" style="color:#ff66aa;">Crea y edita tu propio mapa</div>
        `;
        editBtn.onclick = () => { window.closeModal('diff'); openEditor(song.raw || song, 4); };
        grid.appendChild(editBtn);
    }
    
    if (typeof window.openModal === 'function') window.openModal('diff');
    else { const modal = document.getElementById('modal-diff'); if(modal) modal.style.display = 'flex'; }
};
