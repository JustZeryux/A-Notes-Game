window.openOsuBrowser = function() {
    openModal('osu');
    setTimeout(() => document.getElementById('osu-search-inp').focus(), 100);
};

window.searchOsu = async function() {
    const query = document.getElementById('osu-search-inp').value.trim();
    const status = document.getElementById('osu-status');
    const results = document.getElementById('osu-results');
    
    status.innerText = "Buscando en la base de datos de Osu!... ⏳";
    status.style.color = "var(--gold)";
    results.innerHTML = "";

    try {
        // Si busca en blanco, trae lo más nuevo
        let apiUrl = `https://api.nerinyan.moe/search?m=3`;
        if(query) apiUrl += `&q=${encodeURIComponent(query)}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if(!data || data.length === 0) {
            status.innerText = "No se encontraron mapas de Mania para esta búsqueda.";
            status.style.color = "var(--miss)";
            return;
        }

        status.innerText = `✅ ¡Se encontraron ${data.length} resultados!`;
        status.style.color = "var(--good)";

        data.forEach(set => {
            const maniaBeatmaps = set.beatmaps.filter(b => b.mode_int === 3 || b.mode === 'mania' || b.mode === 3);
            if(maniaBeatmaps.length === 0) return;

            let keys = [...new Set(maniaBeatmaps.map(b => b.cs))].sort((a,b)=>a-b);
            const coverUrl = `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`;
            
            const card = document.createElement('div');
            // FIX: Le damos las clases de tu diseño principal + el aura rosa
            card.className = 'song-card osu-card-style'; 
            
            let keysHTML = keys.map(k => `<div class="diff-badge">${k}K</div>`).join('');

            card.innerHTML = `
                <div class="song-bg" style="background-image: url('${coverUrl}'), url('icon.png');"></div>
                <div class="song-info">
                    <div class="song-title">${set.title}</div>
                    <div class="song-author">Artista: ${set.artist}</div>
                    <div style="display:flex; gap:5px; margin-top:10px; flex-wrap:wrap; align-items:center;">
                        ${keysHTML}
                        <div class="diff-badge badge-osu" style="margin-left:auto;">🌸 OSU!</div>
                    </div>
                </div>
            `;
            
            // FIX: En lugar de iniciar la canción, cerramos este menú y abrimos el menú de dificultad de ui.js
            card.onclick = () => {
                closeModal('osu'); 
                // Le pasamos el objeto formateado exactamente como lo lee tu menú principal
                let songObj = {
                    id: set.id, title: set.title, imageURL: coverUrl, isOsu: true, keysAvailable: keys, raw: set
                };
                if (typeof openUnifiedDiffModal === 'function') {
                    openUnifiedDiffModal(songObj);
                }
            };
            results.appendChild(card);
        });

    } catch(e) {
        console.error(e);
        status.innerText = "Error al conectar con los servidores de Osu!";
        status.style.color = "var(--miss)";
    }
};
window.downloadAndPlayOsu = async function(setId, title, coverUrl, targetKeys) {
    if(typeof JSZip === 'undefined') return alert("Error: JSZip no está cargado.");
    
    const loader = document.getElementById('loading-overlay');
    const loaderText = document.getElementById('loading-text');
    loader.style.display = 'flex';
    
    try {
        loaderText.innerText = "DESCARGANDO MAPA DE OSU!... 🌐";
        const res = await fetch(`https://api.nerinyan.moe/d/${setId}`);
        const blob = await res.blob();

        loaderText.innerText = "DESCOMPRIMIENDO MAPA... 📦";
        const zip = await JSZip.loadAsync(blob);
        const files = Object.keys(zip.files);
        
        const osuFiles = files.filter(f => f.endsWith('.osu'));
        if(osuFiles.length === 0) throw new Error("No se encontraron mapas dentro del archivo.");
        
        let selectedOsuText = null;
        
        // Magia: Buscar el mapa exacto que coincida con las teclas (Ej: 4K, 7K)
        for(let f of osuFiles) {
            let text = await zip.file(f).async("string");
            if(text.includes(`CircleSize:${targetKeys}`) || text.includes(`CircleSize: ${targetKeys}`)) {
                selectedOsuText = text;
                break;
            }
        }
        
        // Fallback por si acaso
        if(!selectedOsuText) selectedOsuText = await zip.file(osuFiles[0]).async("string");
        
        loaderText.innerText = "TRADUCIENDO MAPA... 🧠";
        const parsed = parseOsuFile(selectedOsuText);
        
        loaderText.innerText = "PROCESANDO AUDIO... 🎵";
        const audioFileMatcher = new RegExp(parsed.audioFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const audioKey = files.find(f => audioFileMatcher.test(f));
        
        if(!audioKey) throw new Error("No se encontró el archivo de audio.");
        
        const audioBlob = await zip.file(audioKey).async("blob");
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        if(!window.st.ctx) unlockAudio();
        const audioBuffer = await window.st.ctx.decodeAudioData(arrayBuffer);

        window.curSongData = {
            id: "osu_" + setId,
            title: title + ` [${parsed.keys}K]`,
            imageURL: coverUrl,
            lyrics: null
        };

        const songObj = { 
            id: window.curSongData.id, 
            buf: audioBuffer, 
            map: parsed.map, 
            kVersion: parsed.keys 
        };

        loader.style.display = 'none';
        playSongInternal(songObj);

    } catch(e) {
        console.error(e);
        loader.style.display = 'none';
        alert("Fallo al cargar mapa de Osu!: " + e.message);
    }
};

// === EL TRADUCTOR MÁGICO DE OSU! ===
function parseOsuFile(text) {
    const lines = text.split('\n').map(l => l.trim());
    let hitObjectsIdx = lines.findIndex(l => l.includes('[HitObjects]'));
    let keys = 4;
    let audioFilename = "audio.mp3";
    
    // Buscar configuración de teclas y audio
    for(let i = 0; i < hitObjectsIdx; i++) {
        if(lines[i].startsWith('CircleSize:')) keys = parseInt(lines[i].split(':')[1]);
        if(lines[i].startsWith('AudioFilename:')) audioFilename = lines[i].split(':')[1].trim();
    }

    const map = [];
    // Leer cada nota escrita a mano por la comunidad
    for(let i = hitObjectsIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const parts = lines[i].split(',');
        if(parts.length >= 5) {
            const x = parseInt(parts[0]);
            const time = parseInt(parts[2]);
            const typeFlag = parseInt(parts[3]);
            
            // Convertimos la coordenada X de Osu (0 a 512) al carril de tu juego (0, 1, 2, 3...)
            let lane = Math.floor(Math.max(0, Math.min(511, x)) * keys / 512);
            
            const isHold = (typeFlag & 128) !== 0;
            let len = 0;
            let type = 'tap';

            if(isHold && parts.length >= 6) {
                const endTime = parseInt(parts[5].split(':')[0]);
                len = endTime - time;
                type = 'hold';
            }

            map.push({ t: time, l: lane, type: type, len: len, h: false });
        }
    }
    
    // Osu no necesita el "START_OFFSET" de 3 segundos como tu genMap, pero le agregamos 1 segundo de cortesía
    map.forEach(n => n.t += 1500);

    return { map, keys, audioFilename };
}
