/* === AUDIO & ENGINE (MASTER V30 - SMART GEN) === */

// Cache de elementos DOM para rendimiento
let elTrack = null;
let mlContainer = null;

// === 1. SISTEMA DE AUDIO (ROBUSTO) ===
function unlockAudio() {
    // Verificar y reactivar el contexto global
    if (!window.st.ctx) {
        try {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            // "Calentar" el motor de audio con un buffer vacío silencioso
            // Esto evita el lag en la primera nota real
            const b = window.st.ctx.createBuffer(1, 1, 22050);
            const s = window.st.ctx.createBufferSource();
            s.buffer = b;
            s.connect(window.st.ctx.destination);
            s.start(0);
            
            console.log("Motor de audio iniciado.");
            genSounds(); // Generar sonidos de hit/miss
        } catch(e) { console.error("Error crítico AudioContext:", e); }
    }
    
    if (window.st.ctx && window.st.ctx.state === 'suspended') {
        window.st.ctx.resume().then(() => console.log("Audio reanudado por interacción"));
    }
}

function genSounds() {
    if(!window.st.ctx) return;
    
    // HIT SOUND: Seno con decaimiento rápido (Clicky)
    // Usamos 300 en el exp para que sea corto y preciso (feedback rítmico)
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;

    // MISS SOUND: Ruido blanco con decaimiento
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
        g.gain.value = window.cfg.hvol;
        s.connect(g); g.connect(window.st.ctx.destination);
        s.start(0);
    }
}

function playMiss() {
    if (window.missBuf && window.cfg.missSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource();
        s.buffer = window.missBuf;
        const g = window.st.ctx.createGain();
        g.gain.value = window.cfg.missVol;
        s.connect(g); g.connect(window.st.ctx.destination);
        s.start(0);
    }
}

// === 2. GENERADOR DE MAPAS "INTELIGENTE" (RHYTHM ALGORITHM) ===
function genMap(buf, k) {
    if(!buf) return [];
    console.log("Analizando audio para generación...");
    
    const data = buf.getChannelData(0);
    const map = [];
    const sampleRate = buf.sampleRate;
    
    // Configuración basada en la densidad elegida (1 a 10)
    let safeDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;
    
    // Umbrales dinámicos
    // A mayor densidad, menor umbral (detecta golpes más suaves)
    const thresholdBase = 1.4 - (safeDen * 0.05); 
    const minStep = Math.max(60, 180 - (safeDen * 12)); // Distancia mínima entre notas (ms)
    
    // Ventana de análisis (FFT simplificado)
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 100); // Resolución de análisis
    
    // Variables de Estado para Patrones
    let lastTime = 0;
    let lastLane = 0;
    let energyHistory = []; 
    const historyLen = 40; // Guardamos historia para calcular promedio local
    
    // Estados de patrón: 0=Random, 1=Stream(Escalera), 2=Jack(Repetir), 3=Trill(Alternar)
    let currentPattern = 0;
    let patternDuration = 0; 
    let patternDir = 1; // 1: Derecha, -1: Izquierda

    for (let i = 0; i < data.length - windowSize; i += step) {
        // 1. Calcular energía instantánea (RMS)
        let sum = 0;
        for (let j = 0; j < windowSize; j += 16) {
            sum += Math.abs(data[i + j]);
        }
        const instantEnergy = sum / (windowSize / 16);
        
        // 2. Calcular promedio local (Energía de fondo)
        energyHistory.push(instantEnergy);
        if (energyHistory.length > historyLen) energyHistory.shift();
        
        let localAvg = 0;
        for(let e of energyHistory) localAvg += e;
        localAvg /= energyHistory.length;
        
        const timeMs = (i / sampleRate) * 1000;
        
        // Intro Skip (1.5s)
        if (timeMs < 1500) continue;

        // 3. DETECCIÓN DE ONSET (GOLPE)
        // Si la energía instantánea supera al promedio local multiplicado por el umbral
        if (instantEnergy > localAvg * thresholdBase && (timeMs - lastTime > minStep)) {
            
            let lanesToSpawn = [];
            let isHold = false;
            let holdLen = 0;
            
            // Lógica de Hold Note (Si la energía se mantiene alta por un tiempo futuro)
            // Miramos un poco adelante en el buffer
            if (instantEnergy > localAvg * 1.5 && Math.random() > 0.65) {
                isHold = true;
                holdLen = Math.min(800, Math.random() * 400 + 100);
            }

            // --- LÓGICA DE PATRONES ---
            // Cambiar patrón cada cierto tiempo
            if (patternDuration <= 0) {
                const rand = Math.random();
                if (rand < 0.4) currentPattern = 1; // 40% Stream/Escalera
                else if (rand < 0.6) currentPattern = 2; // 20% Jack
                else if (rand < 0.8) currentPattern = 3; // 20% Trill
                else currentPattern = 0; // 20% Random
                
                patternDuration = Math.floor(Math.random() * 8) + 4; // Durar 4-12 notas
                patternDir = Math.random() > 0.5 ? 1 : -1;
            }

            let lane = 0;

            if (currentPattern === 1) { 
                // ESCALERA: 0, 1, 2, 3...
                lane = (lastLane + patternDir + k) % k; 
            } else if (currentPattern === 2) { 
                // JACK: 2, 2, 2...
                lane = lastLane;
                // Romper jack si es muy largo para no hacerlo imposible
                if (Math.random() > 0.7) lane = (lane + 1) % k;
            } else if (currentPattern === 3) { 
                // TRILL: 1, 3, 1, 3...
                lane = (lastLane + 2) % k;
            } else { 
                // RANDOM
                lane = Math.floor(Math.random() * k);
            }

            lanesToSpawn.push(lane);

            // --- CHORDS (ACORDES/DOBLES) ---
            // Depende de la densidad y la intensidad del golpe
            const isHeavyHit = instantEnergy > localAvg * 1.8;
            const highDensity = safeDen >= 6;
            
            if (isHeavyHit && (highDensity || Math.random() > 0.7)) {
                // Agregar segunda nota para acorde
                let secondLane = (lane + Math.floor(k/2)) % k; 
                // Asegurar que no sea la misma
                if (secondLane === lane) secondLane = (lane + 1) % k;
                
                if (!lanesToSpawn.includes(secondLane)) lanesToSpawn.push(secondLane);
            }
            
            // Triple para modo 9K o Extrema densidad
            if (k >= 6 && safeDen >= 9 && instantEnergy > localAvg * 2.5) {
                let thirdLane = (lane + 2) % k;
                if (!lanesToSpawn.includes(thirdLane)) lanesToSpawn.push(thirdLane);
            }

            // Generar las notas calculadas
            lanesToSpawn.forEach(l => {
                map.push({ 
                    t: timeMs, 
                    l: l, 
                    type: isHold ? 'hold' : 'tap', 
                    len: holdLen, 
                    h: false, 
                    scoreGiven: false 
                });
            });

            lastTime = timeMs;
            lastLane = lane;
            patternDuration--;
        }
    }
    
    console.log(`Mapa generado con éxito: ${map.length} notas.`);
    return map;
}

// === 3. PREPARACIÓN E INTERFAZ ===
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    
    // Aplicar FOV (Perspectiva 3D)
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;

    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    
    // Limpiar arrays
    window.elReceptors = [];

    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    
    for (let i = 0; i < k; i++) {
        // Flash visual del carril
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        if(window.cfg.modes[k]) l.style.setProperty('--c', window.cfg.modes[k][i].c);
        elTrack.appendChild(l);

        // Receptor (Flecha fija)
        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        
        let conf = window.cfg.modes[k][i];
        let shapePath = PATHS[conf.s] || PATHS['circle'];
        
        // Color del borde del receptor
        let strokeColor = "white";
        if(window.user.equipped && window.user.equipped.skin === 'skin_neon') strokeColor = "#00FFFF";

        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" stroke="${strokeColor}" fill="none" stroke-width="4"/></svg>`;
        elTrack.appendChild(r);
    }
}

async function prepareAndPlaySong(k) {
    if (!window.curSongData) return notify("Error: Sin canción", "error");
    
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Analizando audio..."; }

    try {
        unlockAudio(); // INTENTO CRÍTICO DE DESBLOQUEO
        
        let songInRam = window.ramSongs.find(s => s.id === window.curSongData.id);
        
        if (!songInRam) {
            const response = await fetch(window.curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            // DecodeAudioData debe usarse sobre el contexto global
            const audioBuffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            
            const map = genMap(audioBuffer, k);
            songInRam = { id: window.curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            window.ramSongs.push(songInRam);
        } else {
             // Si existe pero cambió el modo de teclas (ej. de 4K a 7K), regenerar
             if (songInRam.kVersion !== k) {
                document.getElementById('loading-text').innerText = "Regenerando mapa...";
                await new Promise(r => setTimeout(r, 10)); // Breve pausa para actualizar UI
                songInRam.map = genMap(songInRam.buf, k);
                songInRam.kVersion = k;
            }
        }
        
        if(loader) loader.style.display = 'none';
        playSongInternal(songInRam);

    } catch (e) {
        console.error(e);
        notify("Error al iniciar: " + e.message, "error");
        if(loader) loader.style.display = 'none';
    }
}

function playSongInternal(s) {
    console.log("Iniciando motor de juego...");
    
    // RESETEAR ESTADO GLOBAL
    window.st.act = true; // ACTIVAR JUEGO
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map)); // Clonar mapa para no dañar el original en RAM
    window.st.spawned = [];
    window.st.sc = 0; 
    window.st.cmb = 0; 
    window.st.maxCmb = 0;
    window.st.hp = 50; 
    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    
    // Resetear contadores de estadísticas
    window.st.stats = { s: 0, g: 0, b: 0, m: 0 };
    window.st.totalOffset = 0;
    window.st.hitCount = 0;
    window.st.fcStatus = "GFC"; // Empezar con Gold Full Combo
    
    window.keys = s.kVersion;

    // UI
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    if(window.cfg.hideHud) document.getElementById('hud').style.display = 'none';
    else document.getElementById('hud').style.display = 'flex';
    
    // Inicializar Leaderboard si es Multi
    if (window.isMultiplayer && typeof initMultiLeaderboard === 'function') initMultiLeaderboard();

    initReceptors(window.keys);
    updHUD();

    // CUENTA REGRESIVA 3-2-1
    const cd = document.getElementById('countdown');
    cd.style.display = 'flex';
    cd.innerText = "3";
    
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if (count > 0) {
            cd.innerText = count;
        } else {
            clearInterval(iv);
            cd.innerText = "GO!";
            setTimeout(() => cd.innerText = "", 500);

            // INICIAR AUDIO Y BUCLE
            try {
                if (window.st.ctx.state === 'suspended') window.st.ctx.resume();
                
                window.st.src = window.st.ctx.createBufferSource();
                window.st.src.buffer = s.buf;
                
                const gain = window.st.ctx.createGain();
                gain.gain.value = window.cfg.vol;
                
                window.st.src.connect(gain);
                gain.connect(window.st.ctx.destination);
                
                window.st.t0 = window.st.ctx.currentTime;
                window.st.src.start(0);
                window.st.src.onended = () => { window.songFinished = true; end(false); };
                
                console.log("Audio iniciado. Entrando al loop...");
                loop(); // ARRANCAR BUCLE
            } catch(err) {
                console.error("Error al arrancar audio source:", err);
                notify("Error de Audio", "error");
            }
        }
    }, 1000);
}

// === 4. BUCLE PRINCIPAL (RENDER LOOP) ===
function loop() {
    if (!window.st.act || window.st.paused) return;

    // Calcular tiempo actual exacto
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    // Barra de progreso superior
    if (window.st.songDuration > 0) {
        const pct = (now / 1000) / window.st.songDuration * 100;
        const bar = document.getElementById('top-progress-fill');
        const timeText = document.getElementById('top-progress-time');
        
        if(bar) bar.style.width = pct + "%";
        if(timeText) {
            const cur = now / 1000;
            const dur = window.st.songDuration;
            timeText.innerText = `${Math.floor(cur/60)}:${Math.floor(cur%60).toString().padStart(2,'0')} / ${Math.floor(dur/60)}:${Math.floor(dur%60).toString().padStart(2,'0')}`;
        }
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    // --- A. SPAWNING (Crear elementos DOM) ---
    // Procesamos lotes pequeños para rendimiento
    let spawnedInFrame = 0;
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; // Ya spawneada
        
        // Spawnear si falta menos de 1.5s (Tiempo de viaje visible)
        if (n.t - now < 1500) {
            const el = document.createElement('div');
            // Clase base + clase de hold si aplica
            const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
            el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
            
            el.style.left = (n.l * w) + '%';
            el.style.width = w + '%';
            
            const conf = window.cfg.modes[window.keys][n.l];
            let color = conf.c;
            
            // Aplicar Skins equipadas
            if (window.user.equipped && window.user.equipped.skin) {
                if (window.user.equipped.skin === 'skin_neon') color = (n.l % 2 === 0) ? '#ff66aa' : '#00FFFF';
                else if (window.user.equipped.skin === 'skin_gold') color = '#FFD700';
                else if (window.user.equipped.skin === 'skin_dark') color = '#FFFFFF';
            }

            let shape = PATHS[conf.s] || PATHS['circle'];
            
            // Construir SVG de la nota
            let svgContent = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${color})"><path d="${shape}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
            
            // Si es Hold Note, agregar la cola (trail)
            if (n.type === 'hold') {
                // Calcular altura del trail basado en duración
                const h = (n.len / 1000) * (window.cfg.spd * 40); 
                svgContent += `<div class="sustain-trail" style="height:${h}px; background:${color}; opacity:${window.cfg.noteOp/100}"></div>`;
            }

            el.innerHTML = svgContent;
            
            if(elTrack) elTrack.appendChild(el);
            n.el = el;
            n.s = true; // Marcar como spawneada
            window.st.spawned.push(n);
            
            spawnedInFrame++;
            if(spawnedInFrame > 8) break; // Límite por frame para evitar tirones
        } else {
            // Si esta nota está lejos, las siguientes también (lista ordenada)
            break; 
        }
    }

    // --- B. ACTUALIZAR POSICIONES Y LÓGICA ---
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        // Si el elemento fue eliminado (por hit o miss), sacarlo del array
        if (!n.el) { window.st.spawned.splice(i, 1); continue; }

        const timeDiff = n.t - now + window.cfg.off;
        // Velocidad: (ms / 1000) * velocidad base * multiplicador arbitrario para pixelado
        const dist = (timeDiff / 1000) * (window.cfg.spd * 40); 
        
        let finalY = window.cfg.down ? (yReceptor - dist) : (yReceptor + dist);
        
        // Lógica Tap Normal
        if (n.type === 'tap' || (n.type === 'hold' && !n.h)) {
             n.el.style.top = finalY + 'px';
        }

        // Lógica Hold Note (Sostenida)
        if (n.type === 'hold') {
             if (n.h) {
                // Si ya fue "golpeada" (holding), fijar cabeza en receptor
                n.el.style.top = yReceptor + 'px';
                
                // Reducir cola visualmente
                const rem = (n.t + n.len) - now;
                const tr = n.el.querySelector('.sustain-trail');
                if (tr) tr.style.height = Math.max(0, (rem / 1000) * (window.cfg.spd * 40)) + 'px';
                
                // Si soltamos la tecla antes de tiempo
                if (!window.st.keys[n.l]) {
                    // Tolerancia de 50ms para soltar
                    if (rem > 50) { miss(n); }
                } else {
                    // Curando vida mientras se sostiene
                    window.st.hp = Math.min(100, window.st.hp + 0.05);
                    updHUD();
                }

                // Finalizar nota larga
                if (now >= n.t + n.len) {
                    window.st.sc += 100; // Puntos extra por terminar hold
                    n.el.remove(); // Borrar del DOM
                    n.el = null; // Marcar para limpieza
                }
             } else {
                 // Si aún no ha sido golpeada (bajando)
                 n.el.style.top = finalY + 'px';
             }
        }

        // Miss check (Si pasa de largo)
        // Ventana de miss: 160ms tarde
        if (!n.h && timeDiff < -160) {
            miss(n);
            // Si era hold, ya falló completa
            if (n.el) { n.el.style.opacity = 0; setTimeout(()=>n.el && n.el.remove(), 100); }
            window.st.spawned.splice(i, 1);
        }
    }

    requestAnimationFrame(loop);
}

// === 5. INPUTS (TECLADO) ===
window.onKd = function(e) {
    if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
    
    // Evitar repetición de tecla mantenida (solo primer press cuenta para hit)
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
        // KEY DOWN
        window.st.keys[l] = 1;
        if(r) r.classList.add('pressed');
        if(flash) { flash.style.opacity = 0.5; setTimeout(()=>flash.style.opacity=0, 100); }

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        // Buscar la nota más cercana en ese carril que sea golpeable
        // Ventana de hit: 160ms
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = Math.abs(n.t - now);
            let score = 50; let text = "BAD"; let color = "yellow";
            
            // Ventanas de tiempo (Timing Windows)
            if(diff < 45) { text="SICK"; color="#00FFFF"; score=350; window.st.stats.s++; }
            else if(diff < 90) { text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }
            
            // Si rompemos combo (Bad cuenta como combo break en algunos juegos, aquí no, solo Miss)
            if (text === "BAD") { 
                 window.st.fcStatus = "SD"; // Si Bad rompe FC, descomentar: window.st.cmb=0; 
            }

            window.st.sc += score;
            window.st.maxScorePossible += 350;
            window.st.cmb++;
            if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            
            window.st.hp = Math.min(100, window.st.hp + 2);
            window.st.hitCount++;
            window.st.totalOffset += (n.t - now);

            showJudge(text, color);
            playHit();
            updHUD();

            n.h = true; // Marcar como golpeada (Hit)
            
            if (n.type === 'tap') {
                if(n.el) n.el.style.opacity = 0; // Ocultar tap
            }
            // Si es hold, no ocultamos, se queda pegada al receptor en el loop()
        }
    } else {
        // KEY UP
        window.st.keys[l] = 0;
        if(r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++;
    window.st.cmb = 0;
    window.st.hp -= 10;
    window.st.fcStatus = "SD"; // Score Depleted / Combo Breaker
    
    playMiss();
    updHUD();
    
    // Ocultar visualmente la nota perdida
    if(n.el) n.el.style.opacity = 0; 
    
    if(window.st.hp <= 0 && !window.isMultiplayer) end(true);
}

function showJudge(text, color) {
    const j = document.createElement('div');
    j.className = 'judge-pop';
    j.innerText = text;
    j.style.color = color;
    document.body.appendChild(j);
    // Animación CSS se encarga del movimiento
    setTimeout(() => j.remove(), 400);
}

function updHUD() {
    // Score
    document.getElementById('g-score').innerText = window.st.sc.toLocaleString();
    
    // Combo
    const cEl = document.getElementById('g-combo');
    if(window.st.cmb > 0) { 
        cEl.innerText = window.st.cmb; 
        cEl.style.opacity = 1; 
        cEl.classList.remove('pulse'); 
        void cEl.offsetWidth; // Trigger reflow
        cEl.classList.add('pulse');
    } else cEl.style.opacity = 0;
    
    // Health
    document.getElementById('health-fill').style.height = window.st.hp + "%";
    
    // Stats (FC, Acc, Mean)
    const acc = window.st.maxScorePossible > 0 ? ((window.st.sc / window.st.maxScorePossible)*100).toFixed(1) : "100.0";
    document.getElementById('g-acc').innerText = acc + "%";
    
    const fcEl = document.getElementById('hud-fc');
    if(fcEl) {
        fcEl.innerText = window.cfg.showFC ? window.st.fcStatus : "";
        if(window.st.fcStatus==="PFC") fcEl.style.color="cyan";
        else if(window.st.fcStatus==="GFC") fcEl.style.color="gold";
        else if(window.st.fcStatus==="FC") fcEl.style.color="lime";
        else fcEl.style.color="red";
    }
    
    // Enviar score online si aplica
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
    const modal = document.getElementById('modal-res');
    if(modal) modal.style.display = 'flex';
    
    const acc = window.st.maxScorePossible > 0 ? Math.round((window.st.sc / window.st.maxScorePossible) * 100) : 0;
    
    if(died) {
        document.getElementById('res-rank').innerText = "F";
        document.getElementById('res-rank').style.color = "red";
    } else {
        let r = "D", c = "red";
        if (acc === 100) { r = "SS"; c = "cyan" }
        else if (acc >= 95) { r = "S"; c = "gold" }
        else if (acc >= 90) { r = "A"; c = "lime" }
        else if (acc >= 80) { r = "B"; c = "yellow" }
        else if (acc >= 70) { r = "C"; c = "orange" }
        
        document.getElementById('res-rank').innerText = r;
        document.getElementById('res-rank').style.color = c;
        
        // Guardar Datos (XP, SP, PP)
        if(window.user.name !== "Guest") {
            const xpGain = Math.floor(window.st.sc / 250);
            window.user.xp += xpGain;
            
            // Guardar en DB
            if(typeof save === 'function') save(); 
            if(typeof updateFirebaseScore === 'function') updateFirebaseScore();
            
            document.getElementById('res-xp').innerText = xpGain;
        }
    }
    document.getElementById('res-score').innerText = window.st.sc.toLocaleString();
    document.getElementById('res-acc').innerText = acc + "%";
}

function togglePause() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    if(window.st.paused) {
        if(window.st.ctx) window.st.ctx.suspend();
        document.getElementById('modal-pause').style.display = 'flex';
    } else {
        if(window.st.ctx) window.st.ctx.resume();
        document.getElementById('modal-pause').style.display = 'none';
        loop();
    }
}
