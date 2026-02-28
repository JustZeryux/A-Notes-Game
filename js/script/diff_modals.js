/* ==========================================================
   DIFF_MODAL.JS - Menú de Dificultades y Botón de Editor
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
    
    const colors = {1: '#ffffff', 2: '#55ff55', 3: '#5555ff', 4: '#00FFFF', 5: '#a200ff', 6: '#12FA05', 7: '#FFD700', 8: '#ff8800', 9: '#F9393F', 10: '#ff0000'};
    const labels = {1: 'RHYTHM', 2: 'BASIC', 3: 'EASY', 4: 'EASY', 5: 'NORMAL', 6: 'NORMAL', 7: 'INSANE', 8: 'EXPERT', 9: 'DEMON', 10: 'IMPOSSIBLE'};
    
    const standardModes = [4, 6, 7, 9];
    let allModes = [...new Set([...standardModes, ...song.keysAvailable])].sort((a,b) => a - b);
    
    allModes.forEach(k => {
        let c = colors[k] || '#ff66aa';
        let l = labels[k] || 'CUSTOM';
        let btn = document.createElement('div');
        btn.className = 'diff-card';
        
        if (song.keysAvailable.includes(k)) {
            btn.style.borderColor = c; 
            btn.style.color = c;
            btn.innerHTML = `<div class="diff-bg-icon">${k}K</div><div class="diff-num" style="font-size:2.2rem; font-weight:900;">${k}K</div><div class="diff-label">${l}</div>`;
            
            btn.onclick = () => {
                window.closeModal('diff');
                window.asegurarModo(k); 
                if(typeof window.saveToRecents === 'function') window.saveToRecents(song); // Guarda en recientes

                if(song.isOsu) {
                    if(typeof downloadAndPlayOsu === 'function') downloadAndPlayOsu(song.id, song.title, song.imageURL, k);
                    else alert("Error: osu.js no conectado");
                } else {
                    window.curSongData = song.raw; 
                    window.startGame(k);
                }
            };
        } else {
            // Tarjeta bloqueada si el mapa no tiene esa dificultad
            btn.style.borderColor = '#333'; 
            btn.style.color = '#555'; 
            btn.style.background = 'rgba(0,0,0,0.6)'; 
            btn.style.cursor = 'not-allowed'; 
            btn.style.boxShadow = 'none';
            btn.innerHTML = `<div class="diff-bg-icon" style="opacity: 0.1;">${k}K</div><div class="diff-num" style="font-size:2rem; font-weight:900;">🔒 ${k}K</div><div class="diff-label">NO DISPONIBLE</div>`;
        }
        grid.appendChild(btn);
    });

    // Botón para ir al Editor (Solo en canciones tuyas, no en Osu)
    if (!song.isOsu) {
        let editBtn = document.createElement('div');
        editBtn.className = 'diff-card'; 
        editBtn.style.gridColumn = "1 / -1"; 
        editBtn.style.borderColor = "#ff66aa"; 
        editBtn.style.color = "#ff66aa"; 
        editBtn.style.marginTop = "10px"; 
        editBtn.style.minHeight = "80px";
        editBtn.innerHTML = `<div class="diff-bg-icon">✏️</div><div class="diff-num" style="font-size:1.5rem; font-weight:900;">✏️ EDITOR STUDIO</div><div class="diff-label">Crea y edita tu propio mapa</div>`;
        
        editBtn.onclick = () => { 
            window.closeModal('diff'); 
            if(typeof openEditor === 'function') openEditor(song.raw, 4); 
        };
        grid.appendChild(editBtn);
    }
    window.openModal('diff');
};
