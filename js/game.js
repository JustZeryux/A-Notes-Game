/* === AUDIO & ENGINE (MEJORADO V9 - ANTI SPAM & BETTER FLOW) === */

function unlockAudio() {
    if (!st.ctx) {
        try {
            st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            genHit();
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

function normalizeAudio(filteredData) {
    let max = 0;
    // Muestreo optimizado
    for (let i = 0; i < filteredData.length; i += 100) { 
        const v = Math.abs(filteredData[i]);
        if (v > max) max = v;
    }
    if (max === 0) return filteredData;
    const multiplier = 0.95 / max;
    // Solo normalizar si está muy bajo o muy saturado
    if (multiplier > 1.1 || multiplier < 0.9) {
        for (let i = 0; i < filteredData.length; i++) filteredData[i] *= multiplier;
    }
    return filteredData;
}

// === GENERADOR DE MAPAS INTELIGENTE ===
function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData));
    const map = [];
    const sampleRate = buf.sampleRate;

    // Configuración de dificultad basada en el slider (1 a 10)
    let density = cfg.den || 5; 
    
    // Parámetros de Ventana y Energía
    const windowSize = 1024;
    const step = Math.floor(sampleRate / (40 + (density * 5))); // Más densidad = pasos más cortos
    
    // Variables de Estado del Algoritmo
    let laneFreeTime = new Array(k).fill(0); // Para evitar superposiciones
    let lastNoteTime = -5000;
    let lastLane = 0;
    let consecutiveInLane = 0; // Contador anti-spam de carril
    
    // Historial de Energía para detectar picos relativos
    let energyHistory = [];
    const historySize = 44100 / step; // ~1 segundo de historia

    // Umbrales dinámicos
    const thresholdBase = 1.4 - (density * 0.04); // Dificultad alta = umbral más bajo
    const minGap = Math.max(80, 400 - (density * 30)); // Tiempo mínimo entre notas (ms)

    for (let i = 0; i < data.length - windowSize; i += step) {
        // 1. Calcular Energía Instantánea (RMS)
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
        const instantEnergy = Math.sqrt(sum / windowSize);

        // Actualizar promedio local
        energyHistory.push(instantEnergy);
        if (energyHistory.length > historySize) energyHistory.shift();
        let localAvg = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;

        // Convertir índice a milisegundos
        const timeMs = (i / sampleRate) * 1000;

        // 2. Detección de Beat
        // El beat ocurre si la energía instantánea supera al promedio local * factor
        if (instantEnergy > localAvg * thresholdBase && instantEnergy > 0.05) {
            
            // Control de tiempo (MinGap)
            if (timeMs - lastNoteTime >= minGap) {
                
                // === LÓGICA DE SELECCIÓN DE CARRIL ===
                let lane = Math.floor(Math.random() * k);
                
                // A. Anti-Jackhammer (Evitar más de 2 notas seguidas en el mismo carril)
                if (lane === lastLane) {
                    consecutiveInLane++;
                    if (consecutiveInLane >= 2) {
                        // Forzar cambio de carril
                        lane = (lane + 1 + Math.floor(Math.random() * (k - 1))) % k;
                        consecutiveInLane = 0;
                    }
                } else {
                    consecutiveInLane = 0;
                }

                // B. Patrones de Flujo (Escaleras/Trinos)
                // Si la dificultad es alta, a veces forzamos patrones
                if (density > 5 && Math.random() > 0.7) {
                    lane = (lastLane + 1) % k; // Escalera simple
                }

                // === LÓGICA DE HOLD NOTES (NOTAS LARGAS) ===
                let type = 'tap';
                let len = 0;
                
                // Si la energía se mantiene alta por un periodo, es un Hold
                // Bajamos el requisito para que salgan más holds
                if (instantEnergy > localAvg * 1.2 && timeMs > 5000) { 
                    // Verificar si el sonido se mantiene fuerte en el futuro cercano
                    let futureIndex = i + (step * 4);
                    if (futureIndex < data.length && Math.abs(data[futureIndex]) > localAvg * 0.8) {
                        if (Math.random() > 0.4) { // 60% chance de hold si hay energía
                            type = 'hold';
                            // Duración basada en dificultad y aleatoriedad
                            len = Math.min(1500, Math.max(200, Math.random() * 600)); 
                        }
                    }
                }

                // Verificar colisión con notas existentes
                if (timeMs < laneFreeTime[lane] + 20) {
                    // Buscar carril libre
                    let found = false;
                    for (let tryL = 0; tryL < k; tryL++) {
                        if (timeMs >= laneFreeTime[tryL] + 20) {
                            lane = tryL;
                            found = true;
                            break;
                        }
                    }
                    if (!found) continue; // Si no hay sitio, saltar nota
                }

                // Registrar nota principal
                map.push({ t: timeMs, l: lane, type: type, len: len, h: false });
                laneFreeTime[lane] = timeMs + len + 20; // Reservar carril
                lastNoteTime = timeMs;
                lastLane = lane;

                // === LÓGICA DE ACORDES (CHORDS) ===
                // Solo permitimos acordes si la dificultad es > 3 y la energía es muy alta
                if (density >= 4 && instantEnergy > localAvg * 1.8) {
                    // Máximo 1 nota extra (Doble) para evitar spam masivo de 4 notas
                    // Solo triples si es dificultad máxima (9 o 10)
                    let maxExtra = (density >= 9 && instantEnergy > localAvg * 2.5) ? 2 : 1;
                    
                    let extrasAdded = 0;
                    for (let offset = 1; offset < k; offset++) {
                        if (extrasAdded >= maxExtra) break;
                        
                        let chordLane = (lane + offset) % k;
                        // Evitar carriles adyacentes en dificultades bajas para legibilidad
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

// === CARGA Y GESTIÓN DE ERRORES ===
async function prepareAndPlaySong(k) {
    if (!curSongData) return notify("Error: No hay canción seleccionada", "error");

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Cargando audio...";

    try {
        unlockAudio(); // Asegurar contexto de audio

        // Buscar en caché RAM
        let songInRam = ramSongs.find(s => s.id === curSongData.id);

        if (!songInRam) {
            // Descargar
            const response = await fetch(curSongData.audioURL);
            if (!response.ok) throw new Error("Error red: " + response.status);
            
            const arrayBuffer = await response.arrayBuffer();
            
            document.getElementById('loading-text').innerText = "Decodificando...";
            const audioBuffer = await st.ctx.decodeAudioData(arrayBuffer);
            
            document.getElementById('loading-text').innerText = "Generando mapa...";
            
            // !! IMPORTANTE: Delay para permitir que el UI se renderice antes de congelar con cálculos
            await new Promise(r => setTimeout(r, 100)); 

            const map = genMap(audioBuffer, k);
            songInRam = { id: curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            
            // Guardar en caché
            ramSongs.push(songInRam);
            if (ramSongs.length > 5) ramSongs.shift();
        } else {
            // Regenerar si cambia dificultad
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

        // === START ===
        const cd = document.getElementById('countdown');
        let c = 3; cd.innerHTML = c;

        st.startTime = performance.now() + 3000;
        st.t0 = null;
        st.act = true; 
        st.paused = false;

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
                
                try {
                    st.src = st.ctx.createBufferSource();
                    st.src.buffer = s.buf;
                    const gain = st.ctx.createGain();
                    gain.gain.value = cfg.vol;
                    st.src.connect(gain);
                    gain.connect(st.ctx.destination);
                    
                    st.t0 = st.ctx.currentTime;
                    st.src.start(0);
                    st.src.onended = () => { songFinished = true; end(false); };
                } catch(e) { console.error("Audio start err", e); }
            }
        }, 1000);
    } catch(e) {
        console.error("Play error:", e);
        notify("Error fatal al iniciar juego", "error");
        toMenu();
    }
}

function formatTime(s) { const m = Math.floor(s / 60); const sc = Math.floor(s % 60); return `${m}:${sc.toString().padStart(2, '0')}`; }

function loop() {
    if (!st.act || st.paused) return;

    let now;
    if (st.t0 !== null && st.ctx && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
    else now = performance.now() - st.startTime;

    if (st.songDuration > 0 && now > 0) {
        const currentSec = now / 1000;
        const pct = Math.min(100, (currentSec / st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${formatTime(currentSec)} / ${formatTime(st.songDuration)}`;
    }

    const yReceptor = cfg.down ? window.innerHeight - 140 : 80;
    const w = 100 / keys;

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

// === PAUSA CORREGIDA ===
function togglePause() {
    if (!st.act) return; 
    
    st.paused = !st.paused;

    if (st.paused) {
        st.lastPause = performance.now();
        
        if (st.ctx && st.ctx.state === 'running') {
            st.ctx.suspend();
        }

        const modal = document.getElementById('modal-pause');
        modal.style.display = 'flex';

        const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 100;
        const elAcc = document.getElementById('p-acc');
        if(elAcc) elAcc.innerText = acc + "%";

        if(document.getElementById('p-sick')) document.getElementById('p-sick').innerText = st.stats.s;
        if(document.getElementById('p-good')) document.getElementById('p-good').innerText = st.stats.g;
        if(document.getElementById('p-bad')) document.getElementById('p-bad').innerText = st.stats.b;
        if(document.getElementById('p-miss')) document.getElementById('p-miss').innerText = st.stats.m;
    } else {
        resumeGame();
    }
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    
    if (st.ctx) st.ctx.resume();

    if (st.lastPause) {
        const duration = performance.now() - st.lastPause;
        st.startTime += duration;
        if (st.t0 !== null) st.t0 += (duration / 1000); 
        st.lastPause = 0;
    }

    st.paused = false;
    requestAnimationFrame(loop);
}

// === INPUTS ===
function onKd(e) {
    if (e.key === "Escape") { 
        e.preventDefault(); 
        togglePause(); 
        return; 
    }
    if (["Tab", "Alt", "Control", "Shift"].includes(e.key)) return;

    if (remapMode !== null && cfg.modes[remapMode]) {
        cfg.modes[remapMode][remapIdx].k = e.key.toLowerCase();
        renderLaneConfig(remapMode);
        remapMode = null;
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
        if (flash) {
            flash.style.opacity = 0.6;
            setTimeout(() => flash.style.opacity = 0, 100);
        }

        let now;
        if (st.t0 !== null && st.ctx && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
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
function updHUD() {
    document.getElementById('g-score').innerText = st.sc.toLocaleString();
    document.getElementById('g-combo').innerText = st.cmb;
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 100;
    document.getElementById('g-acc').innerText = acc + "%";
    
    document.getElementById('h-sick').innerText = st.stats.s;
    document.getElementById('h-good').innerText = st.stats.g;
    document.getElementById('h-bad').innerText = st.stats.b;
    document.getElementById('h-miss').innerText = st.stats.m;
    
    document.getElementById('health-fill').style.height = st.hp + '%';
    document.documentElement.style.setProperty('--combo-y', st.cmb % 2 === 0 ? '50%' : '51%');
    
    if (isMultiplayer) sendLobbyScore(st.sc);
}
