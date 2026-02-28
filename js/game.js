/* === AUDIO & ENGINE (ULTRA PERFORMANCE + AUTO-LYRICS + FX CAMERA V18) === */

let elTrack = null;

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
    
    // 1. CURVA MUCHO MÁS AGRESIVA DESDE EL INICIO
    // Nivel 1 = ~250ms (Antes 350ms) | Nivel 10 = ~160ms | Nivel 15 = ~80ms | Nivel 20 = ~50ms
    let minDistMs = Math.max(50, 260 - (Math.pow(density, 1.4) * 4)); 
    
    // 2. MAYOR SENSIBILIDAD PARA LLENAR LOS ESPACIOS VACÍOS
    // El umbral es más bajo, por lo que detectará más golpes secundarios de la pista
    let thresholdMult = Math.max(0.80, 1.40 - (density * 0.04)); 
    
    let lastNoteTime = -1000; 
    let lastLane = Math.floor(k/2); 
    let laneFreeTimes = new Array(k).fill(0);
    
    const energyHistory = [];
    let prevInstant = 0; 

    // MÁQUINA DE PATRONES
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

        // Detección más sensible (0.015 en vez de 0.02 permite detectar sonidos más suaves)
        if(instant > localAvg * thresholdMult && instant > prevInstant && instant > 0.015) {
            const timeMs = (i / sampleRate) * 1000 + START_OFFSET;
            
            if(timeMs - lastNoteTime > minDistMs) {
                let type = 'tap';
                let length = 0;
                let lane = -1;

                // --- PATRONES CON MAYOR FRECUENCIA ---
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
                    // Ahora lanza patrones más seguido (probabilidad > 0.4 en vez de 0.6)
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

                // --- HOLDS ---
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
                
                // --- ACORDES: APARECEN MUCHO MÁS TEMPRANO Y MÁS SEGUIDO ---
                // Ahora empiezan desde nivel 4 en vez de 6
                if (density >= 4 && type === 'tap') {
                    // Probabilidad aumentada drásticamente
                    let chordChance = (density - 2) * 0.08; 
                    
                    // Umbral bajado a 1.35 para que salgan dobles en casi cualquier golpe de batería fuerte
                    if (intensity > 1.35 && Math.random() < chordChance) {
                        let l2 = getSmartLane(lane, k, laneFreeTimes, timeMs);
                        if (l2 !== -1 && l2 !== lane) {
                            map.push({ t: timeMs, l: l2, type: 'tap', len: 0, h: false });
                            laneFreeTimes[l2] = timeMs + 25;

                            // Acordes Triples ahora empiezan desde el nivel 12
                            if (density >= 12 && intensity > 1.8 && k >= 6 && Math.random() < 0.4) {
                                let l3 = getSmartLane(l2, k, laneFreeTimes, timeMs);
                                if(l3 !== -1 && l3 !== lane && l3 !== l2) {
                                    map.push({ t: timeMs, l: l3, type: 'tap', len: 0, h: false });
                                    laneFreeTimes[l3] = timeMs + 25;
                                }
                            }
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
    
    // === NUEVO: INTERCEPTOR DE OSU! PARA MULTIJUGADOR ===
    // Si la canción viene de la sala online y tiene la etiqueta "osu_"
    if (window.curSongData.isOsu || (window.curSongData.id && String(window.curSongData.id).startsWith('osu_'))) {
        let realId = String(window.curSongData.id).replace('osu_', ''); // Le quitamos la etiqueta
        if(typeof downloadAndPlayOsu === 'function') {
            // Desviamos la carga hacia el motor descompresor de Osu
            downloadAndPlayOsu(realId, window.curSongData.title, window.curSongData.imageURL, k);
            return; // Cortamos la ejecución normal
        }
    }
    
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO PISTA..."; }

    try {
        if(typeof unlockAudio === 'function') unlockAudio();

        // [NUEVO] AUTO-FETCHER DE LETRAS EN TIEMPO REAL CON LIMPIEZA DE PARÉNTESIS
        if (window.cfg.subtitles && !window.curSongData.lyrics && window.curSongData.title) {
            try {
                // Regex mágico: Elimina cualquier cosa entre () o []
                let cleanTitle = window.curSongData.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                console.log("Buscando subtítulos automáticos para:", cleanTitle);
                
                const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
                const data = await res.json();
                const bestMatch = data.find(song => song.syncedLyrics);
                
                if (bestMatch && bestMatch.syncedLyrics) {
                    console.log("¡Letras automáticas encontradas!");
                    window.curSongData.lyrics = bestMatch.syncedLyrics;
                }
            } catch(e) { console.warn("No se encontraron letras automáticas."); }
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

        const map = genMap(buffer, k); 
        const songObj = { id: window.curSongData.id, buf: buffer, map: map, kVersion: k };
        window.preparedSong = songObj; 

        if(window.currentLobbyId) {
             if(typeof window.notifyLobbyLoaded === 'function') window.notifyLobbyLoaded();
        } else {
             playSongInternal(songObj);
             if(loader) loader.style.display = 'none';
        }

    } catch (e) {
        console.error(e);
        if(loader) loader.style.display = 'none';
        alert("Error carga: " + e.message);
    }
};

window.playSongInternal = function(s) {
    if(!s) return;
    // Iniciar controles táctiles basados en la cantidad de teclas (ej. 4)
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
    
    const uiToClose = ['modal-res', 'modal-pause', 'modal-lobbies', 'modal-lobby-room', 'modal-song-selector', 'modal-diff', 'loading-overlay'];
    uiToClose.forEach(id => { const m = document.getElementById(id); if(m) m.style.display = 'none'; });

    // === INYECTAR SUBTÍTULOS Y FONDO SI NO EXISTEN ===
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
    
    // Activar Imagen de Fondo (Con o sin efectos)
    if (window.cfg.bgEffects || window.cfg.subtitles) {
        bgC.style.display = 'block';
        document.getElementById('game-bg-img').style.backgroundImage = window.curSongData.imageURL ? `url(${window.curSongData.imageURL})` : 'none';
    } else {
        bgC.style.display = 'none';
    }

    // Parsear Subtítulos
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
    cd.style.display = 'flex'; cd.innerText = "3";
    
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = s.buf;
    const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);
    
    window.st.src.onended = () => { if(window.st.act) end(false); };
    
    const now = window.st.ctx.currentTime;
    window.st.t0 = now;
    const AUDIO_DELAY = 3; 
    
    window.st.src.start(now + AUDIO_DELAY);
    requestAnimationFrame(loop);

    let count = 3;
    const iv = setInterval(() => {
        count--;
        if (count > 0) cd.innerText = count;
        else { clearInterval(iv); cd.innerText = "GO!"; setTimeout(() => { cd.style.display = 'none'; }, 500); }
    }, 1000);
}

// ==========================================
// 4. EL LOOP ULTRA-OPTIMIZADO (GPU ACCELERATED)
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;
    
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    let songTime = now - 3000; 
    
    if (window.st.songDuration > 0 && songTime > 0) {
        const pct = Math.min(100, (songTime / 1000 / window.st.songDuration) * 100);
        const bar = document.getElementById('top-progress-fill');
        if(bar) bar.style.width = pct + "%";
    }

    // Lógica de Subtítulos
    if (window.cfg.subtitles && window.st.parsedLyrics && window.st.parsedLyrics.length > 0) {
        let idx = window.st.currentLyricIdx;
        if (idx < window.st.parsedLyrics.length && songTime >= window.st.parsedLyrics[idx].t) {
            const subEl = document.getElementById('subtitles-text');
            subEl.innerText = window.st.parsedLyrics[idx].tx;
            subEl.style.animation = 'none'; 
            void subEl.offsetWidth; 
            subEl.style.animation = 'subPop 0.2s ease-out forwards';
            window.st.currentLyricIdx++;
        }
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    // 1. FASE DE SPAWN
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; 
        
        if (n.t - now < 1500) { 
            if (n.t - now > -200) { 
                const el = document.createElement('div');
                const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
                el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
                el.style.left = (n.l * w) + '%';
                el.style.width = w + '%';
                el.style.top = '0px'; 
                
                let conf = window.cfg.modes[window.keys][n.l];
                let color = conf.c; 
                let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";

                if (activeSkin) {
                    if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
                    if (activeSkin.fixed) color = activeSkin.color;
                }

                let svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${color})">
                    <path d="${shapeData}" fill="${color}" stroke="white" stroke-width="2"/>
                </svg>`;
                
                if (n.type === 'hold') {
                    const h = (n.len / 1000) * (window.cfg.spd * 40); 
                    svg += `<div class="sustain-trail" style="height:${h}px; background:${color}; opacity:${(window.cfg.noteOp||100)/100}"></div>`;
                }

                el.innerHTML = svg;
                if(elTrack) elTrack.appendChild(el);
                n.el = el;
            }
            n.s = true;
            window.st.spawned.push(n);
        } else break; 
    }

    // 2. FASE DE PROCESAMIENTO Y DESTRUCCIÓN 
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        
        if (n.h && n.type === 'tap') {
            if(n.el) { n.el.remove(); n.el = null; }
            window.st.spawned.splice(i, 1);
            continue;
        }

        const timeDiff = n.t - now + (window.cfg.off || 0);

        if (!n.h && timeDiff < -160) {
            miss(n); 
            n.h = true; 
            if(n.el) { n.el.remove(); n.el = null; }
            window.st.spawned.splice(i, 1); 
            continue;
        }

        if (n.el) {
            const dist = (timeDiff / 1000) * (window.cfg.spd * 40); 
            let finalY = window.cfg.down ? (yReceptor - dist) : (yReceptor + dist);
            
            if (n.type === 'tap' || (n.type === 'hold' && !n.h)) {
                 n.el.style.transform = `translate3d(0px, ${finalY}px, 0px)`;
            }

            if (n.type === 'hold' && n.h) {
                 n.el.style.transform = `translate3d(0px, ${yReceptor}px, 0px)`; 
                 const rem = (n.t + n.len) - now;
                 const tr = n.el.querySelector('.sustain-trail');
                 if (tr) tr.style.height = Math.max(0, (rem / 1000) * (window.cfg.spd * 40)) + 'px';
                 
                 if (!window.st.keys[n.l]) { 
                     n.el.style.opacity = 0.4;
                     if (rem > 100 && !n.broken) { window.st.cmb = 0; n.broken = true; }
                 } else {
                     n.el.style.opacity = 1;
                     if(!n.broken) window.st.hp = Math.min(100, window.st.hp + 0.1); 
                     updHUD(); 
                 }

                 if (now >= n.t + n.len) {
                     if(!n.broken) window.st.sc += 200; 
                     n.el.remove(); n.el = null; 
                     window.st.spawned.splice(i, 1); 
                 }
            }
        }
    }
    requestAnimationFrame(loop);
}

// ==========================================
// 5. VISUALS & JUEZ
// ==========================================
function createSplash(l) {
    if(!window.cfg.showSplash) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    const color = r.style.getPropertyValue('--col') || window.cfg.modes[window.keys][l].c;
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
        st.innerHTML = `@keyframes judgePop { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }`;
        document.head.appendChild(st);
    }
    
    container.appendChild(j);

    if (text !== "MISS" && typeof diffMs === 'number' && window.cfg.showMs) {
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
// 6. EVENTOS DE TECLADO Y EVALUACIÓN
// ==========================================

window.onKd = function(e) {
    if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
    if (!window.cfg || !window.cfg.modes || !window.cfg.modes[window.keys]) return;

    if (!e.repeat) {
        const idx = window.cfg.modes[window.keys].findIndex(l => l.k && l.k.toLowerCase() === e.key.toLowerCase());
        if (idx !== -1) hit(idx, true);
    }
};

window.onKu = function(e) {
    if (!window.cfg || !window.cfg.modes || !window.cfg.modes[window.keys]) return;
    const idx = window.cfg.modes[window.keys].findIndex(l => l.k && l.k.toLowerCase() === e.key.toLowerCase());
    if (idx !== -1) hit(idx, false);
};

function hit(l, p) {
    if (!window.st.act || window.st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    if (p) {
        if(!window.st.keys) window.st.keys = [];
        window.st.keys[l] = 1;
        if(r) r.classList.add('pressed');

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = n.t - now; 
            const absDiff = Math.abs(diff);
            window.st.totalOffset += absDiff;
            window.st.hitCount++;

            let score=50, text="BAD", color="yellow";
            if(absDiff < 45){ 
                text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); 
            }
            else if(absDiff < 90){ 
                text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); 
                if(window.st.fcStatus === "PFC") window.st.fcStatus = "GFC";
            }
            else { 
                window.st.stats.b++; window.st.hp-=2; 
                if(window.st.fcStatus === "PFC" || window.st.fcStatus === "GFC") window.st.fcStatus = "FC"; 
            }

            // [NUEVO] EFECTOS ALEATORIOS DE CÁMARA EN SICK Y GOOD
            if(window.cfg.bgEffects && (text === "SICK!!" || text === "GOOD")) {
                const bg = document.getElementById('game-bg-img');
                if(bg) {
                    bg.classList.remove('bg-bump-1', 'bg-bump-2', 'bg-bump-3');
                    void bg.offsetWidth; // Forzar reinicio de animación
                    // Escoger un movimiento al azar (1 a 3)
                    const randomBump = 'bg-bump-' + (Math.floor(Math.random() * 3) + 1);
                    bg.classList.add(randomBump);
                    setTimeout(() => bg.classList.remove(randomBump), 120);
                }
            }

            window.st.sc += score; 
            window.st.cmb++; 
            if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            window.st.hp = Math.min(100, window.st.hp+2);
            
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
    window.st.stats.m++; 
    window.st.cmb = 0; 
    window.st.hp -= 10; 
    window.st.fcStatus = "CLEAR"; 

    playMiss(); 
    updHUD();
    
    if (window.st.hp <= 0) {
        window.st.hp = 0;
        if (!window.isMultiplayer) end(true); 
    }
}

// ==========================================
// 7. HUD Y FINALIZACIÓN
// ==========================================

function updHUD() {
    const scEl = document.getElementById('g-score');
    if(scEl) scEl.innerText = window.st.sc.toLocaleString();
    
    const cEl = document.getElementById('g-combo');
    if(cEl) {
        if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } else cEl.style.opacity=0;
    }
    
    document.getElementById('health-fill').style.height = window.st.hp + "%";
    
    const maxPlayed = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const playedScore = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    const acc = maxPlayed > 0 ? ((playedScore / maxPlayed)*100).toFixed(1) : "100.0";
    document.getElementById('g-acc').innerText = acc + "%";
    
    const fcEl = document.getElementById('hud-fc');
    if(fcEl) {
        fcEl.innerText = window.st.fcStatus || "GFC";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }

    const hSick = document.getElementById('h-sick'); if(hSick) hSick.innerText = window.st.stats.s;
    const hGood = document.getElementById('h-good'); if(hGood) hGood.innerText = window.st.stats.g;
    const hBad = document.getElementById('h-bad'); if(hBad) hBad.innerText = window.st.stats.b;
    const hMiss = document.getElementById('h-miss'); if(hMiss) hMiss.innerText = window.st.stats.m;
    
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    
    let touchZones = document.getElementById('mobile-touch-zones'); // <--- BUSCAMOS
    if(touchZones) touchZones.style.display = 'none';               // <--- APAGAMOS AL MORIR/GANAR
    
    if(window.isMultiplayer) {
        if(typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc, true);
        if(window.isLobbyHost && window.db && window.currentLobbyId && !died) {
             setTimeout(() => {
                window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'finished' });
             }, 2000); 
        }
        return; 
    }

    document.getElementById('game-layer').style.display = 'none';
    const modal = document.getElementById('modal-res');
    
    if(modal) {
        modal.style.display = 'flex';
        const totalMax = window.st.trueMaxScore || 1;
        const finalAcc = Math.round((window.st.sc / totalMax) * 1000) / 10;
        let r="D", c="red";
        
        if (!died) {
            if (finalAcc >= 98) { r="SS"; c="cyan" }
            else if (finalAcc >= 95) { r="S"; c="gold" }
            else if (finalAcc >= 90) { r="A"; c="lime" }
            else if (finalAcc >= 80) { r="B"; c="yellow" }
            else if (finalAcc >= 70) { r="C"; c="orange" }
        } else { r="F"; c="red"; }
        
        let xpGain = 0;
        if (!died && window.user && window.user.name !== "Guest") {
            xpGain = Math.floor(window.st.sc / 250);
            window.user.xp += xpGain;
            if(typeof save === 'function') save();
        }

        let fcBadgeHTML = "";
        if(!died) {
            if(window.st.fcStatus === "PFC") fcBadgeHTML = `<div style="background:cyan; color:black; padding:5px 15px; border-radius:8px; font-weight:900; display:inline-block; margin-top:10px; box-shadow:0 0 15px cyan;">🏆 PERFECT FULL COMBO</div>`;
            else if(window.st.fcStatus === "GFC") fcBadgeHTML = `<div style="background:gold; color:black; padding:5px 15px; border-radius:8px; font-weight:900; display:inline-block; margin-top:10px; box-shadow:0 0 15px gold;">🌟 GOOD FULL COMBO</div>`;
            else if(window.st.fcStatus === "FC") fcBadgeHTML = `<div style="background:#12FA05; color:black; padding:5px 15px; border-radius:8px; font-weight:900; display:inline-block; margin-top:10px; box-shadow:0 0 15px #12FA05;">✅ FULL COMBO</div>`;
            else fcBadgeHTML = `<div style="background:#444; color:white; padding:5px 15px; border-radius:8px; font-weight:900; display:inline-block; margin-top:10px;">CLEAR</div>`;
        }

        const panel = modal.querySelector('.modal-panel');
        if(panel) {
            panel.innerHTML = `
                <div class="m-title">RESULTADOS</div>
                <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin-bottom: 25px;">
                    <div class="rank-big" style="color:${c}; font-size:6rem; font-weight:900;">${r}</div>
                    <div style="text-align:left;">
                        <div style="font-size:3rem; font-weight:900;">${window.st.sc.toLocaleString()}</div>
                        <div style="color:#aaa; font-size:1.5rem;">ACC: <span style="color:white">${finalAcc}%</span></div>
                        ${fcBadgeHTML}
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; background:#111; padding:15px; border-radius:10px; border:1px solid #333; text-align:center; font-weight:bold; font-size:1.2rem; margin-bottom:25px;">
                    <div style="color:var(--sick)">SICK<br><span style="color:white">${window.st.stats.s}</span></div>
                    <div style="color:var(--good)">GOOD<br><span style="color:white">${window.st.stats.g}</span></div>
                    <div style="color:var(--bad)">BAD<br><span style="color:white">${window.st.stats.b}</span></div>
                    <div style="color:var(--miss)">MISS<br><span style="color:white">${window.st.stats.m}</span></div>
                </div>

                <div class="modal-buttons-row">
                    <button class="action secondary" onclick="toMenu()">MENU</button>
                    <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
                </div>
            `;
        }
    }
}

function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    
    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin && window.user.equipped.skin !== 'default') {
        if (typeof SHOP_ITEMS !== 'undefined') activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }
    for (let i = 0; i < k; i++) {
        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        r.style.width = (100 / k) + '%';
        let conf = window.cfg.modes[k][i];
        let color = conf.c;
        let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";
        if (activeSkin) {
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
            if (activeSkin.fixed) color = activeSkin.color;
        }
        r.style.setProperty('--active-c', color);
        r.style.setProperty('--col', color); 
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${color})">
            <path class="arrow-path" d="${shapeData}" stroke="${color}" fill="none" stroke-width="4"/>
        </svg>`;
        elTrack.appendChild(r);
        const l = document.createElement('div');
        l.style.position = 'absolute';
        l.style.left = (i * (100 / k)) + '%';
        l.style.width = (100 / k) + '%';
        l.style.height = '100%';
        l.style.background = `linear-gradient(to bottom, transparent, ${color}22)`;
        l.style.borderLeft = '1px solid rgba(255,255,255,0.05)';
        l.style.zIndex = '-1';
        elTrack.appendChild(l);
    }
}

window.restartSong = function() { prepareAndPlaySong(window.keys); };

// [NUEVO] CREADOR DINÁMICO DEL MENÚ DE PAUSA
// ==========================================
// FIX: MENÚ DE PAUSA A PRUEBA DE BALAS
// ==========================================

window.togglePause = function() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    
    let modal = document.getElementById('modal-pause');
    let touchZones = document.getElementById('mobile-touch-zones'); // <--- BUSCAMOS LAS ZONAS

    if(window.st.paused) {
        if(touchZones) touchZones.style.display = 'none'; // <--- APAGAMOS LAS ZONAS AL PAUSAR
        
        window.st.pauseTime = performance.now();
        if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
        
        if(modal) {
            // FORZAMOS VISIBILIDAD EXTREMA PARA EVITAR BUGS DE CSS
            modal.style.setProperty('display', 'flex', 'important');
            modal.style.setProperty('z-index', '999999', 'important');
            modal.style.setProperty('opacity', '1', 'important');
            
            const panel = modal.querySelector('.modal-panel');
            if(panel) {
                // Sacamos la accuracy actual de forma segura
                const accEl = document.getElementById('g-acc');
                const currentAcc = accEl ? accEl.innerText : "100%";

                panel.innerHTML = `
                    <div class="m-title" style="border-bottom: 2px solid var(--accent); padding-bottom: 10px;">⏸️ PAUSA</div>
                    <div style="font-size:2.5rem; font-weight:900; color:var(--blue); margin: 20px 0;">ACC: <span id="p-acc" style="color:white;">${currentAcc}</span></div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="action" onclick="resumeGame()" style="font-size:1.2rem; padding:15px;">▶️ CONTINUAR</button>
                        <button class="action secondary" onclick="restartSong()">🔄 REINTENTAR</button>
                        <button class="action secondary" onclick="toMenu()" style="background:#b32424; color:white; border-color:#ff4d4d;">🚪 SALIR AL MENU</button>
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
    if(modal) {
        modal.style.setProperty('display', 'none', 'important');
    }
    
    // <--- VOLVEMOS A ENCENDER LAS ZONAS TÁCTILES (SOLO EN CELULAR)
    let touchZones = document.getElementById('mobile-touch-zones');
    if(touchZones && window.innerWidth <= 800) touchZones.style.display = 'flex'; 

    if(window.st.pauseTime) {
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration; 
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
    requestAnimationFrame(loop);
};

window.toMenu = function() {
    if(window.st.src) {
        try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){}
        window.st.src = null;
    }
    if(window.st.ctx) window.st.ctx.suspend();
    window.st.act = false; window.st.paused = false;
    
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    
    // Ocultar modales
    const resM = document.getElementById('modal-res');
    if(resM) resM.style.display = 'none';
    
    const pauseM = document.getElementById('modal-pause');
    if(pauseM) pauseM.style.setProperty('display', 'none', 'important');
};
// === SISTEMA MULTI-TOUCH A PRUEBA DE BUGS ===
// === SISTEMA MULTI-TOUCH A PRUEBA DE BUGS (V-FINAL) ===
window.initMobileTouchControls = function(keyCount) {
    // 1. ARRANCAMOS LAS CINTAS VIEJAS (Esto arregla el bug de 4K a 6K)
    let oldContainer = document.getElementById('mobile-touch-zones');
    if (oldContainer) {
        oldContainer.remove(); 
    }

    // 2. Si estás en computadora, no hacemos nada y cancelamos
    if (window.innerWidth > 800 && !('ontouchstart' in window)) return;

    // 3. PONEMOS UN CONTENEDOR NUEVO Y LIMPIO
    const touchContainer = document.createElement('div');
    touchContainer.id = 'mobile-touch-zones';
    // El z-index 800 es para que no tape tu botón de pausa ni otros menús
    touchContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 800; display: flex; flex-direction: row; pointer-events: auto;';
    document.body.appendChild(touchContainer); 

    // 4. PREGUNTAMOS QUÉ LETRAS SE VAN A USAR (D, F, J, K o S, D, F, J, K, L)
    let currentKeys = [];
    if (window.cfg && window.cfg.modes && window.cfg.modes[keyCount]) {
        for(let i = 0; i < keyCount; i++) currentKeys.push(window.cfg.modes[keyCount][i].k);
    } else {
        currentKeys = keyCount === 6 ? ['s','d','f','j','k','l'] : ['d','f','j','k'];
    }

    // 5. CORTAMOS LA PANTALLA EN LOS PEDAZOS NECESARIOS Y LES DAMOS VIDA
    for (let i = 0; i < keyCount; i++) {
        const zone = document.createElement('div');
        zone.style.flex = '1';
        zone.style.height = '100%';
        zone.style.borderRight = '1px solid rgba(255,255,255,0.05)';
        
        const targetKey = currentKeys[i].toLowerCase();

        // Cuando tu dedo TOCA la pantalla
        zone.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            zone.style.background = 'rgba(255,255,255,0.1)'; // Brilla un poquito para que sepas que tocaste
            if(typeof window.onKd === 'function') window.onKd({ key: targetKey, preventDefault: ()=>{} });
        }, { passive: false });

        // Cuando tu dedo SUELTA la pantalla
        zone.addEventListener('touchend', (e) => {
            e.preventDefault();
            zone.style.background = 'transparent';
            if(typeof window.onKu === 'function') window.onKu({ key: targetKey, preventDefault: ()=>{} });
        }, { passive: false });

        // Por si deslizas el dedo fuera de la zona
        zone.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            zone.style.background = 'transparent';
            if(typeof window.onKu === 'function') window.onKu({ key: targetKey, preventDefault: ()=>{} });
        }, { passive: false });

        touchContainer.appendChild(zone);
    }
};
