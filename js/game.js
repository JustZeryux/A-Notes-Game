/* === AUDIO & ENGINE (ULTRA PERFORMANCE + FX MECHANICS + EDITOR SYNC V20) === */

let elTrack = null;
let gameLoopId; 

window.isTestingMap = false; // Flag para saber si venimos del editor

// Interceptar testMap del editor para saber que estamos en modo prueba
setTimeout(() => {
    if (typeof window.testMap === 'function') {
        const originalTestMap = window.testMap;
        window.testMap = function() {
            window.isTestingMap = true;
            originalTestMap();
        };
    }
}, 1000);

// ==========================================
// 1. SISTEMA DE AUDIO
// ==========================================
function unlockAudio() {
    if (!window.st.ctx) {
        try {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const b = window.st.ctx.createBuffer(1, 1, 22050);
            const s = window.st.ctx.createBufferSource();
            s.buffer = b;
            s.connect(window.st.ctx.destination);
            s.start(0);
            genSounds();
        } catch(e) { console.error("Audio Error:", e); }
    }
    if (window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
}

function genSounds() {
    if(!window.st.ctx) return;
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;
    const b2 = window.st.ctx.createBuffer(1, 4000, 44100);
    const d2 = b2.getChannelData(0);
    for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / 1000);
    window.missBuf = b2;
}

function normalizeAudio(filteredData) {
    let max = 0;
    for (let i = 0; i < filteredData.length; i += 50) { 
        const v = Math.abs(filteredData[i]);
        if (v > max) max = v;
    }
    if (max === 0) return filteredData;
    const multiplier = 0.95 / max;
    if (multiplier > 1.1 || multiplier < 0.9) {
        for (let i = 0; i < filteredData.length; i++) filteredData[i] *= multiplier;
    }
    return filteredData;
}

// ==========================================
// 2. GENERADOR DE MAPAS 
// ==========================================
function getSmartLane(last, k, busyLanes, time) {
    let candidates = [];
    for(let i=0; i<k; i++) {
        if (time > busyLanes[i] + 20) candidates.push(i);
    }
    if(candidates.length === 0) return -1;
    let filtered = candidates.filter(c => c !== last);
    if(filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData)); 
    const map = [];
    const sampleRate = buf.sampleRate;
    
    const START_OFFSET = 3000; 
    const density = window.cfg.den || 5;
    const step = Math.floor(sampleRate / 60); 
    
    let minDistMs = Math.max(50, 260 - (Math.pow(density, 1.4) * 4)); 
    let thresholdMult = Math.max(0.80, 1.40 - (density * 0.04)); 
    
    let lastNoteTime = -1000; 
    let lastLane = Math.floor(k/2); 
    let laneFreeTimes = new Array(k).fill(0);
    
    const energyHistory = [];
    let prevInstant = 0; 

    let patternType = 'none'; 
    let patternCount = 0;
    let trillLanes = [];

    for (let i = 0; i < data.length; i += step) {
        let sum = 0; 
        for(let j=0; j<step && (i+j)<data.length; j++) sum += data[i+j] * data[i+j];
        const instant = Math.sqrt(sum / step);
        
        energyHistory.push(instant); 
        if(energyHistory.length > 25) energyHistory.shift(); 
        const localAvg = energyHistory.reduce((a,b)=>a+b,0) / energyHistory.length;

        let intensity = (localAvg > 0) ? (instant / localAvg) : 0;

        if(instant > localAvg * thresholdMult && instant > prevInstant && instant > 0.015) {
            const timeMs = (i / sampleRate) * 1000 + START_OFFSET;
            
            if(timeMs - lastNoteTime > minDistMs) {
                let type = 'tap';
                let length = 0;
                let lane = -1;

                if (patternCount > 0) {
                    patternCount--;
                    if (patternType === 'stairs') {
                        lane = (lastLane + 1) % k;
                    } else if (patternType === 'trill' && trillLanes.length === 2) {
                        lane = (lastLane === trillLanes[0]) ? trillLanes[1] : trillLanes[0];
                    } else if (patternType === 'jack') {
                        lane = lastLane;
                    }
                } else {
                    if (density >= 3 && Math.random() > 0.4) {
                        let rand = Math.random();
                        if (rand > 0.5) {
                            patternType = 'stairs';
                            patternCount = Math.floor(Math.random() * 4) + 2;
                        } else if (rand > 0.2 && density >= 5) {
                            patternType = 'trill';
                            patternCount = Math.floor(Math.random() * 6) + 3; 
                            trillLanes = [Math.floor(Math.random()*k), Math.floor(Math.random()*k)];
                            while(trillLanes[0] === trillLanes[1]) trillLanes[1] = Math.floor(Math.random()*k);
                        } else if (density >= 10 && rand <= 0.2) {
                            patternType = 'jack';
                            patternCount = Math.floor(Math.random() * 2) + 1; 
                        }
                    }
                    if(lane === -1) lane = getSmartLane(lastLane, k, laneFreeTimes, timeMs);
                }

                if (lane === -1) { 
                    let bestLane = 0; let minTime = Infinity;
                    for(let x=0; x<k; x++) { if(laneFreeTimes[x] < minTime) { minTime = laneFreeTimes[x]; bestLane = x; } }
                    lane = bestLane; 
                }

                if (intensity > 1.35 && Math.random() > 0.4) {
                    let sustain = 0;
                    for(let h=1; h<12; h++) {
                        let fIdx = i + (step * h);
                        if(fIdx < data.length && Math.abs(data[fIdx]) > localAvg * 0.95) sustain++;
                        else break; 
                    }
                    if(sustain > 4) { 
                        type = 'hold';
                        length = Math.min(sustain * (step/sampleRate)*1000 * 2.0, 1500); 
                        if(length < 120) { type = 'tap'; length = 0; }
                    }
                }

                map.push({ t: timeMs, l: lane, type: type, len: length, h: false });
                laneFreeTimes[lane] = timeMs + length + 25; 
                
                if (density >= 4 && type === 'tap') {
                    let chordChance = (density - 2) * 0.08; 
                    if (intensity > 1.35 && Math.random() < chordChance) {
                        let l2 = getSmartLane(lane, k, laneFreeTimes, timeMs);
                        if (l2 !== -1 && l2 !== lane) {
                            map.push({ t: timeMs, l: l2, type: 'tap', len: 0, h: false });
                            laneFreeTimes[l2] = timeMs + 25;
                        }
                    }
                }

                lastNoteTime = timeMs; 
                lastLane = lane;
            }
        }
        prevInstant = instant; 
    }
    return map;
}

// ==========================================
// 3. CORE (SYNC & VISUALS)
// ==========================================
function playHit() {
    if (window.hitBuf && window.cfg.hitSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource(); s.buffer = window.hitBuf;
        const g = window.st.ctx.createGain(); g.gain.value = window.cfg.hvol || 0.5;
        s.connect(g); g.connect(window.st.ctx.destination); s.start(0);
    }
}
function playMiss() {
    if (window.missBuf && window.cfg.missSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource(); s.buffer = window.missBuf;
        const g = window.st.ctx.createGain(); g.gain.value = window.cfg.missVol || 0.5;
        s.connect(g); g.connect(window.st.ctx.destination); s.start(0);
    }
}

window.prepareAndPlaySong = async function(k) {
    if (typeof window.loadSettings === 'function') window.loadSettings();

    if(window.currentLobbyId) window.isMultiplayer = true;
    if (!window.curSongData) { if(!window.isMultiplayer) alert("Error: No hay canción"); return; }
    
    if (window.curSongData.isOsu || (window.curSongData.id && String(window.curSongData.id).startsWith('osu_'))) {
        if(typeof unlockAudio === 'function') unlockAudio();
        let realId = String(window.curSongData.id).replace('osu_', '');
        if(typeof downloadAndPlayOsu === 'function') { downloadAndPlayOsu(realId, window.curSongData.title, window.curSongData.imageURL, k); return; }
    }
    
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO PISTA..."; }

    try {
        if(typeof unlockAudio === 'function') unlockAudio();

        if (window.cfg.subtitles && !window.curSongData.lyrics && window.curSongData.title) {
            try {
                let cleanTitle = window.curSongData.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
                const data = await res.json();
                const bestMatch = data.find(song => song.syncedLyrics);
                if (bestMatch && bestMatch.syncedLyrics) window.curSongData.lyrics = bestMatch.syncedLyrics;
            } catch(e) {}
        }

        let buffer;
        let songInRam = window.ramSongs ? window.ramSongs.find(s => s.id === window.curSongData.id) : null;
        if (songInRam) { buffer = songInRam.buf; } 
        else {
            const response = await fetch(window.curSongData.audioURL || window.curSongData.url); 
            const arrayBuffer = await response.arrayBuffer();
            buffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            if(!window.ramSongs) window.ramSongs = [];
            window.ramSongs.push({ id: window.curSongData.id, buf: buffer });
        }

        let map = [];
        let rawData = window.curSongData.raw || window.curSongData;
        let mapKey = `notes_mania_${k}k`; 

        let isCharted = false;
        if (rawData[mapKey] && rawData[mapKey].length > 0) { map = JSON.parse(JSON.stringify(rawData[mapKey])); isCharted = true; } 
        else if (rawData.notes && rawData.notes.length > 0) { map = JSON.parse(JSON.stringify(rawData.notes)); isCharted = true; }

        if (isCharted) {
            map.forEach(n => {
                n.t += 3000; 
                if (n.dur !== undefined) { n.len = n.dur; }
                n.h = false; 
                n.s = false;
                n.broken = false;
            });
            map.sort((a, b) => a.t - b.t); 
        } 
        else {
            if (rawData.uploader && !window.forceAutomap) {
                if(loader) loader.style.display = 'none';
                let ask = confirm("⚠️ Esta canción fue subida desde el Studio y aún no tiene notas mapeadas.\n\n¿Deseas abrir el Editor para chartearla ahora?");
                if (ask && typeof window.openEditor === 'function') { window.openEditor(window.curSongData, k, 'mania'); } 
                else { document.getElementById('menu-container').classList.remove('hidden'); }
                return; 
            } else {
                if (window.forceAutomap && typeof window.notify === 'function') {
                    window.notify("🧠 Analizando audio con Auto-Mapeo Nativo...", "info");
                }
                map = genMap(buffer, k); 
                map.sort((a, b) => a.t - b.t);
                window.forceAutomap = false; 
            }
        }

        const songObj = { id: window.curSongData.id, buf: buffer, map: map, kVersion: k };
        window.preparedSong = songObj; 

        if(window.currentLobbyId) { if(typeof window.notifyLobbyLoaded === 'function') window.notifyLobbyLoaded(); } 
        else { playSongInternal(songObj); if(loader) loader.style.display = 'none'; }
    } catch (e) { 
        console.error(e); 
        if(loader) loader.style.display = 'none'; 
        alert("Error carga: " + e.message); 
    }
};

window.playSongInternal = function(s) {
    if (typeof window.loadSettings === 'function') window.loadSettings();

    if(!s) return;
    initMobileTouchControls(window.keys || 4);
    window.st.act = true; window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = []; window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50; window.st.maxCmb = 0; 
    window.st.stats = { s:0, g:0, b:0, m:0 }; window.st.hitCount = 0; window.st.totalOffset = 0; 
    window.st.fcStatus = "PFC"; window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => { window.st.trueMaxScore += 350; if(n.type === 'hold') window.st.trueMaxScore += 200; });
    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    const oldIg = document.getElementById('ig-profile'); if (oldIg) oldIg.style.display = 'none'; 

    let capsuleUI = document.getElementById('capsule-ui');
    if(!capsuleUI) {
        capsuleUI = document.createElement('div'); capsuleUI.id = 'capsule-ui';
        capsuleUI.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;';
        document.getElementById('game-layer').appendChild(capsuleUI);
    }

    const avUrl = (window.user && window.user.avatarData) ? window.user.avatarData : 'icon.png';
    const uName = window.user ? window.user.name : 'Guest';
    const uLvl = window.user ? window.user.lvl : 1;

    capsuleUI.innerHTML = `
        <div style="position:fixed; top:20px; left:20px; background:rgba(10,10,14,0.95); padding:6px 20px 6px 6px; border-radius:50px; border:1px solid var(--accent); display:flex; align-items:center; gap:12px; box-shadow:0 0 20px rgba(255,0,85,0.3); z-index:9500; pointer-events:auto; backdrop-filter:blur(8px);">
            <div style="width:45px; height:45px; border-radius:50%; background:url('${avUrl}') center/cover; border:2px solid white;"></div>
            <div style="display:flex; flex-direction:column; justify-content:center; padding-right:10px;">
                <div style="color:white; font-weight:900; font-size:1rem; text-transform:uppercase; letter-spacing:1px; line-height:1;">${uName}</div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                    <div style="color:var(--gold); font-weight:900; font-size:0.7rem;">LVL ${uLvl}</div>
                    <div style="width:100px; height:8px; background:#111; border-radius:4px; overflow:hidden; border:1px solid #333;"><div id="engine-hp-fill" style="width:100%; height:100%; background:var(--good); transition:0.2s;"></div></div>
                </div>
            </div>
        </div>
        <div id="countdown" style="position:absolute; top:0; left:0; width:100%; height:100%; display:none; align-items:center; justify-content:center; pointer-events:none; z-index:9999; font-size:15rem; font-weight:900; color:white; text-shadow:0 0 60px black;"></div>
    `;

    const uiToClose = ['modal-res', 'modal-pause', 'modal-lobbies', 'modal-lobby-room', 'modal-song-selector', 'modal-diff', 'loading-overlay'];
    uiToClose.forEach(id => { const m = document.getElementById(id); if(m) m.style.display = 'none'; });

    if(!document.getElementById('game-bg-container')) {
        const bgCont = document.createElement('div'); bgCont.id = "game-bg-container";
        bgCont.innerHTML = `<div id="game-bg-img"></div>`;
        document.getElementById('game-layer').insertBefore(bgCont, document.getElementById('track'));
        const subCont = document.createElement('div'); subCont.id = "subtitles-container";
        subCont.innerHTML = `<div id="subtitles-text"></div>`;
        document.getElementById('game-layer').appendChild(subCont);
    }
    
    const bgC = document.getElementById('game-bg-container'); const subC = document.getElementById('subtitles-container');
    if (window.cfg.bgEffects || window.cfg.subtitles) { bgC.style.display = 'block'; document.getElementById('game-bg-img').style.backgroundImage = window.curSongData.imageURL ? `url(${window.curSongData.imageURL})` : 'none'; } else { bgC.style.display = 'none'; }
    if (window.cfg.subtitles) { window.st.parsedLyrics = []; window.st.currentLyricIdx = 0; subC.style.display = 'block'; document.getElementById('subtitles-text').innerText = "🎵"; if (window.curSongData.lyrics) { const lines = window.curSongData.lyrics.split('\n'); lines.forEach(l => { const match = l.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/); if(match) window.st.parsedLyrics.push({ t: (parseInt(match[1])*60 + parseFloat(match[2])) * 1000, tx: match[3].trim() }); }); window.st.parsedLyrics.sort((a,b) => a.t - b.t); } } else { subC.style.display = 'none'; }

    window.initReceptors(window.keys); 
    updHUD(); 
    
    window.st.src = window.st.ctx.createBufferSource(); window.st.src.buffer = s.buf;
    const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);
    window.st.src.onended = () => { if(window.st.act) end(false); };
    
    const now = window.st.ctx.currentTime; window.st.t0 = now; const AUDIO_DELAY = 3; 
    window.st.src.start(now + AUDIO_DELAY);

    const cd = document.getElementById('countdown');
    if(cd) { cd.style.display = 'flex'; cd.innerText = "3"; }
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if(cd) { if (count > 0) cd.innerText = count; else { clearInterval(iv); cd.innerText = "GO!"; setTimeout(() => { cd.style.display = 'none'; }, 500); } } else { clearInterval(iv); }
    }, 1000);

    gameLoopId = requestAnimationFrame(loop);
};

// ==========================================
// 🚀 INICIALIZADOR DE RECEPTORES (CON CACHÉ RAM)
// ==========================================
window.initReceptors = function(k) {
    const elTrack = document.getElementById('track');
    if (!elTrack) return;
    elTrack.innerHTML = '';

    elTrack.style.background = 'rgba(12, 12, 16, 0.9)';
    elTrack.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)';
    elTrack.style.borderLeft = '2px solid #222';
    elTrack.style.borderRight = '2px solid #222';

    let kCount = parseInt(k) || window.keys || 4;
    const w = 100 / kCount;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    let activeSkin = null;
    let targetSkinId = null;
    let shopArray = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : (window.SHOP_ITEMS || []);

    if (window.user && window.user.equipped && window.user.equipped.skin && window.user.equipped.skin !== 'default') targetSkinId = window.user.equipped.skin;
    if (window.cfg && window.cfg.noteSkin && window.cfg.noteSkin !== 'default') targetSkinId = window.cfg.noteSkin; 
    if (targetSkinId && shopArray.length > 0) activeSkin = shopArray.find(i => i.id === targetSkinId);

    // 🚨 CACHÉ EN RAM PARA ACELERAR EL LOOP A 240 FPS
    window.noteStylesCache = []; 

    for (let i = 0; i < kCount; i++) {
        const lane = document.createElement('div');
        lane.style.cssText = `position:absolute; left:${i * w}%; width:${w}%; top:0; height:100%; border-right:1px solid rgba(255,255,255,0.03); pointer-events:none;`;
        elTrack.appendChild(lane);

        const rec = document.createElement('div');
        rec.id = `rec-${i}`;
        rec.className = 'receptor';
        rec.style.cssText = `left: ${i * w}%; width: ${w}%; top: ${yReceptor}px; height: 80px; position: absolute; display: flex; justify-content: center; align-items: center; z-index: 20;`;

        let conf = { c: '#00ffff', s: 'circle' };
        if (window.cfg && window.cfg.modes && window.cfg.modes[kCount] && window.cfg.modes[kCount][i]) conf = window.cfg.modes[kCount][i];

        let color = conf.c || '#00ffff';
        let isImageSkin = false;
        let shapeType = conf.s || 'circle';

        if (activeSkin) { 
            if (activeSkin.fixed) color = activeSkin.color; 
            if (activeSkin.img) isImageSkin = true;
            if (activeSkin.shape) shapeType = activeSkin.shape; 
        }

        // GUARDADO EN CACHÉ
        window.noteStylesCache[i] = { color, isImageSkin, shapeType, activeSkin };

        let svgStyles = `display: block; width: 100%; height: 100%; position: relative; z-index: 5; opacity: 0.5; filter: drop-shadow(0 0 5px ${color});`;
        let svgHTML = '';

        if (isImageSkin) {
            svgHTML = `<img src="${activeSkin.img}" style="${svgStyles} object-fit: contain;">`;
        } else {
            let innerPath = '';
            if (shapeType === 'diamond') innerPath = `<polygon points="50,10 90,50 50,90 10,50" fill="none" stroke="${color}" stroke-width="5"/>`;
            else if (shapeType === 'bar') innerPath = `<rect x="15" y="35" width="70" height="30" rx="10" fill="none" stroke="${color}" stroke-width="5"/>`;
            else if (shapeType === 'ring') innerPath = `<circle cx="50" cy="50" r="35" fill="none" stroke="${color}" stroke-width="10"/>`;
            else if (typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[shapeType]) innerPath = `<path d="${SKIN_PATHS[shapeType]}" fill="none" stroke="${color}" stroke-width="5"/>`;
            else if (window.PATHS && window.PATHS[shapeType]) innerPath = `<path d="${window.PATHS[shapeType]}" fill="none" stroke="${color}" stroke-width="5"/>`;
            else innerPath = `<circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="5"/>`; 
            
            svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}">${innerPath}</svg>`;
        }

        rec.innerHTML = svgHTML;
        elTrack.appendChild(rec);
    }
};

// ==========================================
// 🚀 EL LOOP ULTRA-OPTIMIZADO (GPU 3D ACCELERATED)
// ==========================================
function loop() {
    if (!window.st || !window.st.act || window.st.paused) {
        if(window.st && window.st.act) gameLoopId = requestAnimationFrame(loop);
        return;
    }

    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    // Progress bar
    if (window.st.songDuration > 0) {
        let progress = Math.min(100, (now / (window.st.songDuration * 1000)) * 100);
        const pFill = document.getElementById('top-progress-fill');
        if(pFill) pFill.style.width = progress + "%";
        
        const pTime = document.getElementById('top-progress-time');
        if(pTime) {
            let currentSec = Math.floor(now / 1000);
            let totalSec = Math.floor(window.st.songDuration);
            let curM = Math.floor(currentSec / 60);
            let curS = currentSec % 60;
            let totM = Math.floor(totalSec / 60);
            let totS = totalSec % 60;
            pTime.innerText = `${curM}:${curS.toString().padStart(2, '0')} / ${totM}:${totS.toString().padStart(2, '0')}`;
        }
    }

    let kCount = window.kCount || window.keys || 4;
    const w = 100 / kCount;
    let actualTrack = document.getElementById('track');

    // === ZONA DE GENERACIÓN VISUAL DE NOTAS ===
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; 
        if (n.type === 'fx_flash' || n.type === 'custom_fx') { n.s = true; window.st.spawned.push(n); continue; }

        if (n.t - now < 4000) { 
            if (n.t - now > -200) { 
                const el = document.createElement('div');
                const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
                
                // 🚨 FIX 5PX: Geometría absoluta pura sin Flexbox
                el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
                el.style.cssText = `left: ${n.l * w}%; width: ${w}%; top: 0px; height: 80px; position: absolute; z-index: 10; will-change: transform;`; 
                
                // 🚨 CACHÉ RAM: Renderizado ultra veloz
                let cache = window.noteStylesCache[n.l] || { color: '#00ffff', isImageSkin: false, shapeType: 'circle', activeSkin: null };
                
                let svgStyles = `position: absolute; top: 0; left: 0; display: block; width: 100%; height: 100%; z-index: 5; filter: drop-shadow(0 0 5px ${cache.color});`;
                let svgHTML = '';
                
                if (n.type === 'mine') {
                    svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}"><circle cx="50" cy="50" r="35" fill="#111" stroke="#F9393F" stroke-width="5"/><path d="M 50 15 L 50 0 M 50 85 L 50 100 M 15 50 L 0 50 M 85 50 L 100 50 M 25 25 L 15 15 M 75 75 L 85 85 M 25 75 L 15 85 M 75 25 L 85 15" stroke="#F9393F" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#F9393F"/></svg>`;
                } else if (n.type === 'dodge') {
                    svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}"><polygon points="50,10 90,85 10,85" fill="rgba(0,255,255,0.2)" stroke="#00ffff" stroke-width="6"/><rect x="45" y="35" width="10" height="25" fill="#00ffff" rx="5"/><circle cx="50" cy="72" r="6" fill="#00ffff"/></svg>`;
                } else {
                    if (cache.isImageSkin) {
                        svgHTML = `<img src="${cache.activeSkin.img}" style="${svgStyles} object-fit: contain;">`;
                    } else {
                        let innerPath = '';
                        if (cache.shapeType === 'diamond') innerPath = `<polygon points="50,10 90,50 50,90 10,50" fill="${cache.color}" stroke="white" stroke-width="5"/>`;
                        else if (cache.shapeType === 'bar') innerPath = `<rect x="15" y="35" width="70" height="30" rx="10" fill="${cache.color}" stroke="white" stroke-width="5"/>`;
                        else if (cache.shapeType === 'ring') innerPath = `<circle cx="50" cy="50" r="35" fill="none" stroke="${cache.color}" stroke-width="15"/>`;
                        else if (typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[cache.shapeType]) innerPath = `<path d="${SKIN_PATHS[cache.shapeType]}" fill="${cache.color}" stroke="white" stroke-width="2"/>`;
                        else if (window.PATHS && window.PATHS[cache.shapeType]) innerPath = `<path d="${window.PATHS[cache.shapeType]}" fill="${cache.color}" stroke="white" stroke-width="2"/>`;
                        else innerPath = `<circle cx="50" cy="50" r="40" fill="${cache.color}" stroke="white" stroke-width="5"/>`; 
                        
                        svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}">${innerPath}</svg>`;
                    }
                }

                let trailHTML = '';
                let noteLen = n.len || n.dur || 0;
                
                if (n.type === 'hold' && noteLen > 0) { 
                    let opacityVal = ((window.cfg.noteOp||100)/100) * 0.6;
                    // 🚨 FIX 5PX: Trail matemáticamente centrado con translateX
                    let tStyle = `position: absolute; left: 50%; transform: translateX(-50%); width: 28%; z-index: 1; opacity: ${opacityVal}; background: ${cache.color}; box-shadow: 0 0 15px ${cache.color}; border-radius: 12px; will-change: transform, height;`;
                    
                    if (window.cfg.down) { tStyle += ` bottom: 50%; transform-origin: bottom center;`; } 
                    else { tStyle += ` top: 50%; transform-origin: top center;`; } 
                    trailHTML = `<div class="sustain-trail" style="${tStyle}"></div>`; 
                }
                
                el.innerHTML = trailHTML + svgHTML; 
                if (actualTrack) actualTrack.appendChild(el); 
                
                n.el = el;
                if (n.type === 'hold') n.trailEl = el.querySelector('.sustain-trail');
                
                n.h = false; n.missed = false; n.broken = false; n.finished = false;
            }
            n.s = true; window.st.spawned.push(n);
        } else break; 
    }

    // === MOVEMENT LOOP ===
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        
        if (n.type === 'fx_flash') {
            if (now >= n.t && !n.h) {
                const bg = document.getElementById('game-layer');
                if(bg) { bg.style.animation = 'flashEffect 0.5s ease-out'; setTimeout(()=> bg.style.animation = '', 500); }
                n.h = true; window.st.spawned.splice(i, 1);
            } continue;
        }
        if (n.type === 'custom_fx') {
            if (now >= n.t && !n.h) { n.h = true; window.st.spawned.splice(i, 1); }
            continue;
        }

        let diff = n.t - now;
        let noteLen = n.len || n.dur || 0;
        const spd = parseFloat(window.cfg.spd) || 25;
        let targetY = window.cfg.down ? (window.innerHeight - 140) : 80;
        let y = window.cfg.down ? (targetY - (diff * (spd / 20))) : (targetY + (diff * (spd / 20)));

        if (n.el) {
            let baseScale = window.cfg.down ? 0.5 : 1;
            let scaleProg = window.cfg.down ? (y / targetY) : (1 - (y / window.innerHeight));
            let scale = (window.cfg.fov && window.cfg.fov > 0) ? Math.max(0, baseScale + (scaleProg * 0.5)) : 1;

            if (n.type === 'hold') {
                if (n.h && !n.broken) {
                    // 🚨 GPU TRANSLATE 3D: Fuerza Hardware Acceleration
                    n.el.style.transform = `translate3d(0px, ${targetY}px, 0px) scale(${scale})`;
                    let holdProg = (now - n.t) / noteLen;
                    if (holdProg < 0) holdProg = 0; if (holdProg > 1) holdProg = 1;
                    
                    if (n.trailEl) n.trailEl.style.transform = `translateX(-50%) scaleY(${1 - holdProg})`;
                    
                    // La nota se completó exitosamente por tiempo
                    if (now >= n.t + noteLen) {
                        window.finishHold(n);
                        window.st.spawned.splice(i, 1);
                        continue;
                    }
                } else {
                    n.el.style.transform = `translate3d(0px, ${y}px, 0px) scale(${scale})`;
                    if (n.trailEl) n.trailEl.style.height = (noteLen * (spd / 20)) + 'px';
                }
            } else {
                n.el.style.transform = `translate3d(0px, ${y}px, 0px) scale(${scale})`;
            }
        }

        if (!n.h && diff < -120) {
            n.missed = true; n.h = true;
            if(n.type !== 'mine' && n.type !== 'dodge') {
                if(n.type === 'hold') {
                    window.breakHold(n);
                } else {
                    miss(n);
                }
                if(n.el) n.el.style.opacity = '0.3';
            } else {
                if(n.el) n.el.remove();
            }
        }

        if (n.type !== 'hold' && n.h && (diff < -200 || n.missed)) {
            if(n.el) n.el.remove();
            window.st.spawned.splice(i, 1);
        } else if (n.type === 'hold' && (n.broken || n.finished)) {
            if (now > n.t + noteLen + 200) {
                if(n.el) n.el.remove();
                window.st.spawned.splice(i, 1);
            }
        }
    }

    if (window.st.hp <= 0 && window.st.songDuration > 0) {
        if(typeof end === 'function') end(true); 
        return;
    }

    if (window.st.notes.length > 0 && window.st.notes.every(n => n.s) && window.st.spawned.length === 0) {
        let extraWait = (window.isMultiplayer) ? 2000 : 1000;
        setTimeout(() => { if(typeof end === 'function') end(false); }, extraWait); 
        return;
    } else if (window.st.songDuration > 0 && now > (window.st.songDuration * 1000) + 2000) {
        if(typeof end === 'function') end(false); 
        return;
    }

    gameLoopId = requestAnimationFrame(loop);
}

// ==========================================
// 5. VISUALS & JUEZ
// ==========================================
function createSplash(l, isBad = false) {
    if(!window.cfg.showSplash && !isBad) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    
    // Fallback a color base si falla la propiedad custom
    const baseColor = (window.cfg.modes && window.cfg.modes[window.keys] && window.cfg.modes[window.keys][l]) ? window.cfg.modes[window.keys][l].c : '#00ffff';
    const color = isBad ? "#F9393F" : (r.style.getPropertyValue('--col') || baseColor);
    
    const s = document.createElement('div');
    s.className = 'splash-oppa'; 
    s.style.setProperty('--c', color);
    
    const rect = r.getBoundingClientRect();
    s.style.left = (rect.left + rect.width/2) + 'px';
    s.style.top = (rect.top + rect.height/2) + 'px';
    s.style.position = 'fixed';
    
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 400);
}

function showJudge(text, color, diffMs) {
    if(!window.cfg.judgeVis) return;
    
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = 'var(--judge-x, 50%)';
    container.style.top = 'var(--judge-y, 40%)';
    container.style.transform = 'translate(-50%, -50%) scale(var(--judge-scale, 1))';
    container.style.zIndex = '500';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const j = document.createElement('div');
    j.innerText = text; 
    j.style.color = color;
    j.style.fontSize = '3rem';
    j.style.fontWeight = '900';
    j.style.textShadow = `0 0 10px ${color}`;
    j.style.animation = 'judgePop 0.35s ease-out forwards';
    
    if(!document.getElementById('style-judge')) {
        const st = document.createElement('style');
        st.id = 'style-judge';
        st.innerHTML = `@keyframes judgePop { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
                        @keyframes cameraShake { 0% {transform: translate(0)} 25% {transform: translate(-10px, 10px)} 50% {transform: translate(10px, -10px)} 75% {transform: translate(-10px, -10px)} 100% {transform: translate(0)} }`;
        document.head.appendChild(st);
    }
    
    container.appendChild(j);

    if (text !== "MISS" && text !== "OUCH!" && text !== "FAIL" && typeof diffMs === 'number' && window.cfg.showMs) {
        const msDiv = document.createElement('div');
        const sign = diffMs > 0 ? "+" : "";
        msDiv.innerText = `${sign}${Math.round(diffMs)}ms`;
        msDiv.style.fontSize = '1.2rem';
        msDiv.style.fontWeight = 'bold';
        msDiv.style.marginTop = '5px';
        msDiv.style.color = (diffMs > 0) ? "#ffaa00" : "#00aaff"; 
        msDiv.style.animation = 'judgePop 0.35s ease-out forwards';
        container.appendChild(msDiv);
    }

    document.body.appendChild(container); 
    setTimeout(() => container.remove(), 600);
}

// ==========================================
// 6. EVENTOS Y COLISIONES DE MECÁNICAS
// ==========================================

// 🚨 LÓGICA OSU!MANIA PARA HOLD NOTES (EVALUACIÓN RETRASADA) 🚨
window.finishHold = function(n) {
    if (n.finished || n.broken) return;
    n.finished = true;
    if (n.el) n.el.remove();
    
    let absDiff = n.pressDiff || 0;
    let score = 50, text = "BAD", color = "yellow";
    
    // Bono extra por hacer el hold completo
    if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350 + 200; window.st.stats.s++; createSplash(n.l); }
    else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200 + 100; window.st.stats.g++; createSplash(n.l); if(window.st.fcStatus==="PFC") window.st.fcStatus="GFC"; }
    else { window.st.stats.b++; window.st.hp-=2; if(window.st.fcStatus!=="CLEAR") window.st.fcStatus="FC"; }
    
    window.st.sc += score; 
    window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
    window.st.hp = Math.min(100, window.st.hp+5); 
    
    showJudge(text, color, null); 
    playHit(); 
    updHUD();
};

window.breakHold = function(n) {
    if (n.broken || n.finished) return;
    n.broken = true;
    window.st.cmb = 0;
    window.st.fcStatus = "CLEAR";
    window.st.stats.m++;
    window.st.hp -= 5;
    showJudge("MISS", "#F9393F", null);
    updHUD();
    if(n.el) n.el.style.opacity = '0.3';
};

function hit(l, p) {
    if (!window.st.act || window.st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    if (p) {
        if(!window.st.keys) window.st.keys = []; 
        if(window.st.keys[l]) return; 
        window.st.keys[l] = 1; 
        if(r) r.classList.add('pressed');
        
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = n.t - now; const absDiff = Math.abs(diff); window.st.totalOffset += absDiff; window.st.hitCount++;
            
            if (n.type === 'mine') { 
                n.h = true; window.st.hp -= 15; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; createSplash(l, true); 
                document.getElementById('game-layer').style.animation = 'cameraShake 0.3s'; 
                setTimeout(()=>document.getElementById('game-layer').style.animation = '', 300); 
            } 
            else if (n.type === 'dodge') { 
                n.h = true; window.st.hp -= 10; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; createSplash(l, true); 
            } 
            else if (n.type === 'hold') {
                n.h = true;
                n.pressDiff = absDiff; // SILENCIO: Guarda precisión, no da puntos todavía.
                createSplash(l); 
            }
            else {
                n.h = true;
                let score=50, text="BAD", color="yellow";
                if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
                else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); if(window.st.fcStatus === "PFC") window.st.fcStatus = "GFC"; }
                else { window.st.stats.b++; window.st.hp-=2; if(window.st.fcStatus === "PFC" || window.st.fcStatus === "GFC") window.st.fcStatus = "FC"; }
                window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
                window.st.sc += score; window.st.hp = Math.min(100, window.st.hp+2);
                
                showJudge(text, color, diff); 
                playHit(); 
                updHUD(); 
            }

            if(window.cfg.bgEffects && n.type !== 'hold' && n.type !== 'mine' && n.type !== 'dodge') { 
                const bg = document.getElementById('game-bg-img'); 
                if(bg) { 
                    bg.classList.remove('bg-bump-1', 'bg-bump-2', 'bg-bump-3'); void bg.offsetWidth; 
                    const randomBump = 'bg-bump-' + (Math.floor(Math.random() * 3) + 1); bg.classList.add(randomBump); 
                    setTimeout(() => bg.classList.remove(randomBump), 120); 
                } 
            }
        }
    } else { 
        if(window.st.keys) window.st.keys[l] = 0; 
        if(r) r.classList.remove('pressed'); 
        
        // EVALUADOR OSU!MANIA AL SOLTAR LA TECLA
        const hn = window.st.spawned.find(x => x.l === l && x.type === 'hold' && x.h && !x.finished && !x.broken);
        if (hn) {
            let noteLen = hn.len || hn.dur || 0;
            let rem = (hn.t + noteLen) - now;
            
            // Margen de perdón de 150ms para soltar
            if (rem > 150) {
                window.breakHold(hn);
            } else {
                window.finishHold(hn);
            }
        }
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++; window.st.cmb = 0; window.st.hp -= 10; window.st.fcStatus = "CLEAR"; 
    playMiss(); updHUD();
    
    if (window.st.hp <= 0) {
        window.st.hp = 0;
        if (!window.isMultiplayer) end(true); 
    }
}

window.onKd = function(e) {
    if (!window.st.act) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); window.togglePause(); return; }
    if (window.st.paused) return; 
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.repeat) return; 
    
    let k1 = String(e.key).toLowerCase().replace('key', '').replace('digit', '');
    let k2 = String(e.code).toLowerCase().replace('key', '').replace('digit', '');
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[window.keys]) {
        for (let i = 0; i < window.keys; i++) {
            let cfgKey = String(window.cfg.modes[window.keys][i].k).toLowerCase().replace('key', '').replace('digit', '');
            if (cfgKey === "space") cfgKey = " ";
            if (k1 === "space" || k2 === "space") { k1 = " "; k2 = " "; }
            
            if (cfgKey === k1 || cfgKey === k2) {
                e.preventDefault(); hit(i, true); return;
            }
        }
    }
};

window.onKu = function(e) {
    if (!window.st.act) return;
    
    let k1 = String(e.key).toLowerCase().replace('key', '').replace('digit', '');
    let k2 = String(e.code).toLowerCase().replace('key', '').replace('digit', '');
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[window.keys]) {
        for (let i = 0; i < window.keys; i++) {
            let cfgKey = String(window.cfg.modes[window.keys][i].k).toLowerCase().replace('key', '').replace('digit', '');
            if (cfgKey === "space") cfgKey = " ";
            if (k1 === "space" || k2 === "space") { k1 = " "; k2 = " "; }
            
            if (cfgKey === k1 || cfgKey === k2) {
                hit(i, false); return;
            }
        }
    }
};

window.togglePause = function() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    let modal = document.getElementById('modal-pause');
    
    let vign = document.getElementById('near-death-vignette');
    if(vign) vign.classList.remove('danger-active');

    if(window.st.paused) {
        window.st.pauseTime = performance.now();
        if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
        
        if(modal) {
            modal.style.cssText = 'display: flex !important; z-index: 9999999 !important; background: rgba(0,0,0,0.85);';
            const panel = modal.querySelector('.modal-panel');
            if(panel) {
                const accEl = document.getElementById('g-acc'); 
                const currentAcc = accEl ? accEl.innerText : "100%";
                panel.innerHTML = `
                    <div class="modal-neon-header">
                        <h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2>
                    </div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">
                            ACCURACY<br><span id="p-acc" style="color:white; font-size:4.5rem;">${currentAcc}</span>
                        </div>
                        <div class="res-stats-grid">
                            <div class="res-stat-box" style="color:var(--sick)">SICK<br><span style="color:white">${window.st.stats.s}</span></div>
                            <div class="res-stat-box" style="color:var(--good)">GOOD<br><span style="color:white">${window.st.stats.g}</span></div>
                            <div class="res-stat-box" style="color:var(--bad)">BAD<br><span style="color:white">${window.st.stats.b}</span></div>
                            <div class="res-stat-box" style="color:var(--miss)">MISS<br><span style="color:white">${window.st.stats.m}</span></div>
                        </div>
                    </div>
                    <div class="modal-neon-buttons">
                        <button class="action" onclick="resumeGame()">▶️ CONTINUAR</button>
                        <button class="action secondary" onclick="restartSong()">🔄 REINTENTAR</button>
                        <button class="action secondary" onclick="toMenu()" style="border-color:#F9393F; color:#F9393F;">🚪 SALIR</button>
                    </div>
                `;
            }
        }
    } else { 
        resumeGame(); 
    }
};

window.resumeGame = function() {
    const modal = document.getElementById('modal-pause');
    if(modal) modal.style.setProperty('display', 'none', 'important');
    window.st.paused = false;
    if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
};

window.removeEventListener('keydown', window.onKd, { capture: true });
window.removeEventListener('keyup', window.onKu, { capture: true });
window.addEventListener('keydown', window.onKd, { capture: true });
window.addEventListener('keyup', window.onKu, { capture: true });


// ==========================================
// 7. HUD Y RETORNO AL EDITOR
// ==========================================
function updHUD() {
    const scEl = document.getElementById('g-score'); if(scEl) scEl.innerText = window.st.sc.toLocaleString();
    const cEl = document.getElementById('g-combo'); if(cEl) { if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } else cEl.style.opacity=0; }
    
    const hBar = document.getElementById('health-fill');
    if(hBar) hBar.style.height = window.st.hp + "%"; 

    const hpCapsule = document.getElementById('engine-hp-fill');
    if(hpCapsule) {
        hpCapsule.style.width = Math.max(0, window.st.hp) + "%";
        hpCapsule.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)';
    }

    const maxPlayed = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const playedScore = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    const acc = maxPlayed > 0 ? ((playedScore / maxPlayed)*100).toFixed(1) : "100.0";
    document.getElementById('g-acc').innerText = acc + "%";
    
    const fcEl = document.getElementById('hud-fc'); if(fcEl) { fcEl.innerText = window.st.fcStatus || "GFC"; fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red"))); }
    const hSick = document.getElementById('h-sick'); if(hSick) hSick.innerText = window.st.stats.s;
    const hGood = document.getElementById('h-good'); if(hGood) hGood.innerText = window.st.stats.g;
    const hBad = document.getElementById('h-bad'); if(hBad) hBad.innerText = window.st.stats.b;
    const hMiss = document.getElementById('h-miss'); if(hMiss) hMiss.innerText = window.st.stats.m;
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);

    let vign = document.getElementById('near-death-vignette');
    if(!vign) { 
        vign = document.createElement('div'); vign.id = 'near-death-vignette';
        document.getElementById('game-layer').insertBefore(vign, document.getElementById('top-progress-bar'));
    }
    if (window.st.hp < 20) vign.classList.add('danger-active'); else vign.classList.remove('danger-active');
}

function end(died) {
    window.st.act = false; 
    cancelAnimationFrame(gameLoopId); 
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    
    let vign = document.getElementById('near-death-vignette'); 
    if(vign) vign.classList.remove('danger-active');
    
    let touchZones = document.getElementById('mobile-touch-zones'); 
    if(touchZones) touchZones.style.display = 'none';               
    
    if(window.isMultiplayer) return; 

    if (window.isTestingMap && typeof window.openEditor === 'function' && window.curSongData) {
        document.getElementById('game-layer').style.display = 'none'; 
        window.isTestingMap = false; 
        window.openEditor(window.curSongData, window.keys, window.curSongData.originalMode || 'mania'); 
        return;
    }

    document.getElementById('game-layer').style.display = 'none';
    const modal = document.getElementById('modal-res');
    
    if(modal) {
        modal.style.display = 'flex';
        const totalMax = window.st.trueMaxScore || 1; 
        const finalAcc = Math.round((window.st.sc / totalMax) * 1000) / 10;
        let r="D", c="#F9393F", titleHTML="";
        
        if (!died) { 
            if (finalAcc >= 98) { r="SS"; c="#00FFFF"; } 
            else if (finalAcc >= 95) { r="S"; c="var(--gold)"; } 
            else if (finalAcc >= 90) { r="A"; c="#12FA05"; } 
            else if (finalAcc >= 80) { r="B"; c="yellow"; } 
            else if (finalAcc >= 70) { r="C"; c="orange"; } 
            titleHTML = `<div id="winner-msg">¡CANCION COMPLETADA!</div>`; 
        } else { 
            r="F"; c="#F9393F"; 
            titleHTML = `<div id="loser-msg">💀 JUEGO TERMINADO</div>`; 
        }
        
        let xpGain = 0, spGain = 0, ppGain = 0; 
        let chk = document.getElementById('chk-ranked'); 
        let isRanked = chk ? chk.checked : false; 
        let rankText = isRanked ? "(Ranked)" : "(Unranked)";
        
        if (!died && window.user && window.user.name !== "Guest") { 
            xpGain = Math.floor(window.st.sc / 250); 
            spGain = Math.floor(window.st.sc / 100); 
            if (isRanked && finalAcc >= 70) { 
                let stars = parseFloat(window.curSongData.starRating || 3); 
                ppGain = Math.floor((stars * 20) * (finalAcc / 100)); 
            }
            
            window.user.xp = (window.user.xp || 0) + xpGain; 
            window.user.sp = (window.user.sp || 0) + spGain; 
            window.user.pp = (window.user.pp || 0) + ppGain; 
            window.user.plays = (window.user.plays || 0) + 1; 
            window.user.score = (window.user.score || 0) + window.st.sc;
            
            let nextLevelXp = window.user.lvl * 1000; 
            if (window.user.xp >= nextLevelXp) { 
                window.user.lvl++; 
                window.user.xp -= nextLevelXp; 
                if(typeof window.notify === 'function') window.notify(`✨ ¡NIVEL ${window.user.lvl} ALCANZADO! ✨`, "success"); 
            }

            if (!window.user.scores) window.user.scores = {};
            let currentBest = window.user.scores[window.curSongData.id];
            let oldScore = currentBest ? currentBest.score : 0;
            
            if (window.st.sc > oldScore) {
                window.user.scores[window.curSongData.id] = { grade: r, score: window.st.sc };
            }

            if(typeof save === 'function') save(); 
            if (window.db) { 
                window.db.collection("users").doc(window.user.name).update({ 
                    xp: window.user.xp, sp: window.user.sp, pp: window.user.pp, 
                    lvl: window.user.lvl, plays: window.user.plays, score: window.user.score,
                    scores: window.user.scores 
                }).catch(e => console.warn(e)); 
            }
        }

        modal.querySelector('.modal-panel').innerHTML = `
            <div class="modal-neon-header" style="border-bottom-color: var(--gold);">
                <h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS</h2>
            </div>
            <div class="modal-neon-content">
                ${titleHTML}
                <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin-bottom: 25px;">
                    <div class="rank-big" style="color:${c}; text-shadow:0 0 20px ${c};">${r}</div>
                    <div style="text-align:left;">
                        <div id="res-score">${window.st.sc.toLocaleString()}</div>
                        <div style="color:#aaa; font-size:1.5rem; font-weight:900;">ACC: <span style="color:white">${finalAcc}%</span></div>
                        <div id="pp-gain-loss" style="color:var(--gold); font-weight:bold; font-size:1.1rem; margin-top:5px;">+${ppGain} PP <span style="font-weight:normal; color:#888;">${rankText}</span></div>
                    </div>
                </div>
                <div class="res-stats-grid">
                    <div class="res-stat-box" style="color:var(--sick)">SICK<br><span style="color:white">${window.st.stats.s}</span></div>
                    <div class="res-stat-box" style="color:var(--good)">GOOD<br><span style="color:white">${window.st.stats.g}</span></div>
                    <div class="res-stat-box" style="color:var(--bad)">BAD<br><span style="color:white">${window.st.stats.b}</span></div>
                    <div class="res-stat-box" style="color:var(--miss)">MISS<br><span style="color:white">${window.st.stats.m}</span></div>
                </div>
                <div style="display:flex; justify-content:space-around; background:#111; padding:15px; border-radius:10px; border:1px solid #333; margin-bottom:20px; font-weight:bold;">
                    <div style="color:var(--blue); font-size:1.3rem;">💙 +<span id="res-xp">${xpGain}</span> XP</div>
                    <div style="color:var(--gold); font-size:1.3rem;">💰 +<span id="res-sp">${spGain}</span> SP</div>
                </div>
            </div>
            <div class="modal-neon-buttons">
                <button class="action" onclick="window.toMenu()">VOLVER AL MENU</button>
            </div>
        `;
    }
}

window.restartSong = function() { prepareAndPlaySong(window.keys); };

window.toMenu = function() {
    if(window.st.src) {
        try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){}
        window.st.src = null;
    }
    if(window.st.ctx) window.st.ctx.suspend();
    window.st.act = false; window.st.paused = false;
    cancelAnimationFrame(gameLoopId); 
    
    document.getElementById('game-layer').style.display = 'none';
    
    const resM = document.getElementById('modal-res');
    if(resM) resM.style.display = 'none';
    const pauseM = document.getElementById('modal-pause');
    if(pauseM) pauseM.style.setProperty('display', 'none', 'important');

    if (window.isTestingMap && typeof window.openEditor === 'function' && window.curSongData) {
        window.isTestingMap = false; 
        window.openEditor(window.curSongData, window.keys, window.curSongData.originalMode || 'mania');
    } else {
        document.getElementById('menu-container').classList.remove('hidden');
    }
};

window.initMobileTouchControls = function(keyCount) {
    let oldContainer = document.getElementById('mobile-touch-zones'); if (oldContainer) oldContainer.remove(); 
    if (window.innerWidth > 800 && !('ontouchstart' in window)) return;

    const touchContainer = document.createElement('div');
    touchContainer.id = 'mobile-touch-zones';
    touchContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 800; display: flex; flex-direction: row; touch-action: none; pointer-events: auto;';
    document.body.appendChild(touchContainer); 

    let currentKeys = [];
    if (window.cfg && window.cfg.modes && window.cfg.modes[keyCount]) {
        for(let i=0; i<keyCount; i++) currentKeys.push(window.cfg.modes[keyCount][i].k.toLowerCase());
    } else {
        currentKeys = keyCount === 6 ? ['s','d','f','j','k','l'] : ['d','f','j','k'];
    }

    for (let i = 0; i < keyCount; i++) {
        const zone = document.createElement('div');
        zone.style.flex = '1'; zone.style.height = '100%';
        zone.style.borderRight = '1px solid rgba(255,255,255,0.05)';
        touchContainer.appendChild(zone);
    }

    let activeTouches = {}; 

    function getLane(x) {
        return Math.max(0, Math.min(Math.floor((x / window.innerWidth) * keyCount), keyCount - 1));
    }

    function handleTouchMove(e) {
        e.preventDefault();
        for(let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let newLane = getLane(t.clientX);
            
            if(activeTouches[t.identifier] !== undefined && activeTouches[t.identifier] !== newLane) {
                let oldLane = activeTouches[t.identifier];
                if(typeof window.onKu === 'function') window.onKu({ key: currentKeys[oldLane], preventDefault: ()=>{} });
                if(touchContainer.children[oldLane]) touchContainer.children[oldLane].style.background = 'transparent';
            }
            if(activeTouches[t.identifier] !== newLane) {
                activeTouches[t.identifier] = newLane;
                touchContainer.children[newLane].style.background = 'rgba(255,255,255,0.1)';
                if(typeof window.onKd === 'function') window.onKd({ key: currentKeys[newLane], preventDefault: ()=>{} });
            }
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        for(let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let oldLane = activeTouches[t.identifier];
            if(oldLane !== undefined) {
                if(typeof window.onKu === 'function') window.onKu({ key: currentKeys[oldLane], preventDefault: ()=>{} });
                if(touchContainer.children[oldLane]) touchContainer.children[oldLane].style.background = 'transparent';
                delete activeTouches[t.identifier];
            }
        }
    }

    touchContainer.addEventListener('touchstart', handleTouchMove, { passive: false });
    touchContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });
};
