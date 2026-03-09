/* === SONGS_BROWSER.JS - REPARACIÓN TOTAL V6 (BLINDADO) === */

window.currentFilters = { type: 'all', key: 'all', stars: 'all' };
window.unifiedSongs = [];
window.lastQuery = "";     

window.setFilter = function(category, val) {
    window.currentFilters[category] = val;
    document.querySelectorAll(`.filter-btn[data-type="${category}"]`).forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-val') === val) btn.classList.add('active');
    });
    window.renderUnifiedGrid();
};

window.fetchUnifiedData = async function(query = "", append = false) {
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if (!append) {
        window.unifiedSongs = []; window.lastQuery = query.trim();
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:100px; color:#00ffff; font-size:1.8rem; font-weight:900;">Buscando Ritmos... ⏳</div>';
    }

    try {
        if (!append && window.db) {
            let snap = await window.db.collection("globalSongs").limit(50).get();
            snap.forEach(doc => {
                let data = doc.data();
                if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                    window.unifiedSongs.push({ id: doc.id, title: data.title, artist: data.uploader || 'Comunidad', imageURL: data.imageURL || 'icon.png', isOsu: false, originalMode: data.originalMode || 'mania', keysAvailable: detectKeys(data), raw: { ...data, id: doc.id } });
                }
            });
        }

        let apiQuery = window.lastQuery || "anime";
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(apiQuery)}&m=3`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            data.forEach(set => {
                let keys = [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
                window.unifiedSongs.push({ id: "osu_" + set.id, title: set.title, artist: set.creator, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: 'mania', keysAvailable: keys, starRating: set.beatmaps[0].difficulty_rating, raw: set });
            });
        }
    } catch(e) { console.warn("Error API:", e); }

    window.renderUnifiedGrid();
};

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid');
    if(!grid) return;
    grid.innerHTML = '';

    let baseList = window.currentFilters.type === 'recent' 
        ? JSON.parse(localStorage.getItem('recentSongs') || '[]') 
        : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        const f = window.currentFilters;

        // 1. Filtro de Teclas
        if (f.key !== 'all') {
            const tk = parseInt(f.key);
            if (!song.keysAvailable || !song.keysAvailable.includes(tk)) return false;
        }

        // 2. Filtro de Estrellas
        if (f.stars !== 'all') {
            const ts = parseInt(f.stars);
            if (song.isOsu && song.raw.beatmaps) {
                const match = song.raw.beatmaps.some(b => {
                    let s = b.difficulty_rating;
                    if (ts === 1) return s < 2;
                    if (ts === 5) return s >= 5;
                    return s >= ts && s < ts + 1;
                });
                if (!match) return false;
            } else {
                let n = countTotalNotes(song.raw || song);
                let s = n === 0 ? 0 : (n / 200) + 1;
                if (ts === 1 && s >= 2) return false;
                if (ts >= 2 && ts <= 4 && (s < ts || s >= ts + 1)) return false;
                if (ts === 5 && s < 5) return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">No se encontraron canciones con estos filtros. 🌸</div>`;
        return;
    }

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`;
        
        // 🚨 FIX VISUAL: Background blindado para evitar cuadros negros
        card.innerHTML = `
            <div class="song-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; background:url('${song.imageURL}'), url('icon.png') center/cover; filter:brightness(0.5); transition:0.3s; z-index:1;"></div>
            <div class="song-info" style="position:relative; z-index:2; padding:15px;">
                <div class="song-title" style="font-weight:900; font-size:1.1rem; text-shadow:0 2px 10px black;">${song.title}</div>
                <div class="song-author" style="opacity:0.7; font-size:0.8rem;">by ${song.artist}</div>
            </div>`;
        
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });
};

function detectKeys(data) {
    let keys = [];
    Object.keys(data).forEach(k => { if (k.startsWith('notes_mania_')) { let n = parseInt(k.split('_')[2]); if (!isNaN(n)) keys.push(n); } });
    if (keys.length === 0 && data.notes && data.notes.length > 0) keys.push(4);
    return keys.sort((a,b)=>a-b);
}

function countTotalNotes(data) {
    let max = 0; if (data.notes) max = data.notes.length;
    Object.keys(data).forEach(k => { if (k.startsWith('notes_') && Array.isArray(data[k])) max = Math.max(max, data[k].length); });
    return max;
}

window.debounceSearch = (val) => { clearTimeout(window.searchTimeout); window.searchTimeout = setTimeout(() => window.fetchUnifiedData(val), 500); };
document.addEventListener('DOMContentLoaded', () => window.fetchUnifiedData());
