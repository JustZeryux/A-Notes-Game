/* === AUDIO & ENGINE (MASTER FINAL V8.0 - PRERENDER SYNC) === */

let elTrack = null;
let mlContainer = null;

// ==========================================
// 1. SISTEMA DE AUDIO
// ==========================================
function unlockAudio() {
    if (!window.st.ctx) {
        try {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Buffer vacío para desbloquear el motor de audio en móviles/chrome
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
    // Generar sonido de Hit (Sintético)
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;

    // Generar sonido de Miss (Ruido blanco)
    const b2 = window.st.ctx.createBuffer(1, 4000, 44100);
    const d2 = b2.getChannelData(0);
    for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / 1000);
    window.missBuf = b2;
}

// ==========================================
// 2. GENERADOR DE MAPAS (OPPA STYLE + MULTI)
// ==========================================
function genMap(buf, k) {
    const data = buf.getChannelData(0);
    const sampleRate = buf.sampleRate;
    const map = [];
    
    // === START OFFSET IMPORTANTE ===
    // Empujamos todas las notas 3000ms (3 segundos)
    // Esto crea el espacio para la cuenta regresiva (3, 2, 1)
    const START_OFFSET = 3000; 

    // Configuración del algoritmo
    const step = Math.floor(sampleRate / 60); 
    let lastTime = -1000;
    let lastLane = Math.floor(k / 2);
    let direction = 1;
    
    // Dificultad basada en slider (1 a 10)
    const density = window.cfg.den || 5;
    const thresholdBase = 0.18 - (density * 0.015); 

    for (let i = 0; i < data.length; i += step) {
        // Calculamos el tiempo REAL del audio y le sumamos el offset
        const timeMs = (i / sampleRate) * 1000 + START_OFFSET;
        const volume = Math.abs(data[i]);
        const minTimeDist = 550 - (density * 45);

        if (volume > thresholdBase && (timeMs - lastTime) > minTimeDist) {
            let lane;
            let type = 'tap';
            let length = 0;

            // Patrones según volumen
            if (volume > 0.4) {
                // Escaleras
                lane = (lastLane + direction + k) % k;
                if (Math.random() > 0.7) {
                     direction *= -1; 
                     lane = Math.floor(Math.random() * k); // Salto
                }
            } else {
                lane = Math.floor(Math.random() * k);
            }

            // Detección de Holds (Notas largas)
            let holdSteps = 0;
            for (let j = 1; j < 8; j++) {
                if (i + j * step < data.length) {
                    if (Math.abs(data[i + j * step]) > thresholdBase * 0.8) holdSteps++;
                }
            }
            if (holdSteps > 5 && volume > 0.3) {
                type = 'hold';
                length = Math.min(holdSteps * (step / sampleRate) * 1000 * 4, 2000); 
            }

            // Generación de Acordes (Multi-Notes) para intensidad alta
            if (volume > 0.75 && k >= 4 && density >= 5) {
                let secondLane = (lane + 2) % k; 
                if(secondLane !== lane) {
                     map.push({ t: timeMs, l: secondLane, type: 'tap', len: 0, h: false });
                }
            }

            map.push({ t: timeMs, l: lane, type: type, len: length, h: false });
            lastTime = timeMs;
            lastLane = lane;
        }
    }
    return map;
}

// ==========================================
// 3. CORE DEL JUEGO
// ==========================================
function playSong(buffer, keys) {
    if(!buffer) return alert("Audio no cargado");
    
    // UI Setup
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
    
    elTrack = document.getElementById('track');
    elTrack.innerHTML = '';
    
    // Generar Receptores (Teclas fijas)
    // Usamos window.keys globalmente
    window.keys = keys; 
    const modeCfg = window.cfg.modes[keys];
    const width = 100 / keys;
    
    // Posición Y del receptor (Downscroll vs Upscroll)
    // Si es downscroll, el receptor va abajo (ej. 90%). Si no, arriba (10-15%)
    const judgeY = window.cfg.down ? (window.innerHeight - 150) : 120;
    // Guardamos judgeY en CSS variable para usarlo en el loop visual si quieres
    
    for(let i = 0; i < keys; i++) {
        const d = document.createElement('div');
        d.className = 'arrow-wrapper receptor';
        d.id = `rec-${i}`;
        d.style.left = (i * width) + '%';
        d.style.width = width + '%';
        d.style.top = judgeY + 'px'; // Posición fija
        
        // Colores y formas
        const c = modeCfg[i].c;
        const s = window.PATHS[modeCfg[i].s] || window.PATHS.circle;
        
        d.style.setProperty('--col', c); // Variable para CSS del splash
        d.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${c})">
            <path d="${s}" fill="none" stroke="${c}" stroke-width="4" />
        </svg>`;
        elTrack.appendChild(d);
        
        // Carril (Lane) background
        const l = document.createElement('div');
        l.style.position = 'absolute';
        l.style.left = (i * width) + '%';
        l.style.width = width + '%';
        l.style.height = '100%';
        l.style.background = `linear-gradient(to bottom, transparent, ${c}22)`;
        l.style.borderLeft = '1px solid rgba(255,255,255,0.05)';
        if(i === keys-1) l.style.borderRight = '1px solid rgba(255,255,255,0.05)';
        l.style.zIndex = '-1';
        elTrack.appendChild(l);
    }

    // Inicializar Estado
    window.st.notes = genMap(buffer, keys);
    window.st.hp = 50;
    window.st.score = 0;
    window.st.combo = 0;
    window.st.maxCombo = 0;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.act = false;
    window.st.paused = false;
    window.songFinished = false;
    
    updateHUD();
    playSongInternal(buffer);
}

function playSongInternal(buffer) {
    unlockAudio();
    
    // Configurar Fuente de Audio
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = buffer;
    
    // Gain Node para volumen
    window.st.gain = window.st.ctx.createGain();
    window.st.gain.gain.value = window.cfg.vol || 0.5;
    
    window.st.src.connect(window.st.gain);
    window.st.gain.connect(window.st.ctx.destination);
    
    window.st.src.onended = () => { if(window.st.act) endGame(false); };

    // === SINCRONIZACIÓN PERFECTA (PRERENDER) ===
    
    // 1. Establecer el tiempo CERO del juego AHORA MISMO
    const now = window.st.ctx.currentTime;
    window.st.t0 = now; 
    
    // 2. Programar que la música suene en 3 segundos (AUDIO_DELAY)
    const AUDIO_DELAY = 3; 
    window.st.src.start(now + AUDIO_DELAY);
    
    // 3. Iniciar el LOOP visual INMEDIATAMENTE
    // Esto hará que las notas (que están en T=3000) empiecen a bajar desde ya
    window.st.act = true;
    requestAnimationFrame(loop);

    // 4. Iniciar la Cuenta Regresiva Visual (3, 2, 1...)
    // Esto es solo visual, no controla la lógica
    const cd = document.getElementById('countdown');
    cd.innerText = "3";
    cd.style.display = 'flex';
    
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if (count > 0) {
            cd.innerText = count;
        } else {
            cd.innerText = "GO!";
            // Efecto de desaparecer el GO
            setTimeout(() => { cd.style.display = 'none'; }, 500);
            clearInterval(iv);
        }
    }, 1000);
}

// ==========================================
// 4. GAME LOOP (VISUAL & LÓGICA)
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;

    // Calcular tiempo actual del juego en MS
    // Como t0 fue hace un rato, 'now' va subiendo: 0... 1000... 3000 (música empieza)
    const currentTime = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    // Actualizar barra de progreso (Solo si la canción ya "empezó" auditivamente)
    if(currentTime > 0 && window.st.src.buffer) {
        const dur = window.st.src.buffer.duration * 1000;
        const pct = Math.min(100, Math.max(0, (currentTime - 3000) / (dur) * 100)); // Restamos 3000 del offset visual
        document.getElementById('top-progress-fill').style.width = pct + '%';
    }

    // Configuración visual
    const keys = window.keys;
    const speed = window.cfg.spd || 25; // Velocidad scroll
    const downscroll = window.cfg.down;
    const receptorY = downscroll ? (window.innerHeight - 150) : 120;
    const width = 100 / keys;

    // Renderizar Notas
    window.st.notes.forEach((n, i) => {
        // Optimización: Solo procesar notas cercanas
        // currentTime va de 0 a infinito. La nota está en n.t (ej. 3500)
        // diff es positivo si la nota está en el futuro
        const diff = n.t - currentTime; 
        
        // Ventana de renderizado (desde -500ms pasado hasta 2000ms futuro)
        if (diff < 2500 && diff > -500) {
            // Verificar si ya existe el elemento DOM
            let el = document.getElementById(`n-${i}`);
            
            if (!n.h) { // Si no ha sido golpeada (hit)
                if (!el) {
                    // CREAR NOTA
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
                    
                    // Si es nota larga (HOLD)
                    if (n.type === 'hold') {
                        // Calcular altura del hold
                        const hHeight = (n.len / 10) * (speed / 2.2); // Ajuste visual de altura
                        // Dirección del hold según scroll
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

                // MOVER NOTA
                // Distancia en pixeles = tiempo * velocidad
                const dist = (diff / 10) * (speed / 2.2);
                const visY = downscroll ? (receptorY - dist) : (receptorY + dist);
                
                el.style.top = visY + 'px';
                
                // Miss Detection (Si pasa de largo)
                if (diff < -160 && !n.h) {
                    miss(i);
                    n.h = true;
                    if(el) el.remove();
                }
            }
        } else {
            // Limpieza de notas fuera de pantalla
            const el = document.getElementById(`n-${i}`);
            if (el) el.remove();
        }
    });

    requestAnimationFrame(loop);
}

// ==========================================
// 5. INPUT & JUDGEMENT
// ==========================================
window.handleInput = function(kIndex, isPressed) {
    if(!window.st.act || window.st.paused) return;
    
    const r = document.getElementById(`rec-${kIndex}`);
    
    if (isPressed) {
        if(r) {
            r.classList.add('pressed');
            r.style.transform = "scale(0.9)";
        }
        
        // Buscar nota golpeable
        const currentTime = (window.st.ctx.currentTime - window.st.t0) * 1000;
        // Buscamos la primera nota en el carril que no esté hiteada y esté cerca
        const note = window.st.notes.find(n => !n.h && n.l === kIndex && Math.abs(n.t - currentTime) < 180);

        if (note) {
            const diff = Math.abs(note.t - currentTime);
            note.h = true; // Marcar como golpeada
            
            // Eliminar visualmente la nota tap
            const el = document.getElementById(`n-${window.st.notes.indexOf(note)}`);
            if(el && note.type !== 'hold') el.remove(); // Si es hold, la lógica sería más compleja, por simpleza la quitamos
            
            // JUICIO
            let txt = "BAD";
            let color = "var(--bad)";
            let pts = 50;
            let health = -2;

            if (diff < 45) {
                txt = "SICK!!"; color = "var(--sick)"; pts = 350; health = 4;
                window.st.stats.s++;
                createSplash(kIndex); // EFECTO SPLASH
            } else if (diff < 90) {
                txt = "GOOD"; color = "var(--good)"; pts = 150; health = 2;
                window.st.stats.g++;
                createSplash(kIndex);
            } else {
                window.st.stats.b++;
                window.st.combo = 0; // Rompe combo en Bad
            }

            if(health > 0) window.st.combo++;
            if(window.st.combo > window.st.maxCombo) window.st.maxCombo = window.st.combo;
            
            window.st.score += pts;
            window.st.hp = Math.min(100, window.st.hp + health);
            
            showJudge(txt, color);
            playSound(window.hitBuf, window.cfg.hvol);
        } else {
            // Ghost tapping (opcional: quitar vida si aprieta sin nota)
            // window.st.hp -= 1; 
        }
    } else {
        if(r) {
            r.classList.remove('pressed');
            r.style.transform = "scale(1)";
        }
    }
    updateHUD();
};

function miss(lane) {
    window.st.stats.m++;
    window.st.combo = 0;
    window.st.hp -= 6;
    showJudge("MISS", "var(--miss)");
    playSound(window.missBuf, window.cfg.mvol || 0.4);
    updateHUD();
    if (window.st.hp <= 0) endGame(true);
}

// === EFECTOS VISUALES (SPLASH & JUDGE) ===
function createSplash(l) {
    if(!window.cfg.vivid) return; // Respetar config
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    
    const color = window.cfg.modes[window.keys][l].c;
    const rect = r.getBoundingClientRect();
    
    const s = document.createElement('div');
    s.className = 'splash-oppa'; // Clase CSS nueva
    s.style.setProperty('--c', color);
    s.style.left = (rect.left + rect.width/2) + 'px';
    s.style.top = (rect.top + rect.height/2) + 'px';
    s.style.position = 'fixed'; // Importante para que no se mueva
    
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
    
    // Estilo CSS inyectado para animación
    if(!document.getElementById('anim-judge')) {
        const style = document.createElement('style');
        style.id = 'anim-judge';
        style.innerHTML = `@keyframes judgePop { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%, -60%) scale(1); opacity: 0; } }`;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(j);
    setTimeout(() => j.remove(), 350);
}

// ==========================================
// 6. UTILIDADES Y FINALIZACIÓN
// ==========================================
function playSound(buf, vol=0.5) {
    if(!buf || !window.st.ctx) return;
    const s = window.st.ctx.createBufferSource();
    s.buffer = buf;
    const g = window.st.ctx.createGain();
    g.gain.value = vol;
    s.connect(g);
    g.connect(window.st.ctx.destination);
    s.start(0);
}

function updateHUD() {
    document.getElementById('g-score').innerText = window.st.score.toLocaleString();
    document.getElementById('g-combo').innerText = window.st.combo;
    document.getElementById('health-fill').style.height = window.st.hp + '%';
    document.getElementById('h-sick').innerText = window.st.stats.s;
    document.getElementById('h-good').innerText = window.st.stats.g;
    document.getElementById('h-bad').innerText = window.st.stats.b;
    document.getElementById('h-miss').innerText = window.st.stats.m;
    
    const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
    const acc = total === 0 ? 100 : Math.round(((window.st.stats.s + window.st.stats.g * 0.5) / total) * 100);
    document.getElementById('g-acc').innerText = acc + '%';
}

function togglePause() {
    if(!window.st.act) return;
    
    window.st.paused = !window.st.paused;
    const modal = document.getElementById('modal-pause');
    
    if(window.st.paused) {
        // Pausar Audio
        window.st.pauseTime = performance.now();
        if(window.st.ctx) window.st.ctx.suspend();
        
        modal.style.display = 'flex';
        // Llenar datos de pausa
        document.getElementById('p-acc').innerText = document.getElementById('g-acc').innerText;
        document.getElementById('p-sick').innerText = window.st.stats.s;
        document.getElementById('p-good').innerText = window.st.stats.g;
        document.getElementById('p-bad').innerText = window.st.stats.b;
        document.getElementById('p-miss').innerText = window.st.stats.m;
    } else {
        resumeGame();
    }
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if(window.st.pauseTime) {
        // Ajustar el t0 para compensar el tiempo pausado
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration;
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx) window.st.ctx.resume();
    requestAnimationFrame(loop);
}

function endGame(died) {
    window.st.act = false;
    if(window.st.src) { try{ window.st.src.stop(); }catch(e){} }
    
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('modal-res').style.display = 'flex';
    
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
    
    // Guardar si no es Guest
    if(!died && window.user && window.user.name !== "Guest") {
        window.user.score += window.st.score;
        window.user.plays = (window.user.plays || 0) + 1;
        save(); // Función global de ui.js
    }
}

// Listeners de Input
window.addEventListener('keydown', e => {
    if(window.st.paused) return;
    const k = e.key.toLowerCase();
    const map = window.cfg.modes[window.keys].map(x => x.k);
    const idx = map.indexOf(k);
    if(idx !== -1 && !e.repeat) handleInput(idx, true);
    if(k === "escape") togglePause();
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    const map = window.cfg.modes[window.keys].map(x => x.k);
    const idx = map.indexOf(k);
    if(idx !== -1) handleInput(idx, false);
});
