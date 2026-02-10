/* === AUDIO & ENGINE (ULTRA UPDATE V11) === */

function unlockAudio() {
    if (!st.ctx) {
        try {
            st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            genHit();
            genMiss();
        } catch(e) { console.error("Audio Context Error:", e); }
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
        s.connect(g);
        g.connect(st.ctx.destination);
        s.start(0);
    }
}

function playMiss() {
    if (missBuf && cfg.missSound && st.ctx) {
        const s = st.ctx.createBufferSource();
        s.buffer = missBuf;
        const g = st.ctx.createGain();
        g.gain.value = cfg.missVol;
        s.connect(g);
        g.connect(st.ctx.destination);
        s.start(0);
    }
}

// ... (genMap y normalizeAudio se mantienen igual que la versión V10, solo asegúrate de incluirlos) ...
function normalizeAudio(filteredData) {
    let max = 0;
    for (let i = 0; i < filteredData.length; i += 100) { 
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

function genMap(buf, k) {
    // ... (Copia el genMap V10 de la respuesta anterior, es compatible) ...
    // Para ahorrar espacio aquí, asumo que usas la versión V10 Anti-Spam
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData));
    const map = [];
    const sampleRate = buf.sampleRate;
    let density = cfg.den || 5; 
    const windowSize = 1024;
    const step = Math.floor(sampleRate / (40 + (density * 5))); 
    let laneFreeTime = new Array(k).fill(0);
    let lastNoteTime = -5000;
    let lastLane = 0;
    let consecutiveInLane = 0;
    let energyHistory = [];
    const historySize = 44100 / step; 
    const thresholdBase = 1.4 - (density * 0.04); 
    const minGap = Math.max(80, 400 - (density * 30)); 

    for (let i = 0; i < data.length - windowSize; i += step) {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
        const instantEnergy = Math.sqrt(sum / windowSize);
        energyHistory.push(instantEnergy);
        if (energyHistory.length > historySize) energyHistory.shift();
        let localAvg = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
        const timeMs = (i / sampleRate) * 1000;

        if (instantEnergy > localAvg * thresholdBase && instantEnergy > 0.05) {
            if (timeMs - lastNoteTime >= minGap) {
                let lane = Math.floor(Math.random() * k);
                if (lane === lastLane) {
                    consecutiveInLane++;
                    if (consecutiveInLane >= 2) {
                        lane = (lane + 1 + Math.floor(Math.random() * (k - 1))) % k;
                        consecutiveInLane = 0;
                    }
                } else consecutiveInLane = 0;

                if (density > 5 && Math.random() > 0.7) lane = (lastLane + 1) % k;

                let type = 'tap';
                let len = 0;
                if (instantEnergy > localAvg * 1.2 && timeMs > 5000) { 
                    let futureIndex = i + (step * 4);
                    if (futureIndex < data.length && Math.abs(data[futureIndex]) > localAvg * 0.8) {
                        if (Math.random() > 0.4) { 
                            type = 'hold';
                            len = Math.min(1500, Math.max(200, Math.random() * 600)); 
                        }
                    }
                }

                if (timeMs < laneFreeTime[lane] + 20) {
                    let found = false;
                    for (let tryL = 0; tryL < k; tryL++) {
                        if (timeMs >= laneFreeTime[tryL] + 20) {
                            lane = tryL;
                            found = true;
                            break;
                        }
                    }
                    if (!found) continue; 
                }

                map.push({ t: timeMs, l: lane, type: type, len: len, h: false, holding: false, scoreGiven: false });
                laneFreeTime[lane] = timeMs + len + 20; 
                lastNoteTime = timeMs;
                lastLane = lane;

                if (density >= 4 && instantEnergy > localAvg * 1.8) {
                    let maxExtra = (density >= 9 && instantEnergy > localAvg * 2.5) ? 2 : 1;
                    let extrasAdded = 0;
                    for (let offset = 1; offset < k; offset++) {
                        if (extrasAdded >= maxExtra) break;
                        let chordLane = (lane + offset) % k;
                        if (density < 6 && Math.abs(chordLane - lane) === 1) continue;
                        if (timeMs >= laneFreeTime[chordLane] + 20) {
                            map.push({ t: timeMs, l: chordLane, type: 'tap', len: 0, h: false });
                            laneFreeTime[chordLane] = timeMs + 20;
                            extrasAdded++;
                        }
                    }
                }
            }
        }
    }
    return map;
}

function initReceptors(k) {
    const t = document.getElementById('track');
    t.innerHTML = '';
    
    // MIDDLE SCROLL LOGIC
    if(cfg.middleScroll) t.classList.add('middle-scroll');
    else t.classList.remove('middle-scroll');

    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    
    for (let i = 0; i < k; i++) {
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        l.style.setProperty('--c', cfg.modes[k][i].c);
        t.appendChild(l);
    }
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
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}"/></svg>`;
        t.appendChild(r);
    }
}

async function prepareAndPlaySong(k) {
    // (Igual que V10, solo cambios en playSongInternal)
    if (!curSongData) return notify("Error: No hay canción seleccionada", "error");
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Cargando audio...";
    try {
        unlockAudio(); 
        let songInRam = ramSongs.find(s => s.id === curSongData.id);
        if (!songInRam) {
            const response = await fetch(curSongData.audioURL);
            if (!response.ok) throw new Error("Error red: " + response.status);
            const arrayBuffer = await response.arrayBuffer();
            document.getElementById('loading-text').innerText = "Decodificando...";
            const audioBuffer = await st.ctx.decodeAudioData(arrayBuffer);
            document.getElementById('loading-text').innerText = "Generando mapa...";
            await new Promise(r => setTimeout(r, 100)); 
            const map = genMap(audioBuffer, k);
            songInRam = { id: curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            ramSongs.push(songInRam);
            if (ramSongs.length > 5) ramSongs.shift();
        } else {
            if (songInRam.kVersion !== k) {
                document.getElementById('loading-text').innerText = "Reajustando...";
                await new Promise(r => setTimeout(r, 50));
                songInRam.map = genMap(songInRam.buf, k);
                songInRam.kVersion = k;
            }
        }
        document.getElementById('loading-overlay').style.display = 'none';
        playSongInternal(songInRam);
    } catch (e) {
        console.error("Error crítico carga:", e);
        notify("Error al cargar: " + e.message, "error");
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
        st.lastPause = 0; 
        st.totalOffset = 0; st.hitCount = 0; st.fcStatus = "GFC";
        songFinished = false; 
        st.songDuration = s.buf.duration;

        if (isMultiplayer) document.getElementById('vs-hud').style.display = 'flex';
        else document.getElementById('vs-hud').style.display = 'none';
        
        document.getElementById('menu-container').classList.add('hidden');
        document.getElementById('game-layer').style.display = 'block';
        document.getElementById('hud').style.display = cfg.hideHud ? 'none' : 'flex';
        document.getElementById('g-combo').style.opacity = '0'; 

        initReceptors(keys);
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
                } catch(e) { console.error("Audio start err", e); }
            }
        }, 1000);
    } catch(e) {
        console.error("Play error:", e);
        toMenu();
    }
}

// === MAIN LOOP CON LOGICA HOLD REESCRITA ===
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
    for (let i = 0; i < st.notes.length; i++) {
        const n = st.notes[i];
        if (n.s) continue;
        if (n.t < now - 200) { n.s = true; continue; } // Demasiado tarde para spawnear

        if (n.t - now < 1500) {
            const el = document.createElement('div');
            const dirClass = cfg.down ? 'hold-down' : 'hold-up';
            el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
            el.style.left = (n.l * w) + '%';
            el.style.width = w + '%';
            el.style.zIndex = 150;

            const conf = cfg.modes[keys][n.l];
            const shapePath = PATHS[conf.s] || PATHS['circle'];
            let svg = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" fill="${conf.c}" stroke="white" stroke-width="2"/></svg>`;

            if (n.type === 'hold') {
                const h = (n.len / 1000) * cfg.spd * 60;
                svg += `<div class="sustain-trail" style="height:${h}px; background:${conf.c}; opacity:${cfg.noteOp/100}"></div>`;
            }
            el.innerHTML = svg;
            if (cfg.vivid) el.querySelector('.arrow-path').style.filter = `drop-shadow(0 0 8px ${conf.c})`;
            document.getElementById('track').appendChild(el);
            n.el = el;
            st.spawned.push(n);
            n.s = true;
        } else break;
    }

    // UPDATE NOTAS
    for (let i = st.spawned.length - 1; i >= 0; i--) {
        const n = st.spawned[i];
        if (!n.el) { st.spawned.splice(i, 1); continue; }

        const diff = n.t - now + cfg.off;
        const dist = (diff / 1000) * cfg.spd * 60;
        let finalY = cfg.down ? (yReceptor - dist) : (yReceptor + dist);

        // LOGICA DE HOLD NOTES COMPLEX
        if (n.type === 'hold' && n.h) { 
            // n.h = Hit inicial (head hit)
            n.el.style.top = yReceptor + 'px';
            
            // Si el usuario soltó la tecla antes de tiempo (Holding check)
            if (!st.keys[n.l] && !n.scoreGiven) {
                // PENALIZACIÓN POR SOLTAR
                const remaining = (n.t + n.len) - now;
                if (remaining > 50) { // Si falta más de 50ms
                    miss(n, true); // Miss en hold break
                    n.el.style.opacity = 0.3; 
                    n.scoreGiven = true;
                }
            }

            // Si se mantiene presionado
            if (st.keys[n.l]) {
                const rem = (n.t + n.len) - now;
                const tr = n.el.querySelector('.sustain-trail');
                if (tr) tr.style.height = Math.max(0, (rem / 1000) * cfg.spd * 60) + 'px';
                st.hp = Math.min(100, st.hp + 0.05);
                updHUD();
            }

            // Si se completó el hold
            if (now >= n.t + n.len && !n.scoreGiven) {
                st.sc += 100; // Bonus por completar hold
                n.scoreGiven = true;
                n.el.remove();
                st.spawned.splice(i, 1);
            }

        } else if (!n.h) {
            // Nota normal o Hold Head no golpeado aún
            n.el.style.top = finalY + 'px';
            if (diff < -160) {
                miss(n, false); 
                n.h = true; n.scoreGiven = true;
                n.el.style.opacity = 0.4;
                setTimeout(() => { if (n.el) n.el.remove() }, 200);
                st.spawned.splice(i, 1);
            }
        }
    }
    
    requestAnimationFrame(loop);
}

// === INPUT SYSTEM MEJORADO ===
function hit(l, p) {
    if (!st.act || st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    const flash = document.getElementById(`flash-${l}`);

    if (p) { // KEY DOWN
        st.keys[l] = 1;
        if (r) r.classList.add('pressed');
        if (flash) { flash.style.opacity = 0.6; setTimeout(() => flash.style.opacity = 0, 100); }

        let now = (st.t0 !== null) ? (st.ctx.currentTime - st.t0) * 1000 : performance.now() - st.startTime;
        
        // Buscar nota golpeable
        const n = st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - (now + cfg.off)) < 160);

        if (n) {
            const msError = n.t - (now + cfg.off);
            const absError = Math.abs(msError);
            let t = "BAD", c = "yellow", pts = 50;

            if (absError < 45) {
                t = "SICK"; c = "var(--sick)"; pts = 350; st.stats.s++;
                if (cfg.shake) triggerShake();
                if (cfg.vivid) createSplash(l);
            } else if (absError < 90) {
                t = "GOOD"; c = "var(--good)"; pts = 200; st.stats.g++;
                st.fcStatus = (st.fcStatus === "GFC") ? "GFC" : (st.fcStatus === "PFC" ? "GFC" : st.fcStatus); // Pierde PFC
            } else {
                st.stats.b++; st.cmb = 0; st.hp -= 5;
                st.fcStatus = (st.fcStatus !== "SD") ? "FC" : "SD"; // Pierde GFC
            }

            st.cmb++;
            if(st.cmb > st.maxCmb) st.maxCmb = st.cmb;
            
            st.sc += pts;
            st.maxScorePossible += 350;
            st.hp = Math.min(100, st.hp + 2);
            
            // MEAN MS CALC
            st.totalOffset += msError;
            st.hitCount++;

            showJudge(t, c);
            playHit();
            updHUD();
            
            n.h = true; // Marcada como golpeada
            if (n.type !== 'hold' && n.el) n.el.style.display = 'none';

        } else if (!cfg.down) {
            // Ghost tapping penalty (opcional)
        }
    } else { // KEY UP
        st.keys[l] = 0;
        if (r) r.classList.remove('pressed');
    }
}

function miss(n, isHoldBreak) {
    showJudge("MISS", "var(--miss)");
    st.stats.m++;
    st.cmb = 0;
    st.hp -= 10;
    st.maxScorePossible += 350;
    st.fcStatus = "SD"; // Combo roto
    playMiss();
    updHUD();
    if (st.hp <= 0) end(true);
}

function updHUD() {
    document.getElementById('g-score').innerText = st.sc.toLocaleString();
    
    // Combo
    const comboEl = document.getElementById('g-combo');
    if (st.cmb > 0) {
        comboEl.innerText = st.cmb;
        comboEl.style.opacity = '1';
        comboEl.classList.remove('pulse'); void comboEl.offsetWidth; comboEl.classList.add('pulse');
    } else {
        comboEl.style.opacity = '0';
    }

    // Mean MS
    if (cfg.showMs && st.hitCount > 0) {
        const mean = (st.totalOffset / st.hitCount).toFixed(2);
        document.getElementById('hud-mean-ms').innerText = `${mean}ms`;
        document.getElementById('hud-mean-ms').style.display = 'block';
    } else {
        document.getElementById('hud-mean-ms').style.display = 'none';
    }

    // FC Status
    const fcEl = document.getElementById('hud-fc-status');
    fcEl.innerText = st.fcStatus;
    fcEl.style.color = (st.fcStatus === "PFC") ? "cyan" : (st.fcStatus === "GFC" ? "gold" : (st.fcStatus === "FC" ? "lime" : "red"));

    // Accuracy
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 100;
    document.getElementById('g-acc').innerText = acc + "%";
    
    // Stats
    document.getElementById('h-sick').innerText = st.stats.s;
    document.getElementById('h-good').innerText = st.stats.g;
    document.getElementById('h-bad').innerText = st.stats.b;
    document.getElementById('h-miss').innerText = st.stats.m;
    
    document.getElementById('health-fill').style.height = st.hp + '%';
    
    if (isMultiplayer) sendLobbyScore(st.sc);
}

// ... (togglePause, resumeGame, triggerShake, createSplash, showJudge, end, toMenu, startGame se mantienen igual que V10) ...
// Asegúrate de copiar las funciones auxiliares de V10 si no están aquí explícitamente para ahorrar espacio.
// IMPORTANTE: Asegúrate de incluir togglePause, resumeGame, triggerShake, createSplash, showJudge, end, toMenu, startGame aquí abajo.
// Son idénticas a la versión anterior, solo updHUD cambió.

function togglePause() {
    if (!st.act && st.spawned.length === 0) return;
    st.paused = !st.paused;
    if (st.paused) {
        st.lastPause = performance.now();
        document.getElementById('modal-pause').style.display = 'flex';
        if (st.ctx && st.ctx.state === 'running') st.ctx.suspend().catch(e=>{});
    } else resumeGame();
}
function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if (st.ctx) st.ctx.resume().catch(e=>{});
    if (st.lastPause) { st.startTime += (performance.now() - st.lastPause); st.lastPause = 0; }
    st.paused = false; requestAnimationFrame(loop);
}
function triggerShake() { if(!cfg.shake)return; const w = document.getElementById('game-layer'); w.classList.remove('shaking'); void w.offsetWidth; w.classList.add('shaking'); }
function createSplash(l) { const r = document.getElementById(`rec-${l}`).getBoundingClientRect(); const s = document.createElement('div'); s.className = 'splash'; s.style.color = cfg.modes[keys][l].c; s.style.left = (r.left + r.width/2 - 80)+'px'; s.style.top = (r.top + r.height/2 - 80)+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(), 300); }
function showJudge(t, c) { if(!cfg.judgeVis)return; const j = document.createElement('div'); j.className = 'judge-pop'; j.innerText = t; j.style.color = c; document.body.appendChild(j); setTimeout(()=>j.remove(), 400); }
function end(died) {
    st.act = false; if(st.src) try{st.src.stop()}catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('modal-res').style.display = 'flex';
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 0;
    let r = "F", c = "red";
    if(!died) { if(acc===100){r="SS";c="cyan"} else if(acc>=95){r="S";c="gold"} else if(acc>=90){r="A";c="lime"} else if(acc>=80){r="B";c="yellow"} else if(acc>=70){r="C";c="orange"} else{r="D";c="red"} }
    document.getElementById('res-rank').innerText = r; document.getElementById('res-rank').style.color = c;
    document.getElementById('res-score').innerText = st.sc.toLocaleString(); document.getElementById('res-acc').innerText = acc+"%";
    if(!died && songFinished && user.name!=="Guest") {
        const xp = Math.floor(st.sc/250); user.xp+=xp; user.score+=st.sc; user.plays++; user.sp = (user.sp||0) + Math.floor(st.sc/1000);
        let req = 1000*Math.pow(1.05, user.lvl-1); if(user.xp>=req){user.xp-=req;user.lvl++;notify("LVL UP!");}
        save(); updateFirebaseScore(); document.getElementById('res-xp').innerText = xp; document.getElementById('res-sp').innerText = Math.floor(st.sc/1000);
    }
}
function toMenu() { location.reload(); }
function startGame(k) { keys = k; closeModal('diff'); prepareAndPlaySong(k); }