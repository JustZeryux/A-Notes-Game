/* === DIFF_MODAL.JS - DISEÑO PREMIUM RESTAURADO 💎 === */

window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    if(titleEl) titleEl.innerText = song.title;
    if(coverEl) coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; 

    // RED DE SEGURIDAD PARA EL MODO
    let safeMode = song.originalMode || 'mania';

    // 1. SI ES STANDARD, TAIKO O CATCH (Botón Grande con Efectos)
    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card'; 
        btn.style.gridColumn = "1 / -1";
        
        let icon = "🎯", color = "#ff44b9", label = "STANDARD";
        if (safeMode === 'taiko') { icon = "🥁"; color = "#f95555"; label = "TAIKO"; }
        else if (safeMode === 'catch') { icon = "🍎"; color = "#44b9ff"; label = "CATCH"; }

        btn.style.cssText = `border: 2px solid ${color}; color: ${color}; box-shadow: 0 0 20px ${color}44; display:flex; justify-content:space-between; align-items:center; padding:20px; transition: 0.3s;`;
        btn.innerHTML = `
            <div style="text-align:left; z-index:2;">
                <div style="font-size:2.5rem; font-weight:900; text-shadow:0 0 10px ${color};">${icon} ${safeMode.toUpperCase()}</div>
                <div style="opacity:0.7; font-weight:bold;">MODO ORIGINAL DE OSU!</div>
            </div>
            <div style="background:rgba(0,0,0,0.8); padding:10px 20px; border-radius:10px; border:2px solid gold; color:gold; font-weight:900; font-size:1.8rem; box-shadow: 0 0 15px rgba(255,215,0,0.3);">
                ⭐ ${parseFloat(song.starRating || 0).toFixed(1)}
            </div>
        `;

        btn.onclick = () => {
            window.closeModal('diff');
            // INICIAR MOTOR CORRECTO
            if (safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(song);
            else if (safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(song);
            else alert("El motor de " + safeMode + " se está cargando...");
        };
        grid.appendChild(btn);
    } 
    // 2. SI ES MANIA O COMUNIDAD (Botones 4K, 6K...)
    else {
        const colors = {4: '#00FFFF', 6: '#12FA05', 7: '#FFD700', 9: '#F9393F'};
        [4, 6, 7, 9].forEach(k => {
            let btn = document.createElement('div');
            btn.className = 'diff-card';
            let isAvail = (song.keysAvailable && song.keysAvailable.includes(k)) || !song.isOsu;
            let c = isAvail ? (colors[k] || '#ff66aa') : '#333';
            
            btn.style.cssText = `border: 2px solid ${c}; color: ${c}; box-shadow: 0 0 15px ${c}22;`;
            btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num">${k}K</div>`;
            
            if(isAvail) btn.onclick = () => {
                window.closeModal('diff');
                if(song.isOsu) downloadAndPlayOsu(song.id, song.title, song.imageURL, k);
                else { window.curSongData = song.raw; window.startGame(k); }
            };
            grid.appendChild(btn);
        });
    }
    window.openModal('diff');
};
