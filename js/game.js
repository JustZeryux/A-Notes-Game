/* === AUDIO & ENGINE (MASTER V20 - REWORKED) === */

// Cache
let elTrack = null;
let elReceptors = [];
let mlContainer = null;

// === AUDIO SYSTEM ===
function unlockAudio() {
    if (!st.ctx) {
        try {
            st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            genHit(); genMiss();
        } catch(e) { console.error("Audio Ctx Error:", e); }
    }
    if (st.ctx && st.ctx.state === 'suspended') st.ctx.resume();
}

function genHit() {
    if(!st.ctx) return;
    const b = st.ctx.createBuffer(1, 2000, 44100);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    hitBuf = b;
}

function genMiss() {
    if(!st.ctx) return;
    const b = st.ctx.createBuffer(1, 4000, 44100);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() - 0.5) * 0.5 * Math.exp(-i / 500);
    missBuf = b;
}

function playHit() {
    if (hitBuf && cfg.hitSound && st.ctx) {
        const s = st.ctx.createBufferSource();
        s.buffer = hitBuf;
        const g = st.ctx.createGain();
        g.gain.value = cfg.hvol;
        s.connect(g); g.connect(st.ctx.destination);
        s.start(0);
    }
}

function playMiss() {
    if (missBuf && cfg.missSound && st.ctx) {
        const s = st.ctx.createBufferSource();
        s.buffer = missBuf;
        const g = st.ctx.createGain();
        g.gain.value = cfg.missVol;
        s.connect(g); g.connect(st.ctx.destination);
        s.start(0);
    }
}

// === NUEVO GENERADOR DE MAPAS INTELIGENTE (4K, 6K, 7K, 9K) ===
function genMap(buf, k) {
    const data = buf.getChannelData(0);
    const map = [];
    const sampleRate = buf.sampleRate;
    
    // Ajuste de sensibilidad basado en la densidad elegida (1-10)
    // Densidad 10 = Muy sensible (muchas notas), Densidad 1 = Poco sensible
  // Usar 5 por defecto si cfg.den no existe (Evita que el mapa salga vacío)
const safeDensity = (typeof cfg !== 'undefined' && cfg.den) ? cfg.den : 5;
const sensitivity = 1.8 - (safeDensity * 0.12); 
const minStep = Math.max(70, 220 - (safeDensity * 18));
    
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 80); // Muestreo
    
    let lastTime = 0;
    let lastLane = 0;
    
    // Máquina de estados para patrones (0: Random, 1: Escalera, 2: Jack, 3: Trill)
    let currentPattern = 0;
    let patternDuration = 0; 
    let patternDir = 1; // 1: Derecha, -1: Izquierda

    for (let i = 0; i < data.length - windowSize; i += step) {
        // Análisis de energía (Volumen)
        let sum = 0;
        for (let j = 0; j < windowSize; j += 32) {
            sum += Math.abs(data[i + j]);
        }
        const energy = sum / (windowSize / 32);
        const timeMs = (i / sampleRate) * 1000;

        // Intro Skip: No poner notas en los primeros 1.5s
        if(timeMs < 1500) continue;

        if (energy > sensitivity && (timeMs - lastTime > minStep)) {
            let lanesToSpawn = [];
            let isHold = false;
            let holdLen = 0;

            // Detectar Hold Notes (Si la energía se mantiene alta)
            if (energy > sensitivity * 1.6 && Math.random() > 0.65) {
                isHold = true;
                holdLen = Math.min(800, Math.random() * 400 + 100);
            }

            // --- Lógica de Patrones ---
            if (patternDuration <= 0) {
                // Cambiar patrón cada 4-10 notas
                currentPattern = Math.floor(Math.random() * 4);
                patternDuration = Math.floor(Math.random() * 6) + 4;
                patternDir = Math.random() > 0.5 ? 1 : -1;
            }

            let lane = 0;

            if (currentPattern === 1) { // Escalera (Stream)
                lane = (lastLane + patternDir + k) % k; // +k para evitar negativos
            } else if (currentPattern === 2) { // Jack (Repetición)
                lane = lastLane;
                // Si es jack, reducimos probabilidad de spawn continuo para no hacerlo imposible
                if (Math.random() > 0.6) lane = (lane + 1) % k; 
            } else if (currentPattern === 3) { // Trill (Alternar dos teclas)
                lane = (lastLane + 2) % k;
            } else { // Random
                lane = Math.floor(Math.random() * k);
            }

            lanesToSpawn.push(lane);

            // --- Dobles y Triples (Chords) ---
            // Solo en dificultades altas (Densidad > 5) o picos muy fuertes
            if ((cfg.den >= 6 && energy > sensitivity * 2) || (cfg.den >= 8 && Math.random() > 0.5)) {
                let secondLane = (lane + Math.floor(k/2)) % k; // Nota separada
                if (!lanesToSpawn.includes(secondLane)) lanesToSpawn.push(secondLane);
            }
            
            // Triple para dificultad demoníaca (9K o Densidad 9-10)
            if (k >= 6 && cfg.den >= 9 && energy > sensitivity * 3) {
                 let thirdLane = (lane + 1) % k;
                 if (!lanesToSpawn.includes(thirdLane)) lanesToSpawn.push(thirdLane);
            }

            // Crear las notas
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
    return map;
}

// === GAMEPLAY INITIALIZATION ===
function initReceptors(k) {
    elTrack = document.getElementById('track');
    elTrack.innerHTML = '';
    
    if(cfg.middleScroll) elTrack.classList.add('middle-scroll');
    else elTrack.classList.remove('middle-scroll');

    // Aplicar FOV
    const fov = cfg.fov || 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    elTrack.style.perspective = `${800 - (fov*10)}px`;

    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    
    elReceptors = [];

    // Lane Flashes
    for (let i = 0; i < k; i++) {
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        l.style.setProperty('--c', cfg.modes[k][i].c);
        elTrack.appendChild(l);
    }
    
    // Receptors
    const y = cfg.down ? window.innerHeight - 140 : 80;
    for (let i = 0; i < k; i++) {
        const conf = cfg.modes[k][i];
        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        r.style.setProperty('--active-c', conf.c);
        const shapePath = PATHS[conf.s] || PATHS['circle'];
        
        // Skin Receptor
        let recColor = "white"; // Default stroke
        if(user.equipped && user.equipped.skin === 'skin_neon') recColor = "#00FFFF";
        
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" stroke="${recColor}"/></svg>`;
        elTrack.appendChild(r);
        elReceptors.push(r);
    }
}

async function prepareAndPlaySong(k) {
    if (!curSongData) return notify("Error: No hay canción seleccionada", "error");
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Cargando audio...";
    
    try {
        unlockAudio(); 
        let songInRam = ramSongs.find(s => s.id === curSongData.id);
        
        if (!songInRam) {
            const response = await fetch(curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await st.ctx.decodeAudioData(arrayBuffer);
            
            document.getElementById('loading-text').innerText = "Generando mapa inteligente...";
            await new Promise(r => setTimeout(r, 50)); 
            
            const map = genMap(audioBuffer, k);
            songInRam = { id: curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            ramSongs.push(songInRam);
            if (ramSongs.length > 5) ramSongs.shift();
        } else {
            // Regenerar mapa si cambió la Key count (ej. de 4K a 7K)
            if (songInRam.kVersion !== k) {
                document.getElementById('loading-text').innerText = "Reajustando mapa...";
                await new Promise(r => setTimeout(r, 50));
                songInRam.map = genMap(songInRam.buf, k);
                songInRam.kVersion = k;
            }
        }
        document.getElementById('loading-overlay').style.display = 'none';
        playSongInternal(songInRam);
    } catch (e) {
        console.error(e);
        notify("Error carga: " + e.message, "error");
        document.getElementById('loading-overlay').style.display = 'none';
        toMenu(); 
    }
}

function playSongInternal(s) {
    try {
        document.getElementById('track').innerHTML = '';
        st.notes = JSON.parse(JSON.stringify(s.map));
        st.spawned = [];
        st.sc = 0; st.cmb = 0; st.maxCmb = 0; st.hp = 50; st.stats = { s: 0, g: 0, b: 0, m: 0 };
        st.keys = new Array(keys).fill(0);
        st.maxScorePossible = 0;
        st.ranked = document.getElementById('chk-ranked').checked;
        st.lastPause = 0; st.totalOffset = 0; st.hitCount = 0; st.fcStatus = "GFC";
        songFinished = false; 
        st.songDuration = s.buf.duration;
        keys = s.kVersion; // Asegurar que keys global sea correcto

        if (isMultiplayer) initMultiLeaderboard();
        else if(mlContainer) mlContainer.style.display = 'none';
        
        document.getElementById('menu-container').classList.add('hidden');
        document.getElementById('game-layer').style.display = 'block';
        document.getElementById('hud').style.display = cfg.hideHud ? 'none' : 'flex';
        
        initReceptors(keys);
        
        // === PRE-RENDER (PRE-WARM) PARA QUITAR LAG ===
        // Crea elementos dummy invisibles para que el navegador asigne memoria
        for(let i=0; i<10; i++) {
            const dummy = document.createElement('div');
            dummy.className = 'arrow-wrapper';
            dummy.style.opacity = '0.001';
            elTrack.appendChild(dummy);
            setTimeout(()=>dummy.remove(), 50);
        }
        // =============================================

        updHUD();

        const cd = document.getElementById('countdown');
        let c = 3; cd.innerHTML = c;

        st.startTime = 0; st.t0 = null; st.act = true; st.paused = false;

        const iv = setInterval(async () => {
            c--;
            if (c > 0) {
                cd.innerHTML = c;
            } else {
                clearInterval(iv);
                cd.innerHTML = "GO!";
                setTimeout(() => cd.innerHTML = "", 500);

                if (st.ctx && st.ctx.state === 'suspended') st.ctx.resume();
                
                try {
                    st.src = st.ctx.createBufferSource();
                    st.src.buffer = s.buf;
                    const gain = st.ctx.createGain();
                    gain.gain.value = cfg.vol;
                    st.src.connect(gain);
                    gain.connect(st.ctx.destination);
                    
                    st.t0 = st.ctx.currentTime;
                    st.startTime = performance.now(); 
                    st.src.start(0);
                    st.src.onended = () => { songFinished = true; end(false); };
                    loop();
                } catch(e) { console.error(e); }
            }
        }, 1000);
    } catch(e) {
        console.error(e);
        toMenu();
    }
}

function loop() {
    if (!st.act || st.paused) return;

    let now;
    if (st.t0 !== null && st.ctx && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
    else now = performance.now() - st.startTime;

    if (st.songDuration > 0 && now > 0) {
        const currentSec = now / 1000;
        const pct = Math.min(100, (currentSec / st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${Math.floor(currentSec/60)}:${Math.floor(currentSec%60).toString().padStart(2,'0')}`;
    }

    const yReceptor = cfg.down ? window.innerHeight - 140 : 80;
    const w = 100 / keys;

    // SPAWNING
    let spawnedCount = 0;
    for (let i = 0; i < st.notes.length; i++) {
        const n = st.notes[i];
        if (n.s) continue;
        if (n.t < now - 200) { n.s = true; continue; }

        if (n.t - now < 1500) {
            const el = document.createElement('div');
            const dirClass = cfg.down ? 'hold-down' : 'hold-up';
            el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
            el.style.left = (n.l * w) + '%';
            el.style.width = w + '%';
            el.style.zIndex = 150;

            const conf = cfg.modes[keys][n.l];
            const shapePath = PATHS[conf.s] || PATHS['circle'];

            // === LÓGICA DE SKINS DE TIENDA ===
            let noteColor = conf.c;
            if (user.equipped && user.equipped.skin) {
                if (user.equipped.skin === 'skin_neon') noteColor = (n.l % 2 === 0) ? '#ff66aa' : '#00FFFF';
                if (user.equipped.skin === 'skin_gold') noteColor = '#FFD700';
                if (user.equipped.skin === 'skin_dark') noteColor = '#FFFFFF'; 
            }

            let svg = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" fill="${noteColor}" stroke="white" stroke-width="2"/></svg>`;

            if (n.type === 'hold') {
                const h = (n.len / 1000) * cfg.spd * 60;
                svg += `<div class="sustain-trail" style="height:${h}px; background:${noteColor}; opacity:${cfg.noteOp/100}"></div>`;
            }
            el.innerHTML = svg;
            if (cfg.vivid) el.querySelector('.arrow-path').style.filter = `drop-shadow(0 0 8px ${noteColor})`;
            
            if(elTrack) elTrack.appendChild(el);
            n.el = el;
            st.spawned.push(n);
            n.s = true;
            spawnedCount++;
            if(spawnedCount > 8) break; 
        } else break; 
    }

    // UPDATE POSITIONS
    for (let i = st.spawned.length - 1; i >= 0; i--) {
        const n = st.spawned[i];
        if (!n.el) { st.spawned.splice(i, 1); continue; }

        const diff = n.t - now + cfg.off;
        const dist = (diff / 1000) * cfg.spd * 60;
        let finalY = cfg.down ? (yReceptor - dist) : (yReceptor + dist);

        if (n.type === 'hold' && n.h) { 
            n.el.style.top = yReceptor + 'px';
            if (!st.keys[n.l] && !n.scoreGiven) {
                const remaining = (n.t + n.len) - now;
                if (remaining > 50) { 
                    miss(n, true); 
                    n.scoreGiven = true;
                }
            }
            if (st.keys[n.l]) {
                const rem = (n.t + n.len) - now;
                const tr = n.el.querySelector('.sustain-trail');
                if (tr) tr.style.height = Math.max(0, (rem / 1000) * cfg.spd * 60) + 'px';
                st.hp = Math.min(100, st.hp + 0.05);
                updHUD(); 
            }
            if (now >= n.t + n.len && !n.scoreGiven) {
                st.sc += 100; n.scoreGiven = true; n.el.remove(); st.spawned.splice(i, 1);
            }
        } else if (!n.h) {
            n.el.style.top = finalY + 'px';
            if (diff < -160) {
                miss(n, false); 
                n.h = true; n.scoreGiven = true;
                st.spawned.splice(i, 1);
            }
        }
    }
    requestAnimationFrame(loop);
}

function onKd(e) {
    if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
    if (typeof remapMode !== 'undefined' && remapMode !== null) {
        if(cfg.modes[remapMode]) {
            if(["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
            cfg.modes[remapMode][remapIdx].k = e.key.toLowerCase();
            renderLaneConfig(remapMode); 
            remapMode = null; remapIdx = null; save();
            if(typeof notify === 'function') notify("Tecla guardada: " + e.key.toUpperCase(), "success");
        }
        return;
    }
    if (!e.repeat && cfg && cfg.modes && cfg.modes[keys]) {
        const idx = cfg.modes[keys].findIndex(l => l.k === e.key.toLowerCase());
        if (idx !== -1) hit(idx, true);
    }
}

function onKu(e) {
    if(cfg && cfg.modes && cfg.modes[keys]) {
        const idx = cfg.modes[keys].findIndex(l => l.k === e.key.toLowerCase());
        if (idx !== -1) hit(idx, false);
    }
}

function hit(l, p) {
    if (!st.act || st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    const flash = document.getElementById(`flash-${l}`); 

    if (p) { 
        st.keys[l] = 1;
        if (r) r.classList.add('pressed');
        if (flash) { flash.style.opacity = 0.6; setTimeout(() => flash.style.opacity = 0, 100); }

        let now = (st.t0 !== null) ? (st.ctx.currentTime - st.t0) * 1000 : performance.now() - st.startTime;
        const n = st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - (now + cfg.off)) < 160);

        if (n) {
            const msError = n.t - (now + cfg.off);
            const absError = Math.abs(msError);
            let t = "BAD", c = "yellow", pts = 50;

            if (absError < 45) { t = "SICK"; c = "var(--sick)"; pts = 350; st.stats.s++; if (cfg.shake) triggerShake(); if (cfg.vivid) createSplash(l); } 
            else if (absError < 90) { t = "GOOD"; c = "var(--good)"; pts = 200; st.stats.g++; st.fcStatus = (st.fcStatus === "GFC") ? "GFC" : (st.fcStatus === "PFC" ? "GFC" : st.fcStatus); } 
            else { st.stats.b++; st.cmb = 0; st.hp -= 5; st.fcStatus = (st.fcStatus !== "SD") ? "FC" : "SD"; }

            st.cmb++; if(st.cmb > st.maxCmb) st.maxCmb = st.cmb;
            st.sc += pts; st.maxScorePossible += 350; st.hp = Math.min(100, st.hp + 2);
            st.totalOffset += msError; st.hitCount++;
            showJudge(t, c); playHit(); updHUD();
            
            n.h = true; 
            if (n.type !== 'hold' && n.el) n.el.style.display = 'none';
        }
    } else { 
        st.keys[l] = 0;
        if (r) r.classList.remove('pressed');
    }
}

function miss(n, isHoldBreak) {
    showJudge("MISS", "var(--miss)");
    st.stats.m++; st.cmb = 0; st.hp -= 10; st.maxScorePossible += 350;
    st.fcStatus = "SD";
    playMiss(); updHUD();
    
    // === FIX HOLD NOTE TRAIL ===
    // Ocultar inmediatamente la nota y el trail si fallamos
    if (n.el) n.el.style.opacity = '0';
    // ===========================

    if (st.hp <= 0) {
        if(isMultiplayer) st.hp = 1; 
        else end(true);
    }
}

function createSplash(l) {
    if(!elTrack) return;
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    const s = document.createElement('div');
    s.className = 'splash';
    s.style.setProperty('--c', cfg.modes[keys][l].c);
    s.style.left = r.style.left; s.style.top = r.style.top;
    elTrack.appendChild(s);
    setTimeout(()=>s.remove(), 300);
}

function triggerShake() { 
    if(!cfg.shake) return; 
    const w = document.getElementById('game-layer'); 
    w.classList.remove('shaking'); void w.offsetWidth; w.classList.add('shaking'); 
}

function showJudge(t, c) { 
    if(!cfg.judgeVis) return; 
    const j = document.createElement('div'); 
    j.className = 'judge-pop'; j.innerText = t; j.style.color = c; 
    document.body.appendChild(j); setTimeout(()=>j.remove(), 400); 
}

function updHUD() {
    document.getElementById('g-score').innerText = st.sc.toLocaleString();
    const comboEl = document.getElementById('g-combo');
    if (st.cmb > 0) { comboEl.innerText = st.cmb; comboEl.style.opacity = '1'; comboEl.classList.remove('pulse'); void comboEl.offsetWidth; comboEl.classList.add('pulse'); } 
    else { comboEl.style.opacity = '0'; }
    
    const fcEl = document.getElementById('hud-fc');
    if(fcEl && st.fcStatus) {
        fcEl.innerText = cfg.showFC ? st.fcStatus : "";
        if(st.fcStatus === "PFC") fcEl.style.color = "cyan";
        else if(st.fcStatus === "GFC") fcEl.style.color = "gold";
        else if(st.fcStatus === "FC") fcEl.style.color = "lime";
        else fcEl.style.color = "red";
    }

    const meanEl = document.getElementById('hud-mean');
    if(meanEl) meanEl.innerText = (cfg.showMean && st.hitCount > 0) ? (st.totalOffset / st.hitCount).toFixed(2) + "ms" : "";

    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 100;
    document.getElementById('g-acc').innerText = acc + "%";
    
    document.getElementById('h-sick').innerText = st.stats.s;
    document.getElementById('h-good').innerText = st.stats.g;
    document.getElementById('h-bad').innerText = st.stats.b;
    document.getElementById('h-miss').innerText = st.stats.m;
    document.getElementById('health-fill').style.height = st.hp + '%';
    
    if (isMultiplayer) sendLobbyScore(st.sc);
}

function initMultiLeaderboard() {
    if (!isMultiplayer) return;
    if (!document.getElementById('multi-leaderboard')) {
        mlContainer = document.createElement('div');
        mlContainer.id = 'multi-leaderboard';
        document.body.appendChild(mlContainer);
    }
    mlContainer.style.display = 'flex';
    mlContainer.innerHTML = ''; 
    multiScores = [{ name: user.name, score: 0, avatar: user.avatarData }];
    updateMultiLeaderboardUI(multiScores);
}

window.updateMultiLeaderboardUI = function(scores) {
    if (!mlContainer) return;
    scores.sort((a, b) => b.score - a.score);
    const existingRows = {};
    Array.from(mlContainer.children).forEach(row => { existingRows[row.dataset.name] = row; });

    scores.forEach((p, index) => {
        let row = existingRows[p.name];
        const newTop = index * 55; 
        if (!row) {
            row = document.createElement('div');
            row.className = `ml-row ${p.name === user.name ? 'is-me' : ''}`;
            row.dataset.name = p.name;
            row.style.top = `${newTop}px`;
            row.style.position = 'absolute';
            row.style.width = '100%';
            row.innerHTML = `<div class="ml-rank">#${index + 1}</div><div class="ml-av" style="background-image:url(${p.avatar||''})"></div><div class="ml-info"><div class="ml-name">${p.name}</div><div class="ml-score">${p.score.toLocaleString()}</div></div>`;
            mlContainer.appendChild(row);
        } else {
            row.style.top = `${newTop}px`;
            row.querySelector('.ml-rank').innerText = `#${index + 1}`;
            row.querySelector('.ml-score').innerText = p.score.toLocaleString();
        }
        delete existingRows[p.name];
    });
    for (const name in existingRows) { existingRows[name].remove(); }
};

function end(died) {
    st.act = false;
    if (st.src) try { st.src.stop() } catch (e) { }
    document.getElementById('game-layer').style.display = 'none';
    const modal = document.getElementById('modal-res');
    if(modal) modal.style.display = 'flex';
    
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 0;
    let r = "F", c = "red";
    if (!died) {
        if (acc === 100) { r = "SS"; c = "cyan" }
        else if (acc >= 95) { r = "S"; c = "gold" }
        else if (acc >= 90) { r = "A"; c = "lime" }
        else if (acc >= 80) { r = "B"; c = "yellow" }
        else if (acc >= 70) { r = "C"; c = "orange" }
        else { r = "D"; c = "red" }
    }
    
    document.getElementById('res-rank').innerText = r;
    document.getElementById('res-rank').style.color = c;
    document.getElementById('res-score').innerText = st.sc.toLocaleString();
    document.getElementById('res-acc').innerText = acc + "%";
    
    if (!died && songFinished && user.name !== "Guest" && curSongData) {
        const xpGain = Math.floor(st.sc / 250);
        user.xp += xpGain;
        const spGain = Math.floor(st.sc / 1000);
        user.sp = (user.sp || 0) + spGain;
        user.score += st.sc;
        user.plays++;
        
        // === NERF PP CALCULATION (Max 40-50pp por song) ===
        // Formula: Acc% * 40 * (Densidad / 5)
        let ppG = 0;
        if(st.ranked) {
            const diffMult = 1 + (cfg.den / 10); // 1.1x a 2.0x
            const accMult = (acc > 85) ? (acc/100) : 0; // 0 PP si acc < 85%
            ppG = Math.floor(40 * diffMult * accMult);
        }
        user.pp += ppG;
        // ==================================================

        let xpReq = 1000 * Math.pow(user.lvl >= 10 ? 1.02 : 1.05, user.lvl - 1);
        if (user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
        if (user.xp >= xpReq) { user.xp -= xpReq; user.lvl++; notify("¡NIVEL " + user.lvl + " ALCANZADO!", "success"); }
        
        document.getElementById('pp-gain-loss').innerText = `+${ppG} PP`;
        
        if(!user.scores) user.scores = {};
        if(!user.scores[curSongData.id] || st.sc > user.scores[curSongData.id].score) {
            user.scores[curSongData.id] = { score: st.sc, rank: r, acc: acc };
        }
        save(); updateFirebaseScore();
        document.getElementById('res-xp').innerText = xpGain;
        document.getElementById('res-sp').innerText = spGain;
    } else {
        document.getElementById('res-xp').innerText = 0;
        document.getElementById('res-sp').innerText = 0;
        document.getElementById('pp-gain-loss').innerText = "+0 PP";
    }
}

function togglePause() {
    // Si no hay juego activo, no hacer nada
    if (!st.act && st.spawned.length === 0) return;
    
    st.paused = !st.paused;
    
    if (st.paused) {
        st.lastPause = performance.now();
        document.getElementById('modal-pause').style.display = 'flex';
        
        // PAUSA SEGURA: Suspender contexto de audio
        if (st.ctx && st.ctx.state === 'running') {
            st.ctx.suspend().then(() => {
                console.log("Audio pausado correctamente");
            }).catch(err => console.error("Error al pausar audio:", err));
        }
    } else {
        resumeGame();
    }
}
function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if (st.ctx) st.ctx.resume().catch(e=>{});
    if (st.lastPause) { st.startTime += (performance.now() - st.lastPause); st.lastPause = 0; }
    st.paused = false; requestAnimationFrame(loop);
}
function toMenu() { location.reload(); }
