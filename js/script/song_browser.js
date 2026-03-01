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
        
        // Filtros de Osu!
        if (window.currentFilters.type === 'osu_mania' && (!song.isOsu || song.originalMode !== 'mania')) return false;
        if (window.currentFilters.type === 'osu_standard' && (!song.isOsu || song.originalMode !== 'standard')) return false;
        if (window.currentFilters.type === 'osu_taiko' && (!song.isOsu || song.originalMode !== 'taiko')) return false;
        if (window.currentFilters.type === 'osu_catch' && (!song.isOsu || song.originalMode !== 'catch')) return false;

        // Si es Mania, aplicamos filtro de teclas. Si no es Mania, ignoramos el filtro de teclas.
        if (window.currentFilters.key !== 'all' && (song.originalMode === 'mania' || !song.isOsu)) { 
            if (!song.keysAvailable.includes(parseInt(window.currentFilters.key))) return false; 
        }
        return true;
    });

    filtered.forEach(song => {
        let modeColor = '#00ffff'; let modeIcon = '☁️';
        if (song.isOsu) {
            if (song.originalMode === 'standard') { modeColor = '#ff44b9'; modeIcon = '🎯'; }
            else if (song.originalMode === 'taiko') { modeColor = '#f95555'; modeIcon = '🥁'; }
            else if (song.originalMode === 'catch') { modeColor = '#44b9ff'; modeIcon = '🍎'; }
            else { modeColor = '#ff66aa'; modeIcon = '🌸'; }
        }

        // --- CÁLCULO DE DIFICULTAD ---
        let difficultyHTML = "";
        if (song.isOsu) {
            // Usar estrellas reales de Osu!
            let stars = song.starRating || (song.raw?.beatmaps?.[0]?.difficulty_rating) || 0;
            let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');
            difficultyHTML = `<div class="diff-badge" style="border-color:${starCol}; color:${starCol}; background:rgba(0,0,0,0.8);">⭐ ${parseFloat(stars).toFixed(1)}</div>`;
        } else {
            // Calcular dificultad para comunidad: Notas / Duración
            let noteCount = song.raw?.notes?.length || 0;
            let duration = 180; // Default 3 min
            let calcStars = Math.min(10, (noteCount / duration) * 0.5).toFixed(1);
            difficultyHTML = `<div class="diff-badge" style="border-color:var(--gold); color:var(--gold);">⭐ ${calcStars}</div>`;
        }

        const card = document.createElement('div'); card.className = 'song-card'; 
        card.style.cssText = `position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid ${modeColor}33; background: #111; animation: fadeIn 0.5s ease-out;`;
        
        // 🚨 MOSTRAR TECLAS SOLO SI ES MANIA O COMUNIDAD
        let keysHTML = "";
        if (!song.isOsu || song.originalMode === 'mania') {
            keysHTML = song.keysAvailable.map(k => `<div class="diff-badge" style="border-color:#00ffff; color:#00ffff;">${k}K</div>`).join('');
        }

        card.innerHTML = `
            <div class="song-bg" style="background-image: url('${song.imageURL}'), url('icon.png'); opacity: 0.7;"></div>
            <div class="song-info" style="background: linear-gradient(to top, rgba(0,0,0,0.95), transparent);">
                <div class="song-title">${song.title}</div>
                <div class="song-author">${song.artist}</div>
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                    ${difficultyHTML}
                    ${keysHTML}
                    <div class="diff-badge" style="margin-left:auto; border-color:${modeColor}; color:${modeColor}; background:rgba(0,0,0,0.8);">${modeIcon} ${song.originalMode?.toUpperCase() || 'MANIA'}</div>
                </div>
            </div>`;
        
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });
};
window.renderMenu = function(filter="") { if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter); };
