/* === SONGS_BROWSER.JS - RESTAURACIÓN VISUAL Y FUNCIONAL TOTAL === */

window.currentFilters = { type: 'all', key: 'all', stars: 'all' };
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
    window.fetchUnifiedData(window.lastQuery, false);
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
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:100px; color:#00ffff; font-size:1.8rem; font-weight:900; text-shadow:0 0 15px #00ffff;">Buscando Ritmos... ⏳</div>';
    } else {
        const btnLoad = document.getElementById('btn-load-more');
        if (btnLoad) btnLoad.innerText = "DESCARGANDO MÁS... 🌐";
    }

    let fbSongs = []; let osuSongs = [];

    // 1. OBTENER CANCIONES DE FIREBASE
    if (!append) {
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let data = doc.data();
                    if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: data.title, artist: `Subido por: ${data.uploader || 'Comunidad'}`, imageURL: data.imageURL || 'icon.png', isOsu: false, originalMode: data.originalMode || 'mania', keysAvailable: detectKeys(data), raw: { ...data, id: doc.id } });
                    }
                });
            }
        } catch(e) { console.warn("Error FB", e); }
    }

    // 2. OBTENER CANCIONES DE OSU! API (CARGA MASIVA)
    try {
        let safeQuery = window.lastQuery.trim() || "anime";
        let modeParam = ""; 
        const fType = window.currentFilters.type;
        
        if (fType.includes('taiko')) modeParam = "&m=1"; 
        else if (fType.includes('catch')) modeParam = "&m=2"; 
        else if (fType.includes('standard')) modeParam = "&m=0"; 
        else if (fType.includes('mania')) modeParam = "&m=3";

        const pageA = window.currentOsuPage; window.currentOsuPage += 2;
        const res1 = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}${modeParam}&p=${pageA}`);
        const d1 = await res1.json();
        
        if (Array.isArray(d1)) {
            d1.forEach(set => {
                if(set.beatmaps && set.beatmaps.length > 0) {
                    let bestMap = set.beatmaps[0];
                    let mNum = bestMap.mode_int !== undefined ? bestMap.mode_int : bestMap.mode;
                    let mName = (mNum === 1) ? 'taiko' : (mNum === 2 ? 'catch' : (mNum === 3 || mNum === 'mania' ? 'mania' : 'standard'));
                    let keys = mName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                    
                    osuSongs.push({ id: "osu_" + set.id, title: set.title, artist: set.creator, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: mName, keysAvailable: keys, starRating: bestMap.difficulty_rating, raw: set });
                }
            });
        }
    } catch(e) { console.warn("Error Osu API"); }

    const existingIds = new Set(window.unifiedSongs.map(s => s.id));
    const uniqueNewSongs = [...fbSongs, ...osuSongs].filter(s => !existingIds.has(s.id));
    window.unifiedSongs = [...window.unifiedSongs, ...uniqueNewSongs];
    window.renderUnifiedGrid();
};

function detectKeys(data) {
    let keys = [];
    Object.keys(data).forEach(k => {
        if (k.startsWith('notes_mania_')) {
            let n = parseInt(k.split('_')[2]);
            if (!isNaN(n)) keys.push(n);
        }
    });
    if (keys.length === 0 && data.notes && data.notes.length > 0) keys.push(4);
    return keys.sort((a,b)=>a-b);
}

function countTotalNotes(data) {
    let max = 0; if (data.notes) max = data.notes.length;
    Object.keys(data).forEach(k => { if (k.startsWith('notes_mania_') && Array.isArray(data[k])) max = Math.max(max, data[k].length); });
    return max;
}

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        const f = window.currentFilters;
        if (f.key !== 'all') {
            const tk = parseInt(f.key);
            if (song.isOsu && song.originalMode !== 'mania') return false;
            if (!song.keysAvailable || !song.keysAvailable.includes(tk)) return false;
        }
        if (f.stars !== 'all') {
            const ts = parseInt(f.stars);
            let sNum = song.isOsu ? parseFloat(song.starRating || 0) : ((countTotalNotes(song.raw) / 200) + 1);
            if (ts === 1 && sNum >= 2.0) return false;
            if (ts >= 2 && ts <= 4 && (sNum < ts || sNum >= ts + 1)) return false;
            if (ts === 5 && sNum < 5.0) return false;
        }
        return true;
    });

    if (filtered.length === 0) { 
        grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">No se encontraron canciones con estos filtros. 🌸</div>`; 
        return; 
    }

    filtered.forEach(song => {
        const card = document.createElement('div'); card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`;
        
        let noteCount = countTotalNotes(song.raw || song);
        let stars = song.isOsu ? parseFloat(song.starRating || 0).toFixed(1) : (noteCount === 0 ? "0.0" : ((noteCount / 200) + 1).toFixed(1));
        let starCol = stars >= 6 ? '#ff0055' : (stars >= 4 ? '#FFD700' : (stars > 0 ? '#00ffcc' : '#555'));
        
        // 🚨 RECUPERACIÓN DE ICONOS Y COLORES DE MODOS
        let mIcon = song.originalMode === 'standard' ? '🎯' : (song.originalMode === 'taiko' ? '🥁' : (song.originalMode === 'catch' ? '🍎' : '🎹'));
        let modeColor = song.isOsu ? (song.originalMode === 'standard' ? '#ff44b9' : (song.originalMode === 'taiko' ? '#f95555' : '#44b9ff')) : 'var(--blue)';
        if(song.isOsu && song.originalMode === 'mania') modeColor = '#ff66aa';

        let modeBadge = `<div class="diff-badge" style="margin-left:auto; border-color: ${modeColor}; color: ${modeColor};">${song.isOsu ? mIcon + ' ' + song.originalMode.toUpperCase() : '☁️ COMMUNITY'}</div>`;
        let maniaKeys = (song.originalMode === 'mania' || !song.isOsu) ? (song.keysAvailable || []).map(k => `<div class="diff-badge" style="border: 1px solid var(--blue); color: var(--blue);">${k}K</div>`).join('') : "";
        let chartedBadge = (!song.isOsu && noteCount > 0) ? `<div class="diff-badge" style="border-color:#12FA05; color:#12FA05; font-weight:900;">📝 CHARTED</div>` : ``;
        let mechBadge = (song.raw && song.raw.mechanics && song.raw.mechanics.length > 0) ? `<div class="diff-badge" style="border-color:#00ffff; color:#00ffff; font-weight:900;">⚙️ FX</div>` : ``;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; filter: brightness(0.6); transition: 0.5s;"></div>
            <div class="song-info" style="position:relative; z-index:2; padding:15px; display:flex; flex-direction:column; justify-content:flex-end; height:100%;">
                <div class="song-title" style="font-weight:900; font-size:1.15rem; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">${song.title}</div>
                <div class="song-author" style="font-size:0.85rem; opacity:0.8;">by ${song.artist.replace('Subido por: ', '')}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:12px;">
                    <div class="diff-badge" style="background: ${starCol}22; border: 1px solid ${starCol}; color: ${starCol};">⭐ ${stars}</div>
                    ${chartedBadge} ${mechBadge} ${maniaKeys} ${modeBadge}
                </div>
            </div>`;
        
        const bg = card.querySelector('.song-bg');
        card.onmouseenter = () => { bg.style.transform = 'scale(1.08)'; bg.style.filter = 'brightness(0.8)'; };
        card.onmouseleave = () => { bg.style.transform = 'scale(1)'; bg.style.filter = 'brightness(0.6)'; };
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });

    // 🚨 BOTÓN DE CARGA MASIVA RESTAURADO
    if (window.currentFilters.type !== 'recent') {
        const loadMoreContainer = document.createElement('div'); loadMoreContainer.style.gridColumn = "1 / -1"; loadMoreContainer.style.padding = "40px"; loadMoreContainer.style.textAlign = "center";
        loadMoreContainer.innerHTML = `<button id="btn-load-more" class="action" style="width: 350px; margin: 0 auto; background: #ff0066; color: white; border-color: #ff0066; font-weight: 900; letter-spacing: 1px; box-shadow: 0 0 20px rgba(255,0,102,0.3);">CARGAR MÁS CONTENIDO</button>`;
        loadMoreContainer.querySelector('button').onclick = () => window.fetchUnifiedData(window.lastQuery, true);
        grid.appendChild(loadMoreContainer);
    }
};

document.addEventListener('DOMContentLoaded', () => window.fetchUnifiedData());
