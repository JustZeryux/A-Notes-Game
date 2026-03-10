/* ==========================================================
   DIFF_MODALS.JS - FIX DE BOTÓN LARGO PARA COMUNIDAD
   ========================================================== */

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

    // 🚨 FIX: AHORA EL BOTÓN LARGO APLICA A LA COMUNIDAD TAMBIÉN
    if (safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        btn.style.gridColumn = "1 / -1"; 
        
        let icon = safeMode === 'standard' ? "🎯" : (safeMode === 'taiko' ? "🥁" : "🍎");
        let color = safeMode === 'standard' ? "#ff44b9" : (safeMode === 'taiko' ? "#f95555" : "#44b9ff");
        let stars = song.isOsu ? parseFloat(song.starRating || 0).toFixed(1) : ((countTotalNotes(song.raw) / 200) + 1).toFixed(1);

        btn.style.borderColor = color; btn.style.color = color;
        btn.style.display = "flex"; btn.style.justifyContent = "space-between"; btn.style.alignItems = "center"; btn.style.padding = "20px";
        btn.innerHTML = `
            <div style="text-align:left;">
                <div style="font-size:2rem; font-weight:900;">${icon} ${safeMode.toUpperCase()}</div>
                <div style="opacity:0.7;">${song.isOsu ? 'Mapa Original de Osu!' : 'Mapa de la Comunidad'}</div>
            </div>
            <div style="font-size:1.8rem; font-weight:900;">⭐ ${stars}</div>
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
        // Lógica de Mania
        const standardModes = [4, 6, 7, 9];
        let isCharted = song.keysAvailable && song.keysAvailable.length > 0 && !song.keysAvailable.includes(1);
        let allModes = !isCharted ? standardModes : [...new Set([...standardModes, ...song.keysAvailable])].sort((a,b)=>a-b);
        allModes = allModes.filter(k => k > 1); // EVITA EL FANTASMA 1K

        allModes.forEach(k => {
            let btn = document.createElement('div'); btn.className = 'diff-card';
            let isAvailable = song.isOsu ? (song.keysAvailable && song.keysAvailable.includes(k)) : (standardModes.includes(k) || song.keysAvailable.includes(k));
            
            if (isAvailable) {
                btn.innerHTML = `<div class="diff-num">${k}K</div><div class="diff-label">MANIA</div>`;
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
                btn.style.opacity = "0.2"; btn.style.cursor = "not-allowed";
                btn.innerHTML = `<div class="diff-num">🔒 ${k}K</div><div class="diff-label">N/A</div>`;
            }
            grid.appendChild(btn);
        });
    }

    if (!song.isOsu) {
        let editBtn = document.createElement('div'); editBtn.className = 'diff-card'; editBtn.style.gridColumn = "1 / -1";
        editBtn.style.borderColor = "#ff66aa"; editBtn.style.color = "#ff66aa";
        editBtn.innerHTML = `<div class="diff-num" style="font-size:1.5rem;">✏️ EDITOR STUDIO</div>`;
        editBtn.onclick = () => { window.closeModal('diff'); openEditor(song.raw || song, 4); };
        grid.appendChild(editBtn);
    }
    
    if (typeof window.openModal === 'function') window.openModal('diff');
    else { const modal = document.getElementById('modal-diff'); if(modal) modal.style.display = 'flex'; }
};
