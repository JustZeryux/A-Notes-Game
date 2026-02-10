/* === AUDIO & ENGINE (V7: FULL PATTERNS + FALLING START) === */

function unlockAudio() {
    if (!st.ctx) {
        st.ctx = new (window.AudioContext || window.webkitAudioContext)();
        genHit();
    }
    if (st.ctx.state === 'suspended') st.ctx.resume();
}

function genHit() {
    const b = st.ctx.createBuffer(1, 2000, 44100);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 0.5) * Math.exp(-i / 300);
    hitBuf = b;
}

function playHit() {
    if (hitBuf && cfg.hvol > 0 && st.ctx) {
        const s = st.ctx.createBufferSource();
        s.buffer = hitBuf;
        const g = st.ctx.createGain();
        g.gain.value = cfg.hvol;
        s.connect(g);
        g.connect(st.ctx.destination);
        s.start(0);
    }
}

// === NORMALIZACIÓN AGRESIVA ===
function normalizeAudio(filteredData) {
    let max = 0;
    // Muestreo optimizado
    for (let i = 0; i < filteredData.length; i += 10) {
        const v = Math.abs(filteredData[i]);
        if (v > max) max = v;
    }
    if (max === 0) return filteredData;
    
    // Subir volumen hasta el techo (0.98) para detectar notas sutiles
    const multiplier = 0.98 / max;
    if (multiplier > 1.05) {
        for (let i = 0; i < filteredData.length; i++) filteredData[i] *= multiplier;
    }
    return filteredData;
}

// === GENERADOR V7: PATRONES COMPLEJOS ===
function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData));
    const map = [];
    const sampleRate = buf.sampleRate;

    // Ventana de análisis (aprox 23ms)
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 85); // Frecuencia de escaneo

    // Estado del Generador
    let laneFreeTime = new Array(k).fill(0);
    let lastNoteTime = -5000;
    let lastLane = 0;
    
    // Máquina de Estados de Patrones
    let patternType = 0; // 0:Random, 1:StairUP, 2:StairDOWN, 3:Trill, 4:Jack
    let patternCounter = 0; 

    // Análisis de Energía
    let energyHistory = [];
    const historySize = 40; 

    // Ajuste de Dificultad (cfg.den va de 1 a 10)
    // Más den = umbral más bajo (más notas) y gap más corto
    const density = Math.max(1, Math.min(10, cfg.den));
    const thresholdFactor = 1.35 - (density * 0.06); 
    const minGapBase = Math.max(70, 550 - (density * 45)); 

    for (let i = 0; i < data.length - windowSize; i += step) {
        // RMS (Root Mean Square) para energía
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
        const instantEnergy = Math.sqrt(sum / windowSize);

        energyHistory.push(instantEnergy);
        if (energyHistory.length > historySize) energyHistory.shift();
        
        let localAvg = 0;
        for(let e of energyHistory) localAvg += e;
        localAvg /= energyHistory.length;

        const timeMs = (i / sampleRate) * 1000;

        // === DETECCIÓN DE GOLPE ===
        // Si supera el promedio local * factor Y un mínimo absoluto de silencio
        if (instantEnergy > localAvg * thresholdFactor && instantEnergy > 0.02) {
            
            // Gap Dinámico: Si la música es intensa, permitimos ráfagas más rápidas
            let currentGap = minGapBase;
            if (instantEnergy > localAvg * 1.8) currentGap *= 0.6; // Stream mode
            if (instantEnergy > localAvg * 2.5) currentGap *= 0.5; // Burst mode

            if (timeMs - lastNoteTime >= currentGap) {
                
                // === SELECCIÓN DE PATRÓN ===
                // Cambiar patrón cada 4-8 notas o aleatoriamente
                if (patternCounter <= 0 || Math.random() > 0.9) {
                    const r = Math.random();
                    if (r < 0.30) patternType = 0; // Random (30%)
                    else if (r < 0.50) patternType = 1; // Escalera Arriba (20%)
                    else if (r < 0.70) patternType = 2; // Escalera Abajo (20%)
                    else if (r < 0.90) patternType = 3; // Trill (20%)
                    else patternType = 4; // Jack/Repetición (10%)
                    
                    patternCounter = Math.floor(Math.random() * 5) + 4; // Duración del patrón
                }

                // === TIPO DE NOTA (Tap vs Hold) ===
                let type = 'tap';
                let len = 0;
                // Probabilidad de Hold aumenta con la energía y si no estamos en ráfaga rápida
                if (instantEnergy > localAvg * 1.4 && currentGap > 100) {
                    if (Math.random() > 0.65) { 
                        type = 'hold';
                        // Largo del hold basado en intensidad
                        len = Math.min(1000, Math.random() * 400 + 150);
                    }
                }

                // === SELECCIÓN DE CARRIL ===
                let lane = 0;
                
                if (patternType === 1) { // Stair UP
                    lane = (lastLane + 1) % k;
                } else if (patternType === 2) { // Stair DOWN
                    lane = (lastLane - 1 + k) % k;
                } else if (patternType === 3) { // Trill (0-2-0-2 o 1-3-1-3)
                    if (k === 4) lane = (lastLane === 0 ? 1 : (lastLane === 1 ? 0 : (lastLane === 2 ? 3 : 2)));
                    else lane = (lastLane + 2) % k;
                } else if (patternType === 4) { // Jack (Repetir o cerca)
                    lane = lastLane; 
                    // A veces cambiar un poco para no ser aburrido
                    if(Math.random() > 0.7) lane = (lastLane + 1) % k;
                } else { // Random Inteligente (Evitar repetición excesiva)
                    let tries = 0;
                    do {
                        lane = Math.floor(Math.random() * k);
                        tries++;
                    } while (lane === lastLane && tries < 5);
                }

                // === ANTI-COLISIÓN DE HOLDS ===
                // Si el carril elegido está ocupado por un hold previo, buscar otro
                if (timeMs < laneFreeTime[lane] + 20) {
                    let found = false;
                    // Intentar buscar carril libre ordenadamente
                    for (let offset = 1; offset < k; offset++) {
                        let tryLane = (lane + offset) % k;
                        if (timeMs >= laneFreeTime[tryLane] + 20) {
                            lane = tryLane;
                            found = true;
                            break;
                        }
                    }
                    // Si todo está lleno, saltar nota (evita bugs visuales)
                    if (!found) continue; 
                }

                // === GENERAR LA NOTA ===
                map.push({ t: timeMs, l: lane, type: type, len: len, h: false });
                
                // Actualizar estado
                laneFreeTime[lane] = timeMs + len; // Ocupar carril
                lastNoteTime = timeMs;
                lastLane = lane;
                patternCounter--;

                // === EXTRAS: DOBLES Y TRIPLES (ACORDES) ===
                // Solo si la dificultad es media/alta y la energía explota
                
                // Dobles (Densidad >= 4)
                if (density >= 4 && instantEnergy > localAvg * 1.8 && k >= 2) {
                    // Solo si no es una ráfaga demasiado rápida
                    if (currentGap > 90) {
                        let lane2 = (lane + Math.floor(k/2)) % k; // Carril opuesto/lejano
                        if (timeMs >= laneFreeTime[lane2] + 20) {
                            map.push({ t: timeMs, l: lane2, type: 'tap', len: 0, h: false });
                            laneFreeTime[lane2] = timeMs;
                        }
                    }
                }

                // Triples (Densidad >= 8, Solo momentos CLIMAX)
                if (density >= 8 && instantEnergy > localAvg * 2.8 && k >= 4) {
                    let lane3 = (lane + 1) % k;
                    if (lane3 !== lane && timeMs >= laneFreeTime[lane3] + 20) {
                        map.push({ t: timeMs, l: lane3, type: 'tap', len: 0, h: false });
                        laneFreeTime[lane3] = timeMs;
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

// === OPTIMIZACIÓN: CACHÉ EN RAM ===
async function prepareAndPlaySong(k) {
    if (!curSongData) return;

    let songInRam = ramSongs.find(s => s.id === curSongData.id);
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Cargando...";

    if (!songInRam) {
        try {
            unlockAudio();
            const response = await fetch(curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await st.ctx.decodeAudioData(arrayBuffer);
            const map = genMap(audioBuffer, k);
            
            songInRam = { id: curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            ramSongs.push(songInRam);
            if (ramSongs.length > 5) ramSongs.shift(); // Max 5 songs cache

        } catch (e) {
            document.getElementById('loading-overlay').style.display = 'none';
            return;
        }
    } else {
        // Regenerar si cambia dificultad
        if (songInRam.kVersion !== k) {
            songInRam.map = genMap(songInRam.buf, k);
            songInRam.kVersion = k;
        }
    }

    document.getElementById('loading-overlay').style.display = 'none';
    playSongInternal(songInRam);
}

function playSongInternal(s) {
    document.getElementById('track').innerHTML = '';
    st.notes = JSON.parse(JSON.stringify(s.map));
    st.spawned = [];
    st.sc = 0; st.cmb = 0; st.hp = 50; st.stats = { s: 0, g: 0, b: 0, m: 0 };
    st.keys = new Array(keys).fill(0);
    st.maxScorePossible = 0;
    st.ranked = document.getElementById('chk-ranked').checked;
    st.lastPause = 0; 
    songFinished = false; 
    st.songDuration = s.buf.duration;

    if (isMultiplayer) document.getElementById('vs-hud').style.display = 'flex';
    else document.getElementById('vs-hud').style.display = 'none';
    
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    document.getElementById('hud').style.display = 'flex';

    initReceptors(keys);
    updHUD();

    // === FALLING START ===
    const cd = document.getElementById('countdown');
    let c = 3; cd.innerHTML = c;

    // Reloj negativo para caída (3s antes)
    st.startTime = performance.now() + 3000;
    st.t0 = null;
    st.act = true;
    st.paused = false;

    // Arrancar visual ya
    requestAnimationFrame(loop);

    const iv = setInterval(async () => {
        c--;
        if (c > 0) {
            cd.innerHTML = c;
        } else {
            clearInterval(iv);
            cd.innerHTML = "GO!";
            setTimeout(() => cd.innerHTML = "", 500);

            if (st.ctx && st.ctx.state === 'suspended') st.ctx.resume();
            st.src = st.ctx.createBufferSource();
            st.src.buffer = s.buf;
            const gain = st.ctx.createGain();
            gain.gain.value = cfg.vol;
            st.src.connect(gain);
            gain.connect(st.ctx.destination);
            st.t0 = st.ctx.currentTime;
            st.src.start(0);
            st.src.onended = () => { songFinished = true; end(false); };
        }
    }, 1000);
}

function formatTime(s) { const m = Math.floor(s / 60); const sc = Math.floor(s % 60); return `${m}:${sc.toString().padStart(2, '0')}`; }

function loop() {
    if (!st.act || st.paused) return;

    let now;
    if (st.t0 !== null && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
    else now = performance.now() - st.startTime;

    if (st.songDuration > 0 && now > 0) {
        const currentSec = now / 1000;
        const pct = Math.min(100, (currentSec / st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${formatTime(currentSec)} / ${formatTime(st.songDuration)}`;
    }

    const yReceptor = cfg.down ? window.innerHeight - 140 : 80;
    const w = 100 / keys;

    // SPAWN LOGIC (Funciona con tiempo negativo)
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
            let svg = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" fill="${conf.c}" stroke="white" stroke-width="2"/></svg>`;

            if (n.type === 'hold') {
                const h = (n.len / 1000) * cfg.spd * 60;
                svg += `<div class="sustain-trail" style="height:${h}px; background:${conf.c};"></div>`;
            }
            el.innerHTML = svg;
            if (cfg.vivid) el.querySelector('.arrow-path').style.filter = `drop-shadow(0 0 8px ${conf.c})`;
            document.getElementById('track').appendChild(el);
            n.el = el;
            st.spawned.push(n);
            n.s = true;
        } else break;
    }

    // MOVEMENT
    for (let i = st.spawned.length - 1; i >= 0; i--) {
        const n = st.spawned[i];
        if (!n.el) { st.spawned.splice(i, 1); continue; }

        const diff = n.t - now + cfg.off;
        const dist = (diff / 1000) * cfg.spd * 60;
        let finalY = cfg.down ? (yReceptor - dist) : (yReceptor + dist);

        if (n.h && n.type === 'hold') {
            n.el.style.top = yReceptor + 'px';
            n.el.style.opacity = 0.8;
            const rem = (n.t + n.len) - now;
            if (rem <= 0) { n.el.remove(); st.spawned.splice(i, 1); continue; }
            const tr = n.el.querySelector('.sustain-trail');
            if (tr) tr.style.height = Math.max(0, (rem / 1000) * cfg.spd * 60) + 'px';
            if (st.keys[n.l]) { st.hp = Math.min(100, st.hp + 0.1); updHUD(); } else n.el.style.opacity = 0.3;
        } else if (!n.h) {
            n.el.style.top = finalY + 'px';
            if (diff < -160) {
                miss(n); n.h = true; n.el.style.opacity = 0.4;
                setTimeout(() => { if (n.el) n.el.remove() }, 200);
                st.spawned.splice(i, 1);
            }
        } else {
            n.el.remove(); st.spawned.splice(i, 1);
        }
    }
    
    if (!st.paused) requestAnimationFrame(loop);
}

// === FIX DE PAUSA INSTANTÁNEA ===
function togglePause() {
    if (!st.act) return;
    st.paused = !st.paused;
    if (st.paused) {
        st.lastPause = performance.now();
        document.getElementById('modal-pause').style.display = 'flex';
        document.getElementById('p-sick').innerText = st.stats.s;
        document.getElementById('p-good').innerText = st.stats.g;
        document.getElementById('p-bad').innerText = st.stats.b;
        document.getElementById('p-miss').innerText = st.stats.m;
        if (st.ctx && st.ctx.state === 'running') st.ctx.suspend();
    } else {
        resumeGame();
    }
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if (st.ctx) st.ctx.resume();
    if (st.lastPause) {
        const dur = performance.now() - st.lastPause;
        st.startTime += dur;
        st.lastPause = 0;
    }
    st.paused = false;
    requestAnimationFrame(loop);
}

// === INPUTS (SAFE & FAST) ===
function onKd(e) {
    if (e.key === "Escape") { e.preventDefault(); togglePause(); return; }
    if (["Tab", "Alt", "Control", "Shift"].includes(e.key)) return;

    if (remapMode !== null && cfg.modes[remapMode]) {
        cfg.modes[remapMode][remapIdx].k = e.key.toLowerCase();
        renderLaneConfig(remapMode);
        remapMode = null;
        return;
    }

    if (!e.repeat) {
        // Safe check
        const idx = cfg.modes[keys]?.findIndex(l => l.k === e.key.toLowerCase());
        if (idx !== undefined && idx !== -1) hit(idx, true);
    }
}

function onKu(e) {
    const idx = cfg.modes[keys]?.findIndex(l => l.k === e.key.toLowerCase());
    if (idx !== undefined && idx !== -1) hit(idx, false);
}

function hit(l, p) {
    if (!st.act || st.paused) return;
    const r = document.getElementById(`rec-${l}`);
    const flash = document.getElementById(`flash-${l}`);

    if (p) {
        st.keys[l] = 1;
        if (r) r.classList.add('pressed');
        if (flash) {
            flash.style.opacity = 0.6;
            setTimeout(() => flash.style.opacity = 0, 100);
        }

        let now;
        if (st.t0 !== null && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
        else now = performance.now() - st.startTime;

        const n = st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - (now + cfg.off)) < 160);

        if (n) {
            const d = Math.abs(n.t - (now + cfg.off));
            let t = "BAD", c = "yellow", pts = 50;

            if (d < 45) {
                t = "SICK"; c = "var(--sick)"; pts = 350; st.stats.s++;
                if (cfg.shake) triggerShake();
                if (cfg.vivid) createSplash(l);
                playHit();
            } else if (d < 90) {
                t = "GOOD"; c = "var(--good)"; pts = 200; st.stats.g++;
                playHit();
            } else {
                st.stats.b++; st.cmb = 0; st.hp -= 5;
            }

            if (pts > 50) st.cmb++;
            st.sc += pts;
            st.maxScorePossible += 350;
            st.hp = Math.min(100, st.hp + 2);

            showJudge(t, c);
            updHUD();
            n.h = true; 
            if (n.type !== 'hold' && n.el) n.el.style.display = 'none';

        } else if (!cfg.down) {
            st.sc -= 10;
            st.cmb = 0;
            st.hp -= 2;
            updHUD();
        }
    } else {
        st.keys[l] = 0;
        if (r) r.classList.remove('pressed');
    }
}

function miss(n) {
    showJudge("MISS", "var(--miss)");
    st.stats.m++;
    st.cmb = 0;
    st.hp -= 10;
    st.maxScorePossible += 350;
    updHUD();
    if (st.hp <= 0) end(true);
}

function triggerShake() {
    const w = document.getElementById('game-layer');
    w.classList.remove('shaking');
    void w.offsetWidth;
    w.classList.add('shaking');
}

function createSplash(l) {
    const r = document.getElementById(`rec-${l}`).getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'splash';
    s.style.color = cfg.modes[keys][l].c;
    s.style.left = (r.left + r.width / 2 - 80) + 'px';
    s.style.top = (r.top + r.height / 2 - 80) + 'px';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 300);
}

function showJudge(t, c) {
    if (!cfg.judgeVis) return;
    const j = document.createElement('div');
    j.className = 'judge-pop';
    j.innerText = t;
    j.style.color = c;
    document.body.appendChild(j);
    setTimeout(() => j.remove(), 400);
}

function end(died) {
    st.act = false;
    if (st.src) try { st.src.stop() } catch (e) { }
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('modal-res').style.display = 'flex';
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 0;
    let r = "F"; let c = "red";
    if (!died) {
        if (acc === 100) { r = "SS"; c = "cyan" }
        else if (acc >= 95) { r = "S"; c = "gold" }
        else if (acc >= 90) { r = "A"; c = "lime" }
        else if (acc >= 80) { r = "B"; c = "yellow" }
        else if (acc >= 70) { r = "C"; c = "orange" }
        else { r = "D"; c = "red" }
    }
    if (isMultiplayer) {
        document.getElementById('winner-msg').innerText = "PARTIDA FINALIZADA";
        document.getElementById('winner-msg').style.display = 'block';
        document.getElementById('winner-msg').style.color = 'white';
        if (typeof leaveLobby === 'function') leaveLobby();
    } else {
        document.getElementById('winner-msg').style.display = 'none';
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
        let xpReq = 1000 * Math.pow(user.lvl >= 10 ? 1.02 : 1.05, user.lvl - 1);
        if (user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1);
        xpReq = Math.floor(xpReq);
        if (user.xp >= xpReq) {
            user.xp -= xpReq;
            user.lvl++;
            notify("¡NIVEL " + user.lvl + " ALCANZADO!", "success", 5000);
        }
        if (st.ranked) {
            if (acc < 50) {
                user.pp = Math.max(0, user.pp - 15);
                document.getElementById('pp-gain-loss').innerText = "-15 PP";
                document.getElementById('pp-gain-loss').style.color = "var(--miss)";
            } else {
                const ppG = Math.floor(st.sc / 5000);
                user.pp += ppG;
                document.getElementById('pp-gain-loss').innerText = `+${ppG} PP`;
                document.getElementById('pp-gain-loss').style.color = "var(--gold)";
            }
        } else {
            document.getElementById('pp-gain-loss').innerText = "0 PP";
            document.getElementById('pp-gain-loss').style.color = "white";
        }
        save();
        updateFirebaseScore();
        document.getElementById('res-xp').innerText = xpGain;
        document.getElementById('res-sp').innerText = spGain;
    } else {
        document.getElementById('res-xp').innerText = 0;
        document.getElementById('res-sp').innerText = 0;
    }
}

function toMenu() { location.reload(); }
function startGame(k) { keys = k; closeModal('diff'); prepareAndPlaySong(k); }
