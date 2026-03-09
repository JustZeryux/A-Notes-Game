/* === SONGS_BROWSER.JS - FILTROS BLINDADOS V3 === */

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

    // OBTENER CANCIONES DE FIREBASE
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

    // OBTENER CANCIONES DE OSU! API CON FILTROS INYECTADOS
    try {
        let safeQuery = window.lastQuery.trim();
        if (safeQuery === "") {
            if (!append) { const terms = ["anime", "fnf", "vocaloid", "camellia", "touhou", "rock", "pop"]; window.lastQuery = terms[Math.floor(Math.random() * terms.length)]; }
            safeQuery = window.lastQuery;
        }

        let apiQuery = safeQuery;
        
        // 🚨 FORZAR A LA API A BUSCAR LAS TECLAS Y ESTRELLAS EXACTAS
        if (window.currentFilters.key !== 'all') apiQuery += ` keys=${window.currentFilters.key}`;
        if (window.currentFilters.stars !== 'all') {
            let st = parseInt(window.currentFilters.stars);
            if (st === 1) apiQuery += ` stars<2`;
            else if (st === 5) apiQuery += ` stars>=5`;
            else apiQuery += ` stars>=${st} stars<${st+1}`;
        }

        const pageA = window.currentOsuPage; window.currentOsuPage += 2;
        let modeParam = ""; const fType = window.currentFilters.type;
        if (fType.includes('taiko')) modeParam = "&m=1"; else if (fType.includes('catch')) modeParam = "&m=2"; else if (fType.includes('standard')) modeParam = "&m=0"; else if (fType.includes('mania')) modeParam = "&m=3";

        const res1 = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(apiQuery)}${modeParam}&p=${pageA}`);
        const d1 = await res1.json();
        
        let rawOsuData = Array.isArray(d1) ? d1 : [];
        const uniqueOsuMap = new Map(); rawOsuData.forEach(item => uniqueOsuMap.set(item.id, item));
        
        uniqueOsuMap.forEach(set => {
            if(set.beatmaps && set.beatmaps.length > 0) {
                
                // 🚨 BUSCAR DENTRO DEL PAQUETE LA DIFICULTAD EXACTA QUE PIDIÓ EL USUARIO
                let validBeatmaps = set.beatmaps;
                
                if (window.currentFilters.key !== 'all') {
                    let tk = parseInt(window.currentFilters.key);
                    validBeatmaps = validBeatmaps.filter(b => (b.mode_int===3 || b.mode===3 || b.mode==='mania') && Math.floor(b.cs) === tk);
                }
                
                if (window.currentFilters.stars !== 'all') {
                    let st = parseInt(window.currentFilters.stars);
                    if (st === 1) validBeatmaps = validBeatmaps.filter(b => b.difficulty_rating < 2);
                    else if (st === 5) validBeatmaps = validBeatmaps.filter(b => b.difficulty_rating >= 5);
                    else validBeatmaps = validBeatmaps.filter(b => b.difficulty_rating >= st && b.difficulty_rating < st + 1);
                }

                // Si encontró la dificultad correcta, la usa. Si no, usa la por defecto.
                let bestMap = validBeatmaps.length > 0 ? validBeatmaps[0] : set.beatmaps[0];
                
                let mNum = bestMap.mode_int !== undefined ? bestMap.mode_int : bestMap.mode;
                let mName = (mNum === 1) ? 'taiko' : (mNum === 2 ? 'catch' : (mNum === 3 || mNum === 'mania' ? 'mania' : 'standard'));
                
                if (modeParam === "&m=1" && mName !== 'taiko') return;
                if (modeParam === "&m=2" && mName !== 'catch') return;
                if (modeParam === "&m=0" && mName !== 'standard') return;

                let stars = bestMap.difficulty_rating || 0;
                let keys = mName === 'mania' ? [...new Set(set.beatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b) : [];
                
                osuSongs.push({ id: "osu_" + set.id, title: set.title, artist: `Subido por: ${set.creator}`, imageURL: `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`, isOsu: true, originalMode: mName, keysAvailable: keys, starRating: stars, raw: set });
            }
        });
    } catch(e) { console.warn("Error Osu API"); }

    const existingIds = new Set(window.unifiedSongs.map(s => s.id));
    const uniqueNewSongs = [...fbSongs, ...osuSongs].filter(s => !existingIds.has(s.id));
    window.unifiedSongs = [...window.unifiedSongs, ...uniqueNewSongs];
    if (!append && query.trim() === "") window.unifiedSongs = window.unifiedSongs.sort(() => 0.5 - Math.random());
    window.renderUnifiedGrid();
};

function detectKeys(data) {
    let keys = [];
    Object.keys(data).forEach(k => {
        if (k.startsWith('notes_')) {
            let parts = k.split('_'); 
            if (parts.length === 3) {
                let kNum = parseInt(parts[2].replace('k',''));
                if (!isNaN(kNum) && !keys.includes(kNum)) keys.push(kNum);
            }
        }
    });
    if (keys.length === 0 && data.notes && data.notes.length > 0) keys.push(4);
    return keys.sort((a,b)=>a-b);
}

function countTotalNotes(data) {
    let max = 0; if (data.notes) max = data.notes.length;
    Object.keys(data).forEach(k => { if (k.startsWith('notes_') && Array.isArray(data[k])) max = Math.max(max, data[k].length); });
    return max;
}

window.renderUnifiedGrid = function() {
    const grid = document.getElementById('song-grid'); if(!grid) return; grid.innerHTML = '';
    let baseList = window.currentFilters.type === 'recent' ? JSON.parse(localStorage.getItem('recentSongs') || '[]') : window.unifiedSongs;

    let filtered = baseList.filter(song => {
        let type = window.currentFilters.type;

        // 1. FILTRO DE TIPO
        if (type !== 'recent' && type !== 'all') {
            if (type === 'charted') { if (song.isOsu) return false; return countTotalNotes(song.raw) > 0; }
            if (type === 'mechanics') return song.raw && song.raw.mechanics && song.raw.mechanics.length > 0;
            if (type === 'osu_mania' && song.originalMode !== 'mania') return false;
            if (type === 'osu_standard' && song.originalMode !== 'standard') return false;
            if (type === 'osu_taiko' && song.originalMode !== 'taiko') return false;
            if (type === 'osu_catch' && song.originalMode !== 'catch') return false;
            if ((type === 'com' || type === 'comunidad' || type === 'community') && song.isOsu) return false;
        }

        // 2. FILTRO DE TECLAS (🚨 FIX: Oculta Standard si eliges teclas)
        if (window.currentFilters.key !== 'all') {
            let targetKey = parseInt(window.currentFilters.key);
            
            // Si el mapa es de Osu y NO es Mania, ¡OCULTALO! (Standard no tiene 5K)
            if (song.isOsu && song.originalMode !== 'mania') return false; 
            
            // Permitir mostrar las canciones vacías de la comunidad
            if (!song.keysAvailable || song.keysAvailable.length === 0) return true; 
            
            if (!song.keysAvailable.includes(targetKey)) return false; 
        }

        // 3. FILTRO DE ESTRELLAS
        if (window.currentFilters.stars !== 'all') {
            let sNum = 0;
            if (song.isOsu) { sNum = parseFloat(song.starRating || 0); } 
            else { let n = countTotalNotes(song.raw || song); sNum = n === 0 ? 0 : (n / 200) + 1; }
            
            let tStar = parseInt(window.currentFilters.stars);
            if (tStar === 1 && sNum >= 2.0) return false; 
            if (tStar > 1 && tStar < 5 && (sNum < tStar || sNum >= tStar + 1)) return false; 
            if (tStar === 5 && sNum < 5.0) return false; 
        }
        
        return true;
    });

    if (filtered.length === 0) { grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:var(--gold); font-weight:bold; font-size:1.5rem;">No se encontraron canciones con estos filtros. 🌸</div>`; return; }

    filtered.forEach(song => {
        const card = document.createElement('div'); card.className = `song-card ${song.isOsu ? 'osu-card-style' : ''}`;
        
        let stars = parseFloat(song.starRating || 0).toFixed(1);
        let noteCount = 0;
        if(!song.isOsu) { noteCount = countTotalNotes(song.raw); stars = (noteCount === 0) ? "0.0" : ((noteCount / 200) + 1).toFixed(1); }
        let starCol = stars >= 6 ? '#ff0055' : (stars >= 4 ? '#FFD700' : (stars > 0 ? '#00ffcc' : '#555'));
        let mIcon = song.originalMode === 'standard' ? '🎯' : (song.originalMode === 'taiko' ? '🥁' : (song.originalMode === 'catch' ? '🍎' : '🎹'));
        
        let maniaKeys = (song.originalMode === 'mania' || !song.isOsu) ? (song.keysAvailable || []).map(k => `<div class="diff-badge" style="border: 1px solid var(--blue); color: var(--blue);">${k}K</div>`).join('') : "";
        let sourceBadge = song.isOsu ? `<div class="diff-badge" style="margin-left:auto; border-color: #ff66aa; color: #ff66aa;">${mIcon} ${song.originalMode.toUpperCase()}</div>` : `<div class="diff-badge" style="margin-left:auto; border-color: var(--blue); color: var(--blue);">☁️ COMUNIDAD</div>`;
        let chartedBadge = (!song.isOsu && noteCount > 0) ? `<div class="diff-badge" style="border-color:#12FA05; color:#12FA05; font-weight:900;">📝 CHARTED</div>` : ``;
        let mechBadge = (song.raw && song.raw.mechanics && song.raw.mechanics.length > 0) ? `<div class="diff-badge" style="border-color:#00ffff; color:#00ffff; font-weight:900;">⚙️ FX</div>` : ``;

        let gradeBadgeHTML = '';
        if (window.user && window.user.scores && window.user.scores[song.id]) {
            let grade = typeof window.user.scores[song.id] === 'object' ? window.user.scores[song.id].grade : null;
            if (grade) {
                let badgeColor = grade === "SS" ? "#00ffff" : grade === "S" ? "gold" : grade === "A" ? "#12FA05" : grade === "B" ? "yellow" : grade === "C" ? "orange" : "#F9393F";
                gradeBadgeHTML = `<div style="position: absolute; top: 8px; right: 8px; background: rgba(10,10,15,0.95); color: ${badgeColor}; border: 2px solid ${badgeColor}; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; box-shadow: 0 0 10px ${badgeColor}; z-index: 10; font-family: sans-serif;">${grade}</div>`;
            }
        }

        card.innerHTML = `${gradeBadgeHTML}
            <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background: url('${song.imageURL}'), url('icon.png'); background-size: cover; background-position: center; transition: 0.5s; filter: brightness(0.6);"></div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-author">by ${song.artist.replace('Subido por: ', '')}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:10px;">
                    <div class="diff-badge" style="background: ${starCol}22; border: 1px solid ${starCol}; color: ${starCol};">⭐ ${stars}</div>
                    ${chartedBadge} ${mechBadge} ${maniaKeys} ${sourceBadge}
                </div>
            </div>`;
        
        const bg = card.querySelector('.song-bg');
        card.onmouseenter = () => { bg.style.transform = 'scale(1.1)'; bg.style.filter = 'brightness(0.9)'; };
        card.onmouseleave = () => { bg.style.transform = 'scale(1)'; bg.style.filter = 'brightness(0.6)'; };
        card.onclick = () => { if(typeof window.openUnifiedDiffModal === 'function') window.openUnifiedDiffModal(song); };
        grid.appendChild(card);
    });

    if (window.currentFilters.type !== 'recent') {
        const loadMoreContainer = document.createElement('div'); loadMoreContainer.style.gridColumn = "1 / -1"; loadMoreContainer.style.padding = "40px";
        loadMoreContainer.innerHTML = `<button id="btn-load-more" class="import-btn" style="width: 320px; margin: 0 auto;">Cargar más contenido</button>`;
        loadMoreContainer.querySelector('button').onclick = () => window.fetchUnifiedData(window.lastQuery, true);
        grid.appendChild(loadMoreContainer);
    }
};

window.renderMenu = function(filter="") { if(typeof window.fetchUnifiedData === 'function') window.fetchUnifiedData(filter); };
