/* ==========================================================
   DIFF_MODAL.JS - Menú de Dificultades Reparado (Anti-Bugs de ID)
   ========================================================== */

window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    
    titleEl.innerText = song.title;
    coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    grid.innerHTML = ''; 
    grid.style.maxHeight = '260px'; 
    grid.style.overflowY = 'auto';
    grid.style.padding = '5px';
    
    let safeMode = song.originalMode || 'mania';
    
    // FIX VITAL: Limpiamos el ID para evitar el Error 400 Bad Request en la API de Osu
    let cleanId = String(song.id).replace('osu_', '');
    let engineSong = Object.assign({}, song);
    engineSong.id = cleanId;

    // --- LOGICA BOTON LARGO PARA STANDARD / TAIKO / CATCH ---
    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        btn.style.gridColumn = "1 / -1";
        
        let icon = safeMode === 'standard' ? "🎯" : (safeMode === 'taiko' ? "🥁" : "🍎");
        let color = safeMode === 'standard' ? "#ff44b9" : (safeMode === 'taiko' ? "#f95555" : "#44b9ff");
        let stars = parseFloat(song.starRating || 0).toFixed(1);

        btn.style.borderColor = color; btn.style.color = color;
        btn.style.boxShadow = `0 0 20px ${color}44`;
        btn.style.display = "flex"; btn.style.justifyContent = "space-between"; btn.style.alignItems = "center";
        btn.style.padding = "20px";

        btn.innerHTML = `
            <div style="text-align:left; position:relative; z-index:2;">
                <div style="font-size:2.5rem; font-weight:900; text-shadow: 0 0 10px ${color};">${icon} ${safeMode.toUpperCase()}</div>
                <div style="font-size:0.9rem; font-weight:bold; opacity:0.8;">MODO ORIGINAL DE OSU!</div>
            </div>
            <div style="background:rgba(0,0,0,0.8); padding:10px 20px; border-radius:10px; border:2px solid gold; color:gold; font-weight:900; font-size:1.8rem; box-shadow: 0 0 15px rgba(255,215,0,0.3);">
                ⭐ ${stars}
            </div>
            <div class="diff-bg-icon" style="position:absolute; right:10px; bottom:-10px; font-size:6rem; opacity:0.1; pointer-events:none;">${icon}</div>
        `;

        btn.onclick = () => {
            window.closeModal('diff');
            // Enviamos engineSong (que tiene el ID limpio) para evitar el JSZip error
            if(safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(engineSong);
            else if(safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(engineSong);
            else if(safeMode === 'catch' && typeof startCatchEngine === 'function') startCatchEngine(engineSong);
        };
        grid.appendChild(btn);
    } 
    // --- LOGICA ORIGINAL PARA MANIA ---
    else {
        const colors = {1: '#ffffff', 2: '#55ff55', 3: '#5555ff', 4: '#00FFFF', 5: '#a200ff', 6: '#12FA05', 7: '#FFD700', 8: '#ff8800', 9: '#F9393F', 10: '#ff0000'};
        const labels = {1: 'RHYTHM', 2: 'BASIC', 3: 'EASY', 4: 'EASY', 5: 'NORMAL', 6: 'NORMAL', 7: 'INSANE', 8: 'EXPERT', 9: 'DEMON', 10: 'IMPOSSIBLE'};
        
        const standardModes = [4, 6, 7, 9];
        let allModes = [...new Set([...standardModes, ...(song.keysAvailable || [])])].sort((a,b) => a - b);
        
        allModes.forEach(k => {
            let c = colors[k] || '#ff66aa';
            let l = labels[k] || 'CUSTOM';
            let btn = document.createElement('div');
            btn.className = 'diff-card';
            
            if (song.keysAvailable && song.keysAvailable.includes(k)) {
                btn.style.borderColor = c; btn.style.color = c;
                btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num" style="font-size:2.2rem; font-weight:900;">${k}K</div><div class="diff-label">${l}</div>`;
                btn.onclick = () => {
                    window.closeModal('diff');
                    if(typeof window.asegurarModo === 'function') window.asegurarModo(k); 
                    if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
                    
                    if(song.isOsu) {
                        // Enviamos el cleanId aquí también por seguridad
                        downloadAndPlayOsu(cleanId, song.title, song.imageURL, k);
                    } else {
                        // FIX: Arreglo del bucle infinito "PREPARANDO PISTA..." para la comunidad
                        window.curSongData = song.raw || song; 
                        if (typeof window.prepareAndPlaySong === 'function') {
                            window.prepareAndPlaySong(k);
                        } else if (typeof window.startGame === 'function') {
                            window.startGame(k);
                        }
                    }
                };
            } else {
                btn.style.borderColor = '#333'; btn.style.color = '#555'; btn.style.background = 'rgba(0,0,0,0.6)'; btn.style.cursor = 'not-allowed'; btn.style.boxShadow = 'none';
                btn.innerHTML = `<div class="diff-bg-icon" style="opacity: 0.1;">${k}K</div><div class="diff-num" style="font-size:2rem; font-weight:900;">🔒 ${k}K</div><div class="diff-label">NO DISPONIBLE</div>`;
            }
            grid.appendChild(btn);
        });
    }

    if (!song.isOsu) {
        let editBtn = document.createElement('div');
        editBtn.className = 'diff-card'; editBtn.style.gridColumn = "1 / -1";
        editBtn.style.borderColor = "#ff66aa"; editBtn.style.color = "#ff66aa"; editBtn.style.marginTop = "10px"; editBtn.style.minHeight = "80px";
        editBtn.innerHTML = `<div class="diff-bg-icon">✏️</div><div class="diff-num" style="font-size:1.5rem; font-weight:900;">✏️ EDITOR STUDIO</div><div class="diff-label">Crea y edita tu propio mapa</div>`;
        editBtn.onclick = () => { window.closeModal('diff'); if(typeof openEditor === 'function') openEditor(song.raw || song, 4); };
        grid.appendChild(editBtn);
    }
    
    // Mostramos el modal usando la lógica global de tu HTML
    if (typeof window.openModal === 'function') {
        window.openModal('diff');
    } else {
        const modal = document.getElementById('modal-diff');
        if(modal) modal.style.display = 'flex';
    }
};
