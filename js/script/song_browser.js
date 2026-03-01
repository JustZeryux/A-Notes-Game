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
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    
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

    filtered.forEach((song, index) => {
        // --- COLORES NEÓN DINÁMICOS ---
        let modeColor = '#00ffff'; let modeIcon = '☁️'; let modeLabel = 'COMUNIDAD';
        if (song.isOsu) {
            if (song.originalMode === 'standard') { modeColor = '#ff44b9'; modeIcon = '🎯'; modeLabel = 'STANDARD'; }
            else if (song.originalMode === 'taiko') { modeColor = '#f95555'; modeIcon = '🥁'; modeLabel = 'TAIKO'; }
            else if (song.originalMode === 'catch') { modeColor = '#44b9ff'; modeIcon = '🍎'; modeLabel = 'CATCH'; }
            else { modeColor = '#ff66aa'; modeIcon = '🌸'; modeLabel = 'MANIA'; }
        }

        // --- CÁLCULO DE DIFICULTAD (ESTRELLAS ⭐) ---
        let stars = song.starRating || 0;
        if(!song.isOsu) {
            let noteCount = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
            stars = Math.min(10, (noteCount / 200) + 1.2); 
        }
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        const card = document.createElement('div');
        card.className = 'song-card'; 
        card.style.cssText = `position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid ${modeColor}55; transition: all 0.3s cubic-bezier(0.17, 0.89, 0.32, 1.28); animation-delay: ${index * 0.02}s;`;
        
        let badgesHTML = `<div class="diff-badge" style="border: 1px solid ${starCol}; color: ${starCol}; background: rgba(0,0,0,0.8); box-shadow: 0 0 12px ${starCol}66;"><span class="star-rating-badge">⭐</span> ${parseFloat(stars).toFixed(1)}</div>`;
        if (song.originalMode === 'mania' || !song.isOsu) {
            badgesHTML += song.keysAvailable.map(k => `<div class="diff-badge" style="border: 1px solid #00ffff; color: #00ffff; background: rgba(0,255,255,0.05);">${k}K</div>`).join('');
        }
        badgesHTML += `<div class="diff-badge" style="margin-left:auto; border: 1px solid ${modeColor}; color: ${modeColor}; background: rgba(0,0,0,0.85); box-shadow: 0 0 12px ${modeColor}88;">${modeIcon} ${modeLabel}</div>`;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.6; transition: 0.6s;"></div>
            <div class="song-info song-info-glass" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 18px; z-index: 2;">
                <div class="song-title" style="font-size: 1.4rem; font-weight: 900; color: white; text-shadow: 0 3px 10px black; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                <div class="song-author" style="font-size: 0.9rem; color: #bbb; font-weight: bold; margin-bottom: 12px; opacity: 0.8; letter-spacing: 0.5px;">${song.artist}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    ${badgesHTML}
                </div>
            </div>
            <div class="card-glow-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at center, ${modeColor}22, transparent); opacity: 0; transition: 0.3s; z-index: 1;"></div>
        `;
        
        card.onmouseenter = () => {
            card.style.transform = 'translateY(-8px) scale(1.03)';
            card.style.borderColor = modeColor;
            card.style.boxShadow = `0 15px 40px rgba(0,0,0,0.8), 0 0 25px ${modeColor}99`;
            card.querySelector('.song-bg').style.opacity = '0.9';
            card.querySelector('.song-bg').style.transform = 'scale(1.15)';
            card.querySelector('.card-glow-overlay').style.opacity = '1';
        };
        card.onmouseleave = () => {
            card.style.transform = 'scale(1)';
            card.style.borderColor = `${modeColor}55`;
            card.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
            card.querySelector('.song-bg').style.opacity = '0.6';
            card.querySelector('.song-bg').style.transform = 'scale(1)';
            card.querySelector('.card-glow-overlay').style.opacity = '0';
        };

        card.onclick = () => {
            if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
            if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song);
        };
        
        grid.appendChild(card);
    });
};
