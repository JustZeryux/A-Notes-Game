window.openUnifiedDiffModal = function(song) {
    const titleEl = document.getElementById('diff-song-title');
    const coverEl = document.getElementById('diff-song-cover');
    titleEl.innerText = song.title;
    coverEl.style.backgroundImage = `url('${song.imageURL}')`;
    
    const grid = document.querySelector('.diff-grid');
    grid.innerHTML = ''; 
    let safeMode = song.originalMode || 'mania';

    if (song.isOsu && safeMode !== 'mania') {
        let btn = document.createElement('div');
        btn.className = 'diff-card'; btn.style.gridColumn = "1 / -1";
        let icon = safeMode === 'standard' ? "🎯" : "🥁";
        let color = safeMode === 'standard' ? "#ff44b9" : "#f95555";

        btn.style.borderColor = color; btn.style.color = color;
        btn.innerHTML = `<div class="diff-bg-icon">${icon}</div><div class="diff-num" style="font-size:2.2rem;">${icon} ${safeMode.toUpperCase()}</div><div class="diff-label">Dificultad: ⭐ ${song.starRating || '?' }</div>`;

        btn.onclick = () => {
            window.closeModal('diff');
            if(safeMode === 'standard') startNewEngine(song);
            else if(safeMode === 'taiko') startTaikoEngine(song);
        };
        grid.appendChild(btn);
    } else {
        [4, 6, 7, 9].forEach(k => {
            let btn = document.createElement('div'); btn.className = 'diff-card';
            let isAvail = song.keysAvailable.includes(k) || !song.isOsu;
            btn.style.borderColor = isAvail ? '#00FFFF' : '#333';
            btn.style.color = isAvail ? '#00FFFF' : '#555';
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
