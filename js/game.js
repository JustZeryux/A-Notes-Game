/* === AUDIO & ENGINE (MASTER FINAL V11 - NO OVERLAPS + MOVABLE JUDGE) === */

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
    // Hit Sound
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;
    // Miss Sound
    const b2 = window.st.ctx.createBuffer(1, 4000, 44100);
    const d2 = b2.getChannelData(0);
    for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / 1000);
    window.missBuf = b2;
}

// Función crítica para limpiar el audio antes de analizarlo
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
// 2. GENERADOR DE MAPAS (CORREGIDO: NO OVERLAPS)
// ==========================================

function getSmartLane(last, k, busyLanes, time) {
    // Intentar encontrar un carril que no sea el anterior y que esté libre
    let candidates = [];
    for(let i=0; i<k; i++) {
        // Verificar si el carril está libre en este tiempo
        if (time > busyLanes[i] + 50) { 
            candidates.push(i);
        }
    }
    
    if(candidates.length === 0) return -1; // No hay espacio
    
    // Evitar repetir la misma nota si es posible
    let filtered = candidates.filter(c => c !== last);
    if(filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData)); 
    const map = [];
    const sampleRate = buf.sampleRate;
    
    const START_OFFSET = 3000; 

    // Configuración
    const density = window.cfg.den || 5;
    const step = Math.floor(sampleRate / 60); 
    
    // Umbrales
    let minDistMs = 400 - (density * 35); 
    if(minDistMs < 80) minDistMs = 80;
    let thresholdMult = 1.6 - (density * 0.07); 
    
    // ESTADO DEL GENERADOR
    let lastNoteTime = -1000; 
    let lastLane = Math.floor(k/2); 
    
    // === FIX: ARRAY PARA RASTREAR CUÁNDO SE LIBERA CADA CARRIL ===
    // Si laneFreeTimes[0] es 5000, significa que hay una nota larga ocupando el carril 0 hasta el segundo 5.
    let laneFreeTimes = new Array(k).fill(0);

    const energyHistory = [];
    let staircaseCount = 0; 
    let staircaseDir = 1;

    for (let i = 0; i < data.length; i += step) {
        // Energía RMS
        let sum = 0; 
        for(let j=0; j<step && (i+j)<data.length; j++) sum += data[i+j] * data[i+j];
        const instant = Math.sqrt(sum / step);
        
        energyHistory.push(instant); 
        if(energyHistory.length > 30) energyHistory.shift();
        const localAvg = energyHistory.reduce((a,b)=>a+b,0) / energyHistory.length;

        // Detección de Beat
        if(instant > localAvg * thresholdMult && instant > 0.01) {
            const timeMs = (i / sampleRate) * 1000 + START_OFFSET;
            
            if(timeMs - lastNoteTime > minDistMs) {
                let type = 'tap';
                let length = 0;
                let lane = -1;

                // --- LÓGICA DE SELECCIÓN DE CARRIL ---
                if (staircaseCount > 0) {
                    // Intento de escalera
                    let target = (lastLane + staircaseDir + k) % k;
                    // Verificar si el carril objetivo está libre
                    if (timeMs > laneFreeTimes[target] + 50) {
                        lane = target;
                        staircaseCount--;
                    } else {
                        // Si está ocupado, cancelamos escalera y buscamos libre
                        staircaseCount = 0;
                        lane = getSmartLane(lastLane, k, laneFreeTimes, timeMs);
                    }
                } else {
                    // Iniciar escalera?
                    if (density >= 4 && instant > localAvg * 1.5 && Math.random() > 0.6) {
                        staircaseCount = Math.floor(Math.random() * 3) + 1;
                        staircaseDir = Math.random() > 0.5 ? 1 : -1;
                    }
                    lane = getSmartLane(lastLane, k, laneFreeTimes, timeMs);
                }

                // SI NO ENCONTRAMOS CARRIL LIBRE, SALTAMOS ESTA NOTA
                if (lane === -1) continue;

                // --- LÓGICA DE HOLD ---
                if (instant > localAvg * 1.3 && Math.random() > 0.6) {
                    let sustain = 0;
                    for(let h=1; h<10; h++) { // Mirar más lejos
                        let fIdx = i + (step * h);
                        if(fIdx < data.length && Math.abs(data[fIdx]) > localAvg * 0.9) sustain++;
                        else break; 
                    }
                    if(sustain > 4) {
                        type = 'hold';
                        length = Math.min(sustain * (step/sampleRate)*1000 * 3, 1500);
                        // Asegurar que length no sea minúsculo
                        if(length < 100) { type = 'tap'; length = 0; }
                    }
                }

                // --- MULTI NOTES (ACORDES) ---
                if(staircaseCount === 0 && density >= 5 && instant > localAvg * (thresholdMult + 0.4)) {
                     // Buscar segundo carril libre
                     let candidates = [];
                     for(let c=0; c<k; c++) {
                         if(c !== lane && timeMs > laneFreeTimes[c] + 50) candidates.push(c);
                     }
                     
                     if(candidates.length > 0) {
                         // Preferir carriles lejanos o simétricos
                         let lane2 = candidates[Math.floor(Math.random()*candidates.length)];
                         map.push({ t: timeMs, l: lane2, type: 'tap', len: 0, h: false });
                         // Actualizar ocupación
                         laneFreeTimes[lane2] = timeMs + 100; // Pequeño buffer
                     }
                }

                // AGREGAR NOTA PRINCIPAL
                map.push({ t: timeMs, l: lane, type: type, len: length, h: false });
                
                // ACTUALIZAR OCUPACIÓN DEL CARRIL
                // Si es hold, ocupado hasta time + len. Si es tap, time + buffer.
                laneFreeTimes[lane] = timeMs + length + 80; 
                
                lastNoteTime = timeMs; 
                lastLane = lane;
            }
        }
    }
    return map;
}

// ==========================================
// 3. CORE Y VISUALES
// ==========================================

// ... (unlockAudio, genSounds, playHit, playMiss igual que antes) ...
function playHit() {
    if (window.hitBuf && window.cfg.hitSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource();
        s.buffer = window.hitBuf;
        const g = window.st.ctx.createGain();
        g.gain.value = window.cfg.hvol || 0.5;
        s.connect(g); g.connect(window.st.ctx.destination);
        s.start(0);
    }
}
function playMiss() {
    if (window.missBuf && window.cfg.missSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource();
        s.buffer = window.missBuf;
        const g = window.st.ctx.createGain();
        g.gain.value = window.cfg.missVol || 0.5;
        s.connect(g); g.connect(window.st.ctx.destination);
        s.start(0);
    }
}

// Función requerida por UI.js
window.prepareAndPlaySong = async function(k) {
    if (!window.curSongData) return alert("Selecciona una canción");
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Generando Mapa..."; }

    try {
        unlockAudio();
        let buffer;
        let songInRam = window.ramSongs ? window.ramSongs.find(s => s.id === window.curSongData.id) : null;
        
        if (songInRam) {
            buffer = songInRam.buf;
        } else {
            const response = await fetch(window.curSongData.audioURL || window.curSongData.url); 
            const arrayBuffer = await response.arrayBuffer();
            buffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            if(!window.ramSongs) window.ramSongs = [];
            window.ramSongs.push({ id: window.curSongData.id, buf: buffer });
        }

        const map = genMap(buffer, k);
        const songObj = { id: window.curSongData.id, buf: buffer, map: map, kVersion: k };
        
        if(window.isMultiplayer && window.notifyLobbyLoaded) {
             window.notifyLobbyLoaded();
        } else {
             playSongInternal(songObj);
             if(loader) loader.style.display = 'none';
        }

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
        if(loader) loader.style.display = 'none';
    }
};

window.playSongInternal = function(s) {
    if(!s) return;
    
    // Reset Stats
    window.st.act = true;
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = [];
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50;
    window.st.maxCmb = 0; 
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.hitCount = 0; 
    window.st.totalOffset = 0;
    window.st.fcStatus = "GFC";
    
    // Max Score Calc
    window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => { window.st.trueMaxScore += 350; if(n.type === 'hold') window.st.trueMaxScore += 200; });

    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;

    // UI Clear
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    ['modal-res', 'modal-pause'].forEach(id => { const m = document.getElementById(id); if(m) m.style.display = 'none'; });

    initReceptors(window.keys);
    if(typeof updHUD === 'function') updHUD();

    // START (PRERENDER)
    const cd = document.getElementById('countdown');
    cd.style.display = 'flex'; cd.innerText = "3";
    
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = s.buf;
    const g = window.st.ctx.createGain();
    g.gain.value = window.cfg.vol || 0.5;
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
        else {
            clearInterval(iv);
            cd.innerText = "GO!";
            setTimeout(() => { cd.style.display = 'none'; }, 500);
        }
    }, 1000);
}

// ==========================================
// 4. GAME LOOP
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

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

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

    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        
        if (!n.el) { 
            if(n.t - now < -200 && !n.h) window.st.spawned.splice(i, 1);
            continue; 
        }

        const timeDiff = n.t - now + (window.cfg.off || 0);
        const dist = (timeDiff / 1000) * (window.cfg.spd * 40); 
        let finalY = window.cfg.down ? (yReceptor - dist) : (yReceptor + dist);
        
        if (n.type === 'tap' || (n.type === 'hold' && !n.h)) {
             n.el.style.top = finalY + 'px';
        }

        if (n.type === 'hold' && n.h) {
             n.el.style.top = yReceptor + 'px'; 
             const rem = (n.t + n.len) - now;
             const tr = n.el.querySelector('.sustain-trail');
             if (tr) tr.style.height = Math.max(0, (rem / 1000) * (window.cfg.spd * 40)) + 'px';
             
             if (!window.st.keys[n.l]) { 
                 n.el.style.opacity = 0.4;
                 if (rem > 100 && !n.broken) { window.st.cmb = 0; n.broken = true; }
             } else {
                 n.el.style.opacity = 1;
                 if(!n.broken) window.st.hp = Math.min(100, window.st.hp + 0.1); 
                 if(typeof updHUD==='function') updHUD(); 
             }

             if (now >= n.t + n.len) {
                 if(!n.broken) window.st.sc += 200; 
                 n.el.remove(); n.el = null; 
             }
        }

        if (!n.h && timeDiff < -160) {
            miss(n);
            if(n.el) { n.el.style.opacity = 0; setTimeout(()=>n.el && n.el.remove(),100); }
            window.st.spawned.splice(i, 1);
        }
    }
    requestAnimationFrame(loop);
}

// ==========================================
// 5. INPUT & VISUALS (FIXED MS POSITION)
// ==========================================

function createSplash(l) {
    if(!window.cfg.showSplash) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    const color = r.style.getPropertyValue('--col') || window.cfg.modes[window.keys][l].c;
    const s = document.createElement('div');
    s.className = 'splash-oppa'; // Asegúrate de tener el CSS en style.css (anteriormente lo di)
    s.style.setProperty('--c', color);
    
    const rect = r.getBoundingClientRect();
    s.style.left = (rect.left + rect.width/2) + 'px';
    s.style.top = (rect.top + rect.height/2) + 'px';
    s.style.position = 'fixed';
    
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 400);
}

window.onKd = function(e) {
    if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
    if (!e.repeat && window.cfg.modes[window.keys]) {
        const idx = window.cfg.modes[window.keys].findIndex(l => l.k === e.key.toLowerCase());
        if (idx !== -1) hit(idx, true);
    }
};
window.onKu = function(e) {
    if(window.cfg.modes[window.keys]) {
        const idx = window.cfg.modes[window.keys].findIndex(l => l.k === e.key.toLowerCase());
        if (idx !== -1) hit(idx, false);
    }
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
            if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
            else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }

            if(text==="BAD") window.st.fcStatus="SD";
            window.st.sc += score; 
            window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            window.st.hp = Math.min(100, window.st.hp+2);
            
            showJudge(text, color, diff); 
            playHit(); if(typeof updHUD==='function') updHUD();
            n.h = true; if (n.type === 'tap' && n.el) n.el.style.opacity = 0;
        }
    } else {
        if(window.st.keys) window.st.keys[l] = 0;
        if(r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++; window.st.cmb=0; window.st.hp-=10; window.st.fcStatus="SD";
    playMiss(); if(typeof updHUD==='function') updHUD();
    if(n.el) n.el.style.opacity = 0;
    if(window.st.hp <= 0 && !window.isMultiplayer) end(true);
}

// === FIX: JUEZ Y MS EN CONTENEDOR MÓVIL ===
function showJudge(text, color, diffMs) {
    if(!window.cfg.judgeVis) return;
    
    // Crear contenedor que usa las variables CSS globales para moverse
    const container = document.createElement('div');
    container.style.position = 'absolute';
    // Usamos las variables definidas en ui.js (applyCfg)
    container.style.left = 'var(--judge-x)';
    container.style.top = 'var(--judge-y)';
    container.style.transform = 'translate(-50%, -50%) scale(var(--judge-scale))';
    container.style.zIndex = '500';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    // Texto del Juicio
    const j = document.createElement('div');
    j.innerText = text; 
    j.style.color = color;
    j.style.fontSize = '3rem';
    j.style.fontWeight = '900';
    j.style.textShadow = `0 0 10px ${color}`;
    j.style.animation = 'judgePop 0.35s ease-out forwards';
    
    // Inyectar keyframes si no existen
    if(!document.getElementById('style-judge')) {
        const st = document.createElement('style');
        st.id = 'style-judge';
        st.innerHTML = `@keyframes judgePop { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }`;
        document.head.appendChild(st);
    }
    
    container.appendChild(j);

    // Texto de MS (Dentro del mismo contenedor)
    if (text !== "MISS" && typeof diffMs === 'number' && window.cfg.showMs) {
        const msDiv = document.createElement('div');
        const sign = diffMs > 0 ? "+" : "";
        msDiv.innerText = `${sign}${Math.round(diffMs)}ms`;
        msDiv.style.fontSize = '1.2rem';
        msDiv.style.fontWeight = 'bold';
        msDiv.style.marginTop = '5px'; // Separación
        
        if (diffMs > 0) msDiv.style.color = "#ffaa00"; // Tarde (Naranja)
        else msDiv.style.color = "#00aaff"; // Temprano (Azul)
        
        msDiv.style.animation = 'judgePop 0.35s ease-out forwards';
        container.appendChild(msDiv);
    }

    document.body.appendChild(container); 
    setTimeout(() => container.remove(), 600);
}

// ... (updHUD, end, togglePause, etc. se mantienen igual) ...
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
    
    const fcEl = document.getElementById('hud-fc-status');
    if(fcEl) {
        fcEl.innerText = window.st.fcStatus || "GFC";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }
    
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
    // REDIRECT SI ES MULTIPLAYER
   if(window.isMultiplayer) {
        if(typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc, true);
        
        // Si soy el host, yo digo cuando acaba realmente (después de 2 segs para sync)
        if(window.isLobbyHost && window.db && window.currentLobbyId) {
             setTimeout(() => {
                window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'finished' });
             }, 1500); 
        }
        return; // <--- ESTO EVITA QUE SE CIERRE SOLO
    }

    const modal = document.getElementById('modal-res');
    if(modal) {
        modal.style.display = 'flex';
        const totalMax = window.st.trueMaxScore || 1;
        const finalAcc = Math.round((window.st.sc / totalMax) * 100);
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

        const panel = modal.querySelector('.modal-panel');
        if(panel) {
            panel.innerHTML = `
                <div class="m-title">RESULTADOS</div>
                <div style="display:flex; justify-content:center; align-items:center; gap:30px;">
                    <div class="rank-big" style="color:${c}; font-size:6rem; font-weight:900;">${r}</div>
                    <div>
                        <div style="font-size:3rem; font-weight:900;">${window.st.sc.toLocaleString()}</div>
                        <div style="color:#aaa; font-size:1.5rem;">ACC: <span style="color:white">${finalAcc}%</span></div>
                    </div>
                </div>
                <div class="modal-buttons-row">
                    <button class="action secondary" onclick="toMenu()">MENU</button>
                    <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
                </div>
            `;
        }
    }
}

window.restartSong = function() { prepareAndPlaySong(window.keys); };

function togglePause() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    const modal = document.getElementById('modal-pause');
    if(window.st.paused) {
        window.st.pauseTime = performance.now(); 
        if(window.st.ctx) window.st.ctx.suspend();
        
        if(modal) {
            modal.style.display = 'flex';
            const panel = modal.querySelector('.modal-panel');
            if(panel) {
                panel.innerHTML = `
                    <div class="m-title">PAUSA</div>
                    <div style="font-size:3rem; font-weight:900; color:var(--blue);">ACC: <span id="p-acc">${document.getElementById('g-acc').innerText}</span></div>
                    <div class="modal-buttons-row">
                        <button class="action" onclick="resumeGame()">CONTINUAR</button>
                        <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
                        <button class="action secondary" onclick="toMenu()">MENU</button>
                    </div>
                `;
            }
        }
    } else {
        resumeGame();
    }
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if(window.st.pauseTime) {
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration; 
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx) window.st.ctx.resume();
    requestAnimationFrame(loop);
}

function toMenu() {
    if(window.st.src) {
        try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){}
        window.st.src = null;
    }
    if(window.st.ctx) window.st.ctx.suspend();
    window.st.act = false; window.st.paused = false;
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
}

/* === ONLINE SYSTEM (STABLE START & RIGHT HUD V4) === */

var currentLobbyId = null;
var lobbyListener = null;
window.isMultiplayerReady = false; // Nueva bandera de seguridad

window.initOnline = function() {
    if(typeof Peer !== 'undefined') {
        try {
            window.peer = new Peer(null, { secure: true }); 
            window.peer.on('open', (id) => {
                if(window.db && window.user && window.user.name !== "Guest") {
                    window.db.collection("users").doc(window.user.name).set({ peerId: id, online: true }, { merge: true });
                }
            });
        } catch(e) { console.log("PeerJS error:", e); }
    }
};

window.notifyLobbyLoaded = function() {
    // Esta función se llama desde game.js cuando el mapa ya se generó
    console.log("Juego listo para multiplayer.");
    window.isMultiplayerReady = true;
    
    // Si la sala ya estaba en 'playing' (porque cargamos lento), iniciamos ahora
    if(window.lobbyStatusCache === 'playing') {
        startMultiplayerGameNow();
    }
};

function startMultiplayerGameNow() {
    const s = window.ramSongs ? window.ramSongs.find(x => x.id === window.curSongData.id) : null;
    if(s && (!window.st.act || window.st.paused)) {
        console.log("GO! Iniciando partida multiplayer.");
        window.playSongInternal(s);
    }
}

window.createLobbyData = function(songId, config, isPrivate = false) {
    if (!window.db) return Promise.reject("DB no conectada");
    
    const lobbyData = {
        host: window.user.name,
        songId: songId,
        songTitle: window.curSongData ? window.curSongData.title : "Desconocido",
        status: 'waiting',
        players: [{ name: window.user.name, avatar: window.user.avatarData || '', status: 'ready', score: 0 }],
        config: config,
        isPrivate: isPrivate,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return window.db.collection("lobbies").add(lobbyData).then(docRef => {
        currentLobbyId = docRef.id;
        subscribeToLobby(currentLobbyId);
        return docRef.id;
    });
};

window.joinLobbyData = function(lobbyId) {
    if(lobbyListener) lobbyListener();
    if(!window.db) return;
    const lobbyRef = window.db.collection("lobbies").doc(lobbyId);
    
    window.db.runTransaction(async (t) => {
        const doc = await t.get(lobbyRef);
        if(!doc.exists) throw "Sala no encontrada";
        const data = doc.data();
        if(data.status === 'playing') throw "Partida en curso";
        if(data.players.length >= 8) throw "Sala llena";
        
        const exists = data.players.some(p => p.name === window.user.name);
        if(!exists) {
            t.update(lobbyRef, {
                players: firebase.firestore.FieldValue.arrayUnion({
                    name: window.user.name, avatar: window.user.avatarData||'', status: 'not-ready', score: 0
                })
            });
        }
        return data;
    }).then(data => {
        currentLobbyId = lobbyId;
        window.db.collection("globalSongs").doc(data.songId).get().then(s => {
            if(s.exists) {
                window.curSongData = { id: s.id, ...s.data() };
                if(typeof window.openHostPanel === 'function') {
                    window.openHostPanel(window.curSongData, true); 
                }
            }
        });
        subscribeToLobby(lobbyId);
    }).catch(e => {
        if(typeof notify === 'function') notify(e, "error");
    });
};

window.toggleReadyData = function() {
    if(!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    ref.get().then(doc => {
        if(!doc.exists) return;
        let p = doc.data().players;
        p = p.map(x => {
            if(x.name === window.user.name) x.status = (x.status === 'ready' ? 'not-ready' : 'ready');
            return x;
        });
        ref.update({ players: p });
    });
};

function subscribeToLobby(lobbyId) {
    if (lobbyListener) lobbyListener();
    
    lobbyListener = window.db.collection("lobbies").doc(lobbyId).onSnapshot(doc => {
        if (!doc.exists) { 
            window.leaveLobbyData(); 
            if(typeof closeModal === 'function') closeModal('host'); 
            notify("Sala cerrada por el host", "info");
            return; 
        }
        
        const data = doc.data();
        window.lobbyStatusCache = data.status; // Guardar estado actual
        
        // Sync Config
        if (data.config && window.cfg) {
            window.cfg.den = data.config.density;
        }

        // --- CARGA ---
        if (data.status === 'loading') {
            window.isMultiplayer = true;
            window.isMultiplayerReady = false; // Resetear bandera
            if(typeof closeModal === 'function') closeModal('host');
            
            const loader = document.getElementById('loading-overlay');
            if(loader) {
                loader.style.display = 'flex';
                document.getElementById('loading-text').innerText = "SINCRONIZANDO...";
            }

            const k = (data.config && data.config.keys) ? data.config.keys[0] : 4;
            // Iniciamos la preparación (generar mapa). Cuando termine, llamará a notifyLobbyLoaded
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
        }
        
        if (data.status === 'loading' && window.isLobbyHost) {
            if(!window.syncTimer) {
                // El host espera 5 segundos y fuerza el inicio
                window.syncTimer = setTimeout(() => {
                    window.db.collection("lobbies").doc(lobbyId).update({ status: 'playing' });
                    window.syncTimer = null;
                }, 5000); 
            }
        }

        // --- PLAYING ---
        if (data.status === 'playing') {
            const loader = document.getElementById('loading-overlay');
            if(loader) loader.style.display = 'none';
            
            // Solo iniciamos si el mapa ya se generó (isMultiplayerReady)
            if (window.isMultiplayerReady) {
                startMultiplayerGameNow();
            }
            // Si no estamos listos, startMultiplayerGameNow se llamará en notifyLobbyLoaded
        }
        
        // UI Updates
        if (data.status === 'waiting' && typeof updateHostPanelUI === 'function') {
            updateHostPanelUI(data.players, data.host);
        }
        
        if (data.status === 'playing' && data.players) {
            // Clonamos y ordenamos para el leaderboard
            const sortedPlayers = [...data.players].sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
            updateMultiLeaderboardUI(sortedPlayers);
        }

        // --- FINALIZADO ---
        if (data.status === 'finished') {
            if(window.st.act) {
                window.st.act = false;
                if(window.st.src) { try{window.st.src.stop();}catch(e){} window.st.src = null; }
                document.getElementById('game-layer').style.display = 'none';
            }
            window.showMultiplayerResults(data.players);
        }
    });
}

window.startLobbyMatchData = function() {
    if(currentLobbyId && window.db) {
        window.db.collection("lobbies").doc(currentLobbyId).update({ status: 'loading' });
    }
};

window.leaveLobbyData = function() {
    if (!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    if(lobbyListener) { lobbyListener(); lobbyListener = null; }

    ref.get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === window.user.name) {
                ref.delete(); 
            } else {
                const p = doc.data().players.filter(x => x.name !== window.user.name);
                ref.update({ players: p });
            }
        }
    });
    currentLobbyId = null; 
    window.isMultiplayer = false;
};

window.sendLobbyScore = function(score, isFinal) {
    if(!currentLobbyId || !window.db) return;
    const ref = window.db.collection("lobbies").doc(currentLobbyId);
    window.db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        if(!doc.exists) return;
        const players = doc.data().players;
        const myIdx = players.findIndex(p => p.name === window.user.name);
        if(myIdx !== -1) {
            players[myIdx].currentScore = score;
            t.update(ref, { players: players });
        }
    });
};

// === LEADERBOARD DERECHO (CUADRADO) ===
window.updateMultiLeaderboardUI = function(players) {
    const hud = document.getElementById('vs-hud');
    const container = document.getElementById('multi-players-container');
    if(!hud || !container) return;

    hud.style.display = 'flex'; // Usamos Flex para la columna derecha
    container.innerHTML = '';
    
    // 'players' ya viene ordenado
    players.forEach((p, index) => {
        const isMe = p.name === window.user.name;
        
        const row = document.createElement('div');
        row.className = `ml-row ${isMe ? 'is-me' : ''}`;
        row.setAttribute('data-rank', index + 1);

        row.innerHTML = `
            <div class="ml-pos">#${index + 1}</div>
            <div class="ml-av" style="background-image:url(${p.avatar || ''})"></div>
            <div class="ml-info">
                <div class="ml-name">${p.name}</div>
                <div class="ml-score">${(p.currentScore||0).toLocaleString()}</div>
            </div>
        `;
        container.appendChild(row);
    });
};

window.showMultiplayerResults = function(playersData) {
    const modal = document.getElementById('modal-res');
    if(!modal) return;
    
    // Asegurar orden
    playersData.sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
    
    const winner = playersData[0];
    const amIWinner = winner.name === window.user.name;

    modal.style.display = 'flex';
    const panel = modal.querySelector('.modal-panel');
    
    let listHTML = '<div class="rank-table-wrapper" style="margin-top:20px; max-height:300px; overflow-y:auto; background:#111; padding:10px; border-radius:8px;"><table class="rank-table" style="font-size:1rem; width:100%;">';
    playersData.forEach((p, i) => {
        listHTML += `
        <tr class="${p.name === window.user.name ? 'rank-row-me' : ''}" style="border-bottom:1px solid #333;">
            <td style="color:${i===0?'gold':'white'}; font-weight:bold;">#${i+1}</td>
            <td style="text-align:left; padding-left:10px;">${p.name}</td>
            <td style="color:var(--blue); font-weight:900; text-align:right;">${(p.currentScore||0).toLocaleString()}</td>
        </tr>`;
    });
    listHTML += '</table></div>';

    panel.innerHTML = `
        <div class="m-title" style="border-color:${amIWinner ? 'gold' : '#F9393F'}">
            ${amIWinner ? '🏆 ¡VICTORIA! 🏆' : 'PARTIDA FINALIZADA'}
        </div>
        
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:1.2rem; color:#aaa;">GANADOR</div>
            <div style="font-size:2.5rem; font-weight:900; color:gold; text-shadow:0 0 20px gold;">${winner.name}</div>
            <div style="font-size:1.5rem;">${(winner.currentScore||0).toLocaleString()} pts</div>
        </div>

        ${listHTML}

        <div class="modal-buttons-row">
            <button class="action secondary" onclick="toMenu(); leaveLobbyData();">SALIR AL MENU</button>
        </div>
    `;
};

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
        
        // Carril visual
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
