/* === DIFF_MODAL.JS - DISEÑO PREMIUM RESTAURADO 💎 === */

window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    if(titleEl) titleEl.innerText = song.title;
    if(coverEl) coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; 
    
    let safeMode = song.originalMode || 'mania';

    // 1. DISEÑO ESPECIAL PARA STANDARD, TAIKO Y CATCH (Botón Grande Neón)
    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card'; btn.style.gridColumn = "1 / -1";
        
        let icon = "🎯", color = "#ff44b9", label = "STANDARD";
        if (safeMode === 'taiko') { icon = "🥁"; color = "#f95555"; label = "TAIKO"; }
        else if (safeMode === 'catch') { icon = "🍎"; color = "#44b9ff"; label = "CATCH"; }

        let stars = song.starRating || 0;
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        btn.style.cssText = `border: 2px solid ${color}; color: ${color}; box-shadow: 0 0 20px ${color}33; display:flex; justify-content:space-between; align-items:center; padding:20px;`;
        btn.innerHTML = `
            <div class="diff-bg-icon" style="opacity:0.1; font-size:6rem;">${icon}</div>
            <div style="z-index:2; text-align:left;">
                <div style="font-size:2.5rem; font-weight:900; margin:0;">${icon} ${label}</div>
                <div style="font-size:1rem; opacity:0.8;">Modo Original de Osu!</div>
            </div>
            <div style="background:rgba(0,0,0,0.8); padding:15px 25px; border-radius:12px; border:2px solid ${starCol}; color:${starCol}; font-weight:900; font-size:2rem;" class="star-glow">
                ⭐ ${parseFloat(stars).toFixed(1)}
            </div>
        `;

        btn.onclick = () => {
            window.closeModal('diff');
            if (safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(song);
            else if (safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(song);
            else window.notify(`Iniciando motor ${safeMode.toUpperCase()}...`, "info");
        };
        grid.appendChild(btn);
    } 
    // 2. DISEÑO PARA MANIA Y COMUNIDAD (Botones Estructurados)
    else {
        const colors = {4: '#00FFFF', 6: '#12FA05', 7: '#FFD700', 9: '#F9393F'};
        [4, 6, 7, 9].forEach(k => {
            let btn = document.createElement('div'); btn.className = 'diff-card';
            let isAvail = (song.keysAvailable && song.keysAvailable.includes(k)) || !song.isOsu;
            let c = isAvail ? (colors[k] || '#ff66aa') : '#333';
            
            btn.style.cssText = `border: 2px solid ${c}; color: ${c}; box-shadow: 0 0 15px ${c}22;`;
            
            if(isAvail) {
                let stars = song.starRating || 0;
                if(!song.isOsu) { let n = song.raw?.notes?.length || 0; stars = Math.min(10, (n/200)+(k*0.2)); }
                let sCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

                btn.innerHTML = `
                    <div class="diff-bg-icon">${k}K</div>
                    <div class="diff-num">${k}K</div>
                    <div style="font-weight:900; color:${sCol}; font-size:1.1rem; margin-top:5px;">⭐ ${parseFloat(stars).toFixed(1)}</div>
                `;
                btn.onclick = () => {
                    window.closeModal('diff');
                    if(song.isOsu) downloadAndPlayOsu(song.id, song.title, song.imageURL, k);
                    else { window.curSongData = song.raw; window.startGame(k); }
                };
            } else {
                btn.style.opacity = "0.4"; btn.style.cursor = "not-allowed";
                btn.innerHTML = `<div class="diff-bg-icon">🔒</div><div class="diff-num">🔒 ${k}K</div>`;
            }
            grid.appendChild(btn);
        });
    }

    // BOTÓN DE EDITOR (Restaurado el estilo neón)
    if (!song.isOsu) {
        let eb = document.createElement('div');
        eb.className = 'diff-card'; eb.style.gridColumn = "1 / -1";
        eb.style.cssText = "border: 2px solid #ff66aa; color: #ff66aa; margin-top:15px; min-height:70px; display:flex; align-items:center; justify-content:center; gap:20px;";
        eb.innerHTML = `<span style="font-size:2rem;">✏️</span> <span style="font-size:1.5rem; font-weight:900;">ABRIR EN EDITOR STUDIO</span>`;
        eb.onclick = () => { window.closeModal('diff'); if(typeof openEditor==='function') openEditor(song.raw, 4); };
        grid.appendChild(eb);
    }

    window.openModal('diff');
};
