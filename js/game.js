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
    if(window.currentLobbyId) window.isMultiplayer = true;
    if (!window.curSongData) { if(!window.isMultiplayer) alert("Error: No hay canción"); return; }
    
    // Interceptor de Osu!
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

        if (rawData[mapKey] && rawData[mapKey].length > 0) { 
            map = JSON.parse(JSON.stringify(rawData[mapKey])); 
            isCharted = true;
        } 
        else if (rawData.notes && rawData.notes.length > 0) { 
            map = JSON.parse(JSON.stringify(rawData.notes)); 
            isCharted = true;
        }

        if (isCharted) {
            // FIX 1 y 2: Sincronizar temporizador (3000ms) y reparar las notas largas sanadoras (dur -> len)
            map.forEach(n => {
                n.t += 3000; // Sincroniza la nota con el temporizador 3-2-1
                if (n.dur !== undefined) {
                    n.len = n.dur; // Traduce el lenguaje del Editor al lenguaje del Motor
                }
            });
            map.sort((a, b) => a.t - b.t); 
        } 
        else {
            // FIX 3: Diferenciar canciones del Studio vs Canciones por defecto
            if (rawData.uploader) {
                // Es una canción subida por un usuario, NO usar automapeo
                if(loader) loader.style.display = 'none';
                let ask = confirm("⚠️ Esta canción fue subida desde el Studio y aún no tiene notas mapeadas.\n\n¿Deseas abrir el Editor para chartearla ahora?");
                
                if (ask && typeof window.openEditor === 'function') {
                    window.openEditor(window.curSongData, k, 'mania');
                } else {
                    document.getElementById('menu-container').classList.remove('hidden');
                }
                return; // Frenar ejecución
            } else {
                // Es una canción estándar del sistema, podemos usar Auto-Mapeo
                map = genMap(buffer, k); 
                map.sort((a, b) => a.t - b.t);
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
    if(!s) return;
    initMobileTouchControls(window.keys || 4);
    window.st.act = true; window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = []; 
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50; window.st.maxCmb = 0; 
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.hitCount = 0; window.st.totalOffset = 0; 
    
    window.st.fcStatus = "PFC"; 
    window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => { window.st.trueMaxScore += 350; if(n.type === 'hold') window.st.trueMaxScore += 200; });

    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    
    const oldIg = document.getElementById('ig-profile');
    if (oldIg) oldIg.style.display = 'none'; 

    let capsuleUI = document.getElementById('capsule-ui');
    if(!capsuleUI) {
        capsuleUI = document.createElement('div');
        capsuleUI.id = 'capsule-ui';
        capsuleUI.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;';
        document.getElementById('game-layer').appendChild(capsuleUI);
    }

    const avUrl = (window.user && window.user.avatarData) ? window.user.avatarData : 'icon.png';
    const uName = window.user ? window.user.name : 'Guest';
    const uLvl = window.user ? window.user.lvl : 1;

    capsuleUI.innerHTML = `
        <div style="position:fixed; top:20px; left:20px; background:rgba(10,10,14,0.95); padding:6px 20px 6px 6px; border-radius:50px; border:1px solid var(--accent); display:flex; align-items:center; gap:12px; box-shadow:0 0 20px rgba(255,0,85,0.3); z-index:9500; pointer-events:auto; backdrop-filter:blur(8px);">
            <div style="width:45px; height:45px; border-radius:50%; background:url('${avUrl}') center/cover; border:2px solid white; box-shadow: 0 0 10px rgba(255,255,255,0.5);"></div>
            <div style="display:flex; flex-direction:column; justify-content:center; padding-right:10px;">
                <div style="color:white; font-weight:900; font-size:1rem; text-transform:uppercase; letter-spacing:1px; line-height:1;">${uName}</div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                    <div style="color:var(--gold); font-weight:900; font-size:0.7rem;">LVL ${uLvl}</div>
                    <div style="width:100px; height:8px; background:#111; border-radius:4px; overflow:hidden; border:1px solid #333; box-shadow:inset 0 0 5px black;">
                        <div id="engine-hp-fill" style="width:100%; height:100%; background:var(--good); transition:0.2s; box-shadow:0 0 10px var(--good);"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const uiToClose = ['modal-res', 'modal-pause', 'modal-lobbies', 'modal-lobby-room', 'modal-song-selector', 'modal-diff', 'loading-overlay'];
    uiToClose.forEach(id => { const m = document.getElementById(id); if(m) m.style.display = 'none'; });

    if(!document.getElementById('game-bg-container')) {
        const bgCont = document.createElement('div');
        bgCont.id = "game-bg-container";
        bgCont.innerHTML = `<div id="game-bg-img"></div>`;
        document.getElementById('game-layer').insertBefore(bgCont, document.getElementById('track'));
        
        const subCont = document.createElement('div');
        subCont.id = "subtitles-container";
        subCont.innerHTML = `<div id="subtitles-text"></div>`;
        document.getElementById('game-layer').appendChild(subCont);
    }
    
    const bgC = document.getElementById('game-bg-container');
    const subC = document.getElementById('subtitles-container');
    
    if (window.cfg.bgEffects || window.cfg.subtitles) {
        bgC.style.display = 'block';
        document.getElementById('game-bg-img').style.backgroundImage = window.curSongData.imageURL ? `url(${window.curSongData.imageURL})` : 'none';
    } else {
        bgC.style.display = 'none';
    }

    if (window.cfg.subtitles) {
        window.st.parsedLyrics = [];
        window.st.currentLyricIdx = 0;
        subC.style.display = 'block';
        document.getElementById('subtitles-text').innerText = "🎵"; 
        
        if (window.curSongData.lyrics) {
            const lines = window.curSongData.lyrics.split('\n');
            lines.forEach(l => {
                const match = l.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/);
                if(match) {
                    const tMs = (parseInt(match[1])*60 + parseFloat(match[2])) * 1000;
                    window.st.parsedLyrics.push({ t: tMs, tx: match[3].trim() });
                }
            });
            window.st.parsedLyrics.sort((a,b) => a.t - b.t);
        }
    } else {
        subC.style.display = 'none';
    }

    initReceptors(window.keys);
    updHUD(); 

    const cd = document.getElementById('countdown');
    if(cd) { cd.style.display = 'flex'; cd.innerText = "3"; }
    
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = s.buf;
    const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);
    
    window.st.src.onended = () => { if(window.st.act) end(false); };
    
    const now = window.st.ctx.currentTime;
    window.st.t0 = now;
    const AUDIO_DELAY = 3; 
    
    window.st.src.start(now + AUDIO_DELAY);
    gameLoopId = requestAnimationFrame(loop);

    let count = 3;
    const iv = setInterval(() => {
        count--;
        if(cd) {
            if (count > 0) cd.innerText = count;
            else { clearInterval(iv); cd.innerText = "GO!"; setTimeout(() => { cd.style.display = 'none'; }, 500); }
        } else { clearInterval(iv); }
    }, 1000);
}

// ==========================================
// 4. EL LOOP ULTRA-OPTIMIZADO 
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) { gameLoopId = requestAnimationFrame(loop); return; }
    
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    let songTime = now - 3000; 
    
    if (window.st.songDuration > 0 && songTime > 0) {
        let currentSec = songTime / 1000; let totalSec = window.st.songDuration; if (currentSec > totalSec) currentSec = totalSec;
        const pct = Math.min(100, (currentSec / totalSec) * 100);
        const bar = document.getElementById('top-progress-fill'); if(bar) bar.style.width = pct + "%";
        let curM = Math.floor(currentSec / 60); let curS = Math.floor(currentSec % 60).toString().padStart(2, '0');
        let totM = Math.floor(totalSec / 60); let totS = Math.floor(totalSec % 60).toString().padStart(2, '0');
        const timeText = document.getElementById('top-progress-time'); if (timeText) timeText.innerText = `${curM}:${curS} / ${totM}:${totS}`;
    }

    if (window.cfg.subtitles && window.st.parsedLyrics && window.st.parsedLyrics.length > 0) {
        let idx = window.st.currentLyricIdx;
        if (idx < window.st.parsedLyrics.length && songTime >= window.st.parsedLyrics[idx].t) {
            const subEl = document.getElementById('subtitles-text'); subEl.innerText = window.st.parsedLyrics[idx].tx;
            subEl.style.animation = 'none'; void subEl.offsetWidth; subEl.style.animation = 'subPop 0.2s ease-out forwards';
            window.st.currentLyricIdx++;
        }
    }

    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (!n.fxTriggered && n.t <= now) {
            if (n.type === 'fx_flash') { document.getElementById('game-layer').style.background = 'white'; setTimeout(() => document.getElementById('game-layer').style.background = 'transparent', 150); }
            if (n.type === 'custom_fx' && n.customData) {
                const track = document.getElementById('track'); const oldFilter = track.style.filter; track.style.filter = n.customData.filter; track.style.transition = 'filter 0.2s';
                setTimeout(() => { track.style.filter = oldFilter; }, n.customData.dur);
            }
            n.fxTriggered = true; 
        }
    }

    const w = 100 / window.keys; const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;
    
    let activeSkin = null; 
    if (window.cfg.noteSkin && window.cfg.noteSkin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.cfg.noteSkin);
    }

    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; 
        if (n.type === 'fx_flash' || n.type === 'custom_fx') { n.s = true; window.st.spawned.push(n); continue; }

        // 🚨 FIX: 4000ms de anticipación para que bajen desde afuera de la pantalla
        if (n.t - now < 4000) { 
            if (n.t - now > -200) { 
                const el = document.createElement('div');
                const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
                el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
                
                // 🚨 FIX CSS: Centrado absoluto de la nota para que el trail no la mueva
                el.style.cssText = `left: ${n.l * w}%; width: ${w}%; top: 0px; display: flex; justify-content: center; align-items: center; position: absolute;`; 
                
                let conf = window.cfg.modes[window.keys][n.l]; let color = conf.c; let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";
                
                let isImageSkin = false;
                if (activeSkin) { 
                    if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape]; 
                    if (activeSkin.fixed) color = activeSkin.color; 
                    if (activeSkin.img) isImageSkin = true;
                }

                let svg = '';
                if (n.type === 'mine') {
                    svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 15px #F9393F); position:relative; z-index:2; width:100%;"><circle cx="50" cy="50" r="35" fill="#111" stroke="#F9393F" stroke-width="5"/><path d="M 50 15 L 50 0 M 50 85 L 50 100 M 15 50 L 0 50 M 85 50 L 100 50 M 25 25 L 15 15 M 75 75 L 85 85 M 25 75 L 15 85 M 75 25 L 85 15" stroke="#F9393F" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#F9393F"/></svg>`;
                } else if (n.type === 'dodge') {
                    svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 15px #00ffff); position:relative; z-index:2; width:100%;"><polygon points="50,10 90,85 10,85" fill="rgba(0,255,255,0.2)" stroke="#00ffff" stroke-width="6"/><rect x="45" y="35" width="10" height="25" fill="#00ffff" rx="5"/><circle cx="50" cy="72" r="6" fill="#00ffff"/></svg>`;
                } else {
                    if (isImageSkin) {
                        svg = `<img src="${activeSkin.img}" style="width:100%; filter:drop-shadow(0 0 8px ${color}); object-fit: contain; position:relative; z-index:2;">`;
                    } else {
                        svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${color}); position:relative; z-index:2; width:100%;"><path d="${shapeData}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
                    }
                }
                
                // 🚨 FIX CSS 2: El trail ahora nace por DEBAJO (z-index:-1) y desde el centro de la nota
                let noteLen = n.len || n.dur || 0;
                if (n.type === 'hold' && noteLen > 0) { 
                    const h = (noteLen / 1000) * (window.cfg.spd * 40); 
                    let trailStyle = `height:${h}px; background:${color}; opacity:${(window.cfg.noteOp||100)/100}; position:absolute; width:30%; z-index:-1;`;
                    if (window.cfg.down) { 
                        trailStyle += ` bottom: 50%; transform-origin: bottom center;`; 
                    } else { 
                        trailStyle += ` top: 50%; transform-origin: top center;`; 
                    } 
                    
                    svg += `<div class="sustain-trail" style="${trailStyle}"></div>`; 
                }
                
                el.innerHTML = svg; if(elTrack) elTrack.appendChild(el); n.el = el;
            }
            n.s = true; window.st.spawned.push(n);
        } else break; 
    }

    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        if ((n.type === 'fx_flash' || n.type === 'custom_fx') && n.t < now - 100) { window.st.spawned.splice(i, 1); continue; }
        if (n.h && (n.type === 'tap' || n.type === 'mine' || n.type === 'dodge')) { if(n.el) { n.el.remove(); n.el = null; } window.st.spawned.splice(i, 1); continue; }

        const timeDiff = n.t - now + (window.cfg.off || 0);

        if (!n.h && timeDiff < -160) {
            if (n.type === 'mine') { n.h = true; if(n.el) { n.el.remove(); n.el = null; } window.st.spawned.splice(i, 1); continue; } 
            else if (n.type === 'dodge') { n.h = true; window.st.sc += 100; showJudge("DODGED", "#00ffff", 0); if(n.el) { n.el.remove(); n.el = null; } window.st.spawned.splice(i, 1); continue; } 
            else { miss(n); n.h = true; if(n.el) { n.el.remove(); n.el = null; } window.st.spawned.splice(i, 1); continue; }
        }

        if (n.el) {
            const dist = (timeDiff / 1000) * (window.cfg.spd * 40); 
            let finalY = window.cfg.down ? (yReceptor - dist) : (yReceptor + dist);
            if (n.type !== 'hold' || (n.type === 'hold' && !n.h)) { n.el.style.transform = `translate3d(0px, ${finalY}px, 0px)`; }
            
            if (n.type === 'hold' && n.h) {
                 n.el.style.transform = `translate3d(0px, ${yReceptor}px, 0px)`; 
                 let noteLen = n.len || n.dur || 0;
                 const rem = (n.t + noteLen) - now; 
                 const tr = n.el.querySelector('.sustain-trail');
                 if (tr) tr.style.height = Math.max(0, (rem / 1000) * (window.cfg.spd * 40)) + 'px';
                 
                 if (!window.st.keys[n.l]) { 
                     n.el.style.opacity = 0.4; 
                     if (rem > 100 && !n.broken) { window.st.cmb = 0; n.broken = true; } 
                 } 
                 else { 
                     n.el.style.opacity = 1; 
                     if(!n.broken) window.st.hp = Math.min(100, window.st.hp + 0.1); 
                     updHUD(); 
                 }
                 
                 if (now >= n.t + noteLen) { 
                     if(!n.broken) window.st.sc += 200; 
                     n.el.remove(); n.el = null; 
                     window.st.spawned.splice(i, 1); 
                 }
            }
        }
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
    const color = isBad ? "#F9393F" : (r.style.getPropertyValue('--col') || window.cfg.modes[window.keys][l].c);
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
// === SISTEMA DE INPUT BLINDADO ===
// === SISTEMA DE INPUT BLINDADO ===
// === SISTEMA DE INPUT BLINDADO V4 (ANTI-FANTASMAS) ===
window.onKd = function(e) {
    if (!window.st.act || window.st.paused) return;
    if (e.key === "Escape") { e.preventDefault(); window.togglePause(); return; }
    
    // Ignorar teclas si estás escribiendo en el chat
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.repeat) return; // Evita bugs si dejas la tecla presionada
    
    let pressedKey = (e.code === "Space" || e.key === " ") ? " " : e.key.toLowerCase();
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[window.keys]) {
        for (let i = 0; i < window.keys; i++) {
            let cfgKey = window.cfg.modes[window.keys][i].k;
            if (!cfgKey) continue;
            cfgKey = String(cfgKey).toLowerCase();
            if (cfgKey === "space") cfgKey = " ";
            
            if (cfgKey === pressedKey) {
                e.preventDefault(); // Detiene el scroll de la página
                hit(i, true);
                return;
            }
        }
    }
};

window.onKu = function(e) {
    if (!window.st.act) return;
    let pressedKey = (e.code === "Space" || e.key === " ") ? " " : e.key.toLowerCase();
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[window.keys]) {
        for (let i = 0; i < window.keys; i++) {
            let cfgKey = window.cfg.modes[window.keys][i].k;
            if (!cfgKey) continue;
            cfgKey = String(cfgKey).toLowerCase();
            if (cfgKey === "space") cfgKey = " ";
            
            if (cfgKey === pressedKey) {
                hit(i, false);
                return;
            }
        }
    }
};

// 🚨 FUERZA AL NAVEGADOR A LEER EL TECLADO SIN IMPORTAR NADA MÁS 🚨
window.removeEventListener('keydown', window.onKd, { capture: true });
window.removeEventListener('keyup', window.onKu, { capture: true });
window.addEventListener('keydown', window.onKd, { capture: true });
window.addEventListener('keyup', window.onKu, { capture: true });

function hit(l, p) {
    if (!window.st.act || window.st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    
    if (p) {
        if(!window.st.keys) window.st.keys = []; 
        if(window.st.keys[l]) return; // ANTI-DOBLE INPUT (Evita bugs)
        window.st.keys[l] = 1; 
        if(r) r.classList.add('pressed');
        
        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = n.t - now; const absDiff = Math.abs(diff); window.st.totalOffset += absDiff; window.st.hitCount++;
            let score=50, text="BAD", color="yellow";

            if (n.type === 'mine') { 
                text = "OUCH!"; color = "#F9393F"; score = -200; window.st.hp -= 15; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; 
                createSplash(l, true); document.getElementById('game-layer').style.animation = 'cameraShake 0.3s'; 
                setTimeout(()=>document.getElementById('game-layer').style.animation = '', 300); 
            } 
            else if (n.type === 'dodge') { 
                text = "FAIL"; color = "#F9393F"; score = -100; window.st.hp -= 10; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; 
                createSplash(l, true); 
            } 
            else {
                if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
                else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); if(window.st.fcStatus === "PFC") window.st.fcStatus = "GFC"; }
                else { window.st.stats.b++; window.st.hp-=2; if(window.st.fcStatus === "PFC" || window.st.fcStatus === "GFC") window.st.fcStatus = "FC"; }
                window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            }

            if(window.cfg.bgEffects && (text === "SICK!!" || text === "GOOD")) { 
                const bg = document.getElementById('game-bg-img'); 
                if(bg) { 
                    bg.classList.remove('bg-bump-1', 'bg-bump-2', 'bg-bump-3'); void bg.offsetWidth; 
                    const randomBump = 'bg-bump-' + (Math.floor(Math.random() * 3) + 1); bg.classList.add(randomBump); 
                    setTimeout(() => bg.classList.remove(randomBump), 120); 
                } 
            }
            
            window.st.sc += score; 
            if(n.type !== 'mine' && n.type !== 'dodge') window.st.hp = Math.min(100, window.st.hp+2);
            
            showJudge(text, color, diff); 
            playHit(); 
            updHUD(); 
            n.h = true; 
        }
    } else { 
        if(window.st.keys) window.st.keys[l] = 0; 
        if(r) r.classList.remove('pressed'); 
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

    // RETORNO AL EDITOR
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
        
        // CÁLCULO DE RECOMPENSAS
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
            if(typeof save === 'function') save(); 
            if (window.db) { 
                window.db.collection("users").doc(window.user.name).update({ 
                    xp: window.user.xp, sp: window.user.sp, pp: window.user.pp, 
                    lvl: window.user.lvl, plays: window.user.plays, score: window.user.score 
                }).catch(e => console.warn(e)); 
            }
        }

        const panel = modal.querySelector('.modal-panel');
        if(panel) {
            panel.innerHTML = `
                <div class="modal-neon-header" style="border-bottom-color: ${c};">
                    <h2 class="modal-neon-title" style="color:${c};">🏆 RESULTADOS</h2>
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
                    <button class="action" onclick="toMenu()">VOLVER AL MENU</button>
                    <button class="action secondary" onclick="restartSong()">🔄 REINTENTAR</button>
                </div>`;
        }
    }
}
function initReceptors(k) {
    elTrack = document.getElementById('track'); if(!elTrack) return; elTrack.innerHTML = '';
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0; elTrack.style.transform = `rotateX(${fov}deg)`; document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    const y = window.cfg.down ? window.innerHeight - 140 : 80; 
    
    // --- FIX MAESTRO: LEER SKIN DESDE LA VARIABLE CORRECTA DE AJUSTES ---
    let activeSkin = null; 
    if (window.cfg.noteSkin && window.cfg.noteSkin !== 'default' && typeof SHOP_ITEMS !== 'undefined') { 
        activeSkin = SHOP_ITEMS.find(i => i.id === window.cfg.noteSkin); 
    }
    
    for (let i = 0; i < k; i++) {
        const r = document.createElement('div'); r.className = `arrow-wrapper receptor`; r.id = `rec-${i}`; r.style.left = (i * (100 / k)) + '%'; r.style.top = y + 'px'; r.style.width = (100 / k) + '%';
        let conf = window.cfg.modes[k][i]; let color = conf.c; let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";
        
        let htmlContent = "";
        
        if (activeSkin) { 
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape]; 
            if (activeSkin.fixed) color = activeSkin.color; 
            
            // Si la skin es una imagen en lugar de un SVG
            if (activeSkin.img) {
                htmlContent = `<img src="${activeSkin.img}" style="width:100%; height:100%; filter:drop-shadow(0 0 8px ${color}); object-fit: contain;">`;
            }
        }
        
        r.style.setProperty('--active-c', color); r.style.setProperty('--col', color); 
        
        // Si no es imagen, renderizamos la forma SVG
        if(!htmlContent) {
            htmlContent = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${color})"><path class="arrow-path" d="${shapeData}" stroke="${color}" fill="none" stroke-width="4"/></svg>`;
        }
        
        r.innerHTML = htmlContent;
        elTrack.appendChild(r);
        const l = document.createElement('div'); l.style.position = 'absolute'; l.style.left = (i * (100 / k)) + '%'; l.style.width = (100 / k) + '%'; l.style.height = '100%'; l.style.background = `linear-gradient(to bottom, transparent, ${color}22)`; l.style.borderLeft = '1px solid rgba(255,255,255,0.05)'; l.style.zIndex = '-1'; elTrack.appendChild(l);
    }
}
window.restartSong = function() { prepareAndPlaySong(window.keys); };

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
            modal.style.setProperty('display', 'flex', 'important'); modal.style.setProperty('z-index', '999999', 'important');
            const panel = modal.querySelector('.modal-panel');
            if(panel) {
                const accEl = document.getElementById('g-acc'); const currentAcc = accEl ? accEl.innerText : "100%";
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
    } else { resumeGame(); }
};

window.resumeGame = function() {
    const modal = document.getElementById('modal-pause');
    if(modal) modal.style.setProperty('display', 'none', 'important');
    
    let touchZones = document.getElementById('mobile-touch-zones');
    if(touchZones && window.innerWidth <= 800) touchZones.style.display = 'flex'; 

    if(window.st.pauseTime) {
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration; 
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
};

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

    // 🚨 RETORNO DIRECTO AL EDITOR SI SALIMOS DEL MENÚ DE PAUSA 🚨
    if (window.isTestingMap && typeof window.openEditor === 'function' && window.curSongData) {
        window.isTestingMap = false; // Reiniciamos el flag
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
