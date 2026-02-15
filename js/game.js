/* === AUDIO & ENGINE (MASTER FINAL V7.0 - SPECTRAL ANALYZER) === */

let elTrack = null;
let mlContainer = null;

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

function normalizeAudio(filteredData) {
    let max = 0;
    // Muestreo optimizado
    for (let i = 0; i < filteredData.length; i += 50) { 
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

// ==========================================
// 2. GENERADOR V7.0 (ZCR & STATE MACHINE)
// ==========================================
// Reemplaza toda la función genMap actual con esta:
function genMap(buf, k) {
    const data = buf.getChannelData(0);
    const sampleRate = buf.sampleRate;
    const map = [];
    
    // Configuración base (Oppa Logic)
    const step = Math.floor(sampleRate / 60); // Muestreo ~60fps
    let lastTime = -1000;
    let lastLane = Math.floor(k / 2);
    let direction = 1; // Para escaleras (1 o -1)
    
    // Factor de dificultad basado en tu slider de densidad (1-10)
    // cfg.den: 1 (fácil) a 10 (difícil)
    const density = window.cfg.den || 5;
    
    // Umbral dinámico: A mayor densidad, detecta sonidos más suaves
    const thresholdBase = 0.18 - (density * 0.015); 

    for (let i = 0; i < data.length; i += step) {
        const timeMs = (i / sampleRate) * 1000;
        const volume = Math.abs(data[i]);

        // Distancia mínima entre notas (a mayor densidad, permite notas más rápidas)
        const minTimeDist = 550 - (density * 45);

        if (volume > thresholdBase && (timeMs - lastTime) > minTimeDist) {
            let lane;
            let type = 'tap';
            let length = 0;

            // --- LÓGICA DE PATRONES ---
            
            // Si el volumen es alto (> 0.4), hacemos patrones estructurados (Escaleras/Saltos)
            if (volume > 0.4) {
                // Algoritmo de escalera: Sube o baja por las teclas
                lane = (lastLane + direction + k) % k;
                
                // 30% de probabilidad de cambiar dirección o salto aleatorio
                if (Math.random() > 0.7) {
                     direction *= -1; 
                     lane = Math.floor(Math.random() * k);
                }
            } else {
                // Nota aleatoria normal para sonidos suaves
                lane = Math.floor(Math.random() * k);
            }

            // --- LÓGICA DE HOLD (NOTAS LARGAS) ---
            // Mira hacia adelante. Si el sonido se mantiene, es un Hold.
            let isHold = true;
            let holdSteps = 0;
            // Miramos 8 pasos adelante (aprox 130ms)
            for (let j = 1; j < 8; j++) {
                if (i + j * step < data.length) {
                    if (Math.abs(data[i + j * step]) > thresholdBase * 0.8) {
                         holdSteps++;
                    } else {
                         isHold = false;
                    }
                }
            }
            
            if (holdSteps > 5 && volume > 0.3) {
                type = 'hold';
                length = holdSteps * (step / sampleRate) * 1000 * 4; // Duración ajustada
                // Limitar duración máxima
                length = Math.min(length, 2000); 
            }

            // --- MULTI NOTES (ACORDES) ---
            // Si el volumen es MUY alto y tienes densidad > 5, crea una nota doble
            if (volume > 0.75 && k >= 4 && density >= 5) {
                let secondLane = (lane + 2) % k; // Nota paralela (ej: 0 y 2)
                if(secondLane !== lane) {
                     map.push({ t: timeMs, l: secondLane, type: 'tap', len: 0, h: false });
                }
            }

            // Agregamos la nota principal
            map.push({ t: timeMs, l: lane, type: type, len: length, h: false });
            
            lastTime = timeMs;
            lastLane = lane;
        }
    }
    return map;
}

// ==========================================
// 3. INICIO Y GESTIÓN
// ==========================================
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    
    const fov = (window.cfg && window.cfg.fov) ? window.cfg.fov : 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');

    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    window.elReceptors = []; 
    
    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin && window.user.equipped.skin !== 'default') {
        if (typeof SHOP_ITEMS !== 'undefined') activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    for (let i = 0; i < k; i++) {
        const l = document.createElement('div');
        l.className = 'lane-flash';
        l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        l.style.setProperty('--c', window.cfg.modes[k][i].c);
        elTrack.appendChild(l);

        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`;
        r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%';
        r.style.top = y + 'px';
        
        let conf = window.cfg.modes[k][i];
        let color = conf.c;
        let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";

        if (activeSkin) {
            if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
            if (activeSkin.fixed) color = activeSkin.color;
        }

        r.style.setProperty('--active-c', color);
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 5px ${color})">
            <path class="arrow-path" d="${shapeData}" stroke="${color}" fill="none" stroke-width="4"/>
        </svg>`;
        elTrack.appendChild(r);
        window.elReceptors.push(r);
    }
}

window.prepareAndPlaySong = async function(k) {
    if (!window.curSongData) return notify("Selecciona una canción", "error");
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Analizando frecuencias..."; }

    try {
        unlockAudio();
        let songInRam = window.ramSongs.find(s => s.id === window.curSongData.id);
        const currentDen = window.cfg.den || 5;

        if (songInRam && (songInRam.kVersion !== k || songInRam.genDen !== currentDen)) {
            window.ramSongs = window.ramSongs.filter(s => s.id !== window.curSongData.id); 
            songInRam = null; 
        }

        if (!songInRam) {
            const response = await fetch(window.curSongData.audioURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            const map = genMap(audioBuffer, k); 
            songInRam = { id: window.curSongData.id, buf: audioBuffer, map: map, kVersion: k, genDen: currentDen };
            window.ramSongs.push(songInRam);
        }
        
        if(window.isMultiplayer) {
            document.getElementById('loading-text').innerText = "Esperando jugadores...";
            if(window.notifyLobbyLoaded) window.notifyLobbyLoaded();
        } else {
            if(loader) loader.style.display = 'none';
            playSongInternal(songInRam);
        }
    } catch (e) {
        console.error(e);
        notify("Error carga: " + e.message, "error");
        if(loader) loader.style.display = 'none';
    }
};

window.playSongInternal = function(s) {
    if(!s && window.isMultiplayer && window.curSongData) {
        s = window.ramSongs.find(x => x.id === window.curSongData.id);
    }
    if(!s) return;

    const loader = document.getElementById('loading-overlay');
    if(loader) loader.style.display = 'none';
    
    window.st.act = true;
    window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map));
    window.st.spawned = [];
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50;
    
    window.st.trueMaxScore = 0;
    window.st.notes.forEach(n => {
        window.st.trueMaxScore += 350; 
        if(n.type === 'hold') window.st.trueMaxScore += 200; 
    });

    window.st.keys = new Array(window.keys).fill(0);
    window.st.songDuration = s.buf.duration;
    window.keys = s.kVersion;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.fcStatus = "GFC";

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    
    ['modal-res', 'modal-pause'].forEach(id => {
        const m = document.getElementById(id);
        if(m) m.style.display = 'none';
    });

    if(window.isMultiplayer) initMultiLeaderboard();
    else if(document.getElementById('multi-leaderboard')) document.getElementById('multi-leaderboard').style.display = 'none';

    initReceptors(window.keys);
    updHUD();

    const cd = document.getElementById('countdown');
    cd.style.display = 'flex';
    cd.innerText = "3";
    let count = 3;
    
    const AUDIO_DELAY = 3; 

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
                
                window.st.src.start(window.st.ctx.currentTime + AUDIO_DELAY);
                
                window.st.src.onended = () => { window.songFinished = true; end(false); };
                loop();
            } catch(err) { console.error(err); }
        }
    }, 1000);
}

// ==========================================
// 4. BUCLE DE JUEGO
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    if (window.st.songDuration > 0) {
        const cur = Math.max(0, (now - 3000) / 1000); 
        const pct = Math.min(100, (cur / window.st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${Math.floor(cur/60)}:${Math.floor(cur%60).toString().padStart(2,'0')}`;
    }

    const w = 100 / window.keys;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue;
        
        if (n.t - now < 1500) {
            if (n.t - now > -200) {
                const el = document.createElement('div');
                const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
                el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
                el.style.left = (n.l * w) + '%';
                el.style.width = w + '%';
                
                let conf = window.cfg.modes[window.keys][n.l];
                let color = conf.c; 
                let shapeData = (typeof PATHS !== 'undefined') ? (PATHS[conf.s] || PATHS['circle']) : "";

                if (activeSkin) {
                    if (activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) shapeData = SKIN_PATHS[activeSkin.shape];
                    if (activeSkin.fixed) color = activeSkin.color;
                }

                let svg = `<svg class="arrow-svg" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 8px ${color})">
                    <path d="${shapeData}" fill="${color}" stroke="white" stroke-width="2"/>
                </svg>`;
                
                if (n.type === 'hold') {
                    const h = (n.len / 1000) * (window.cfg.spd * 40); 
                    svg += `<div class="sustain-trail" style="height:${h}px; background:${color}; opacity:${window.cfg.noteOp/100}"></div>`;
                }

                el.innerHTML = svg;
                if(elTrack) elTrack.appendChild(el);
                n.el = el;
            }
            n.s = true;
            window.st.spawned.push(n);
        } else break; 
    }

    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        
        if (!n.el) { 
            if(n.t - now < -200 && !n.h) {
                 window.st.spawned.splice(i, 1);
            }
            continue; 
        }

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
             
             if (!window.st.keys[n.l]) {
                 n.el.style.opacity = 0.4;
                 if (rem > 100 && !n.broken) {
                     window.st.cmb = 0; 
                     n.broken = true;   
                 }
             } else {
                 n.el.style.opacity = 1;
                 if(!n.broken) window.st.hp = Math.min(100, window.st.hp + 0.1); 
                 updHUD(); 
             }

             if (now >= n.t + n.len) {
                 if(!n.broken) window.st.sc += 200; 
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

// === VISUALS: SPLASH ===
function createSplash(l) {
    // Verificar Configuración
    if(!window.cfg.showSplash) return;
    
    // Buscar el receptor (la nota fija gris)
    const r = document.getElementById(`rec-${l}`);
    if(!r) return;
    
    // Obtener color de la nota
    const color = window.cfg.modes[window.keys][l].c;
    
    // Crear elemento
    const s = document.createElement('div');
    s.className = 'splash-oppa'; // Usamos la nueva clase CSS
    s.style.setProperty('--c', color);
    
    // Posicionar EXACTAMENTE sobre el receptor
    // getBoundingClientRect ayuda a ubicarlo si el track está inclinado o movido
    const rect = r.getBoundingClientRect();
    s.style.left = (rect.left + rect.width / 2) + 'px';
    s.style.top = (rect.top + rect.height / 2) + 'px';
    s.style.position = 'fixed'; // Fixed para que no le afecte el scroll del track 3D
    
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 400);
}

// === INPUTS ===
window.onKd = function(e) {
    if (e.key === "Escape") { 
        e.preventDefault(); 
        if (window.isMultiplayer) {
            if(typeof notify === 'function') notify("🚫 No puedes pausar en Online", "error");
        } else {
            togglePause(); 
        }
        return; 
    }
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
        if(flash && window.cfg.laneFlash) { 
            flash.style.opacity = 0.5; 
            setTimeout(() => flash.style.opacity=0, 100); 
        }

        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

        if (n) {
            const diff = n.t - now; 
            const absDiff = Math.abs(diff);

            window.st.totalOffset += absDiff;
            window.st.hitCount++;

            let score=50, text="BAD", color="yellow";
            
            if(absDiff < 45){ text="SICK"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
            else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }

            if(text==="BAD") window.st.fcStatus="SD";

            window.st.sc += score; 
            window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            window.st.hp = Math.min(100, window.st.hp+2);
            
            showJudge(text, color, diff); 
            playHit(); updHUD();
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

function showJudge(text, color, diffMs) {
    if(!window.cfg.judgeVis) return;
    const container = document.createElement('div');
    container.className = 'judge-container';
    container.style.left = getComputedStyle(document.documentElement).getPropertyValue('--judge-x');
    container.style.top = getComputedStyle(document.documentElement).getPropertyValue('--judge-y');

    const j = document.createElement('div');
    j.className = 'judge-pop'; 
    j.innerText = text; 
    j.style.color = color;
    container.appendChild(j);

    if (text !== "MISS" && typeof diffMs === 'number' && window.cfg.showMs) {
        const msDiv = document.createElement('div');
        msDiv.className = 'judge-ms';
        const sign = diffMs > 0 ? "+" : "";
        msDiv.innerText = `${sign}${Math.round(diffMs)}ms`;
        if (diffMs > 0) msDiv.style.color = "#ffaa00"; 
        else msDiv.style.color = "#00aaff"; 
        container.appendChild(msDiv);
    }

    document.body.appendChild(container); 
    setTimeout(() => container.remove(), 600);
}

function updHUD() {
    document.getElementById('g-score').innerText = window.st.sc.toLocaleString();
    const cEl = document.getElementById('g-combo');
    if(window.st.cmb > 0) { cEl.innerText = window.st.cmb; cEl.style.opacity=1; } else cEl.style.opacity=0;
    document.getElementById('health-fill').style.height = window.st.hp + "%";
    const maxPlayed = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const playedScore = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    const acc = maxPlayed > 0 ? ((playedScore / maxPlayed)*100).toFixed(1) : "100.0";
    document.getElementById('g-acc').innerText = acc + "%";
    const fcEl = document.getElementById('hud-fc');
    if(fcEl) {
        fcEl.innerText = window.cfg.showFC ? window.st.fcStatus : "";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

// ==========================================
// 5. RESULTADOS & MENU
// ==========================================
function end(died) {
    window.st.act = false;
    if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    
    if(window.isMultiplayer) {
        if(typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc, true);
        if(window.isLobbyHost && window.db && window.currentLobbyId) {
             setTimeout(() => {
                window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'finished' });
             }, 2000); 
        }
        return; 
    }

    const modal = document.getElementById('modal-res');
    if(modal) {
        modal.style.display = 'flex';
        const totalMax = window.st.trueMaxScore || 1;
        const finalAcc = Math.round((window.st.sc / totalMax) * 100);
        let r="D", c="red";
        if (!died) {
            if (finalAcc >= 98) { r="SS"; c="cyan" }
            else if (finalAcc >= 95) { r="S"; c="gold" }
            else if (finalAcc >= 90) { r="A"; c="lime" }
            else if (finalAcc >= 80) { r="B"; c="yellow" }
            else if (finalAcc >= 70) { r="C"; c="orange" }
        } else { r="F"; c="red"; }
        
        let xpGain = 0, ppGain = 0;
        if (!died && window.user.name !== "Guest") {
            xpGain = Math.floor(window.st.sc / 250);
            window.user.xp += xpGain;
            if(window.st.ranked) {
                if(finalAcc > 90) ppGain = Math.floor((window.st.sc / 5000) * ((finalAcc-90)/10)); 
                window.user.pp += ppGain;
            }
            if(typeof save === 'function') save();
            if(typeof updateFirebaseScore === 'function') updateFirebaseScore();
        }

        const panel = modal.querySelector('.modal-panel');
        panel.innerHTML = `
            <div class="m-title">RESULTADOS</div>
            <div style="display:flex; justify-content:center; align-items:center; gap:30px;">
                <div class="rank-big" style="color:${c}">${r}</div>
                <div>
                    <div style="font-size:3rem; font-weight:900;">${window.st.sc.toLocaleString()}</div>
                    <div style="color:#aaa; font-size:1.5rem;">ACC: <span style="color:white">${finalAcc}%</span></div>
                </div>
            </div>
            <div class="res-grid">
                <div class="res-card xp-card"><div class="res-label">XP</div><div class="res-val" style="color:var(--blue)">+${xpGain}</div></div>
                <div class="res-card pp-card"><div class="res-label">PP</div><div class="res-val" style="color:var(--gold)">+${ppGain}</div></div>
            </div>
            <div class="modal-buttons-row">
                <button class="action secondary" onclick="toMenu()">MENU</button>
                <button class="action secondary" onclick="restartSong()">REINTENTAR</button>
            </div>
        `;
    }
}

window.restartSong = function() { prepareAndPlaySong(window.keys); };

function togglePause() {
    if(!window.st.act) return;
    
    window.st.paused = !window.st.paused;
    const modal = document.getElementById('modal-pause');
    
    if(window.st.paused) {
        // Guardar tiempo exacto para no desincronizar audio
        window.st.pauseTime = performance.now();
        
        // SUSPENDER AUDIO (Crucial para que la música pare)
        if(window.st.ctx && window.st.ctx.state === 'running') {
            window.st.ctx.suspend();
        }
        
        if(modal) {
            modal.style.display = 'flex'; // Forzar display flex
            
            // Actualizar datos del modal de pausa
            const accEl = document.getElementById('p-acc');
            if(accEl) accEl.innerText = document.getElementById('g-acc').innerText;
            
            if(document.getElementById('p-sick')) document.getElementById('p-sick').innerText = window.st.stats.s;
            if(document.getElementById('p-good')) document.getElementById('p-good').innerText = window.st.stats.g;
            if(document.getElementById('p-bad')) document.getElementById('p-bad').innerText = window.st.stats.b;
            if(document.getElementById('p-miss')) document.getElementById('p-miss').innerText = window.st.stats.m;
        }
    } else {
        resumeGame();
    }
}

function resumeGame() {
    document.getElementById('modal-pause').style.display = 'none';
    if(window.st.pauseTime) {
        const pauseDuration = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDuration; 
        window.st.pauseTime = null;
    }
    window.st.paused = false;
    if(window.st.ctx) window.st.ctx.resume();
    loop();
}

function toMenu() {
    if(window.st.src) {
        try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){}
        window.st.src = null;
    }
    if(window.st.ctx) window.st.ctx.suspend();
    
    window.st.act = false;
    window.st.paused = false;
    window.songFinished = false;
    
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
}

function initMultiLeaderboard() {}
window.updateMultiLeaderboardUI = function(scores) {}
