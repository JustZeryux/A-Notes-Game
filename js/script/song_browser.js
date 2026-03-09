/* === SONGS_BROWSER.JS - RESTAURACIÓN TOTAL (VISUAL BADGES + FILTROS) === */

window.currentFilters = { type: 'all', key: 'all', stars: 'all' };
window.unifiedSongs = [];
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
        window.unifiedSongs = []; window.lastQuery = query.trim();
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:100px; color:#00ffff; font-size:1.8rem; font-weight:900; text-shadow:0 0 15px #00ffff;">Buscando Ritmos... ⏳</div>';
    }

    let fbSongs = []; let osuSongs = [];

    // OBTENER DE FIREBASE
    if (!append) {
        let retries = 0; while(!window.db && retries < 15) { await new Promise(r => setTimeout(r, 100)); retries++; }
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
        } catch(e) { console.warn("Error DB", e); }
    }

    // OBTENER DE OSU! API
    try {
        let q = window.lastQuery || "anime";
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(q)}&m=3`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            data.forEach(set => {
                if(set.beatmaps && set.beatmaps.length > 0) {
                    let keys = [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
                    osuSongs.push({ id: "osu_" + set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: 'mania', keysAvailable: keys, starRating: set.beatmaps[0].difficulty_rating, raw: set });
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
        let stars = song.isOsu ? parseFloat(song.starRating || 0).toFixed(1) : ((noteCount / 200) + 1).toFixed(1);
        let starCol = stars >= 6 ? '#ff0055' : (stars >= 4 ? '#FFD700' : (stars > 0 ? '#00ffcc' : '#555'));
        
        let maniaKeys = (song.keysAvailable || []).map(k => `<div class="diff-badge" style="border: 1px solid var(--blue); color: var(--blue);">${k}K</div>`).join('');
        let chartedBadge = (!song.isOsu && noteCount > 0) ? `<div class="diff-badge" style="border-color:#12FA05; color:#12FA05; font-weight:900;">📝 CHARTED</div>` : ``;
        let sourceBadge = song.isOsu ? `<div class="diff-badge" style="margin-left:auto; border-color: #ff66aa; color: #ff66aa;">🌸 OSU!</div>` : `<div class="diff-badge" style="margin-left:auto; border-color: var(--blue); color: var(--blue);">☁️ COMUNIDAD</div>`;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; filter: brightness(0.6); transition: 0.5s;"></div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-author">by ${song.artist.replace('Subido por: ', '')}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:10px;">
                    <div class="diff-badge" style="background: ${starCol}22; border: 1px solid ${starCol}; color: ${starCol};">⭐ ${stars}</div>
                    ${chartedBadge} ${maniaKeys} ${sourceBadge}
                </div>
            </div>`;
        
        const bg = card.querySelector('.song-bg');
        card.onmouseenter = () => { bg.style.transform = 'scale(1.1)'; bg.style.filter = 'brightness(0.9)'; };
        card.onmouseleave = () => { bg.style.transform = 'scale(1)'; bg.style.filter = 'brightness(0.6)'; };
        card.onclick = () => window.openUnifiedDiffModal(song);
        grid.appendChild(card);
    });
};
