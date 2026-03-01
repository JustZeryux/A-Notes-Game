/* === SONGS_BROWSER.JS - Versión Original Mejorada con Estrellas y Filtros 💎 === */

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

window.fetchUnifiedData = async function(query = "", append = false) {
    const grid = document.getElementById('song-grid');
    if(!grid) return;

    if (!append) {
        window.unifiedSongs = []; window.currentOsuPage = 0; window.lastQuery = query.trim();
        grid.innerHTML = '<div style="width:100%; text-align:center; padding:50px; color:#00ffff; font-size:1.5rem; font-weight:bold;">Sincronizando Galería... ⏳</div>';
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
        // QUITAMOS EL &m=3 PARA TRAER TODOS LOS MODOS
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
        // FILTROS DE MODOS
        if (window.currentFilters.type === 'osu_mania' && (!song.isOsu || song.originalMode !== 'mania')) return false;
        if (window.currentFilters.type === 'osu_standard' && (!song.isOsu || song.originalMode !== 'standard')) return false;
        if (window.currentFilters.type === 'osu_taiko' && (!song.isOsu || song.originalMode !== 'taiko')) return false;
        if (window.currentFilters.type === 'osu_catch' && (!song.isOsu || song.originalMode !== 'catch')) return false;
        if (window.currentFilters.type === 'com' && song.isOsu) return false;
        
        // FILTRO DE TECLAS (Solo aplica a Mania o Comunidad)
        if (window.currentFilters.key !== 'all' && (song.originalMode === 'mania' || !song.isOsu)) { 
            if (!song.keysAvailable.includes(parseInt(window.currentFilters.key))) return false; 
        }
        return true;
    });

    if (filtered.length === 0) { grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">No se encontraron mapas. 🌸</div>`; return; }

    filtered.forEach(song => {
        // USAMOS TUS CLASES CSS: .osu-card-style
        const card = document.createElement('div');
        card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`; 
        
        // COLORES POR MODO
        let mCol = '#00ffff'; let mIcon = '☁️';
        if (song.isOsu) {
            if (song.originalMode === 'standard') { mCol = '#ff44b9'; mIcon = '🎯'; }
            else if (song.originalMode === 'taiko') { mCol = '#f95555'; mIcon = '🥁'; }
            else if (song.originalMode === 'catch') { mCol = '#44b9ff'; mIcon = '🍎'; }
            else { mCol = '#ff66aa'; mIcon = '🌸'; }
        }

        // CÁLCULO DE DIFICULTAD ⭐
        let stars = song.starRating || 0;
        if(!song.isOsu) {
            let n = (song.raw && song.raw.notes) ? song.raw.notes.length : 0;
            stars = Math.min(10, (n / 200) + 1.2); 
        }
        let starCol = stars >= 6 ? '#F9393F' : (stars >= 4 ? '#FFD700' : '#12FA05');

        // BADGES (Usando .osu-badge)
        let badgesHTML = `<div class="diff-badge" style="border-color:${starCol}; color:${starCol};">⭐ ${parseFloat(stars).toFixed(1)}</div>`;
        if (song.originalMode === 'mania' || !song.isOsu) {
            badgesHTML += song.keysAvailable.map(k => `<div class="diff-badge">${k}K</div>`).join('');
        }
        badgesHTML += `<div class="diff-badge ${song.isOsu?'osu-badge':''}" style="margin-left:auto; border-color:${mCol}; color:${mCol};">${mIcon} ${song.originalMode?.toUpperCase() || 'MANIA'}</div>`;

        card.innerHTML = `
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div>
            <div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), transparent); z-index: 2;">
                <div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                <div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">${song.artist}</div>
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">${badgesHTML}</div>
            </div>`;

        card.onclick = () => {
            if(typeof window.saveToRecents === 'function') window.saveToRecents(song);
            window.openUnifiedDiffModal(song);
        };
        grid.appendChild(card);
    });
};
