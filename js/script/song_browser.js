/* === SONGS_BROWSER.JS - Versión Premium Restaurada 💎 === */

window.currentFilters = { type: 'all', key: 'all' };
window.unifiedSongs = [];
window.searchTimeout = null;
window.currentOsuPage = 0; 
window.lastQuery = "";     

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
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:80px; color:#00ffff; font-size:2rem; font-weight:900; text-shadow:0 0 20px #00ffff; animation: pulse 1.5s infinite;">ESTABLECIENDO CONEXIÓN GLOBAL... ⚡</div>';
    } 

    let fbSongs = []; 
    if (!append) {
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let d = doc.data();
                    if (!query || d.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: d.title, artist: `By: ${d.uploader}`, imageURL: d.imageURL || 'icon.png', isOsu: false, originalMode: 'mania', keysAvailable: [4, 6, 7, 9], raw: { ...d, id: doc.id } });
                    }
                });
            }
        } catch(e) {}
    }

    try {
        let safeQuery = window.lastQuery || "ranked";
        const pageA = window.currentOsuPage; window.currentOsuPage += 1;
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageA}`);
        const data = await res.json();
        
        if(Array.isArray(data)) {
            data.forEach(set => {
                if(set.beatmaps && set.beatmaps.length > 0) {
                    let mNum = set.beatmaps[0].mode_int !== undefined ? set.beatmaps[0].mode_int : set.beatmaps[0].mode;
                    let mName = (mNum === 1) ? 'taiko' : (mNum === 2 ? 'catch' : (mNum === 3 ? 'mania' : 'standard'));
                    let stars = set.beatmaps[0].difficulty_rating || 0;
                    let keys = mName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                    window.unifiedSongs.push({ id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: mName, keysAvailable: keys, starRating: stars, raw: set });
                }
            });
        }
    } catch(e) {}

    window.unifiedSongs = [...fbSongs, ...window.unifiedSongs];
    window.renderUnifiedGrid();
};
window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); 
    if(!grid) return; 
    grid.innerHTML = '';
    
    let filtered = window.unifiedSongs.filter(song => {
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

    filtered.forEach((song) => {
        // --- DETECTAR MODO Y COLOR ---
        let isOsu = song.isOsu;
        let modeClass = isOsu ? "osu-card-style" : "community-card-style";
        let modeIcon = isOsu ? (song.originalMode === 'standard' ? '🎯' : (song.originalMode === 'taiko' ? '🥁' : '🌸')) : '☁️';
        
        // --- CÁLCULO DE ESTRELLAS ⭐ ---
        let stars = song.starRating || 0;
        if(!isOsu) {
            let noteCount = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
            stars = Math.min(10, (noteCount / 200) + 1.2); 
        }
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        const card = document.createElement('div');
        // USAMOS TUS CLASES CSS REALES
        card.className = `song-card ${modeClass}`; 
        
        // Badges usando tu clase .osu-badge si es de Osu
        let badgesHTML = `<div class="diff-badge" style="border-color:${starCol}; color:${starCol};">⭐ ${parseFloat(stars).toFixed(1)}</div>`;
        
        if (song.originalMode === 'mania' || !isOsu) {
            badgesHTML += song.keysAvailable.map(k => `<div class="diff-badge">${k}K</div>`).join('');
        }
        
        let tagClass = isOsu ? "diff-badge osu-badge" : "diff-badge";
        badgesHTML += `<div class="${tagClass}" style="margin-left:auto;">${modeIcon} ${song.originalMode?.toUpperCase() || 'MANIA'}</div>`;

        card.innerHTML = `
            <div class="song-bg" style="background-image: url('${song.imageURL}'), url('icon.png');"></div>
            <div class="song-info" style="background: linear-gradient(to top, rgba(0,0,0,0.95), transparent);">
                <div class="song-title">${song.title}</div>
                <div class="song-author">${song.artist}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${badgesHTML}
                </div>
            </div>
        `;

        card.onclick = () => {
            if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
            if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song);
        };
        
        grid.appendChild(card);
    });
};
