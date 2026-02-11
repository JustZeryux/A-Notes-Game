/* === AUDIO & ENGINE (MASTER V25 - DEBUGGED) === */

// Cache de elementos DOM
let elTrack = null;
let mlContainer = null;

// === SISTEMA DE AUDIO ROBUSTO ===
function unlockAudio() {
    // Intentar iniciar o reanudar el contexto de audio globalmente
    if (!window.st.ctx) {
        try {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Generar buffers de sonido vacíos o de prueba para "calentar" el motor
            const b = window.st.ctx.createBuffer(1, 1, 22050); 
            const s = window.st.ctx.createBufferSource();
            s.buffer = b;
            s.connect(window.st.ctx.destination);
            s.start(0);
            console.log("AudioContext creado y calentado.");
            genSounds(); // Generar sonidos de hit/miss
        } catch(e) { console.error("Error crítico AudioContext:", e); }
    }
    if (window.st.ctx && window.st.ctx.state === 'suspended') {
        window.st.ctx.resume().then(() => console.log("Audio reanudado"));
    }
}

function genSounds() {
    if(!window.st.ctx) return;
    // Hit Sound (Seno suave)
    const b1 = window.st.ctx.createBuffer(1, 2000, 44100);
    const d1 = b1.getChannelData(0);
    for (let i = 0; i < d1.length; i++) d1[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    window.hitBuf = b1;

    // Miss Sound (Ruido blanco)
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

// === GENERADOR DE MAPA ===
function genMap(buf, k) {
    if(!buf) return [];
    const data = buf.getChannelData(0);
    const map = [];
    const sampleRate = buf.sampleRate;
    
    // Asegurar que densidad tenga valor
    let safeDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;
    
    const sensitivity = 1.5 - (safeDen * 0.1); 
    const minStep = Math.max(80, 200 - (safeDen * 15));
    
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 80); 
    
    let lastTime = 0;
    let lastLane = 0;

    for (let i = 0; i < data.length - windowSize; i += step) {
        let sum = 0;
        for (let j = 0; j < windowSize; j += 32) sum += Math.abs(data[i + j]);
        const energy = sum / (windowSize / 32);
        const timeMs = (i / sampleRate) * 1000;

        if(timeMs < 1000) continue; // Skip intro muy breve

        if (energy > sensitivity && (timeMs - lastTime > minStep)) {
            let lane = Math.floor(Math.random() * k);
            
            // Lógica simple anti-repetición excesiva
            if(lane === lastLane && Math.random() > 0.4) lane = (lane + 1) % k;

            map.push({ 
                t: timeMs, 
                l: lane, 
                type: 'tap', 
                len: 0, 
                h: false, 
                scoreGiven: false 
            });
            lastTime = timeMs;
            lastLane = lane;
        }
    }
    console.log(`Mapa generado: ${map.length} notas.`);
    return map;
}

// === PREPARACIÓN DEL JUEGO ===
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    
    // Aplicar FOV
    const fov = window.cfg.fov || 20; // Valor por defecto 20 si es 0
    elTrack.style.transform = `rotateX(${fov}deg)`;

    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    
    // Crear Receptores
    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    
    for (let i = 0; i < k; i++) {
        // Flash
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        if(window.cfg.modes[k]) l.style.setProperty('--c', window.cfg.modes[k][i].c);
        elTrack.appendChild(l);

        // Flecha
        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        
        let conf = window.cfg.modes[k][i];
        let shapePath = PATHS[conf.s] || PATHS['circle'];
        
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" stroke="white" fill="none" stroke-width="4"/></svg>`;
        elTrack.appendChild(r);
    }
}

async function prepareAndPlaySong(k) {
    if (!window.curSongData) return notify("Error: Sin canción", "error");
    
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Cargando..."; }

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
             if (songInRam.kVersion !== k) {
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
        // location.reload(); // Comentado para poder ver el error en consola
    }
}

function playSongInternal(s) {
    console.log("Iniciando motor de juego...");
    
    // RESETEAR ESTADO (Sin sobrescribir el objeto st para no perder referencias)
    window.st.act = true; // ACTIVAR JUEGO
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = [];
    window.st.sc = 0; 
    window.st.cmb = 0; 
    window.st.hp = 50; 
    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    
    initReceptors(window.keys);
    updHUD();

    // CUENTA REGRESIVA
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

            // INICIAR AUDIO
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

// === BUCLE PRINCIPAL (RENDER LOOP) ===
function loop() {
    if (!window.st.act || window.st.paused) return;

    // Calcular tiempo actual exacto
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    // Barra de progreso superior
    if (window.st.songDuration > 0) {
        const pct = (now / 1000) / window.st.songDuration * 100;
        const bar = document.getElementById('top-progress-fill');
        if(bar) bar.style.width = pct + "%";
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    // 1. SPAWNING (Crear elementos DOM)
    // Procesamos lotes pequeños para rendimiento
    let spawnedInFrame = 0;
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; // Ya spawneda
        
        // Spawnear si falta menos de 1.5s (Tiempo de viaje visible)
        if (n.t - now < 1500) {
            const el = document.createElement('div');
            el.className = 'arrow-wrapper';
            el.style.left = (n.l * w) + '%';
            el.style.width = w + '%';
            
            const conf = window.cfg.modes[window.keys][n.l];
            let color = conf.c;
            
            // Skins
            if (window.user.equipped && window.user.equipped.skin === 'skin_neon') {
                color = (n.l % 2 === 0) ? '#ff66aa' : '#00FFFF';
            }

            let shape = PATHS[conf.s] || PATHS['circle'];
            el.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${color})"><path d="${shape}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
            
            if(elTrack) elTrack.appendChild(el);
            n.el = el;
            n.s = true; // Marcar como spawneada
            window.st.spawned.push(n);
            
            spawnedInFrame++;
            if(spawnedInFrame > 5) break; // Límite por frame
        } else {
            // Si esta nota está lejos, las siguientes también (lista ordenada)
            break; 
        }
    }

    // 2. ACTUALIZAR POSICIONES
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        if (!n.el) { window.st.spawned.splice(i, 1); continue; }

        const timeDiff = n.t - now + window.cfg.off;
        // Velocidad: (ms / 1000) * velocidad base * multiplicador
        const dist = (timeDiff / 1000) * (window.cfg.spd * 40); 
        
        let finalY = window.cfg.down ? (yReceptor - dist) : (yReceptor + dist);
        
        n.el.style.top = finalY + 'px';

        // Miss check
        if (timeDiff < -160) {
            miss(n);
            window.st.spawned.splice(i, 1);
        }
    }

    requestAnimationFrame(loop);
}

// === INPUTS ===
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
    const flash = document.getElementById(`flash-${l}`);

    if (p) {
        window.st.keys[l] = 1;
        if(r) r.classList.add('pressed');
        if(flash) { flash.style.opacity = 0.5; setTimeout(()=>flash.style.opacity=0, 100); }

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        // Buscar nota golpeable
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = Math.abs(n.t - now);
            let score = 50; let text = "BAD"; let color = "yellow";
            
            if(diff < 45) { text="SICK"; color="#00FFFF"; score=350; window.st.stats.s++; }
            else if(diff < 90) { text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; }
            else { window.st.stats.b++; window.st.hp-=2; }

            window.st.sc += score;
            window.st.cmb++;
            if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            
            showJudge(text, color);
            playHit();
            updHUD();

            n.h = true; 
            if(n.el) n.el.style.opacity = 0; // Ocultar nota
        }
    } else {
        window.st.keys[l] = 0;
        if(r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++;
    window.st.cmb = 0;
    window.st.hp -= 10;
    playMiss();
    updHUD();
    
    if(n.el) n.el.style.opacity = 0; // Ocultar visualmente
    
    if(window.st.hp <= 0 && !isMultiplayer) end(true);
}

function showJudge(text, color) {
    const j = document.createElement('div');
    j.className = 'judge-pop';
    j.innerText = text;
    j.style.color = color;
    document.body.appendChild(j);
    setTimeout(() => j.remove(), 400);
}

function updHUD() {
    document.getElementById('g-score').innerText = window.st.sc.toLocaleString();
    const cEl = document.getElementById('g-combo');
    if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } else cEl.style.opacity=0;
    
    document.getElementById('health-fill').style.height = window.st.hp + "%";
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
    const modal = document.getElementById('modal-res');
    if(modal) modal.style.display = 'flex';
    
    if(died) {
        document.getElementById('res-rank').innerText = "F";
        document.getElementById('res-rank').style.color = "red";
    } else {
        document.getElementById('res-rank').innerText = "S";
        document.getElementById('res-rank').style.color = "gold";
        // Guardar XP, etc.
        window.user.xp += 100;
        save(); 
    }
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
