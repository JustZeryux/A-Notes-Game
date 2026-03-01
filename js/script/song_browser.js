/* === SONGS_BROWSER.JS - Versión Premium Restaurada 💎 === */

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
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:900; text-shadow:0 0 15px #00ffff;">Sincronizando Galería... ⏳</div>';
    } else {
        const btnLoad = document.getElementById('btn-load-more');
        if (btnLoad) btnLoad.innerText = "CARGANDO MÁS MAPAS... 🌐";
    }

    let fbSongs = []; 
    if (!append) {
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let d = doc.data();
                    if (!query || d.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: d.title, artist: `Subido por: ${d.uploader}`, imageURL: d.imageURL || 'icon.png', isOsu: false, originalMode: 'mania', keysAvailable: [4, 6, 7, 9], raw: { ...d, id: doc.id } });
                    }
                });
            }
        } catch(e) { console.warn("Error DB"); }
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
    } catch(e) { console.warn("Error API"); }

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
        // --- MOTOR DE COLORES DE MODO (NEÓN) ---
        let modeColor = '#00ffff'; let modeIcon = '☁️'; let modeLabel = 'COMUNIDAD';
        if (song.isOsu) {
            if (song.originalMode === 'standard') { modeColor = '#ff44b9'; modeIcon = '🎯'; modeLabel = 'STANDARD'; }
            else if (song.originalMode === 'taiko') { modeColor = '#f95555'; modeIcon = '🥁'; modeLabel = 'TAIKO'; }
            else if (song.originalMode === 'catch') { modeColor = '#44b9ff'; modeIcon = '🍎'; modeLabel = 'CATCH'; }
            else { modeColor = '#ff66aa'; modeIcon = '🌸'; modeLabel = 'MANIA'; }
        }

        // --- CÁLCULO DE ESTRELLAS ⭐ ---
        let stars = song.starRating || 0;
        if(!song.isOsu) {
            let noteCount = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
            stars = Math.min(10, (noteCount / 200) + 1.2); 
        }
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        // --- CONSTRUCCIÓN DE LA TARJETA ---
        const card = document.createElement('div');
        card.className = 'song-card'; 
        card.style.cssText = `position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid ${modeColor}44; background: #111; transition: all 0.3s cubic-bezier(0.17, 0.89, 0.32, 1.28); opacity: 1; animation-delay: ${index * 0.02}s;`;
        
        let badgesHTML = `<div class="diff-badge" style="border: 1px solid ${starCol}; color: ${starCol}; background: rgba(0,0,0,0.8); box-shadow: 0 0 10px ${starCol}66;"><span class="star-glow">⭐</span> ${parseFloat(stars).toFixed(1)}</div>`;
        if (song.originalMode === 'mania' || !song.isOsu) {
            badgesHTML += song.keysAvailable.map(k => `<div class="diff-badge" style="border: 1px solid #00ffff; color: #00ffff; background: rgba(0,255,255,0.1);">${k}K</div>`).join('');
        }
        badgesHTML += `<div class="diff-badge" style="margin-left:auto; border: 1px solid ${modeColor}; color: ${modeColor}; background: rgba(0,0,0,0.85); box-shadow: 0 0 10px ${modeColor}88;">${modeIcon} ${modeLabel}</div>`;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.6; transition: 0.5s;"></div>
            <div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.7), transparent); z-index: 2;">
                <div class="song-title" style="font-size: 1.3rem; font-weight: 900; color: white; text-shadow: 0 2px 10px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                <div class="song-author" style="font-size: 0.9rem; color: #bbb; font-weight: bold; margin-bottom: 12px; opacity: 0.9;">${song.artist}</div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    ${badgesHTML}
                </div>
            </div>
            <div class="card-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(45deg, ${modeColor}33, transparent); opacity: 0; transition: 0.3s; z-index: 1;"></div>
        `;
        
        card.onmouseenter = () => {
            card.style.transform = 'translateY(-5px) scale(1.03)';
            card.style.borderColor = modeColor;
            card.style.boxShadow = `0 10px 30px rgba(0,0,0,0.7), 0 0 25px ${modeColor}88`;
            card.querySelector('.song-bg').style.opacity = '0.85';
            card.querySelector('.song-bg').style.transform = 'scale(1.1)';
            card.querySelector('.card-overlay').style.opacity = '1';
        };
        card.onmouseleave = () => {
            card.style.transform = 'scale(1)';
            card.style.borderColor = `${modeColor}44`;
            card.style.boxShadow = 'none';
            card.querySelector('.song-bg').style.opacity = '0.6';
            card.querySelector('.song-bg').style.transform = 'scale(1)';
            card.querySelector('.card-overlay').style.opacity = '0';
        };

        card.onclick = () => {
            if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
            if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song);
        };
        
        grid.appendChild(card);
    });
};

window.renderMenu = function(filter="") {
    if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter);
};
