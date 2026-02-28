/* === SONGS_BROWSER.JS - Motor de Búsqueda y Paginación de Mapas === */

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
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:bold;">Descargando Galería Masiva... ⏳</div>';
    } else {
        const btnLoad = document.getElementById('btn-load-more');
        if (btnLoad) btnLoad.innerText = "DESCARGANDO 100 MÁS... 🌐";
    }

    let fbSongs = []; let osuSongs = [];

    if (!append) {
        let retries = 0; while(!window.db && retries < 15) { await new Promise(r => setTimeout(r, 100)); retries++; }
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let data = doc.data();
                    if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`, imageURL: data.imageURL || 'icon.png', isOsu: false, keysAvailable: [4, 6, 7, 9], raw: { ...data, id: doc.id } });
                    }
                });
            }
        } catch(e) { console.warn("Error DB Local"); }
    }

    try {
        let safeQuery = window.lastQuery;
        if (safeQuery === "") {
            if (!append) { const terms = ["anime", "fnf", "vocaloid", "camellia", "remix", "nightcore", "osu", "kpop", "rock", "pop"]; window.lastQuery = terms[Math.floor(Math.random() * terms.length)]; }
            safeQuery = window.lastQuery;
        }

        const pageA = window.currentOsuPage; const pageB = window.currentOsuPage + 1; window.currentOsuPage += 2;
        const [res1, res2] = await Promise.all([
            fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&m=3&p=${pageA}`),
            fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&m=3&p=${pageB}`)
        ]);
        
        const d1 = await res1.json(); const d2 = await res2.json();
        let rawOsuData = []; if(Array.isArray(d1)) rawOsuData = rawOsuData.concat(d1); if(Array.isArray(d2)) rawOsuData = rawOsuData.concat(d2);
        const uniqueOsuData = Array.from(new Map(rawOsuData.map(item => [item.id, item])).values());
        
        uniqueOsuData.forEach(set => {
            const maniaBeatmaps = set.beatmaps.filter(b => b.mode_int === 3 || b.mode === 3 || b.mode === 'mania');
            if(maniaBeatmaps.length > 0) {
                let keys = [...new Set(maniaBeatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
                osuSongs.push({ id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, keysAvailable: keys, raw: set });
            }
        });
    } catch(e) { console.warn("Error Osu API"); }

    window.unifiedSongs = [...window.unifiedSongs, ...fbSongs, ...osuSongs];
    if (!append && query.trim() === "") window.unifiedSongs = window.unifiedSongs.sort(() => 0.5 - Math.random());
    window.renderUnifiedGrid();
};

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        if (window.currentFilters.type === 'recent') return true; 
        if (window.currentFilters.type === 'osu' && !song.isOsu) return false;
        if (window.currentFilters.type === 'com' && song.isOsu) return false;
        if (window.currentFilters.key !== 'all') { if (!song.keysAvailable.includes(parseInt(window.currentFilters.key))) return false; }
        return true;
    });

    if (filtered.length === 0) { grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">${window.currentFilters.type === 'recent' ? 'Aún no has jugado ninguna canción. 🕒' : 'No se encontraron mapas con estos filtros. 🌸'}</div>`; return; }

    filtered.forEach(song => {
        const card = document.createElement('div'); card.className = 'song-card'; 
        card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: transform 0.2s, box-shadow 0.2s; background: #111;';
        if(song.isOsu) { card.style.borderColor = '#ff66aa'; card.style.boxShadow = '0 0 15px rgba(255, 102, 170, 0.2)'; }
        
        let badgesHTML = song.keysAvailable.map(k => `<div class="diff-badge" style="padding: 2px 8px; border: 1px solid #00ffff; color: #00ffff; border-radius: 5px; font-size: 0.8rem; font-weight: bold;">${k}K</div>`).join('');
        if(song.isOsu) badgesHTML += `<div class="diff-badge" style="margin-left:auto; border: 1px solid #ff66aa; color: #ff66aa; padding: 2px 8px; border-radius: 5px; font-size: 0.8rem; font-weight: bold; background: rgba(255,102,170,0.1); box-shadow:0 0 8px rgba(255,102,170,0.4);">🌸 OSU!</div>`;

        card.innerHTML = `<div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div><div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent);"><div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div><div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">${song.artist}</div><div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">${badgesHTML}</div></div>`;
        card.onmouseenter = () => { card.style.transform = 'scale(1.03)'; card.style.boxShadow = song.isOsu ? '0 0 25px rgba(255, 102, 170, 0.5)' : '0 0 20px rgba(0, 255, 255, 0.3)'; };
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

// Mantenemos la función legacy "renderMenu" por si tienes partes del HTML que aún la llaman
window.renderMenu = function(filter="") {
    if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter);
};
