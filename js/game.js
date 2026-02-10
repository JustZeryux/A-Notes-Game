/* === AUDIO & ENGINE (FULL EXPERIENCE V5) === */

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

// Normalización Agresiva (Para que las partes bajas tengan notas)
function normalizeAudio(filteredData) {
    let max = 0;
    for (let i = 0; i < filteredData.length; i++) {
        const v = Math.abs(filteredData[i]);
        if (v > max) max = v;
    }
    if (max === 0) return filteredData;
    // Amplificamos hasta que el pico más alto sea 0.95 (casi el tope)
    const multiplier = 0.95 / max;
    // Solo aplicamos si vale la pena amplificar
    if (multiplier > 1.1) {
        for (let i = 0; i < filteredData.length; i++) filteredData[i] *= multiplier;
    }
    return filteredData;
}

// === GENERADOR DE MAPAS "FULL EXPERIENCE" ===
function genMap(buf, k) {
    const rawData = buf.getChannelData(0);
    const data = normalizeAudio(new Float32Array(rawData));
    const map = [];
    const sampleRate = buf.sampleRate;

    // Configuración de análisis
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 70); // ~70 checks por segundo

    // Variables de Estado para Patrones (Escaleras, Holds, etc.)
    let laneFreeTime = new Array(k).fill(0);
    let lastNoteTime = -2000;
    let lastLane = 0;
    let patternState = 0; // 0: Random, 1: Escalera Der, 2: Escalera Izq, 3: Stream
    let patternCount = 0; // Cuántas notas llevamos en el patrón actual

    // Historial de energía para comparar (Promedio Local)
    let energyHistory = [];
    const historySize = 40;

    // Factores de dificultad
    const thresholdFactor = 1.35 - (cfg.den * 0.04); // Umbral de disparo
    const minGap = Math.max(90, 500 - (cfg.den * 45)); // Velocidad máxima permitida

    for (let i = 0; i < data.length - windowSize; i += step) {
        // 1. Calcular Energía Instantánea (RMS)
        let sum = 0;
        for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
        const instantEnergy = Math.sqrt(sum / windowSize);

        // 2. Mantener historial
        energyHistory.push(instantEnergy);
        if (energyHistory.length > historySize) energyHistory.shift();
        let localAvg = 0;
        for (let e of energyHistory) localAvg += e;
        localAvg /= energyHistory.length;

        const timeMs = (i / sampleRate) * 1000;

        // 3. DETECCIÓN DE GOLPE (BEAT)
        // Usamos un umbral relativo: Si la energía actual supera al promedio local
        if (instantEnergy > localAvg * thresholdFactor && instantEnergy > 0.01) {

            // Ajuste dinámico de Gap (Ráfagas permitidas si la energía es muy alta)
            let dynamicGap = minGap;
            if (instantEnergy > localAvg * 2.0) dynamicGap *= 0.7; // Permitir ráfagas rápidas

            if (timeMs - lastNoteTime > dynamicGap) {
                
                // === LÓGICA DE PATRONES ===
                
                // Cambiar patrón aleatoriamente cada ciertas notas
                if (patternCount <= 0 || Math.random() > 0.8) {
                    const r = Math.random();
                    if (r < 0.4) patternState = 0; // Random
                    else if (r < 0.6) patternState = 1; // Escalera Derecha (0->1->2->3)
                    else if (r < 0.8) patternState = 2; // Escalera Izquierda (3->2->1->0)
                    else patternState = 3; // Trill/Stream (0-1-0-1)
                    patternCount = Math.floor(Math.random() * 4) + 3; // Duración del patrón
                }

                // Determinar tipo de nota
                let type = 'tap';
                let len = 0;
                // Notas largas (Holds) en picos sostenidos o parte de escaleras de hold
                if ((instantEnergy > localAvg * 1.5 && Math.random() > 0.7) || (patternState > 0 && Math.random() > 0.8)) {
                    type = 'hold';
                    len = Math.min(800, Math.random() * 300 + 100);
                }

                // Selección de Carril según Patrón
                let selectedLane = -1;

                if (patternState === 1) { // Escalera Derecha
                    selectedLane = (lastLane + 1) % k;
                } else if (patternState === 2) { // Escalera Izquierda
                    selectedLane = (lastLane - 1 + k) % k;
                } else if (patternState === 3) { // Trill (Alternar)
                    selectedLane = (lastLane + 1) % 2 + (lastLane >= 2 ? 2 : 0); // Alterna entre pares
                } else { // Random Inteligente
                    let attempts = 0;
                    while (attempts < 5) {
                        selectedLane = Math.floor(Math.random() * k);
                        if (selectedLane !== lastLane) break; // Evitar jacks (repetir misma nota)
                        attempts++;
                    }
                }

                // Verificar Overlap (Si el carril está ocupado por un hold anterior)
                if (timeMs < laneFreeTime[selectedLane] + 20) {
                    // Si está ocupado, buscar otro libre desesperadamente
                    for(let x=0; x<k; x++) {
                        if(timeMs >= laneFreeTime[x] + 20) {
                            selectedLane = x;
                            break;
                        }
                    }
                }

                // Insertar Nota
                map.push({ t: timeMs, l: selectedLane, type: type, len: len, h: false });
                laneFreeTime[selectedLane] = timeMs + len;
                lastNoteTime = timeMs;
                lastLane = selectedLane;
                patternCount--;

                // === NOTAS DOBLES (ACORDES) ===
                // Solo en dificultades altas y golpes fuertes
                if ((k >= 4 && cfg.den >= 6) && instantEnergy > localAvg * 2.2) {
                    for (let l = 0; l < k; l++) {
                        // Buscar carril alejado del actual para que sea cómodo
                        if (Math.abs(l - selectedLane) > 1 && timeMs >= laneFreeTime[l] + 20) {
                            map.push({ t: timeMs, l: l, type: 'tap', len: 0, h: false });
                            laneFreeTime[l] = timeMs;
                            break; // Solo una nota doble máx
                        }
                    }
                }
            }
        }
    }
    return map;
}

// === INICIALIZACIÓN DE RECEPTORES ===
function initReceptors(k) {
    const t = document.getElementById('track');
    t.innerHTML = '';
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    
    // Flashes de carril
    for (let i = 0; i < k; i++) {
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        l.style.setProperty('--c', cfg.modes[k][i].c);
        t.appendChild(l);
    }
    
    const y = cfg.down ? window.innerHeight - 140 : 80;
    
    // Flechas fijas (Receptores)
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

// === OPTIMIZACIÓN: CACHÉ DE CANCIONES ===
async function prepareAndPlaySong(k) {
    if (!curSongData) return;

    // Buscar si ya la tenemos en memoria RAM para no volver a descargar/generar
    let songInRam = ramSongs.find(s => s.id === curSongData.id);

    // Pantalla de carga
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Cargando...";

    if (!songInRam) {
        try {
            unlockAudio(); // Asegurar contexto de audio
            const response = await fetch(curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await st.ctx.decodeAudioData(arrayBuffer);

            // Generar mapa con el nuevo algoritmo
            const map = genMap(audioBuffer, k);

            // Guardar en caché
            songInRam = { id: curSongData.id, buf: audioBuffer, map: map, kVersion: k };
            ramSongs.push(songInRam);

            // Limitar caché (Guardar solo 5 canciones para no llenar RAM)
            if (ramSongs.length > 5) ramSongs.shift();

        } catch (e) {
            console.error(e);
            notify("Error cargando audio", "error");
            document.getElementById('loading-overlay').style.display = 'none';
            return;
        }
    } else {
        // Si ya existe pero cambiamos la dificultad (cantidad de teclas), regenerar mapa
        if (songInRam.kVersion !== k) {
            songInRam.map = genMap(songInRam.buf, k);
            songInRam.kVersion = k;
        }
    }

    document.getElementById('loading-overlay').style.display = 'none';
    playSongInternal(songInRam);
}

// === MOTOR DEL JUEGO ===
function playSongInternal(s) {
    document.getElementById('track').innerHTML = '';
    
    // Clonar mapa para no modificar el original en RAM
    st.notes = JSON.parse(JSON.stringify(s.map));
    st.spawned = [];
    st.sc = 0; st.cmb = 0; st.hp = 50; st.stats = { s: 0, g: 0, b: 0, m: 0 };
    st.keys = new Array(keys).fill(0);
    st.maxScorePossible = 0;
    st.ranked = document.getElementById('chk-ranked').checked;
    st.lastPause = 0; 
    songFinished = false; 
    st.songDuration = s.buf.duration;

    // Configurar HUD
    if (isMultiplayer) document.getElementById('vs-hud').style.display = 'flex';
    else document.getElementById('vs-hud').style.display = 'none';
    
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    document.getElementById('hud').style.display = 'flex';

    initReceptors(keys);
    updHUD();

    // === FALLING START (Inicio con caída) ===
    const cd = document.getElementById('countdown');
    let c = 3;
    cd.innerHTML = c;

    // Configurar tiempos: El tiempo "0" del audio será dentro de 3 segundos
    // Iniciamos en -3000ms para que las notas spawneen arriba y bajen
    st.startTime = performance.now() + 3000;
    st.t0 = null; // Aún no hay audio
    st.act = true;
    st.paused = false;

    // Iniciar loop visual INMEDIATAMENTE
    loop();

    const iv = setInterval(async () => {
        c--;
        if (c > 0) {
            cd.innerHTML = c;
        } else {
            clearInterval(iv);
            cd.innerHTML = "GO!";
            setTimeout(() => cd.innerHTML = "", 500);

            // Iniciar Audio Exactamente aquí
            if (st.ctx && st.ctx.state === 'suspended') st.ctx.resume();
            
            st.src = st.ctx.createBufferSource();
            st.src.buffer = s.buf;
            const gain = st.ctx.createGain();
            gain.gain.value = cfg.vol;
            st.src.connect(gain);
            gain.connect(st.ctx.destination);

            // Sincronizar
            st.t0 = st.ctx.currentTime;
            st.src.start(0);
            st.src.onended = () => { songFinished = true; end(false); };
        }
    }, 1000);
}

function formatTime(s) { const m = Math.floor(s / 60); const sc = Math.floor(s % 60); return `${m}:${sc.toString().padStart(2, '0')}`; }

// === LOOP PRINCIPAL ===
function loop() {
    if (!st.act || st.paused) return;

    let now;
    // Si el audio está corriendo, usamos el tiempo del audio (Ultra preciso)
    if (st.t0 !== null && st.ctx.state === 'running') {
        now = (st.ctx.currentTime - st.t0) * 1000;
    } else {
        // Si estamos en la cuenta regresiva, usamos reloj del sistema (Tiempo negativo)
        now = performance.now() - st.startTime;
    }

    // Barra de progreso
    if (st.songDuration > 0 && now > 0) {
        const currentSec = now / 1000;
        const pct = Math.min(100, (currentSec / st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${formatTime(currentSec)} / ${formatTime(st.songDuration)}`;
    }

    const yReceptor = cfg.down ? window.innerHeight - 140 : 80;
    const w = 100 / keys;

    // 1. SPAWN LOGIC (Funciona con tiempo negativo)
    for (let i = 0; i < st.notes.length; i++) {
        const n = st.notes[i];
        if (n.s) continue;
        
        // Si ya pasó, marcar spawn
        if (n.t < now - 200) { n.s = true; continue; }

        // Previsualización: Spawnear si faltan < 1500ms para que llegue
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
        } else {
            break; // Las notas están ordenadas, si esta está lejos, las siguientes también
        }
    }

    // 2. MOVEMENT & LOGIC
    for (let i = st.spawned.length - 1; i >= 0; i--) {
        const n = st.spawned[i];
        if (!n.el) { st.spawned.splice(i, 1); continue; }

        const diff = n.t - now + cfg.off;
        const dist = (diff / 1000) * cfg.spd * 60;
        let finalY = cfg.down ? (yReceptor - dist) : (yReceptor + dist);

        if (n.h && n.type === 'hold') {
            // Nota sostenida (presionada)
            n.el.style.top = yReceptor + 'px';
            n.el.style.opacity = 0.8;
            const rem = (n.t + n.len) - now;
            
            if (rem <= 0) {
                n.el.remove();
                st.spawned.splice(i, 1);
                continue;
            }
            
            // Efecto visual de acortar la cola
            const tr = n.el.querySelector('.sustain-trail');
            if (tr) tr.style.height = Math.max(0, (rem / 1000) * cfg.spd * 60) + 'px';
            
            // Vida por sostener
            if (st.keys[n.l]) {
                st.hp = Math.min(100, st.hp + 0.1);
                updHUD();
            } else {
                n.el.style.opacity = 0.3; // Perdiendo el hold
            }

        } else if (!n.h) {
            // Nota cayendo
            n.el.style.top = finalY + 'px';

            // Miss
            if (diff < -160) {
                miss(n);
                n.h = true;
                n.el.style.opacity = 0.4;
                setTimeout(() => { if (n.el) n.el.remove() }, 200);
                st.spawned.splice(i, 1);
            }
        } else {
            n.el.remove();
            st.spawned.splice(i, 1);
        }
    }
    requestAnimationFrame(loop);
}

// === INPUTS Y SISTEMA DE JUEGO ===
function onKd(e) {
    if (e.key === "Escape") { togglePause(); return; }
    if (["Tab", "Alt", "Control", "Shift"].includes(e.key)) return;

    // Remap de teclas
    if (remapMode !== null && cfg.modes[remapMode]) {
        cfg.modes[remapMode][remapIdx].k = e.key.toLowerCase();
        renderLaneConfig(remapMode);
        remapMode = null;
        return;
    }

    if (!e.repeat) {
        // Uso de ?. para evitar crash si cfg no cargó bien
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

    if (p) { // Key Down
        st.keys[l] = 1;
        if (r) r.classList.add('pressed');
        if (flash) {
            flash.style.opacity = 0.6;
            setTimeout(() => flash.style.opacity = 0, 100);
        }

        let now;
        if (st.t0 !== null && st.ctx.state === 'running') now = (st.ctx.currentTime - st.t0) * 1000;
        else now = performance.now() - st.startTime;

        // Buscar nota golpeable
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
            n.h = true; // Hit
            
            // Si no es hold, la ocultamos. Si es hold, sigue viva.
            if (n.type !== 'hold' && n.el) n.el.style.display = 'none';

        } else if (!cfg.down) {
            // Ghost tapping penalty (opcional, quita puntos)
            st.sc -= 10;
            st.cmb = 0;
            st.hp -= 2;
            updHUD();
        }
    } else { // Key Up
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

// Efectos Visuales
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

function updHUD() {
    document.getElementById('g-score').innerText = st.sc.toLocaleString();
    
    if (isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(st.sc);
    else if (conn && conn.open) conn.send({ type: 'score', val: st.sc });

    document.getElementById('g-combo').innerText = st.cmb;
    const acc = st.maxScorePossible > 0 ? Math.round((st.sc / st.maxScorePossible) * 100) : 100;
    document.getElementById('g-acc').innerText = acc + "%";
    document.getElementById('health-fill').style.height = st.hp + "%";
    
    document.getElementById('h-sick').innerText = st.stats.s;
    document.getElementById('h-good').innerText = st.stats.g;
    document.getElementById('h-bad').innerText = st.stats.b;
    document.getElementById('h-miss').innerText = st.stats.m;
}

function togglePause() {
    if (!st.act) return;
    st.paused = !st.paused;
    if (st.paused) {
        st.lastPause = performance.now();
        if (st.ctx) st.ctx.suspend();
        document.getElementById('modal-pause').style.display = 'flex';
        document.getElementById('p-sick').innerText = st.stats.s;
        document.getElementById('p-good').innerText = st.stats.g;
        document.getElementById('p-bad').innerText = st.stats.b;
        document.getElementById('p-miss').innerText = st.stats.m;
    } else resumeGame();
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if (st.ctx) st.ctx.resume();
    
    // Compensar tiempo pausado
    if (st.lastPause) {
        const dur = performance.now() - st.lastPause;
        st.startTime += dur;
        st.lastPause = 0;
    }
    st.paused = false;
    loop();
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

        let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
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

        if (!user.scores) user.scores = {};
        const currentBest = user.scores[curSongData.id] ? user.scores[curSongData.id].score : 0;
        if (st.sc > currentBest) {
            user.scores[curSongData.id] = { score: st.sc, rank: r, acc: acc };
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
