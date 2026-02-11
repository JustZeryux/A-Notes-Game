/* === AUDIO & ENGINE (MASTER FULL V135 - TOTAL RESTORATION) === */

let elTrack = null;
let mlContainer = null;

// ==========================================
// 1. SISTEMA DE AUDIO (PRECISO)
// ==========================================
window.unlockAudio = function() {
    if (!window.st.ctx) {
        try {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const b = window.st.ctx.createBuffer(1, 1, 22050);
            const s = window.st.ctx.createBufferSource();
            s.buffer = b; s.connect(window.st.ctx.destination); s.start(0);
            genSounds();
        } catch(e) { console.error("Audio Error:", e); }
    }
    if (window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
};

function genSounds() {
    if(!window.st.ctx) return;
    // Hit Sound (Seno corto)
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

window.playHit = function() {
    if (window.hitBuf && window.cfg.hitSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource();
        s.buffer = window.hitBuf;
        const g = window.st.ctx.createGain(); g.gain.value = window.cfg.hvol;
        s.connect(g); g.connect(window.st.ctx.destination); s.start(0);
    }
};

window.playMiss = function() {
    if (window.missBuf && window.cfg.missSound && window.st.ctx) {
        const s = window.st.ctx.createBufferSource();
        s.buffer = window.missBuf;
        const g = window.st.ctx.createGain(); g.gain.value = window.cfg.missVol;
        s.connect(g); g.connect(window.st.ctx.destination); s.start(0);
    }
};

// ==========================================
// 2. VISUALS LOGIC (SKINS & COLORS FIX)
// ==========================================
window.getNoteVisuals = function(laneIndex, skinId) {
    if (!window.cfg || !window.cfg.modes[window.keys]) return { color: "white", shape: window.PATHS.circle, filter: "" };
    
    let conf = window.cfg.modes[window.keys][laneIndex];
    let color = conf.c; // Prioridad: Color de tu configuración (Blanco)
    let shape = window.PATHS[conf.s] || window.PATHS.circle;
    let filter = `drop-shadow(0 0 5px ${color})`;

    // Solo si hay una skin equipada que no sea la default
    if (skinId && skinId !== 'default' && window.SHOP_ITEMS) {
        const item = window.SHOP_ITEMS.find(x => x.id === skinId);
        if (item) {
            // Cambiar forma si la skin tiene una
            if (item.shape && window.SKIN_PATHS[item.shape]) shape = window.SKIN_PATHS[item.shape];
            // Cambiar color solo si la skin es de color fijo (Demon, Angel, Gold, etc)
            if (item.fixed) {
                color = item.color;
            } else if (item.id === 'skin_neon') {
                color = (laneIndex % 2 === 0) ? '#ff66aa' : '#00FFFF';
            }
            filter = `drop-shadow(0 0 10px ${color})`;
        }
    }
    return { color, shape, filter };
};

// ==========================================
// 3. GENERADOR DE MAPAS (PRO PATTERNS)
// ==========================================
function genMap(buf, k) {
    if(!buf) return [];
    const data = buf.getChannelData(0);
    const map = [];
    const sampleRate = buf.sampleRate;
    let safeDen = window.cfg.den || 5;
    const thresholdBase = 1.5 - (safeDen * 0.08); 
    const minStep = Math.max(90, 260 - (safeDen * 22)); 
    const windowSize = 1024;
    const step = Math.floor(sampleRate / 100); 
    let lastTime = 0, lastLane = 0, energyHistory = [], laneFreeTimes = new Array(k).fill(0), consecutiveSameLane = 0; 
    let currentPattern = 0, patternDuration = 0, patternDir = 1;

    for (let i = 0; i < data.length - windowSize; i += step) {
        let sum = 0;
        for (let j = 0; j < windowSize; j += 16) sum += Math.abs(data[i + j]);
        const instantEnergy = sum / (windowSize / 16);
        energyHistory.push(instantEnergy); if (energyHistory.length > 40) energyHistory.shift();
        let localAvg = 0; for(let e of energyHistory) localAvg += e; localAvg /= energyHistory.length;
        const timeMs = (i / sampleRate) * 1000;
        if (timeMs < 1500) continue;

        if (instantEnergy > localAvg * thresholdBase && (timeMs - lastTime > minStep)) {
            if (patternDuration <= 0) {
                const r = Math.random();
                if (r < 0.35) currentPattern = 1; else if (r < 0.45) currentPattern = 2; 
                else if (r < 0.7) currentPattern = 3; else currentPattern = 0; 
                patternDuration = Math.floor(Math.random() * 6) + 3; patternDir = Math.random() > 0.5 ? 1 : -1;
            }
            let targetLane = 0;
            if (currentPattern === 1) targetLane = (lastLane + patternDir + k) % k;
            else if (currentPattern === 2) targetLane = lastLane;
            else if (currentPattern === 3) targetLane = (lastLane + 2) % k;
            else targetLane = Math.floor(Math.random() * k);

            // ANTI-SPAM: Máximo 2 notas seguidas en un carril
            if (targetLane === lastLane) {
                consecutiveSameLane++;
                if (consecutiveSameLane >= 2) { targetLane = (targetLane + 1) % k; consecutiveSameLane = 0; currentPattern = 0; }
            } else { consecutiveSameLane = 0; }

            let finalLane = -1;
            if (timeMs >= laneFreeTimes[targetLane]) finalLane = targetLane;
            else {
                const freeLanes = []; for(let l=0; l<k; l++) if(timeMs >= laneFreeTimes[l]) freeLanes.push(l);
                if(freeLanes.length > 0) finalLane = freeLanes[Math.floor(Math.random()*freeLanes.length)];
            }
            if (finalLane !== -1) {
                let isHold = false, holdLen = 0;
                if (instantEnergy > localAvg * 1.6 && Math.random() > 0.7) { isHold = true; holdLen = Math.min(600, Math.random() * 300 + 100); }
                map.push({ t: timeMs, l: finalLane, type: isHold?'hold':'tap', len: holdLen, h:false, scoreGiven:false });
                laneFreeTimes[finalLane] = timeMs + holdLen + 50; lastTime = timeMs; lastLane = finalLane;
            }
            patternDuration--;
        }
    }
    return map;
}

// ==========================================
// 4. MOTOR DE INICIALIZACIÓN
// ==========================================
function initReceptors(k) {
    elTrack = document.getElementById('track');
    if(!elTrack) return;
    elTrack.innerHTML = '';
    const fov = window.cfg.fov || 0;
    elTrack.style.transform = `rotateX(${fov}deg)`;
    document.documentElement.style.setProperty('--lane-width', (100 / k) + '%');
    const y = window.cfg.down ? window.innerHeight - 140 : 80;
    window.elReceptors = []; 
    const skin = (window.user && window.user.equipped) ? window.user.equipped.skin : 'default';

    for (let i = 0; i < k; i++) {
        const viz = window.getNoteVisuals(i, skin);
        
        // Glow/Flash del carril
        const l = document.createElement('div');
        l.className = 'lane-flash'; l.id = `flash-${i}`;
        l.style.left = (i * (100 / k)) + '%';
        l.style.setProperty('--c', viz.color); // FIX: Brillo color skin
        elTrack.appendChild(l);

        const r = document.createElement('div');
        r.className = `arrow-wrapper receptor`; r.id = `rec-${i}`;
        r.style.left = (i * (100 / k)) + '%'; r.style.top = y + 'px';
        r.style.setProperty('--active-c', viz.color);
        
        r.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="${viz.filter}">
            <path class="arrow-path" d="${viz.shape}" stroke="white" stroke-width="4" fill="transparent" />
        </svg>`;
        elTrack.appendChild(r);
        window.elReceptors.push(r);
    }
}

// FUNCIONES GLOBALES PARA UI Y ONLINE
window.prepareAndPlaySong = async function(k) {
    if (!window.curSongData) return notify("Selecciona una canción", "error");
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Analizando Audio..."; }
    try {
        window.unlockAudio();
        let songInRam = window.ramSongs.find(s => s.id === window.curSongData.id);
        if (!songInRam || songInRam.kVersion !== k) {
            const res = await fetch(window.curSongData.audioURL);
            const ab = await res.arrayBuffer();
            const aud = await window.st.ctx.decodeAudioData(ab);
            const map = genMap(aud, k);
            songInRam = { id: window.curSongData.id, buf: aud, map: map, kVersion: k };
            window.ramSongs.push(songInRam);
        }
        if(window.isMultiplayer) {
            if(window.notifyLobbyLoaded) window.notifyLobbyLoaded();
        } else {
            if(loader) loader.style.display = 'none';
            window.playSongInternal(songInRam);
        }
    } catch (e) { console.error(e); notify("Error de carga","error"); if(loader) loader.style.display='none'; }
};

window.playSongInternal = function(s) {
    const syncOv = document.getElementById('sync-overlay'); if(syncOv) syncOv.style.display = 'none';
    window.st.act = true; window.st.paused = false;
    window.st.notes = JSON.parse(JSON.stringify(s.map)); window.st.spawned = [];
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 50; window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.trueMaxScore = 0; window.st.notes.forEach(n => { window.st.trueMaxScore += 350; if(n.type==='hold') window.st.trueMaxScore += 100; });
    window.st.songDuration = s.buf.duration; window.keys = s.kVersion;
    window.st.hitCount = 0; window.st.totalOffset = 0; window.st.fcStatus = "GFC";

    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-layer').style.display = 'block';
    initReceptors(window.keys); updHUD();

    const cd = document.getElementById('countdown'); cd.style.display='flex'; cd.innerText="3";
    let c = 3;
    const iv = setInterval(() => {
        c--; if(c>0) cd.innerText=c;
        else {
            clearInterval(iv); cd.innerText="GO!"; setTimeout(()=>cd.innerText="",500);
            try {
                window.st.src = window.st.ctx.createBufferSource();
                window.st.src.buffer = s.buf;
                const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol;
                window.st.src.connect(g); g.connect(window.st.ctx.destination);
                window.st.t0 = window.st.ctx.currentTime; window.st.src.start(0);
                window.st.src.onended = () => { window.songFinished = true; end(false); };
                loop();
            } catch(e) { console.error(e); }
        }
    }, 1000);
};

// ==========================================
// 5. LOOP PRINCIPAL (RENDER & MOVEMENT)
// ==========================================
function loop() {
    if (!window.st.act || window.st.paused) return;
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    if (window.st.songDuration > 0) {
        const pct = Math.min(100, ((now/1000) / window.st.songDuration) * 100);
        document.getElementById('top-progress-fill').style.width = pct + "%";
        document.getElementById('top-progress-time').innerText = `${Math.floor(now/60000)}:${Math.floor((now%60000)/1000).toString().padStart(2,'0')}`;
    }
    const w = 100 / window.keys, yR = window.cfg.down ? window.innerHeight - 140 : 80;
    const skin = (window.user && window.user.equipped) ? window.user.equipped.skin : 'default';

    // SPAWNING
    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue;
        if (n.t - now < 1500) {
            const el = document.createElement('div');
            el.className = `arrow-wrapper ${n.type==='hold'?'hold-note':''}`;
            el.style.left = (n.l * w) + '%'; el.style.width = w + '%';
            const viz = window.getNoteVisuals(n.l, skin);
            el.innerHTML = `<svg class="arrow-svg" viewBox="0 0 100 100" style="${viz.filter}"><path d="${viz.shape}" fill="${viz.color}" stroke="white" stroke-width="2"/></svg>`;
            
            if (skin === 'skin_shuriken') el.classList.add('rotating-note');

            if (n.type === 'hold') {
                const h = (n.len / 1000) * (window.cfg.spd * 40); 
                el.innerHTML += `<div class="sustain-trail" style="height:${h}px; background:${viz.color}; opacity:${window.cfg.noteOp/100}"></div>`;
            }
            if(elTrack) elTrack.appendChild(el); n.el = el; n.s = true; window.st.spawned.push(n);
        } else break;
    }

    // MOVEMENT & COLLISION
    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        const dist = (n.t - now + window.cfg.off) / 1000 * (window.cfg.spd * 40);
        let finalY = window.cfg.down ? (yR - dist) : (yR + dist);
        
        if (n.type==='hold' && n.h) {
            n.el.style.top = yR + 'px';
            const rem = (n.t+n.len)-now;
            const tr = n.el.querySelector('.sustain-trail');
            if(tr) tr.style.height = Math.max(0, (rem/1000)*(window.cfg.spd*40)) + 'px';
            
            if(!window.st.keys[n.l] && rem>50) miss(n); 
            else { window.st.hp=Math.min(100,window.st.hp+0.05); updHUD(); }
            
            if(now >= n.t+n.len){ 
                window.st.sc+=100; 
                if(n.el) n.el.remove(); 
                window.st.spawned.splice(i,1);
            }
        } else {
            if(n.el) n.el.style.top = finalY + 'px';
            if((n.t - now + window.cfg.off) < -160 && !n.h){ miss(n); if(n.el) n.el.remove(); window.st.spawned.splice(i,1); }
        }
    }
    requestAnimationFrame(loop);
}

// ==========================================
// 6. PAUSA, MENU Y REINTENTAR
// ==========================================
window.togglePause = function() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    const m = document.getElementById('modal-pause');
    if(window.st.paused) {
        window.st.pauseTime = performance.now();
        if(window.st.ctx) window.st.ctx.suspend();
        if(m) {
            m.style.display = 'flex';
            m.querySelector('.modal-panel').innerHTML = `
                <div class="m-title">PAUSA</div>
                <div style="font-size:2.5rem; font-weight:900; color:var(--blue); margin-bottom:20px;">ACC: ${document.getElementById('g-acc').innerText}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; font-size:1.5rem; margin-bottom:30px;">
                    <div style="color:var(--sick)">SICK: <span>${window.st.stats.s}</span></div>
                    <div style="color:var(--good)">GOOD: <span>${window.st.stats.g}</span></div>
                    <div style="color:var(--bad)">BAD: <span>${window.st.stats.b}</span></div>
                    <div style="color:var(--miss)">MISS: <span>${window.st.stats.m}</span></div>
                </div>
                <div class="modal-buttons-row">
                    <button class="action" onclick="window.resumeGame()">CONTINUAR</button>
                    <button class="action secondary" onclick="window.restartSong()">REINTENTAR</button>
                    <button class="action secondary" onclick="window.toMenu()">MENU</button>
                </div>`;
        }
    } else window.resumeGame();
};

window.resumeGame = function() {
    document.getElementById('modal-pause').style.display = 'none';
    if(window.st.pauseTime) {
        const pauseDur = (performance.now() - window.st.pauseTime) / 1000;
        window.st.t0 += pauseDur;
        window.st.pauseTime = null;
    }
    window.st.paused = false; if(window.st.ctx) window.st.ctx.resume(); loop();
};

window.restartSong = function() { 
    if(window.st.src) { try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){} }
    window.st.act = false;
    window.prepareAndPlaySong(window.keys); 
};

window.toMenu = function() {
    if(window.st.src) { try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){} window.st.src = null; }
    if(window.st.ctx) window.st.ctx.suspend();
    window.st.act = false; window.st.paused = false;
    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('modal-res').style.display = 'none';
    document.getElementById('modal-pause').style.display = 'none';
};

// ==========================================
// 7. HIT, MISS & HUD
// ==========================================
window.onKd = function(e) {
    if (e.key === "Escape") { e.preventDefault(); window.togglePause(); return; }
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
        window.st.keys[l] = 1; if(r) r.classList.add('pressed');
        if(flash && window.cfg.laneFlash) { flash.style.opacity = 0.5; setTimeout(() => { if(flash) flash.style.opacity = 0; }, 100); }
        
        let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);
        
        if (n) {
            const diff = Math.abs(n.t - now);
            window.st.hitCount++;
            window.st.totalOffset += (n.t - now);
            let pts=50, t="BAD", c="yellow";
            if(diff<45){ t="SICK"; c="#00FFFF"; pts=350; window.st.stats.s++; createSplash(l); }
            else if(diff<90){ t="GOOD"; c="#12FA05"; pts=200; window.st.stats.g++; createSplash(l); }
            else { window.st.stats.b++; window.st.hp-=2; window.st.fcStatus = (window.st.fcStatus!=="SD")?"FC":"SD"; }
            if(t==="BAD") window.st.fcStatus="SD";
            window.st.sc += pts; window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
            window.st.hp = Math.min(100, window.st.hp+2);
            showJudge(t, c); window.playHit(); updHUD();
            n.h = true; if (n.type === 'tap' && n.el) n.el.style.opacity = 0;
        }
    } else { window.st.keys[l] = 0; if(r) r.classList.remove('pressed'); }
}

function miss(n) { 
    showJudge("MISS", "#F9393F");
    window.st.stats.m++; window.st.cmb=0; window.st.hp-=10; window.st.fcStatus="SD";
    window.playMiss(); updHUD(); if(n.el) n.el.style.opacity = 0; if(window.st.hp <= 0 && !window.isMultiplayer) end(true); 
}

function showJudge(text, color) {
    if(!window.cfg.judgeVis) return;
    const j = document.createElement('div');
    j.className = 'judge-pop'; j.innerText = text; j.style.color = color;
    document.body.appendChild(j); setTimeout(() => j.remove(), 400);
}

function updHUD() { 
    document.getElementById('g-score').innerText = window.st.sc.toLocaleString(); 
    document.getElementById('health-fill').style.height = window.st.hp + "%"; 
    const maxP = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
    const curP = window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50;
    document.getElementById('g-acc').innerText = (maxP>0 ? ((curP/maxP)*100).toFixed(1) : "100.0") + "%";
    const comboEl = document.getElementById('g-combo');
    if(window.st.cmb > 0) { comboEl.innerText = window.st.cmb; comboEl.style.opacity=1; } else comboEl.style.opacity=0;
    const fcEl = document.getElementById('hud-fc');
    if(fcEl) {
        fcEl.innerText = window.cfg.showFC ? window.st.fcStatus : "";
        fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red")));
    }
    if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
}

function createSplash(l) {
    if(!window.cfg.showSplash || !elTrack) return;
    const r = document.getElementById(`rec-${l}`); if(!r) return;
    const s = document.createElement('div'); s.className = 'splash-wrapper';
    s.style.left = r.style.left; s.style.top = r.style.top;
    const inner = document.createElement('div'); inner.className = `splash-${window.cfg.splashType || 'classic'}`;
    const viz = window.getNoteVisuals(l, (window.user && window.user.equipped) ? window.user.equipped.skin : 'default');
    inner.style.setProperty('--c', viz.color);
    s.appendChild(inner); elTrack.appendChild(s); setTimeout(() => s.remove(), 400);
}

// ==========================================
// 8. RESULTADOS Y MULTIPLAYER
// ==========================================
function end(died) {
    window.st.act = false; if(window.st.src) try{ window.st.src.stop(); }catch(e){}
    document.getElementById('game-layer').style.display = 'none';
    if(window.isMultiplayer) { if(typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc, true); return; }
    const m = document.getElementById('modal-res');
    if(m) {
        m.style.display = 'flex';
        const totalP = window.st.trueMaxScore || 1;
        const acc = Math.round((window.st.sc / totalP) * 100);
        let xpG = Math.floor(window.st.sc / 250), ppG = (acc > 90) ? Math.floor((window.st.sc / 5000) * ((acc-90)/10)) : 0;
        if (!died && window.user.name !== "Guest") { window.user.xp += xpG; if(window.st.ranked) window.user.pp += ppG; save(); updateFirebaseScore(); }
        m.querySelector('.modal-panel').innerHTML = `
            <div class="m-title">RESULTADOS</div>
            <div style="font-size:6rem; font-weight:900; color:var(--gold); text-align:center;">${acc}%</div>
            <div class="res-grid">
                <div class="res-card xp-card"><div class="res-label">XP</div><div class="res-val" style="color:var(--blue)">+${xpG}</div></div>
                <div class="res-card pp-card"><div class="res-label">PP</div><div class="res-val" style="color:var(--gold)">+${ppG}</div></div>
            </div>
            <div class="modal-buttons-row">
                <button class="action" onclick="window.toMenu()">MENU</button>
                <button class="action secondary" onclick="window.restartSong()">REINTENTAR</button>
            </div>`;
    }
}

// Vincular eventos globales de teclado
window.onkeydown = (e) => { try { window.onKd(e); } catch(err){} };
window.onkeyup = (e) => { try { window.onKu(e); } catch(err){} };
