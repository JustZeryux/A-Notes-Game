/* === SONGS_BROWSER.JS - Motor Maestro (Versión Completa Restaurada) 💎 === */

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
        window.unifiedSongs = []; 
        window.currentOsuPage = 0; 
        window.lastQuery = query.trim();
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:100px; color:#00ffff; font-size:1.8rem; font-weight:900; text-shadow:0 0 15px #00ffff;">Estableciendo Conexión Global... ⏳</div>';
    } else {
        const btnLoad = document.getElementById('btn-load-more');
        if (btnLoad) btnLoad.innerText = "DESCARGANDO 100 MÁS... 🌐";
    }

    let fbSongs = []; 
    let osuSongs = [];

    // Lógica de Firebase (Carga Inicial)
    if (!append) {
        let retries = 0; 
        while(!window.db && retries < 15) { await new Promise(r => setTimeout(r, 100)); retries++; }
        try {
            if(window.db) {
                let snapshot = await window.db.collection("globalSongs").limit(100).get();
                snapshot.forEach(doc => {
                    let data = doc.data();
                    if (!query || data.title.toLowerCase().includes(query.toLowerCase())) {
                        fbSongs.push({ 
                            id: doc.id, title: data.title, artist: `Subido por: ${data.uploader}`, 
                            imageURL: data.imageURL || 'icon.png', isOsu: false, originalMode: 'mania',
                            keysAvailable: [4, 6, 7, 9], raw: { ...data, id: doc.id } 
                        });
                    }
                });
            }
        } catch(e) { console.warn("Error en la Base de Datos"); }
    }

    // Lógica de Búsqueda en Osu! (Standard, Taiko, Catch y Mania)
    try {
        let safeQuery = window.lastQuery;
        if (safeQuery === "") {
            if (!append) { 
                const terms = ["anime", "fnf", "vocaloid", "camellia", "remix", "nightcore", "osu", "kpop", "rock", "pop"]; 
                window.lastQuery = terms[Math.floor(Math.random() * terms.length)]; 
            }
            safeQuery = window.lastQuery;
        }

        const pageA = window.currentOsuPage; 
        const pageB = window.currentOsuPage + 1; 
        window.currentOsuPage += 2;
        
        // Sin el filtro &m=3 para traer todos los modos
        const [res1, res2] = await Promise.all([
            fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageA}`),
            fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&p=${pageB}`)
        ]);
        
        const d1 = await res1.json(); const d2 = await res2.json();
        let rawOsuData = []; 
        if(Array.isArray(d1)) rawOsuData = rawOsuData.concat(d1); 
        if(Array.isArray(d2)) rawOsuData = rawOsuData.concat(d2);
        
        const uniqueOsuData = Array.from(new Map(rawOsuData.map(item => [item.id, item])).values());
        
        uniqueOsuData.forEach(set => {
            if(set.beatmaps && set.beatmaps.length > 0) {
                let mNum = set.beatmaps[0].mode_int !== undefined ? set.beatmaps[0].mode_int : set.beatmaps[0].mode;
                let mName = (mNum === 1) ? 'taiko' : (mNum === 2 ? 'catch' : (mNum === 3 || mNum === 'mania' ? 'mania' : 'standard'));
                let stars = set.beatmaps[0].difficulty_rating || 0;
                let keys = mName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                
                osuSongs.push({ 
                    id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, 
                    imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, 
                    isOsu: true, originalMode: mName, keysAvailable: keys, starRating: stars, raw: set 
                });
            }
        });
    } catch(e) { console.warn("Error de Conexión con Osu!"); }

    window.unifiedSongs = [...window.unifiedSongs, ...fbSongs, ...osuSongs];
    if (!append && query.trim() === "") window.unifiedSongs = window.unifiedSongs.sort(() => 0.5 - Math.random());
    window.renderUnifiedGrid();
};

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); 
    if(!grid) return; 
    grid.innerHTML = '';
    
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        if (window.currentFilters.type === 'recent') return true; 
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

    if (filtered.length === 0) { 
        grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">No se encontraron canciones. 🌸</div>`; 
        return; 
    }

    filtered.forEach(song => {
        const card = document.createElement('div'); 
        card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`;
        
        // --- LÓGICA DE ESTRELLAS ⭐ ---
        let stars = parseFloat(song.starRating || 0).toFixed(1);
        if(!song.isOsu) stars = ((song.raw?.notes?.length || 0) / 250 + 1.2).toFixed(1);
        
        let starCol = stars >= 6 ? '#ff0055' : (stars >= 4 ? '#FFD700' : '#00ffcc');
        
        // --- LÓGICA DE BADGES ---
        let mIcon = song.originalMode === 'standard' ? '🎯' : (song.originalMode === 'taiko' ? '🥁' : (song.originalMode === 'catch' ? '🍎' : '🎹'));
        let maniaKeys = (song.originalMode === 'mania' || !song.isOsu) 
            ? song.keysAvailable.map(k => `<div class="diff-badge" style="border: 1px solid var(--blue); color: var(--blue);">${k}K</div>`).join('') 
            : "";
        
        let sourceBadge = song.isOsu 
            ? `<div class="diff-badge" style="margin-left:auto; border-color: #ff66aa; color: #ff66aa;">${mIcon} ${song.originalMode.toUpperCase()}</div>` 
            : `<div class="diff-badge" style="margin-left:auto; border-color: var(--blue); color: var(--blue);">☁️ COMMUNITY</div>`;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; transition: 0.5s; filter: brightness(0.6);"></div>
            
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-author">by ${song.artist.replace('Subido por: ', '')}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:10px;">
                    <div class="diff-badge" style="background: ${starCol}22; border: 1px solid ${starCol}; color: ${starCol};">⭐ ${stars}</div>
                    ${maniaKeys}
                    ${sourceBadge}
                </div>
            </div>`;
        
        // Hover effects manejados por CSS, pero añadimos el zoom de fondo por JS
        const bg = card.querySelector('.song-bg');
        card.onmouseenter = () => { bg.style.transform = 'scale(1.1)'; bg.style.filter = 'brightness(0.9)'; };
        card.onmouseleave = () => { bg.style.transform = 'scale(1)'; bg.style.filter = 'brightness(0.6)'; };
        
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });

    // Botón Cargar Más (Estilizado)
    if (window.currentFilters.type !== 'recent') {
        const loadMoreContainer = document.createElement('div'); 
        loadMoreContainer.style.gridColumn = "1 / -1"; 
        loadMoreContainer.style.padding = "40px";
        loadMoreContainer.innerHTML = `<button id="btn-load-more" class="import-btn" style="width: 320px; margin: 0 auto;">Cargar más contenido</button>`;
        loadMoreContainer.querySelector('button').onclick = () => window.fetchUnifiedData(window.lastQuery, true);
        grid.appendChild(loadMoreContainer);
    }
};

window.renderMenu = function(filter="") { if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter); };
