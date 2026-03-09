/* ==========================================================
   DIFF_MODALS.JS - Menú de Dificultades + Interceptor de Mapas Vacíos
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
                <p style="color: #ccc; font-size: 1.1rem; margin-bottom: 25px;">Esta canción fue subida desde la comunidad y aún no tiene notas mapeadas en ${k}K. ¿Qué deseas hacer?</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="action" id="btn-empty-play" style="width: 100%; background: #00ffff; color: black; font-weight: 900; font-size: 1.1rem; text-shadow: none;">🎮 JUGAR (Auto-Mapeo del Juego)</button>
                    <button class="action secondary" id="btn-empty-edit" style="width: 100%; color: #ff66aa; border-color: #ff66aa; font-weight: bold;">✏️ MAPEAR (Abrir Editor)</button>
                    <button class="action secondary" onclick="document.getElementById('modal-empty-map').remove()" style="width: 100%; color: #F9393F; border-color: #F9393F; font-weight: bold;">❌ CANCELAR</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

document.getElementById('btn-empty-play').onclick = () => {
        document.getElementById('modal-empty-map').remove();
        
        // 1. Banderas globales: Le avisamos a tu game.js que QUEREMOS usar su automapeo
        window.useNativeAutomap = true; 
        window.forceAutomap = true;
        
        // 2. Llamamos a tu juego de forma limpia (Sin inyectar notas falsas)
        if (typeof window.prepareAndPlaySong === 'function') {
            window.prepareAndPlaySong(k, true); // Mandamos un 'true' por si tu función lo lee
        } else if (typeof window.startGame === 'function') {
            window.startGame(k, true);
        }
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
        coverEl.style.position = 'relative';
        
        let gradeBadgeHTML = '';
        if (window.user && window.user.scores && window.user.scores[song.id]) {
            let bestScoreData = window.user.scores[song.id];
            let grade = typeof bestScoreData === 'object' ? bestScoreData.grade : null;
            if (grade) {
                let badgeColor = grade === "SS" ? "#00ffff" : grade === "S" ? "gold" : grade === "A" ? "#12FA05" : grade === "B" ? "yellow" : grade === "C" ? "orange" : "#F9393F";
                gradeBadgeHTML = `<div style="position: absolute; top: -15px; right: -15px; background: rgba(10,10,15,0.95); color: ${badgeColor}; border: 3px solid ${badgeColor}; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.5rem; box-shadow: 0 0 20px ${badgeColor}; z-index: 10; font-family: sans-serif;">${grade}</div>`;
            }
        }
        coverEl.innerHTML = gradeBadgeHTML; 
    }

    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; grid.style.maxHeight = '260px'; grid.style.overflowY = 'auto'; grid.style.padding = '5px';
    
    let safeMode = song.originalMode || 'mania';
    let cleanId = String(song.id).replace('osu_', '');
    let engineSong = Object.assign({}, song);
    engineSong.id = cleanId;

    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div'); btn.className = 'diff-card'; btn.style.gridColumn = "1 / -1";
        let icon = safeMode === 'standard' ? "🎯" : (safeMode === 'taiko' ? "🥁" : "🍎");
        let color = safeMode === 'standard' ? "#ff44b9" : (safeMode === 'taiko' ? "#f95555" : "#44b9ff");
        let stars = parseFloat(song.starRating || 0).toFixed(1);

        btn.style.borderColor = color; btn.style.color = color; btn.style.boxShadow = `0 0 20px ${color}44`;
        btn.style.display = "flex"; btn.style.justifyContent = "space-between"; btn.style.alignItems = "center"; btn.style.padding = "20px";
        btn.innerHTML = `<div style="text-align:left; position:relative; z-index:2;"><div style="font-size:2.5rem; font-weight:900; text-shadow: 0 0 10px ${color};">${icon} ${safeMode.toUpperCase()}</div><div style="font-size:0.9rem; font-weight:bold; opacity:0.8;">MODO ORIGINAL DE OSU!</div></div><div style="background:rgba(0,0,0,0.8); padding:10px 20px; border-radius:10px; border:2px solid gold; color:gold; font-weight:900; font-size:1.8rem; box-shadow: 0 0 15px rgba(255,215,0,0.3);">⭐ ${stars}</div><div class="diff-bg-icon" style="position:absolute; right:10px; bottom:-10px; font-size:6rem; opacity:0.1; pointer-events:none;">${icon}</div>`;

        btn.onclick = () => {
            if(typeof window.closeModal === 'function') window.closeModal('diff');
            if(safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(engineSong);
            else if(safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(engineSong);
            else if(safeMode === 'catch' && typeof startCatchEngine === 'function') startCatchEngine(engineSong);
        };
        grid.appendChild(btn);
    } 
    else {
        const colors = {1: '#ffffff', 2: '#55ff55', 3: '#5555ff', 4: '#00FFFF', 5: '#a200ff', 6: '#12FA05', 7: '#FFD700', 8: '#ff8800', 9: '#F9393F', 10: '#ff0000'};
        const labels = {1: 'RHYTHM', 2: 'BASIC', 3: 'EASY', 4: 'EASY', 5: 'NORMAL', 6: 'NORMAL', 7: 'INSANE', 8: 'EXPERT', 9: 'DEMON', 10: 'IMPOSSIBLE'};
        const standardModes = [4, 6, 7, 9];
        let allModes = [...new Set([...standardModes, ...(song.keysAvailable || [])])].sort((a,b) => a - b);
        
        allModes.forEach(k => {
            let c = colors[k] || '#ff66aa'; let l = labels[k] || 'CUSTOM';
            let btn = document.createElement('div'); btn.className = 'diff-card';
            
            let isUnlocked = (!song.isOsu) || (song.keysAvailable && song.keysAvailable.includes(k));
            
            if (isUnlocked) {
                btn.style.borderColor = c; btn.style.color = c;
                btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num" style="font-size:2.2rem; font-weight:900;">${k}K</div><div class="diff-label">${l}</div>`;
                btn.onclick = () => {
                    if(typeof window.closeModal === 'function') window.closeModal('diff');
                    if(typeof window.asegurarModo === 'function') window.asegurarModo(k); 
                    if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
                    
                    if(song.isOsu) {
                        if(typeof downloadAndPlayOsu === 'function') downloadAndPlayOsu(cleanId, song.title, song.imageURL, k);
                    } else {
                        window.curSongData = song.raw || song; 
                        let mapData = window.curSongData[`notes_${k}k`] || window.curSongData.notes || [];
                        
                        if (!mapData || mapData.length === 0) {
                            window.showEmptyMapModal(k, window.curSongData);
                        } else {
                            if (typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
                            else if (typeof window.startGame === 'function') window.startGame(k);
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
        let editBtn = document.createElement('div'); editBtn.className = 'diff-card'; editBtn.style.gridColumn = "1 / -1";
        editBtn.style.borderColor = "#ff66aa"; editBtn.style.color = "#ff66aa"; editBtn.style.marginTop = "10px"; editBtn.style.minHeight = "80px";
        editBtn.innerHTML = `<div class="diff-bg-icon">✏️</div><div class="diff-num" style="font-size:1.5rem; font-weight:900;">✏️ EDITOR STUDIO</div><div class="diff-label">Crea y edita tu propio mapa</div>`;
        editBtn.onclick = () => { 
            if(typeof window.closeModal === 'function') window.closeModal('diff'); 
            if(typeof window.openEditor === 'function') window.openEditor(song.raw || song, 4); 
        };
        grid.appendChild(editBtn);
    }
    
    if (typeof window.openModal === 'function') window.openModal('diff');
    else { const modal = document.getElementById('modal-diff'); if(modal) modal.style.display = 'flex'; }
};
