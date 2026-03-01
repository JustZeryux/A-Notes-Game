/* === SONGS_BROWSER.JS - Buscador con Dificultad Dinámica === */
window.currentFilters = { type: 'all', key: 'all' };
window.unifiedSongs = []; window.searchTimeout = null; window.currentOsuPage = 0; window.lastQuery = "";     

window.saveToRecents = function(songObj) {
    let recents = JSON.parse(localStorage.getItem('recentSongs') || '[]');
    recents = recents.filter(s => s.id !== songObj.id); recents.unshift(songObj);
    if(recents.length > 30) recents.pop(); localStorage.setItem('recentSongs', JSON.stringify(recents));
};

window.setFilter = function(category, val) {
    window.currentFilters[category] = val;
    document.querySelectorAll(`.filter-btn[data-type="${category}"]`).forEach(btn => {
        btn.classList.remove('active'); if(btn.getAttribute('data-val') === val) btn.classList.add('active');
    });
    window.renderUnifiedGrid();
};

window.debounceSearch = function(val) {
    clearTimeout(window.searchTimeout); window.searchTimeout = setTimeout(() => window.fetchUnifiedData(val, false), 500);
};

window.fetchUnifiedData = async function(query = "", append = false) {
    const grid = document.getElementById('song-grid'); if(!grid) return;
    if (!append) { window.unifiedSongs = []; window.currentOsuPage = 0; window.lastQuery = query.trim(); grid.innerHTML = '<div style="text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:bold;">Cargando Galería... ⏳</div>'; } 
    else { const btnLoad = document.getElementById('btn-load-more'); if (btnLoad) btnLoad.innerText = "DESCARGANDO... 🌐"; }

    let fbSongs = []; let osuSongs = [];

    if (!append) {
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let data = doc.data();
                    if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`, imageURL: data.imageURL || 'icon.png', isOsu: false, originalMode: 'mania', keysAvailable: [4, 6, 7, 9], starRating: 0, raw: { ...data, id: doc.id } });
                    }
                });
            }
        } catch(e) {}
    }

    try {
        let safeQuery = window.lastQuery || "ranked";
        const pageA = window.currentOsuPage; const pageB = window.currentOsuPage + 1; window.currentOsuPage += 2;
        const [res1, res2] = await Promise.all([ fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageA}`), fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageB}`) ]);
        const d1 = await res1.json(); const d2 = await res2.json();
        let rawOsuData = []; if(Array.isArray(d1)) rawOsuData = rawOsuData.concat(d1); if(Array.isArray(d2)) rawOsuData = rawOsuData.concat(d2);
        const uniqueOsuData = Array.from(new Map(rawOsuData.map(item => [item.id, item])).values());
        
        uniqueOsuData.forEach(set => {
            if(set.beatmaps && set.beatmaps.length > 0) {
                let modeNum = set.beatmaps[0].mode_int !== undefined ? set.beatmaps[0].mode_int : set.beatmaps[0].mode;
                let modeName = 'standard';
                if (modeNum === 1) modeName = 'taiko'; else if (modeNum === 2) modeName = 'catch'; else if (modeNum === 3 || modeNum === 'mania') modeName = 'mania';

                // 🚨 EXTRAEMOS LA DIFICULTAD (ESTRELLAS)
                let stars = set.beatmaps[0].difficulty_rating || 0;
                let keys = modeName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                
                osuSongs.push({ id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: modeName, keysAvailable: keys, starRating: stars.toFixed(1), raw: set });
            }
        });
    } catch(e) {}

    window.unifiedSongs = [...window.unifiedSongs, ...fbSongs, ...osuSongs];
    if (!append && query.trim() === "") window.unifiedSongs = window.unifiedSongs.sort(() => 0.5 - Math.random());
    window.renderUnifiedGrid();
};

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        if (window.currentFilters.type === 'recent') return true; 
        if (window.currentFilters.type === 'com' && song.isOsu) return false;
        if (window.currentFilters.type === 'osu_mania' && (!song.isOsu || song.originalMode !== 'mania')) return false;
        if (window.currentFilters.type === 'osu_standard' && (!song.isOsu || song.originalMode !== 'standard')) return false;
        if (window.currentFilters.type === 'osu_taiko' && (!song.isOsu || song.originalMode !== 'taiko')) return false;
        if (window.currentFilters.type === 'osu_catch' && (!song.isOsu || song.originalMode !== 'catch')) return false;
        if (window.currentFilters.key !== 'all' && song.originalMode === 'mania') { if (!song.keysAvailable.includes(parseInt(window.currentFilters.key))) return false; }
        return true;
    });

    if (filtered.length === 0) { grid.innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold); font-size:1.5rem;">No hay mapas aquí.</div>`; return; }

    filtered.forEach(song => {
        let modeColor = '#00ffff'; let modeIcon = '☁️'; let modeText = 'COMUNIDAD';
        if (song.isOsu) {
            if (song.originalMode === 'standard') { modeColor = '#ff44b9'; modeIcon = '🎯'; modeText = 'STANDARD'; }
            else if (song.originalMode === 'taiko') { modeColor = '#f95555'; modeIcon = '🥁'; modeText = 'TAIKO'; }
            else if (song.originalMode === 'catch') { modeColor = '#44b9ff'; modeIcon = '🍎'; modeText = 'CATCH'; }
            else { modeColor = '#ff66aa'; modeIcon = '🌸'; modeText = 'MANIA'; }
        }

        const card = document.createElement('div'); card.className = 'song-card'; 
        card.style.cssText = `position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid ${modeColor}44; background: #111;`;
        
        // 🚨 SI ES MANIA MUESTRA TECLAS, SI ES OTRO MODO MUESTRA ESTRELLAS
        let badgesHTML = "";
        if (song.originalMode === 'mania' || !song.isOsu) {
            badgesHTML = song.keysAvailable.map(k => `<div class="diff-badge" style="padding: 2px 8px; border: 1px solid #00ffff; color: #00ffff; border-radius: 5px; font-size: 0.8rem; font-weight: bold;">${k}K</div>`).join('');
        } else {
            let starCol = song.starRating >= 6 ? '#F9393F' : (song.starRating >= 4 ? '#FFD700' : '#12FA05');
            badgesHTML = `<div class="diff-badge" style="padding: 2px 8px; border: 1px solid ${starCol}; color: ${starCol}; border-radius: 5px; font-size: 0.8rem; font-weight: bold; background:rgba(0,0,0,0.8);">⭐ ${song.starRating}</div>`;
        }

        badgesHTML += `<div class="diff-badge" style="margin-left:auto; border: 1px solid ${modeColor}; color: ${modeColor}; padding: 2px 8px; border-radius: 5px; font-size: 0.8rem; font-weight: bold; background: rgba(0,0,0,0.8);">${modeIcon} ${modeText}</div>`;

        card.innerHTML = `<div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div><div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent);"><div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div><div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">${song.artist}</div><div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">${badgesHTML}</div></div>`;
        card.onmouseenter = () => { card.style.transform = 'scale(1.03)'; card.style.boxShadow = `0 0 20px ${modeColor}88`; };
        card.onmouseleave = () => { card.style.transform = 'scale(1)'; card.style.boxShadow = 'none'; };
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });

    if (window.currentFilters.type !== 'recent') {
        const loadMoreContainer = document.createElement('div'); loadMoreContainer.style.gridColumn = "1 / -1"; loadMoreContainer.style.textAlign = "center"; loadMoreContainer.style.padding = "30px";
        loadMoreContainer.innerHTML = `<button id="btn-load-more" class="action btn-acc" style="width: 400px; padding: 15px; font-size: 1.2rem; border-radius: 12px;">⬇️ CARGAR MÁS ⬇️</button>`;
        loadMoreContainer.querySelector('button').onclick = () => window.fetchUnifiedData(window.lastQuery, true);
        grid.appendChild(loadMoreContainer);
    }
};
window.renderMenu = function(filter="") { if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter); };
