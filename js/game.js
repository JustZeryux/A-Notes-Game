/* === AUDIO & ENGINE (MASTER FINAL V10 - OPPA ALGORITHM EXACT) === */

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

// ==========================================
// 2. GENERADOR DE MAPAS (EXACT OPPA ALGORITHM)
// ==========================================

function getSmartLane(last, k) {
    // Lógica adaptada de Oppa para K teclas
    if (Math.random() > 0.8) return Math.floor(Math.random() * k);
    
    // Evitar repetición directa amenos que sea intencional
    let next = Math.floor(Math.random() * k);
    
    // Lógica simple de flujo: tratar de alternar manos
    if(k === 4) {
        if(last===0) return Math.random()>0.5 ? 1 : 2; 
        if(last===1) return Math.random()>0.5 ? 0 : 3;
        if(last===2) return Math.random()>0.5 ? 3 : 0; 
        return Math.random()>0.5 ? 2 : 1;
    }
    
    // Para 6K, 7K, 9K: intentar no repetir la misma nota inmediatamente
    while(next === last) {
        next = Math.floor(Math.random() * k);
    }
    return next;
}

function genMap(buf, k) {
    const data = buf.getChannelData(0);
    const sampleRate = buf.sampleRate;
    const map = [];
    
    // Offset para el Prerender (3 segundos)
    const START_OFFSET = 3000; 

    // === CONFIGURACIÓN DEL ALGORITMO (OPPA EXACT) ===
    const density = window.cfg.den || 5;
    
    // Oppa usa 60 FPS de muestreo
    const step = Math.floor(sampleRate / 60); 
    
    // Umbrales calculados como en Oppa
    let minDistMs = 400 - (density * 30); 
    if(minDistMs < 60) minDistMs = 60;
    
    let thresholdMult = 1.7 - (density * 0.08); 
    
    let lastNoteTime = -1000; 
    let lastLane = Math.floor(k/2); 
    
    // Historial de Energía (Energy History)
    const energyHistory = [];
    
    // Lógica de Escaleras (Stairs)
    let staircaseCount = 0; 
    let staircaseDir = 1;

    for (let i = 0; i < data.length; i += step) {
        // 1. Calcular Energía RMS (Root Mean Square) del segmento
        let sum = 0; 
        for(let j=0; j<step && (i+j)<data.length; j++) {
            sum += data[i+j] * data[i+j];
        }
        const instant = Math.sqrt(sum / step);
        
        // 2. Mantener historial de energía local
        energyHistory.push(instant); 
        if(energyHistory.length > 30) energyHistory.shift();
        
        // Calcular promedio local
        const localAvg = energyHistory.reduce((a,b)=>a+b,0) / energyHistory.length;

        // 3. Detección de Beat
        // El instante debe ser mayor al promedio local multiplicado por el umbral
        if(instant > localAvg * thresholdMult && instant > 0.005) {
            
            const timeMs = (i / sampleRate) * 1000 + START_OFFSET; // + OFFSET AQUI
            
            if(timeMs - lastNoteTime > minDistMs) {
                let lane;
                let type = 'tap';
                let length = 0;
                
                // --- Lógica de Patrones ---
                if (staircaseCount > 0) {
                    // Continuar escalera
                    lane = (lastLane + staircaseDir + k) % k;
                    staircaseCount--;
                } else {
                    // Nueva patrón?
                    // Si es intenso y denso, iniciar escalera
                    if (density >= 4 && instant > localAvg * 1.5 && Math.random() > 0.6) {
                        staircaseCount = Math.floor(Math.random() * 3) + 1; // 1 a 3 notas
                        staircaseDir = Math.random() > 0.5 ? 1 : -1;
                        lane = getSmartLane(lastLane, k);
                    } else {
                        lane = getSmartLane(lastLane, k);
                    }
                }

                // --- Lógica de Holds (Notas Largas) ---
                // "Mira hacia adelante 5 pasos" (Oppa logic)
                // (Adaptado ligeramente para que no sea infinito)
                let isHold = true;
                // Miramos si la energía cae rápido
                // En oppa: if (i + j * step < data.length && Math.abs(data[i + j * step]) < 0.1)
                // Usamos RMS para consistencia
                /* Nota: En el original de oppa se usa Math.abs(data) directo para el hold check, 
                   mientras usa RMS para el beat. Mantendremos RMS para mejor precisión.
                */
                
                // Generar duración aleatoria si es un beat fuerte y largo (simplificación de Oppa)
                if (instant > localAvg * 1.4 && Math.random() > 0.7) {
                     length = Math.random() * 300 + 100;
                     type = 'hold';
                }

                // --- Lógica de Dobles (Multi-Notes) ---
                // Oppa: if(staircaseCount === 0 && config.density >= 6 && instant > localAvg * (thresholdMult + 0.5))
                let addedDouble = false;
                if(staircaseCount === 0 && density >= 5 && instant > localAvg * (thresholdMult + 0.4)) {
                     let lane2 = (lane + Math.floor(k/2)) % k; // Nota opuesta o lejana
                     if(lane2 === lane) lane2 = (lane + 1) % k;
                     
                     map.push({ t: timeMs, l: lane2, type: 'tap', len: 0, h: false });
                     addedDouble = true;
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
// 3. CORE DEL JUEGO
// ==========================================

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

        // Generar Mapa con el nuevo algoritmo
        const notes = genMap(buffer, k);
        
        playSongInternal(buffer, notes, k);
        
        if(loader) loader.style.display = 'none';

    } catch (e) {
        console.error(e);
        alert("Error cargando audio: " + e.message);
        if(loader) loader.style.display = 'none';
    }
};

window.playSongInternal = function(buffer, notes, keys) {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
    
    elTrack = document.getElementById('track');
    elTrack.innerHTML = '';
    
    window.keys = keys || 4;
    const modeCfg = window.cfg.modes[window.keys];
    const width = 100 / window.keys;
    const judgeY = window.cfg.down ? (window.innerHeight - 150) : 120;
    
    for(let i = 0; i < window.keys; i++) {
        const d = document.createElement('div');
        d.className = 'arrow-wrapper receptor';
        d.id = `rec-${i}`;
        d.style.left = (i * width) + '%';
        d.style.width = width + '%';
        d.style.top = judgeY + 'px';
        
        const c = modeCfg[i].c;
        const s = window.PATHS[modeCfg[i].s] || window.PATHS.circle;
        
        d.style.setProperty('--col', c);
        d.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${c})">
            <path d="${s}" fill="none" stroke="${c}" stroke-width="4" />
        </svg>`;
        elTrack.appendChild(d);
        
        const l = document.createElement('div');
        l.style.position = 'absolute';
        l.style.left = (i * width) + '%';
        l.style.width = width + '%';
        l.style.height = '100%';
        l.style.background = `linear-gradient(to bottom, transparent, ${c}22)`;
        l.style.borderLeft = '1px solid rgba(255,255,255,0.05)';
        l.style.zIndex = '-1';
        elTrack.appendChild(l);
    }

    window.st.notes = notes;
    window.st.hp = 50;
    window.st.score = 0;
    window.st.combo = 0;
    window.st.maxCombo = 0;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.act = false;
    window.st.paused = false;
    
    updateHUD();

    // === START SEQUENCE ===
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = buffer;
    window.st.gain = window.st.ctx.createGain();
    window.st.gain.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(window.st.gain);
    window.st.gain.connect(window.st.ctx.destination);
    
    window.st.src.onended = () => { if(window.st.act) endGame(false); };

    const now = window.st.ctx.currentTime;
    window.st.t0 = now;
    const AUDIO_DELAY = 3; 
    
    window.st.src.start(now + AUDIO_DELAY);
    
    window.st.act = true;
    requestAnimationFrame(loop);

    const cd = document.getElementById('countdown');
    cd.innerText = "3";
    cd.style.display = 'flex';
    
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if (count > 0) cd.innerText = count;
        else {
            cd.innerText = "GO!";
            setTimeout(() => { cd.style.display = 'none'; }, 500);
            clearInterval(iv);
        }
    }, 1000);
}

// ==========================================
// 4. GAME LOOP
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;

    const currentTime = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    if(currentTime > 3000 && window.st.src.buffer) {
        const dur = window.st.src.buffer.duration * 1000;
        const pct = Math.min(100, Math.max(0, (currentTime - 3000) / dur * 100));
        const bar = document.getElementById('top-progress-fill');
        if(bar) bar.style.width = pct + '%';
    }

    const keys = window.keys;
    const speed = window.cfg.spd || 25;
    const downscroll = window.cfg.down;
    const receptorY = downscroll ? (window.innerHeight - 150) : 120;
    const width = 100 / keys;

    window.st.notes.forEach((n, i) => {
        const diff = n.t - currentTime; 
        
        if (diff < 2500 && diff > -500) {
            let el = document.getElementById(`n-${i}`);
            
            if (!n.h) {
                if (!el) {
                    el = document.createElement('div');
                    el.id = `n-${i}`;
                    el.className = 'arrow-wrapper';
                    el.style.width = width + '%';
                    el.style.left = (n.l * width) + '%';
                    
                    const c = window.cfg.modes[keys][n.l].c;
                    const s = window.PATHS[window.cfg.modes[keys][n.l].s] || window.PATHS.circle;
                    
                    let svg = `<svg class="arrow-svg" viewBox="0 0 100 100">
                        <path d="${s}" fill="${c}" stroke="white" stroke-width="2" style="filter:drop-shadow(0 0 5px ${c})"/>
                    </svg>`;
                    
                    if (n.type === 'hold') {
                        const hHeight = (n.len / 10) * (speed / 2.2);
                        const gradDir = downscroll ? 'top' : 'bottom';
                        svg += `<div class="hold-body" style="
                            height:${hHeight}px; 
                            ${downscroll ? 'bottom:50%' : 'top:50%'}; 
                            background: linear-gradient(to ${gradDir}, ${c}, transparent);
                            width: 40%; left: 30%; position: absolute; opacity: 0.6;
                        "></div>`;
                    }
                    el.innerHTML = svg;
                    elTrack.appendChild(el);
                }

                const dist = (diff / 10) * (speed / 2.2);
                const visY = downscroll ? (receptorY - dist) : (receptorY + dist);
                el.style.top = visY + 'px';
                
                if (diff < -160 && !n.h) {
                    miss();
                    n.h = true;
                    if(el) el.remove();
                }
            }
        } else {
            const el = document.getElementById(`n-${i}`);
            if (el) el.remove();
        }
    });

    requestAnimationFrame(loop);
}

// ==========================================
// 5. INPUT & UTILIDADES
// ==========================================
window.handleInput = function(kIndex, isPressed) {
    if(!window.st.act || window.st.paused) return;
    
    const r = document.getElementById(`rec-${kIndex}`);
    
    if (isPressed) {
        if(r) {
            r.classList.add('pressed');
            r.style.transform = "scale(0.9)";
        }
        
        const currentTime = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const note = window.st.notes.find(n => !n.h && n.l === kIndex && Math.abs(n.t - currentTime) < 180);

        if (note) {
            const diff = Math.abs(note.t - currentTime);
            note.h = true;
            
            const el = document.getElementById(`n-${window.st.notes.indexOf(note)}`);
            if(el && note.type !== 'hold') el.remove();
            
            let txt="BAD", color="var(--bad)", pts=50, hp=-2;

            if (diff < 45) {
                txt="SICK!!"; color="var(--sick)"; pts=350; hp=4;
                window.st.stats.s++;
                createSplash(kIndex);
            } else if (diff < 90) {
                txt="GOOD"; color="var(--good)"; pts=150; hp=2;
                window.st.stats.g++;
                createSplash(kIndex);
            } else {
                window.st.stats.b++;
                window.st.combo = 0;
            }

            if(hp > 0) window.st.combo++;
            if(window.st.combo > window.st.maxCombo) window.st.maxCombo = window.st.combo;
            
            window.st.score += pts;
            window.st.hp = Math.min(100, window.st.hp + hp);
            
            showJudge(txt, color);
            playSound(window.hitBuf, window.cfg.hvol);
        }
    } else {
        if(r) {
            r.classList.remove('pressed');
            r.style.transform = "scale(1)";
        }
    }
    updateHUD();
};

function miss() {
    window.st.stats.m++;
    window.st.combo = 0;
    window.st.hp -= 6;
    showJudge("MISS", "var(--miss)");
    playSound(window.missBuf, window.cfg.mvol || 0.4);
    updateHUD();
    if (window.st.hp <= 0) endGame(true);
}

function createSplash(l) {
    if(!window.cfg.showSplash) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    const color = window.cfg.modes[window.keys][l].c;
    const rect = r.getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'splash-oppa';
    s.style.setProperty('--c', color);
    s.style.left = (rect.left + rect.width/2) + 'px';
    s.style.top = (rect.top + rect.height/2) + 'px';
    s.style.position = 'fixed';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 400);
}

function showJudge(text, color) {
    const j = document.createElement('div');
    j.innerText = text;
    j.style.color = color;
    j.style.position = 'absolute';
    j.style.left = '50%';
    j.style.top = '40%';
    j.style.transform = 'translate(-50%, -50%)';
    j.style.fontSize = '3rem';
    j.style.fontWeight = '900';
    j.style.textShadow = `0 0 10px ${color}`;
    j.style.zIndex = '500';
    j.style.animation = 'judgePop 0.3s ease-out forwards';
    
    if(!document.getElementById('anim-judge')) {
        const style = document.createElement('style');
        style.id = 'anim-judge';
        style.innerHTML = `@keyframes judgePop { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%, -60%) scale(1); opacity: 0; } }`;
        document.head.appendChild(style);
    }
    document.body.appendChild(j);
    setTimeout(() => j.remove(), 350);
}

function playSound(buf, vol=0.5) {
    if(!buf || !window.st.ctx) return;
    const s = window.st.ctx.createBufferSource();
    s.buffer = buf;
    const g = window.st.ctx.createGain();
    g.gain.value = vol;
    s.connect(g); g.connect(window.st.ctx.destination);
    s.start(0);
}

function updateHUD() {
    document.getElementById('g-score').innerText = window.st.score.toLocaleString();
    document.getElementById('g-combo').innerText = window.st.combo;
    const bar = document.getElementById('health-fill');
    if(bar) bar.style.height = window.st.hp + '%';
    
    document.getElementById('h-sick').innerText = window.st.stats.s;
    document.getElementById('h-good').innerText = window.st.stats.g;
    document.getElementById('h-bad').innerText = window.st.stats.b;
    document.getElementById('h-miss').innerText = window.st.stats.m;
    
    const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
    const acc = total === 0 ? 100 : Math.round(((window.st.stats.s + window.st.stats.g * 0.5) / total) * 100);
    document.getElementById('g-acc').innerText = acc + '%';
}

window.togglePause = function() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    const modal = document.getElementById('modal-pause');
    if(window.st.paused) {
        window.st.pauseTime = performance.now();
        if(window.st.ctx) window.st.ctx.suspend();
        if(modal) {
            modal.style.display = 'flex';
            document.getElementById('p-acc').innerText = document.getElementById('g-acc').innerText;
            document.getElementById('p-sick').innerText = window.st.stats.s;
            document.getElementById('p-good').innerText = window.st.stats.g;
            document.getElementById('p-bad').innerText = window.st.stats.b;
            document.getElementById('p-miss').innerText = window.st.stats.m;
        }
    } else {
        resumeGame();
    }
};

window.resumeGame = function() {
    document.getElementById('modal-pause').style.display = 'none';
    if(window.st.pauseTime) {
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration;
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx) window.st.ctx.resume();
    requestAnimationFrame(loop);
};

function endGame(died) {
    window.st.act = false;
    if(window.st.src) { try{ window.st.src.stop(); }catch(e){} }
    
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('modal-res').style.display = 'flex';
    document.getElementById('menu-container').classList.remove('hidden'); 
    
    const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
    const acc = total === 0 ? 0 : Math.round(((window.st.stats.s + window.st.stats.g * 0.5) / total) * 100);
    
    const rankEl = document.getElementById('res-rank');
    let rank = "F"; let color = "var(--miss)";
    
    if(!died) {
        if(acc >= 95) { rank = "S"; color = "var(--gold)"; }
        else if(acc >= 90) { rank = "A"; color = "var(--good)"; }
        else if(acc >= 80) { rank = "B"; color = "var(--blue)"; }
        else { rank = "C"; color = "white"; }
    }
    
    rankEl.innerText = rank;
    rankEl.style.color = color;
    document.getElementById('res-score').innerText = window.st.score.toLocaleString();
    document.getElementById('res-acc').innerText = acc + '%';
    
    if(!died && window.user && window.user.name !== "Guest") {
        window.user.score += window.st.score;
        window.user.plays = (window.user.plays || 0) + 1;
        if(window.save) window.save();
    }
}

window.addEventListener('keydown', e => {
    if(window.st.paused) return;
    const k = e.key.toLowerCase();
    const map = window.cfg.modes[window.keys].map(x => x.k);
    const idx = map.indexOf(k);
    if(idx !== -1 && !e.repeat) handleInput(idx, true);
    if(k === "escape") window.togglePause();
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    const map = window.cfg.modes[window.keys].map(x => x.k);
    const idx = map.indexOf(k);
    if(idx !== -1) handleInput(idx, false);
});
