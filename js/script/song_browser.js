/* === SONGS_BROWSER.JS - Versión Restaurada y Mejorada 💎 === */

window.currentFilters = { type: 'all', key: 'all' };
window.unifiedSongs = [];
window.searchTimeout = null;
window.currentOsuPage = 0; 
window.lastQuery = "";     

window.saveToRecents = function(songObj) {
    let recents = JSON.parse(localStorage.getItem('recentSongs') || '[]');
    recents = recents.filter(s => s.id !== songObj.id);
    recents.unshift(songObj);
    if(recents.length > 30) recents.pop();
    localStorage.setItem('recentSongs', JSON.stringify(recents));
};

window.setFilter = function(category, val) {
    window.currentFilters[category] = val;
    document.querySelectorAll(`.filter-btn[data-type="${category}"]`).forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-val') === val) btn.classList.add('active');
    });
    window.renderUnifiedGrid();
};

window.debounceSearch = function(val) {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => window.fetchUnifiedData(val, false), 500);
};

window.fetchUnifiedData = async function(query = "", append = false) {
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if (!append) {
        window.unifiedSongs = []; window.currentOsuPage = 0; window.lastQuery = query.trim();
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:bold;">Sincronizando Galería... ⏳</div>';
    } else {
        const btnLoad = document.getElementById('btn-load-more');
        if (btnLoad) btnLoad.innerText = "DESCARGANDO MÁS... 🌐";
    }

    let fbSongs = []; let osuSongs = [];

    if (!append) {
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let data = doc.data();
                    if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`, imageURL: data.imageURL || 'icon.png', isOsu: false, keysAvailable: [4, 6, 7, 9], originalMode: 'mania', raw: { ...data, id: doc.id } });
                    }
                });
            }
        } catch(e) { console.warn("Error DB"); }
    }

    try {
        let safeQuery = window.lastQuery || "ranked";
        const pageA = window.currentOsuPage; window.currentOsuPage += 1;
        // Quitamos &m=3 para traer Standard, Taiko y Catch
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageA}`);
        const data = await res.json();
        
        if(Array.isArray(data)) {
            data.forEach(set => {
                if(set.beatmaps && set.beatmaps.length > 0) {
                    let mNum = set.beatmaps[0].mode_int !== undefined ? set.beatmaps[0].mode_int : set.beatmaps[0].mode;
                    let mName = (mNum === 1) ? 'taiko' : (mNum === 2 ? 'catch' : (mNum === 3 || mNum === 'mania' ? 'mania' : 'standard'));
                    let stars = set.beatmaps[0].difficulty_rating || 0;
                    let keys = mName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                    osuSongs.push({ id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: mName, keysAvailable: keys, starRating: stars, raw: set });
                }
            });
        }
    } catch(e) { console.warn("Error Osu API"); }

    window.unifiedSongs = [...fbSongs, ...osuSongs];
    if (!append && query.trim() === "") window.unifiedSongs = window.unifiedSongs.sort(() => 0.5 - Math.random());
    window.renderUnifiedGrid();
};

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        if (window.currentFilters.type === 'recent') return true; 
        // Filtros de Modos Osu!
        if (window.currentFilters.type === 'osu_mania' && (!song.isOsu || song.originalMode !== 'mania')) return false;
        if (window.currentFilters.type === 'osu_standard' && (!song.isOsu || song.originalMode !== 'standard')) return false;
        if (window.currentFilters.type === 'osu_taiko' && (!song.isOsu || song.originalMode !== 'taiko')) return false;
        if (window.currentFilters.type === 'osu_catch' && (!song.isOsu || song.originalMode !== 'catch')) return false;
        if (window.currentFilters.type === 'com' && song.isOsu) return false;

        if (window.currentFilters.key !== 'all' && (song.originalMode === 'mania' || !song.isOsu)) { 
            if (!song.keysAvailable.includes(parseInt(window.currentFilters.key))) return false; 
        }
        return true;
    });

    filtered.forEach(song => {
        const card = document.createElement('div'); 
        card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`; // Tu clase original
        card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s, box-shadow 0.2s; background: #111;';
        if(song.isOsu) { card.style.borderColor = '#ff66aa'; card.style.boxShadow = '0 0 15px rgba(255, 102, 170, 0.2)'; }
        
        // Estrellas ⭐
        let stars = song.starRating || 0;
        if(!song.isOsu) {
            let noteCount = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
            stars = (noteCount / 200) + 1.2; 
        }
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');
        let diffBadge = `<div class="diff-badge" style="border:1px solid ${starCol}; color:${starCol}; box-shadow:0 0 8px ${starCol}44;">⭐ ${parseFloat(stars).toFixed(1)}</div>`;

        // Modos y Teclas
        let mIcon = song.originalMode === 'standard' ? '🎯' : (song.originalMode === 'taiko' ? '🥁' : (song.originalMode === 'catch' ? '🍎' : '🌸'));
        let keysHTML = (song.originalMode === 'mania' || !song.isOsu) ? song.keysAvailable.map(k => `<div class="diff-badge" style="border-color:#00ffff; color:#00ffff;">${k}K</div>`).join('') : "";
        let osuBadge = song.isOsu ? `<div class="diff-badge osu-badge" style="margin-left:auto;">${mIcon} ${song.originalMode.toUpperCase()}</div>` : `<div class="diff-badge" style="margin-left:auto; border-color:#00ffff; color:#00ffff;">☁️ COMUNIDAD</div>`;

        card.innerHTML = `<div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div><div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent);"><div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div><div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">${song.artist}</div><div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">${diffBadge}${keysHTML}${osuBadge}</div></div>`;
        card.onmouseenter = () => { card.style.transform = 'translateY(-5px) scale(1.03)'; card.style.boxShadow = song.isOsu ? '0 0 25px rgba(255, 102, 170, 0.5)' : '0 0 20px rgba(0, 255, 255, 0.3)'; };
        card.onmouseleave = () => { card.style.transform = 'scale(1)'; card.style.boxShadow = song.isOsu ? '0 0 15px rgba(255, 102, 170, 0.2)' : 'none'; };
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });

    if (window.currentFilters.type !== 'recent') {
        const loadMoreContainer = document.createElement('div'); loadMoreContainer.style.gridColumn = "1 / -1"; loadMoreContainer.style.textAlign = "center"; loadMoreContainer.style.padding = "30px";
        loadMoreContainer.innerHTML = `<button id="btn-load-more" class="action btn-acc" style="width: 400px; padding: 15px; font-size: 1.2rem; box-shadow: 0 0 25px rgba(0,255,255,0.4); border-radius: 12px;">⬇️ CARGAR MÁS CANCIONES ⬇️</button>`;
        loadMoreContainer.querySelector('button').onclick = () => window.fetchUnifiedData(window.lastQuery, true);
        grid.appendChild(loadMoreContainer);
    }
};

window.renderMenu = function(filter="") {
    if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter);
};
