/* === AUDIO & ENGINE (MASTER V75 - RANK FIX & ANTI-SPAM) === */

let elTrack = null;

// === 1. AUDIO SYSTEM ===
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

// === 2. GENERADOR (ANTI-SPAM JACKHAMMER) ===
function genMap(buf, k) {
    if(!buf) return [];
    const data = buf.getChannelData(0);
    const map = [];
    const sampleRate = buf.sampleRate;
    
    let safeDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;
    
    // Ajuste de umbral
    const thresholdBase = 1.5 - (safeDen * 0.08); 
    const minStep = Math.max(90, 260 - (safeDen * 22)); // Aumenté el tiempo mínimo para evitar spam
    
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 100); 
    
    let lastTime = 0;
    let lastLane = 0;
    let energyHistory = [];
    let laneFreeTimes = new Array(k).fill(0);
    let consecutiveSameLane = 0; // Contador anti-spam

    // Patrones
    let currentPattern = 0;
    let patternDuration = 0;
    let patternDir = 1;

    for (let i = 0; i < data.length - windowSize; i += step) {
        let sum = 0;
        for (let j = 0; j < windowSize; j += 16) sum += Math.abs(data[i + j]);
        const instantEnergy = sum / (windowSize / 16);
        
        energyHistory.push(instantEnergy);
        if (energyHistory.length > 40) energyHistory.shift();
        
        let localAvg = 0;
        for(let e of energyHistory) localAvg += e;
        localAvg /= energyHistory.length;
        
        const timeMs = (i / sampleRate) * 1000;
        if (timeMs < 1500) continue;

        if (instantEnergy > localAvg * thresholdBase && (timeMs - lastTime > minStep)) {
            
            // Selección de patrón
            if (patternDuration <= 0) {
                const r = Math.random();
                if (r < 0.35) currentPattern = 1; // Stream
                else if (r < 0.45) currentPattern = 2; // Jack (Reducido probabilidad)
                else if (r < 0.7) currentPattern = 3; // Trill
                else currentPattern = 0; // Random
                patternDuration = Math.floor(Math.random() * 6) + 3;
                patternDir = Math.random() > 0.5 ? 1 : -1;
            }

            let targetLane = 0;
            if (currentPattern === 1) targetLane = (lastLane + patternDir + k) % k;
            else if (currentPattern === 2) targetLane = lastLane;
            else if (currentPattern === 3) targetLane = (lastLane + 2) % k;
            else targetLane = Math.floor(Math.random() * k);

            // === LÓGICA ANTI-SPAM ESTRICTA ===
            if (targetLane === lastLane) {
                consecutiveSameLane++;
                // Si intenta poner más de 2 notas seguidas en el mismo carril, FORZAR CAMBIO
                if (consecutiveSameLane >= 2) {
                    targetLane = (targetLane + 1) % k; // Mover al siguiente carril
                    consecutiveSameLane = 0;
                    currentPattern = 0; // Romper patrón de jack
                }
            } else {
                consecutiveSameLane = 0;
            }

            // Buscar carril libre (sin notas largas activas)
            let finalLane = -1;
            if (timeMs >= laneFreeTimes[targetLane]) {
                finalLane = targetLane;
            } else {
                // Si el target está ocupado, buscar otro aleatorio libre
                const freeLanes = [];
                for(let l=0; l<k; l++) if(timeMs >= laneFreeTimes[l]) freeLanes.push(l);
                if(freeLanes.length > 0) finalLane = freeLanes[Math.floor(Math.random()*freeLanes.length)];
            }

            if (finalLane !== -1) {
                let isHold = false;
                let holdLen = 0;
                
                if (instantEnergy > localAvg * 1.6 && Math.random() > 0.7) {
                    isHold = true;
                    holdLen = Math.min(600, Math.random() * 300 + 100);
                }

                map.push({ t: timeMs, l: finalLane, type: isHold?'hold':'tap', len: holdLen, h:false, scoreGiven:false });
                laneFreeTimes[finalLane] = timeMs + holdLen + 50; 
                lastTime = timeMs;
                lastLane = finalLane;

                // Dobles controlados
                if (instantEnergy > localAvg * 2.2 && safeDen >= 6) {
                    let secondLaneTarget = (finalLane + Math.floor(k/2)) % k;
                    if (timeMs >= laneFreeTimes[secondLaneTarget] && secondLaneTarget !== finalLane) {
                        map.push({ t: timeMs, l: secondLaneTarget, type: 'tap', len: 0, h:false, scoreGiven:false });
                        laneFreeTimes[secondLaneTarget] = timeMs + 50;
                    }
                }
            }
            patternDuration--;
        }
    }
    return map;
}

// === 3. PREPARACIÓN ===
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');

    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    
    for (let i = 0; i < k; i++) {
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        if(window.cfg.modes[k]) l.style.setProperty('--c', window.cfg.modes[k][i].c);
        elTrack.appendChild(l);

        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        
        let strokeColor = "white";
        if(window.user && window.user.equipped && window.user.equipped.skin === 'skin_neon') strokeColor = "#00FFFF";

        let conf = window.cfg.modes[k][i];
        let shape = PATHS[conf.s] || PATHS['circle'];
        
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shape}" stroke="${strokeColor}" fill="none" stroke-width="4"/></svg>`;
        elTrack.appendChild(r);
    }
}

async function prepareAndPlaySong(k) {
    if (!window.curSongData) return notify("Selecciona una canción", "error");
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Cargando..."; }

    try {
        unlockAudio();
        
        let songInRam = window.ramSongs.find(s => s.id === window.curSongData.id);
        const currentDen = window.cfg.den || 5;

        // Regenerar si cambió dificultad o teclas
        if (songInRam && (songInRam.kVersion !== k || songInRam.genDen !== currentDen)) {
            window.ramSongs = window.ramSongs.filter(s => s.id !== window.curSongData.id); 
            songInRam = null; 
        }

        if (!songInRam) {
            const response = await fetch(window.curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            
            document.getElementById('loading-text').innerText = "Generando mapa...";
            await new Promise(r => setTimeout(r, 10));

            const map = genMap(audioBuffer, k);
            
            songInRam = { id: window.curSongData.id, buf: audioBuffer, map: map, kVersion: k, genDen: currentDen };
            window.ramSongs.push(songInRam);
        }
        
        if(loader) loader.style.display = 'none';
        playSongInternal(songInRam);
    } catch (e) {
        console.error(e);
        notify("Error: " + e.message, "error");
        if(loader) loader.style.display = 'none';
    }
}

// === FIX: REINTENTO INSTANTÁNEO ===
window.restartSong = function() {
    // 1. Resetear UI visualmente INMEDIATAMENTE
    const bar = document.getElementById('top-progress-fill');
    const timeText = document.getElementById('top-progress-time');
    if(bar) bar.style.width = '0%';
    if(timeText) timeText.innerText = '0:00 / 0:00';
    document.getElementById('health-fill').style.height = '50%';
    document.getElementById('g-score').innerText = '0';
    document.getElementById('g-acc').innerText = '100%';
    
    // 2. Cerrar modales
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';

    // 3. Llamar lógica
    prepareAndPlaySong(window.keys);
};

// === LÓGICA DE JUEGO & CÁLCULO DE RANK REAL ===
function playSongInternal(s) {
    window.st.act = true;
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = [];
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50;
    
    // === FIX RANK: CALCULAR PUNTAJE TOTAL DE LA CANCIÓN ===
    // Cada nota vale 350 pts (SICK). Si fallas una, pierdes esos 350 potenciales.
    // Hold Notes: 350 (inicio) + 100 (fin). Simplificamos: 1 nota = 350 pts base para accuracy.
    window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => {
        window.st.trueMaxScore += 350; // Puntos por hit perfecto
        if(n.type === 'hold') window.st.trueMaxScore += 100; // Bonus por hold completo
    });
    // ======================================================

    window.st.maxScorePossible = 0; // Esto solo es para tracking visual progresivo
    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.fcStatus = "GFC";

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    
    initReceptors(window.keys);
    updHUD();

    const cd = document.getElementById('countdown');
    cd.style.display = 'flex';
    cd.innerText = "3";
    
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if (count > 0) cd.innerText = count;
        else {
            clearInterval(iv);
            cd.innerText = "GO!";
            setTimeout(() => cd.innerText = "", 500);
            try {
                if (window.st.ctx.state === 'suspended') window.st.ctx.resume();
                window.st.src = window.st.ctx.createBufferSource();
                window.st.src.buffer = s.buf;
                const g = window.st.ctx.createGain();
                g.gain.value = window.cfg.vol;
                window.st.src.connect(g); g.connect(window.st.ctx.destination);
                window.st.t0 = window.st.ctx.currentTime;
                window.st.src.start(0);
                window.st.src.onended = () => { window.songFinished = true; end(false); };
                loop();
            } catch(err) { console.error(err); }
        }
    }, 1000);
}

function loop() {
    if (!window.st.act || window.st.paused) return;
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    if (window.st.songDuration > 0) {
        const dur = window.st.songDuration;
        const cur = Math.max(0, now / 1000); 
        const pct = Math.min(100, (cur / dur) * 100);
        const bar = document.getElementById('top-progress-fill');
        if(bar) bar.style.width = pct + "%";

        const timeText = document.getElementById('top-progress-time');
        if(timeText) {
            const curM = Math.floor(cur / 60);
            const curS = Math.floor(cur % 60).toString().padStart(2, '0');
            const durM = Math.floor(dur / 60);
            const durS = Math.floor(dur % 60).toString().padStart(2, '0');
            timeText.innerText = `${curM}:${curS} / ${durM}:${durS}`;
        }
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    // SPAWNING
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue;
        if (n.t - now < 1500) {
            const el = document.createElement('div');
            const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
            el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
            el.style.left = (n.l * w) + '%';
            el.style.width = w + '%';
            
            let conf = window.cfg.modes[window.keys][n.l];
            let color = conf.c;
            
            if (window.user && window.user.equipped && window.user.equipped.skin) {
                const s = window.user.equipped.skin;
                if (s === 'skin_neon') color = (n.l % 2 === 0) ? '#ff66aa' : '#00FFFF';
                else if (s === 'skin_gold') color = '#FFD700';
                else if (s === 'skin_dark') color = '#FFFFFF';
            }

            let shape = PATHS[conf.s] || PATHS['circle'];
            let svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${color})"><path d="${shape}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
            
            if (n.type === 'hold') {
                const h = (n.len / 1000) * (window.cfg.spd * 40); 
                svg += `<div class="sustain-trail" style="height:${h}px; background:${color}; opacity:${window.cfg.noteOp/100}"></div>`;
            }

            el.innerHTML = svg;
            if(elTrack) elTrack.appendChild(el);
            n.el = el;
            n.s = true;
            window.st.spawned.push(n);
        } else break;
    }

    // MOVEMENT
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        if (!n.el) { window.st.spawned.splice(i, 1); continue; }

        const timeDiff = n.t - now + window.cfg.off;
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
             
             if (!window.st.keys[n.l] && rem > 50) miss(n); 
             else { window.st.hp = Math.min(100, window.st.hp+0.05); updHUD(); }

             if (now >= n.t + n.len) {
                 window.st.sc += 100; 
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
        if(flash) { flash.style.opacity = 0.5; setTimeout(()=>flash.style.opacity=0,100); }

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = Math.abs(n.t - now);
            let score=50, text="BAD", color="yellow";
            if(diff<45){ text="SICK"; color="#00FFFF"; score=350; window.st.stats.s++; }
            else if(diff<90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }

            if(text==="BAD") window.st.fcStatus="SD";

            window.st.sc += score; 
            window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            window.st.hp = Math.min(100, window.st.hp+2);
            
            showJudge(text, color); playHit(); updHUD();
            n.h = true; 
            if (n.type === 'tap' && n.el) n.el.style.opacity = 0;
        }
    } else {
        window.st.keys[l] = 0;
        if(r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "#F9393F");
    window.st.stats.m++; window.st.cmb=0; window.st.hp-=10; window.st.fcStatus="SD";
    playMiss(); updHUD();
    if(n.el) n.el.style.opacity = 0;
    if(window.st.hp <= 0 && !window.isMultiplayer) end(true);
}

function showJudge(text, color) {
    const j = document.createElement('div');
    j.className = 'judge-pop'; j.innerText = text; j.style.color = color;
    document.body.appendChild(j); setTimeout(() => j.remove(), 400);
}

function updHUD() {
    document.getElementById('g-score').innerText = window.st.sc.toLocaleString();
    const cEl = document.getElementById('g-combo');
    if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } else cEl.style.opacity=0;
    document.getElementById('health-fill').style.height = window.st.hp + "%";
    
    // Calcular Accuracy basado en lo jugado hasta ahora (para feedback visual)
    // Pero el Rank final se calculará distinto
    const playedScore = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    const maxPlayed = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const acc = maxPlayed > 0 ? ((playedScore / maxPlayed)*100).toFixed(1) : "100.0";
    document.getElementById('g-acc').innerText = acc + "%";

    const fcEl = document.getElementById('hud-fc');
    if(fcEl) {
        fcEl.innerText = window.cfg.showFC ? window.st.fcStatus : "";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
    const modal = document.getElementById('modal-res');
    if(modal) {
        modal.style.display = 'flex';
        const panel = modal.querySelector('.modal-panel');
        
        // === CÁLCULO DE RANK REAL (SOBRE EL TOTAL DE LA CANCIÓN) ===
        // Si trueMaxScore es 0 (error), usar 1 para evitar división por cero
        const totalMax = window.st.trueMaxScore || 1;
        const finalAcc = Math.round((window.st.sc / totalMax) * 100);
        
        let r="D", c="red";
        if (!died) {
            if (finalAcc >= 98) { r="SS"; c="cyan" }
            else if (finalAcc >= 95) { r="S"; c="gold" }
            else if (finalAcc >= 90) { r="A"; c="lime" }
            else if (finalAcc >= 80) { r="B"; c="yellow" }
            else if (finalAcc >= 70) { r="C"; c="orange" }
            else { r="D"; c="red" } // Si sacas menos de 70% es D (incluso si no moriste)
        } else { r="F"; c="red"; }
        
        let xpGain = 0, ppGain = 0;
        if (!died && window.user.name !== "Guest") {
            xpGain = Math.floor(window.st.sc / 250);
            window.user.xp += xpGain;
            if (window.st.ranked) {
                ppGain = (finalAcc > 90) ? Math.floor(window.st.sc / 5000) : 0;
                window.user.pp += ppGain;
            }
            if(typeof save === 'function') save();
            if(typeof updateFirebaseScore === 'function') updateFirebaseScore();
        }

        panel.innerHTML = `
            <div class="m-title">RESULTADOS</div>
            <div style="display:flex; justify-content:center; align-items:center; gap:30px;">
                <div class="rank-big" style="color:${c}">${r}</div>
                <div style="text-align:left;">
                    <div style="font-size:3rem; font-weight:900;">${window.st.sc.toLocaleString()}</div>
                    <div style="color:#aaa; font-size:1.5rem;">ACC: <span style="color:white">${finalAcc}%</span></div>
                    <div style="color:#aaa;">MAX COMBO: <span style="color:white">${window.st.maxCmb}</span></div>
                </div>
            </div>
            
            <div class="res-grid">
                <div class="res-card xp-card">
                    <div class="res-label">Experiencia</div>
                    <div class="res-val" style="color:var(--blue)">+${xpGain} XP</div>
                    <div class="xp-gain-bar-bg"><div class="xp-gain-fill" style="width:0%" id="anim-xp-bar"></div></div>
                </div>
                <div class="res-card pp-card">
                    <div class="res-label">Performance</div>
                    <div class="res-val" style="color:var(--gold)">+${ppGain} PP</div>
                </div>
            </div>

            <div style="margin-top:30px; display:flex; gap:10px;">
                <button class="action" onclick="toMenu()">CONTINUAR</button>
                <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
            </div>
        `;
        
        setTimeout(() => {
            const bar = document.getElementById('anim-xp-bar');
            if(bar) bar.style.width = '100%';
        }, 100);
    }
}

function togglePause() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    const modal = document.getElementById('modal-pause');
    if(window.st.paused) {
        if(window.st.ctx) window.st.ctx.suspend();
        if(modal) {
            modal.style.display = 'flex';
            const panel = modal.querySelector('.modal-panel');
            panel.innerHTML = `
                <div class="m-title">PAUSA</div>
                <div style="font-size:3rem; font-weight:900; color:var(--blue);">ACC: <span id="p-acc">${document.getElementById('g-acc').innerText}</span></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; font-size:1.5rem; margin-bottom:30px;">
                    <div style="color:var(--sick)">SICK: <span>${window.st.stats.s}</span></div>
                    <div style="color:var(--good)">GOOD: <span>${window.st.stats.g}</span></div>
                    <div style="color:var(--bad)">BAD: <span>${window.st.stats.b}</span></div>
                    <div style="color:var(--miss)">MISS: <span>${window.st.stats.m}</span></div>
                </div>
                <button class="action" onclick="resumeGame()">CONTINUAR</button>
                <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
                <button class="action secondary" onclick="toMenu()">SALIR</button>
            `;
        }
    } else {
        resumeGame();
    }
}

function resumeGame() {
    const modal = document.getElementById('modal-pause');
    if(modal) modal.style.display = 'none'; 
    window.st.paused = false;
    if(window.st.ctx) window.st.ctx.resume();
    loop();
}

function toMenu() {
    location.reload(); 
}
