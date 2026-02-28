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
        let safeQuery = query ? query : "ranked";
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(safeQuery)}&m=3`);
        const data = await res.json();

        if(!data || data.length === 0) {
            status.innerText = "No se encontraron mapas de Mania.";
            status.style.color = "var(--miss)";
            return;
        }

        status.innerText = `✅ ¡Se encontraron ${data.length} resultados!`;
        status.style.color = "var(--good)";

        // FORZAMOS LA CUADRICULA PARA QUE NO SE APLASTEN
        results.style.display = 'grid';
        results.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        results.style.gap = '15px';
        results.style.padding = '10px';

        data.forEach(set => {
            const maniaBeatmaps = set.beatmaps.filter(b => b.mode_int === 3 || b.mode === 3 || b.mode === 'mania');
            if(maniaBeatmaps.length === 0) return;

            let keys = [...new Set(maniaBeatmaps.map(b => Math.floor(b.cs)))].sort((a,b)=>a-b);
            const coverUrl = `https://assets.ppy.sh/beatmaps/${set.id}/covers/list@2x.jpg`;
            
            const card = document.createElement('div');
            card.className = 'song-card'; 
            card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid #ff66aa; box-shadow: 0 0 15px rgba(255, 102, 170, 0.2); transition: transform 0.2s, box-shadow 0.2s; background: #111;';
            
            let keysHTML = keys.map(k => `<div class="diff-badge" style="padding: 2px 8px; border: 1px solid #00ffff; color: #00ffff; border-radius: 5px; font-size: 0.8rem; font-weight: bold;">${k}K</div>`).join('');

            card.innerHTML = `
                <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${coverUrl}'), url('icon.png'); background-size: cover; background-position: center; opacity: 0.7;"></div>
                <div class="song-info" style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 15px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent);">
                    <div class="song-title" style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${set.title}</div>
                    <div class="song-author" style="font-size: 0.9rem; color: #ccc; font-weight: bold; margin-bottom: 10px;">Subido por: ${set.creator}</div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                        ${keysHTML}
                        <div class="diff-badge" style="margin-left:auto; border: 1px solid #ff66aa; color: #ff66aa; padding: 2px 8px; border-radius: 5px; font-size: 0.8rem; font-weight: bold; background: rgba(255,102,170,0.1); box-shadow:0 0 8px rgba(255,102,170,0.4);">🌸 OSU!</div>
                    </div>
                </div>
            `;
            
            card.onmouseenter = () => { card.style.transform = 'scale(1.03)'; card.style.boxShadow = '0 0 25px rgba(255, 102, 170, 0.5)'; };
            card.onmouseleave = () => { card.style.transform = 'scale(1)'; card.style.boxShadow = '0 0 15px rgba(255, 102, 170, 0.2)'; };

            card.onclick = () => {
                closeModal('osu'); 
                let songObj = {
                    id: set.id, title: set.title, artist: `Subido por: ${set.creator}`, 
                    imageURL: coverUrl, isOsu: true, keysAvailable: keys, raw: set
                };
                if (typeof openUnifiedDiffModal === 'function') openUnifiedDiffModal(songObj);
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
        for(let f of osuFiles) {
            let text = await zip.file(f).async("string");
            if(text.includes(`CircleSize:${targetKeys}`) || text.includes(`CircleSize: ${targetKeys}`)) {
                selectedOsuText = text; break;
            }
        }
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

        // === EL ARREGLO DE LOS SUBTÍTULOS ===
        let fetchedLyrics = null;
        if (window.cfg && window.cfg.subtitles) {
            loaderText.innerText = "BUSCANDO LETRAS AUTOMÁTICAS... 🎤";
            try {
                // Limpiamos la basura del título (Ej: "Bad Apple!! (feat. nomico)" -> "Bad Apple!!")
                let cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                const resLrc = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
                const dataLrc = await resLrc.json();
                
                // Buscamos la mejor coincidencia que tenga subtítulos sincronizados
                const bestMatch = dataLrc.find(s => s.syncedLyrics);
                if (bestMatch && bestMatch.syncedLyrics) {
                    fetchedLyrics = bestMatch.syncedLyrics;
                }
            } catch(e) { console.warn("No se encontraron letras"); }
        }

        window.curSongData = {
            id: "osu_" + setId,
            title: title, 
            imageURL: coverUrl,
            lyrics: fetchedLyrics // Inyectamos las letras directamente al juego
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
    map.forEach(n => n.t += 3000);

    return { map, keys, audioFilename };
}
