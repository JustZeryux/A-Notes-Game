/* === AUDIO & ENGINE (HYBRID: USER ZIP + OPPA GENERATOR) === */

let elTrack = null;
let mlContainer = null;

// ==========================================
// 1. SISTEMA DE AUDIO (RESTAURADO DEL ZIP)
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
    // Hit Sound (Sintético suave)
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;

    // Miss Sound (Ruido)
    const b2 = window.st.ctx.createBuffer(1, 4000, 44100);
    const d2 = b2.getChannelData(0);
    for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() - 0.5) * 0.5 * Math.exp(-i / 500);
    window.missBuf = b2;
}

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

// Función crítica de tu ZIP para que el audio se analice bien
function normalizeAudio(filteredData) {
    let max = 0;
    for (let i = 0; i < filteredData.length; i += 50) { 
        const v = Math.abs(filteredData[i]);
        if (v > max) max = v;
    }
    if (max === 0) return filteredData;
    const multiplier = 0.95 / max;
    // Solo normalizar si está muy bajo o saturado
    if (multiplier > 1.1 || multiplier < 0.9) {
        for (let i = 0; i < filteredData.length; i++) filteredData[i] *= multiplier;
    }
    return filteredData;
}

// ==========================================
// 2. GENERADOR (ESTILO OPPA + MULTI NOTES)
// ==========================================
function getSmartLane(last, k) {
    // Lógica inteligente para evitar repeticiones aburridas
    if (Math.random() > 0.8) return Math.floor(Math.random() * k);
    let next = Math.floor(Math.random() * k);
    
    // Evitar misma nota seguida en 4K+
    if(k >= 4) {
        let retries = 5;
        while(next === last && retries > 0) {
            next = Math.floor(Math.random() * k);
            retries--;
        }
    }
    return next;
}

function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    // Usamos TU normalizador para mejorar la calidad del análisis
    const data = normalizeAudio(new Float32Array(rawData)); 
    const map = [];
    const sampleRate = buf.sampleRate;
    
    // START_OFFSET para el Prerender (3, 2, 1)
    const START_OFFSET = 3000; 

    // Configuración estilo Oppa
    const density = window.cfg.den || 5;
    const step = Math.floor(sampleRate / 60); // 60 FPS analysis
    
    // Umbrales dinámicos
    let minDistMs = 400 - (density * 35); 
    if(minDistMs < 80) minDistMs = 80;
    
    let thresholdMult = 1.6 - (density * 0.07); 
    
    let lastNoteTime = -1000; 
    let lastLane = Math.floor(k/2); 
    
    // Variables de Patrón
    const energyHistory = [];
    let staircaseCount = 0; 
    let staircaseDir = 1;

    for (let i = 0; i < data.length; i += step) {
        // Energía RMS (Root Mean Square) - Más preciso que el promedio simple
        let sum = 0; 
        for(let j=0; j<step && (i+j)<data.length; j++) {
            sum += data[i+j] * data[i+j];
        }
        const instant = Math.sqrt(sum / step);
        
        // Historial local para detectar picos relativos (Beats)
        energyHistory.push(instant); 
        if(energyHistory.length > 30) energyHistory.shift();
        const localAvg = energyHistory.reduce((a,b)=>a+b,0) / energyHistory.length;

        // Detección de Beat
        if(instant > localAvg * thresholdMult && instant > 0.01) {
            const timeMs = (i / sampleRate) * 1000 + START_OFFSET;
            
            if(timeMs - lastNoteTime > minDistMs) {
                let lane;
                let type = 'tap';
                let length = 0;
                
                // === LÓGICA DE PATRONES (STAIRS & STREAMS) ===
                if (staircaseCount > 0) {
                    lane = (lastLane + staircaseDir + k) % k;
                    staircaseCount--;
                } else {
                    // Iniciar escalera si la energía es alta
                    if (density >= 4 && instant > localAvg * 1.5 && Math.random() > 0.6) {
                        staircaseCount = Math.floor(Math.random() * 3) + 1;
                        staircaseDir = Math.random() > 0.5 ? 1 : -1;
                        lane = getSmartLane(lastLane, k);
                    } else {
                        lane = getSmartLane(lastLane, k);
                    }
                }

                // === HOLDS (NOTAS LARGAS) ===
                // Si la energía se mantiene alta, es un hold
                if (instant > localAvg * 1.3 && Math.random() > 0.6) {
                    // Mirar al futuro
                    let sustain = 0;
                    for(let h=1; h<8; h++) {
                        let fIdx = i + (step * h);
                        if(fIdx < data.length && Math.abs(data[fIdx]) > localAvg * 0.9) sustain++;
                    }
                    if(sustain > 4) {
                        type = 'hold';
                        length = Math.min(sustain * (step/sampleRate)*1000 * 3, 1500);
                    }
                }

                // === MULTI NOTES (ACORDES) ===
                // Si la energía explota (Kick + Snare fuerte)
                if(staircaseCount === 0 && density >= 5 && instant > localAvg * (thresholdMult + 0.4)) {
                     let lane2 = (lane + Math.floor(k/2)) % k;
                     if(lane2 === lane) lane2 = (lane + 1) % k;
                     map.push({ t: timeMs, l: lane2, type: 'tap', len: 0, h: false });
                }

                map.push({ t: timeMs, l: lane, type: type, len: length, h: false });
                lastNoteTime = timeMs; 
                lastLane = lane;
            }
        }
    }
    return map;
}

// ==========================================
// 3. INICIO Y GESTIÓN (RESTAURADO)
// ==========================================
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');

    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    window.elReceptors = []; 
    
    // RECUPERADO: Lógica de Skins del Usuario
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

        // Aplicar Skin si existe
        if (activeSkin) {
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
            if (activeSkin.fixed) color = activeSkin.color;
        }

        r.style.setProperty('--active-c', color);
        r.style.setProperty('--col', color); // Para el splash
        
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
        
        window.elReceptors.push(r);
    }
}

// Función requerida por UI.js
window.prepareAndPlaySong = async function(k) {
    if (!window.curSongData) return alert("Selecciona una canción"); // Usar alert si notify no está
    
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Generando Mapa..."; }

    try {
        unlockAudio();
        
        // 1. Obtener Audio
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

        // 2. Generar Mapa (Nuevo Algoritmo)
        const map = genMap(buffer, k);
        
        // Estructura compatible con tu ZIP
        const songObj = { 
            id: window.curSongData.id, 
            buf: buffer, 
            map: map, 
            kVersion: k 
        };
        
        playSongInternal(songObj);
        
        if(loader) loader.style.display = 'none';

    } catch (e) {
        console.error(e);
        alert("Error cargando audio: " + e.message);
        if(loader) loader.style.display = 'none';
    }
};

window.playSongInternal = function(s) {
    if(!s) return;
    
    window.st.act = true;
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = [];
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50;
    window.st.maxCmb = 0; // Restaurado
    
    // Restaurado: Cálculo de Max Score real
    window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => {
        window.st.trueMaxScore += 350; 
        if(n.type === 'hold') window.st.trueMaxScore += 200; 
    });

    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;
    
    // Restaurado: Estadísticas detalladas
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.hitCount = 0; 
    window.st.totalOffset = 0;
    window.st.fcStatus = "GFC";

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    
    ['modal-res', 'modal-pause'].forEach(id => {
        const m = document.getElementById(id);
        if(m) m.style.display = 'none';
    });

    initReceptors(window.keys);
    if(typeof updHUD === 'function') updHUD();

    // === SECUENCIA DE INICIO (PRERENDER) ===
    const cd = document.getElementById('countdown');
    cd.style.display = 'flex';
    cd.innerText = "3";
    
    // Preparamos el audio pero con delay
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = s.buf;
    const g = window.st.ctx.createGain();
    g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);
    
    window.st.src.onended = () => { if(window.st.act) end(false); }; // Usamos tu función 'end'
    
    const now = window.st.ctx.currentTime;
    window.st.t0 = now;
    const AUDIO_DELAY = 3; // 3 Segundos de espera
    
    // Programar inicio
    window.st.src.start(now + AUDIO_DELAY);
    
    // Iniciar Loop Visual YA
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
// 4. BUCLE DE JUEGO (RESTAURADO + UPGRADED)
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;
    
    // Tiempo ajustado por el delay de 3s
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    let songTime = now - 3000; // Tiempo real de la canción
    
    if (window.st.songDuration > 0 && songTime > 0) {
        const pct = Math.min(100, (songTime / 1000 / window.st.songDuration) * 100);
        const bar = document.getElementById('top-progress-fill');
        if(bar) bar.style.width = pct + "%";
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    // RECUPERADO: Skins en el loop
    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue;
        
        // Spawnear si está cerca (usando songTime como referencia base + offset)
        // Nota: n.t ya tiene el START_OFFSET de 3000 sumado en genMap
        // Así que comparamos n.t con now directamente
        
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
                
                // RECUPERADO: Sustain trails originales
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

        // Lógica de Hold
        if (n.type === 'hold' && n.h) {
             n.el.style.top = yReceptor + 'px'; 
             const rem = (n.t + n.len) - now;
             const tr = n.el.querySelector('.sustain-trail');
             
             if (tr) tr.style.height = Math.max(0, (rem / 1000) * (window.cfg.spd * 40)) + 'px';
             
             if (!window.st.keys[n.l]) { // Soltó la tecla
                 n.el.style.opacity = 0.4;
                 if (rem > 100 && !n.broken) {
                     window.st.cmb = 0; 
                     n.broken = true;   
                 }
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
// 5. INPUT & VISUALS (MEJORADO)
// ==========================================

// NUEVO: Efecto Splash de Oppa
function createSplash(l) {
    if(!window.cfg.showSplash) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    
    // Obtener color (compatible con skins)
    const color = r.style.getPropertyValue('--col') || window.cfg.modes[window.keys][l].c;
    
    // Crear elemento splash
    const s = document.createElement('div');
    s.className = 'splash-oppa'; // Asegúrate de tener el CSS
    s.style.setProperty('--c', color);
    
    const rect = r.getBoundingClientRect();
    s.style.left = (rect.left + rect.width/2) + 'px';
    s.style.top = (rect.top + rect.height/2) + 'px';
    s.style.position = 'fixed';
    
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 400);
}

// Handlers restaurados
window.onKd = function(e) {
    if (e.key === "Escape") { 
        e.preventDefault(); 
        togglePause(); 
        return; 
    }
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
    const flash = document.getElementById(`flash-${l}`);
    
    if (p) {
        if(!window.st.keys) window.st.keys = [];
        window.st.keys[l] = 1;
        if(r) r.classList.add('pressed');
        if(flash && window.cfg.laneFlash) { 
            flash.style.opacity = 0.5; 
            setTimeout(() => flash.style.opacity=0, 100); 
        }

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = n.t - now; 
            const absDiff = Math.abs(diff);

            // RECUPERADO: Estadísticas para Mean MS
            window.st.totalOffset += absDiff;
            window.st.hitCount++;

            let score=50, text="BAD", color="yellow";
            
            if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
            else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }

            if(text==="BAD") window.st.fcStatus="SD";

            window.st.sc += score; 
            window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb; // Restaurado maxCmb
            window.st.hp = Math.min(100, window.st.hp+2);
            
            showJudge(text, color, diff); 
            playHit(); 
            if(typeof updHUD==='function') updHUD();
            n.h = true; 
            if (n.type === 'tap' && n.el) n.el.style.opacity = 0;
        }
    } else {
        if(window.st.keys) window.st.keys[l] = 0;
        if(r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++; window.st.cmb=0; window.st.hp-=10; window.st.fcStatus="SD";
    playMiss(); 
    if(typeof updHUD==='function') updHUD();
    if(n.el) n.el.style.opacity = 0;
    if(window.st.hp <= 0 && !window.isMultiplayer) end(true);
}

function showJudge(text, color, diffMs) {
    if(!window.cfg.judgeVis) return;
    
    // CSS dinámico para animación
    if(!document.getElementById('style-judge')) {
        const st = document.createElement('style');
        st.id = 'style-judge';
        st.innerHTML = `@keyframes judgePop { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%, -60%) scale(1); opacity: 0; } }`;
        document.head.appendChild(st);
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '50%';
    container.style.top = '40%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = '500';
    container.style.pointerEvents = 'none';

    const j = document.createElement('div');
    j.innerText = text; 
    j.style.color = color;
    j.style.fontSize = '3rem';
    j.style.fontWeight = '900';
    j.style.textShadow = `0 0 10px ${color}`;
    j.style.animation = 'judgePop 0.35s ease-out forwards';
    container.appendChild(j);

    if (text !== "MISS" && typeof diffMs === 'number' && window.cfg.showMs) {
        const msDiv = document.createElement('div');
        const sign = diffMs > 0 ? "+" : "";
        msDiv.innerText = `${sign}${Math.round(diffMs)}ms`;
        msDiv.style.fontSize = '1.2rem';
        msDiv.style.fontWeight = 'bold';
        msDiv.style.textAlign = 'center';
        if (diffMs > 0) msDiv.style.color = "#ffaa00"; 
        else msDiv.style.color = "#00aaff"; 
        msDiv.style.animation = 'judgePop 0.35s ease-out forwards';
        container.appendChild(msDiv);
    }

    document.body.appendChild(container); 
    setTimeout(() => container.remove(), 600);
}

// ==========================================
// 6. UTILIDADES FINALES (RESTAURADAS)
// ==========================================

function updHUD() {
    const scEl = document.getElementById('g-score');
    if(scEl) scEl.innerText = window.st.sc.toLocaleString();
    
    const cEl = document.getElementById('g-combo');
    if(cEl) {
        if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } 
        else cEl.style.opacity=0;
    }
    
    const hpEl = document.getElementById('health-fill');
    if(hpEl) hpEl.style.height = window.st.hp + "%";
    
    // Cálculo preciso de ACC (como en tu zip)
    const maxPlayed = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const playedScore = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    const acc = maxPlayed > 0 ? ((playedScore / maxPlayed)*100).toFixed(1) : "100.0";
    
    const accEl = document.getElementById('g-acc');
    if(accEl) accEl.innerText = acc + "%";
    
    const fcEl = document.getElementById('hud-fc-status');
    if(fcEl) {
        fcEl.innerText = window.st.fcStatus || "GFC";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
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
        
        let xpGain = 0, ppGain = 0;
        if (!died && window.user && window.user.name !== "Guest") {
            xpGain = Math.floor(window.st.sc / 250);
            window.user.xp += xpGain;
            // Guardar
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
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; font-size:1.5rem; margin-bottom:30px;">
                        <div style="color:var(--sick)">SICK: <span>${window.st.stats.s}</span></div>
                        <div style="color:var(--good)">GOOD: <span>${window.st.stats.g}</span></div>
                        <div style="color:var(--bad)">BAD: <span>${window.st.stats.b}</span></div>
                        <div style="color:var(--miss)">MISS: <span>${window.st.stats.m}</span></div>
                    </div>
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
    
    window.st.act = false;
    window.st.paused = false;
    window.songFinished = false;
    
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
}
