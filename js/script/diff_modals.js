/* ==========================================================
   DIFF_MODAL.JS - Selector de Modos y Calculador de Estrellas ⭐
   ========================================================== */

window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    
    if(titleEl) titleEl.innerText = song.title;
    if(coverEl) coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    if(!grid) return;
    grid.innerHTML = ''; 
    grid.style.maxHeight = '400px'; // Más espacio para los nuevos modos
    grid.style.overflowY = 'auto';

    // 1. DETERMINAR EL MODO SEGURO (Evita el crash de toUpperCase)
    let safeMode = song.originalMode ? song.originalMode : 'mania';

    // 2. LÓGICA PARA MODOS ESPECIALES (Standard, Taiko, Catch)
    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        btn.style.gridColumn = "1 / -1"; // Tarjeta ancha
        
        let icon = "🎯", color = "#ff44b9", label = "STANDARD";
        if (safeMode === 'taiko') { icon = "🥁"; color = "#f95555"; label = "TAIKO"; }
        else if (safeMode === 'catch') { icon = "🍎"; color = "#44b9ff"; label = "CATCH"; }

        // Obtener estrellas reales de Osu!
        let stars = song.starRating || 0;
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        btn.style.borderColor = color;
        btn.style.color = color;
        btn.innerHTML = `
            <div class="diff-bg-icon">${icon}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; z-index:2; position:relative; padding: 0 20px;">
                <div style="text-align:left;">
                    <div class="diff-num" style="font-size:2.5rem; font-weight:900; margin:0;">${icon} ${label}</div>
                    <div class="diff-label" style="font-size:1rem; opacity:0.8;">Modo Original de Osu!</div>
                </div>
                <div style="background:rgba(0,0,0,0.8); padding:10px 20px; border-radius:10px; border:2px solid ${starCol}; color:${starCol}; font-weight:900; font-size:1.5rem;">
                    ⭐ ${parseFloat(stars).toFixed(1)}
                </div>
            </div>
        `;

        btn.onclick = () => {
            window.closeModal('diff');
            // Llamar al motor correspondiente
            if (safeMode === 'standard' && typeof startNewEngine === 'function') startNewEngine(song);
            else if (safeMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(song);
            else alert(`El motor para ${safeMode.toUpperCase()} estará listo en la próxima actualización.`);
        };
        grid.appendChild(btn);
    } 
    
    // 3. LÓGICA PARA MANIA Y COMUNIDAD (4K, 6K, 7K, 9K)
    else {
        const colors = {4: '#00FFFF', 6: '#12FA05', 7: '#FFD700', 9: '#F9393F'};
        const modeList = [4, 6, 7, 9];

        modeList.forEach(k => {
            let btn = document.createElement('div');
            btn.className = 'diff-card';
            
            // Verificar si el mapa tiene esa dificultad disponible
            let isAvailable = (song.keysAvailable && song.keysAvailable.includes(k)) || !song.isOsu;
            
            if (isAvailable) {
                let c = colors[k] || '#ff66aa';
                btn.style.borderColor = c;
                btn.style.color = c;
                
                // Calcular estrellas para Mania
                let stars = 0;
                if (song.isOsu) {
                    stars = song.starRating || 0;
                } else {
                    // Calculador de dificultad por notas (Comunidad)
                    let notes = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
                    stars = Math.min(10, (notes / 200) + (k * 0.2)); 
                }
                let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

                btn.innerHTML = `
                    <div class="diff-bg-icon">${k}K</div>
                    <div class="diff-num">${k}K</div>
                    <div style="font-size:0.9rem; font-weight:900; color:${starCol}; margin-top:5px;">⭐ ${parseFloat(stars).toFixed(1)}</div>
                `;
                
                btn.onclick = () => {
                    window.closeModal('diff');
                    if(song.isOsu) {
                        if(typeof downloadAndPlayOsu === 'function') downloadAndPlayOsu(song.id, song.title, song.imageURL, k);
                    } else {
                        window.curSongData = song.raw;
                        if(typeof window.startGame === 'function') window.startGame(k);
                    }
                };
            } else {
                // Modo bloqueado
                btn.style.borderColor = '#333';
                btn.style.color = '#555';
                btn.style.background = 'rgba(0,0,0,0.6)';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = `<div class="diff-bg-icon" style="opacity:0.1;">${k}K</div><div class="diff-num">🔒 ${k}K</div>`;
            }
            grid.appendChild(btn);
        });
    }

    // 4. BOTÓN DE EDITOR (Solo canciones de la Comunidad)
    if (!song.isOsu) {
        let editBtn = document.createElement('div');
        editBtn.className = 'diff-card'; 
        editBtn.style.gridColumn = "1 / -1"; 
        editBtn.style.borderColor = "#00ffff";
        editBtn.style.color = "#00ffff";
        editBtn.style.marginTop = "15px";
        editBtn.style.minHeight = "70px";
        editBtn.innerHTML = `<div class="diff-bg-icon" style="font-size:4rem; left:10px;">✏️</div><div class="diff-num" style="font-size:1.5rem;">✏️ ABRIR EN EDITOR</div>`;
        
        editBtn.onclick = () => {
            window.closeModal('diff');
            if(typeof openEditor === 'function') openEditor(song.raw.audioURL || song.raw.url, song.raw.notes, 4);
        };
        grid.appendChild(editBtn);
    }

    window.openModal('diff');
};
