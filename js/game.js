/* === GAME.JS - MOTOR PRINCIPAL V-PRO (REPARACIÓN UPSCROLL Y SVGs) === */

let elTrack = null;
let gameLoopId;
window.isTestingMap = false;

setTimeout(() => {
    if (typeof window.testMap === 'function') {
        const originalTestMap = window.testMap;
        window.testMap = function() {
            window.isTestingMap = true;
            originalTestMap();
        };
    }
}, 1000);

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
    for(let i=0; i<2000; i++) d1[i] = Math.random() * 2 - 1;
    window.st.sndDef = b1;
}

function playHit() {
    if (!window.st.ctx || !window.st.sndDef) return;
    const v = (window.cfg.hvol !== undefined) ? window.cfg.hvol : 50;
    if (v <= 0) return;

    let hsType = window.cfg.hitsound || 'default';
    if (hsType === 'drum') {
        const o = window.st.ctx.createOscillator();
        const g = window.st.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(150, window.st.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(0.01, window.st.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(v / 100, window.st.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, window.st.ctx.currentTime + 0.1);
        o.connect(g); g.connect(window.st.ctx.destination);
        o.start(); o.stop(window.st.ctx.currentTime + 0.1);
    } else if (hsType === 'soft') {
        const o = window.st.ctx.createOscillator();
        const g = window.st.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(800, window.st.ctx.currentTime);
        g.gain.setValueAtTime((v / 100) * 0.5, window.st.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, window.st.ctx.currentTime + 0.05);
        o.connect(g); g.connect(window.st.ctx.destination);
        o.start(); o.stop(window.st.ctx.currentTime + 0.05);
    } else {
        const s = window.st.ctx.createBufferSource();
        const g = window.st.ctx.createGain();
        s.buffer = window.st.sndDef;
        g.gain.value = (v / 100) * 0.3;
        s.connect(g); g.connect(window.st.ctx.destination);
        s.start();
    }
}

// ==========================================
// 2. SISTEMA VISUAL Y RECEPTORES
// ==========================================
window.initReceptors = function(k) {
    const elTrack = document.getElementById('track');
    if (!elTrack) return;
    elTrack.innerHTML = '';

    elTrack.style.background = 'rgba(12, 12, 16, 0.9)';
    elTrack.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)';
    elTrack.style.borderLeft = '2px solid #222';
    elTrack.style.borderRight = '2px solid #222';

    let kCount = parseInt(k) || 4;
    const w = 100 / kCount;
    const yReceptor = window.cfg.down ? window.innerHeight - 140 : 80;

    let activeSkin = null;
    if (window.cfg && window.cfg.noteSkin && window.cfg.noteSkin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.cfg.noteSkin);
    } else if (window.user && window.user.equipped && window.user.equipped.skin && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    for (let i = 0; i < kCount; i++) {
        const lane = document.createElement('div');
        lane.style.cssText = `position:absolute; left:${i * w}%; width:${w}%; top:0; height:100%; border-right:1px solid rgba(255,255,255,0.03); pointer-events:none;`;
        elTrack.appendChild(lane);

        const rec = document.createElement('div');
        rec.id = `rec-${i}`;
        rec.className = 'receptor';
        rec.style.cssText = `left: ${i * w}%; width: ${w}%; top: ${yReceptor}px; height: 80px; position: absolute; display: flex; justify-content: center; align-items: center; z-index: 20;`;

        let conf = { c: '#00ffff', s: 'circle' };
        if (window.cfg && window.cfg.modes && window.cfg.modes[kCount] && window.cfg.modes[kCount][i]) {
            conf = window.cfg.modes[kCount][i];
        }

        let color = conf.c || '#00ffff';
        let isImageSkin = false;
        
        if (activeSkin) { 
            if (activeSkin.fixed) color = activeSkin.color; 
            if (activeSkin.img) isImageSkin = true;
        }

        let svgStyles = `display: block; width: 100%; height: 100%; position: relative; z-index: 5; opacity: 0.5; filter: drop-shadow(0 0 5px ${color});`;
        let svgHTML = '';

        if (isImageSkin) {
            svgHTML = `<img src="${activeSkin.img}" style="${svgStyles} object-fit: contain;">`;
        } else {
            let innerPath = '';
            let shapeType = conf.s || 'circle';

            if (shapeType === 'diamond') {
                innerPath = `<polygon points="50,10 90,50 50,90 10,50" fill="none" stroke="${color}" stroke-width="5"/>`;
            } else if (shapeType === 'bar') {
                innerPath = `<rect x="15" y="35" width="70" height="30" rx="10" fill="none" stroke="${color}" stroke-width="5"/>`;
            } else if (shapeType === 'ring') {
                innerPath = `<circle cx="50" cy="50" r="35" fill="none" stroke="${color}" stroke-width="10"/>`;
            } else if (activeSkin && activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) {
                innerPath = `<path d="${SKIN_PATHS[activeSkin.shape]}" fill="none" stroke="${color}" stroke-width="5"/>`;
            } else {
                innerPath = `<circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="5"/>`; 
            }
            // 🚨 FIX: Etiqueta xmlns asegurada para visibilidad
            svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}">${innerPath}</svg>`;
        }

        rec.innerHTML = svgHTML;
        elTrack.appendChild(rec);
    }
};

// ==========================================
// 3. CONTROL DE JUEGO (START / END)
// ==========================================
window.startGame = async function(k) {
    if(window.currentLobbyId) window.isMultiplayer = true;
    let c = document.getElementById('countdown');
    if(c) { c.innerText = "3"; c.style.display = "flex"; }
    
    let pM = document.getElementById('modal-pause');
    if(pM) pM.style.display = 'none';

    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-layer').style.display = 'block';

    if(window.bgmStarted && document.getElementById('menu-bgm')) {
        document.getElementById('menu-bgm').pause();
        window.bgmStarted = false;
    }

    window.kCount = k;
    elTrack = document.getElementById('track');
    window.initReceptors(k);
    setupTouchZones(k);

    window.st = {
        t0: 0, notes: [], spawned: [], keys: [],
        sc: 0, hp: 100, cmb: 0, maxCmb: 0,
        stats: { s: 0, g: 0, b: 0, m: 0 },
        act: false, paused: false,
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
        fcStatus: "PFC", totalOffset: 0, hitCount: 0
    };

    unlockAudio();

    let mapData = [];
    if (window.isTestingMap) {
        mapData = window.edMap || window.curSongData.notes || [];
    } else {
        let mk = `notes_mania_${k}k`;
        mapData = window.curSongData[mk] || window.curSongData.notes || [];
    }

    window.st.notes = JSON.parse(JSON.stringify(mapData));
    window.st.notes.sort((a,b) => a.t - b.t);

    let audioUrl = window.curSongData.audioURL || window.curSongData.url;
    
    try {
        const resp = await fetch(audioUrl);
        const buf = await resp.arrayBuffer();
        const decoded = await window.st.ctx.decodeAudioData(buf);
        window.st.src = window.st.ctx.createBufferSource();
        window.st.src.buffer = decoded;
        
        const gain = window.st.ctx.createGain();
        gain.gain.value = (window.cfg.vol !== undefined ? window.cfg.vol : 50) / 100;
        window.st.src.connect(gain);
        gain.connect(window.st.ctx.destination);
        window.st.songDuration = decoded.duration;

        let off = window.cfg.off || 0;
        let cNum = 3;
        let iv = setInterval(() => {
            cNum--;
            if(c) c.innerText = cNum;
            if(cNum <= 0) {
                clearInterval(iv);
                if(c) c.style.display = "none";
                window.st.t0 = window.st.ctx.currentTime + 0.1 - (off/1000);
                window.st.src.start(window.st.t0);
                window.st.act = true;
                if(typeof initMultiplayerGame === 'function' && window.isMultiplayer) initMultiplayerGame();
                loop();
            }
        }, 1000);

    } catch(e) {
        console.error(e);
        if(typeof window.notify === 'function') window.notify("Error de Audio", "error");
        window.toMenu();
    }
};

window.end = function(died) {
    window.st.act = false; window.st.paused = false;
    cancelAnimationFrame(gameLoopId); 
    if(window.st.src) try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){}
    
    document.getElementById('game-layer').style.display = 'none';
    
    let pM = document.getElementById('modal-pause');
    if(pM) pM.style.display = 'none';
    
    const modal = document.getElementById('modal-res');
    if (modal) {
        modal.style.cssText = 'display:flex !important; z-index:9999999;';
        
        let totalMax = (window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m) * 350;
        if(totalMax === 0) totalMax = 1;
        const finalAcc = Math.round((window.st.sc / totalMax) * 1000) / 10;
        let r="D", c="#F9393F", titleHTML="";
        
        if (!died) { 
            if (finalAcc >= 98) { r="SS"; c="#00FFFF"; } 
            else if (finalAcc >= 95) { r="S"; c="var(--gold)"; } 
            else if (finalAcc >= 90) { r="A"; c="#12FA05"; } 
            else if (finalAcc >= 80) { r="B"; c="yellow"; } 
            else if (finalAcc >= 70) { r="C"; c="orange"; } 
            titleHTML = `<div id="winner-msg" style="color:#12FA05; font-size:1.5rem; font-weight:bold; margin-bottom:10px;">¡CANCION COMPLETADA!</div>`; 
        } else { 
            r="F"; c="#F9393F"; titleHTML = `<div id="loser-msg" style="color:#F9393F; font-size:1.5rem; font-weight:bold; margin-bottom:10px;">💀 JUEGO TERMINADO</div>`; 
        }
        
        let xpGain = Math.floor(window.st.sc / 250); 
        let spGain = Math.floor(window.st.sc / 100); 

        if (!died && window.user && window.user.name !== "Guest" && !window.isTestingMap) { 
            window.user.xp = (window.user.xp || 0) + xpGain; 
            window.user.sp = (window.user.sp || 0) + spGain; 
            if (window.db) window.db.collection("users").doc(window.user.name).update({ xp: window.user.xp, sp: window.user.sp }).catch(()=>{}); 
        }

        modal.querySelector('.modal-panel').innerHTML = `
            <div class="modal-neon-header"><h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS</h2></div>
            <div class="modal-neon-content">
                ${titleHTML}
                <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin-bottom: 25px;">
                    <div class="rank-big" style="color:${c}; text-shadow:0 0 20px ${c}; font-size:4rem; font-weight:900;">${r}</div>
                    <div style="text-align:left;">
                        <div id="res-score" style="font-size:2rem; font-weight:900;">${window.st.sc.toLocaleString()}</div>
                        <div style="color:#aaa; font-size:1.2rem; font-weight:900;">ACC: <span style="color:white">${finalAcc}%</span></div>
                        <div style="color:${window.st.fcStatus==='PFC'?'#00ffff':(window.st.fcStatus==='GFC'?'#12FA05':(window.st.fcStatus==='FC'?'var(--gold)':'#888'))}; font-weight:bold; margin-top:5px;">${window.st.fcStatus} - Max Combo: ${window.st.maxCmb}</div>
                    </div>
                </div>
            </div>
            <div class="modal-neon-buttons"><button class="action" onclick="toMenu()">VOLVER AL MENU</button></div>
        `;
    } else {
        window.toMenu();
    }
};

window.toMenu = function() {
    if(window.st && window.st.src) { try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){} }
    window.st = {act: false};
    
    let pM = document.getElementById('modal-pause');
    if(pM) pM.style.display = 'none';
    
    let rM = document.getElementById('modal-res');
    if(rM) rM.style.display = 'none';

    document.getElementById('game-layer').style.display = 'none';
    document.getElementById('menu-container').style.display = 'flex';
    
    window.isTestingMap = false;
    
    if (!window.bgmStarted) window.playRandomBGM();
};

window.restartSong = function() {
    if(window.st && window.st.src) { try { window.st.src.stop(); window.st.src.disconnect(); } catch(e){} }
    let k = window.kCount;
    window.startGame(k);
};

// ==========================================
// 4. UI INGAME (HUD Y SPLASH)
// ==========================================
function updHUD() {
    const hs = document.getElementById('h-sick'); if(hs) hs.innerText = window.st.stats.s;
    const hg = document.getElementById('h-good'); if(hg) hg.innerText = window.st.stats.g;
    const hb = document.getElementById('h-bad'); if(hb) hb.innerText = window.st.stats.b;
    const hm = document.getElementById('h-miss'); if(hm) hm.innerText = window.st.stats.m;
    const gs = document.getElementById('g-score'); if(gs) gs.innerText = window.st.sc;
    const gc = document.getElementById('g-combo'); if(gc) gc.innerText = window.st.cmb;
    const hf = document.getElementById('health-fill'); if(hf) hf.style.width = window.st.hp + '%';

    let total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
    let acc = total === 0 ? 100 : ((window.st.stats.s*350 + window.st.stats.g*200 + window.st.stats.b*50) / (total*350)) * 100;
    const ga = document.getElementById('g-acc'); if(ga) ga.innerText = acc.toFixed(2) + '%';
    
    const hfc = document.getElementById('hud-fc');
    if(hfc) {
        hfc.innerText = window.st.fcStatus;
        hfc.style.color = window.st.fcStatus === 'PFC' ? '#00ffff' : (window.st.fcStatus === 'GFC' ? '#12FA05' : (window.st.fcStatus === 'FC' ? 'var(--gold)' : '#888'));
    }

    const hmean = document.getElementById('hud-mean');
    if(hmean && window.st.hitCount > 0) {
        let mean = window.st.totalOffset / window.st.hitCount;
        hmean.innerText = mean.toFixed(1) + 'ms';
    }
}

function createSplash(l, isMine=false) {
    if(!window.cfg.splash) return;
    const rec = document.getElementById(`rec-${l}`);
    if(!rec) return;
    const spl = document.createElement('div');
    spl.className = 'splash';
    spl.style.cssText = `position:absolute; width:100px; height:100px; border-radius:50%; background:${isMine ? '#F9393F' : 'rgba(255,255,255,0.8)'}; left:50%; top:50%; transform:translate(-50%,-50%); pointer-events:none; z-index:30; animation: splashAnim 0.3s ease-out;`;
    rec.appendChild(spl);
    setTimeout(() => spl.remove(), 300);
}

function showJudge(text, color, msDiff) {
    const h = document.getElementById('hud');
    if(!h) return;
    
    let existing = document.getElementById('temp-judge');
    if(existing) existing.remove();

    const j = document.createElement('div');
    j.id = 'temp-judge';
    j.style.cssText = `position:absolute; top:35%; left:50%; transform:translate(-50%, -50%); color:${color}; font-size:3rem; font-weight:900; text-shadow:0 0 20px ${color}; z-index:100; pointer-events:none; animation: popFade 0.4s ease-out forwards;`;
    j.innerHTML = `${text}<br><span style="font-size:1rem; color:white;">${msDiff ? msDiff.toFixed(1) + 'ms' : ''}</span>`;
    h.appendChild(j);
}

// ==========================================
// 5. INPUTS (TECLADO Y TÁCTIL)
// ==========================================
window.onKd = function(e) {
    if (!window.st || !window.st.act) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); window.togglePause(); return; }
    if (window.st.paused) return; 
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.repeat) return; 

    let k1 = String(e.key).toLowerCase().replace('key', '').replace('digit', '');
    let k2 = String(e.code).toLowerCase().replace('key', '').replace('digit', '');
    if (k1 === "space" || k2 === "space") { k1 = " "; k2 = " "; }

    let currentK = window.kCount || (window.st.keys ? window.st.keys.length : 4);
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[currentK]) {
        for (let i = 0; i < currentK; i++) {
            let cfgKey = String(window.cfg.modes[currentK][i].k).toLowerCase().replace('key', '').replace('digit', '');
            if (cfgKey === "space") cfgKey = " ";
            if (cfgKey === k1 || cfgKey === k2) { e.preventDefault(); if(typeof window.hit === 'function') window.hit(i, true); return; }
        }
    }
};

window.onKu = function(e) {
    if (!window.st || !window.st.act) return;
    let k1 = String(e.key).toLowerCase().replace('key', '').replace('digit', '');
    let k2 = String(e.code).toLowerCase().replace('key', '').replace('digit', '');
    if (k1 === "space" || k2 === "space") { k1 = " "; k2 = " "; }

    let currentK = window.kCount || (window.st.keys ? window.st.keys.length : 4);
    
    if (window.cfg && window.cfg.modes && window.cfg.modes[currentK]) {
        for (let i = 0; i < currentK; i++) {
            let cfgKey = String(window.cfg.modes[currentK][i].k).toLowerCase().replace('key', '').replace('digit', '');
            if (cfgKey === "space") cfgKey = " ";
            if (cfgKey === k1 || cfgKey === k2) { if(typeof window.hit === 'function') window.hit(i, false); return; }
        }
    }
};

window.removeEventListener('keydown', window.onKd, { capture: true });
window.removeEventListener('keyup', window.onKu, { capture: true });
window.addEventListener('keydown', window.onKd, { capture: true });
window.addEventListener('keyup', window.onKu, { capture: true });

window.hit = function(l, p) {
    if (!p) {
        if(window.st.keys) window.st.keys[l] = 0; 
        const r = document.getElementById(`rec-${l}`);
        if(r) r.classList.remove('pressed'); 
        return;
    }

    if (!window.st.act || window.st.paused) return;
    
    const r = document.getElementById(`rec-${l}`);
    if(!window.st.keys) window.st.keys = []; 
    if(window.st.keys[l]) return; 
    window.st.keys[l] = 1; 
    if(r) r.classList.add('pressed');
    
    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    const n = window.st.spawned.find(x => x.l === l && !x.h && Math.abs(x.t - now) < 160);

    if (n) {
        const diff = n.t - now; const absDiff = Math.abs(diff); window.st.totalOffset += absDiff; window.st.hitCount++;
        let score=50, text="BAD", color="yellow";

        if (n.type === 'mine') { 
            text = "OUCH!"; color = "#F9393F"; score = -200; window.st.hp -= 15; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; 
            createSplash(l, true); document.getElementById('game-layer').style.animation = 'cameraShake 0.3s'; 
            setTimeout(()=>document.getElementById('game-layer').style.animation = '', 300); 
        } 
        else if (n.type === 'dodge') { 
            text = "FAIL"; color = "#F9393F"; score = -100; window.st.hp -= 10; window.st.cmb = 0; window.st.fcStatus = "CLEAR"; 
            createSplash(l, true); 
        } 
        else {
            if(absDiff < 45){ text="SICK!!"; color="#00FFFF"; score=350; window.st.stats.s++; createSplash(l); }
            else if(absDiff < 90){ text="GOOD"; color="#12FA05"; score=200; window.st.stats.g++; createSplash(l); if(window.st.fcStatus === "PFC") window.st.fcStatus = "GFC"; }
            else { window.st.stats.b++; window.st.hp-=2; if(window.st.fcStatus === "PFC" || window.st.fcStatus === "GFC") window.st.fcStatus = "FC"; }
            window.st.cmb++; if(window.st.cmb > window.st.maxCmb) window.st.maxCmb = window.st.cmb;
        }

        window.st.sc += score; 
        if(n.type !== 'mine' && n.type !== 'dodge') window.st.hp = Math.min(100, window.st.hp+2);
        
        showJudge(text, color, diff); 
        playHit();
        updHUD(); 
        n.h = true; 
    }
};

window.togglePause = function() {
    if(!window.st.act) return;
    window.st.paused = !window.st.paused;
    let modal = document.getElementById('modal-pause');

    if(window.st.paused) {
        if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
        if(modal) {
            modal.style.cssText = 'display: flex !important; z-index: 9999999 !important; background: rgba(0,0,0,0.85);';
            const panel = modal.querySelector('.modal-panel');
            if(panel) {
                const accEl = document.getElementById('g-acc'); 
                const currentAcc = accEl ? accEl.innerText : "100%";
                panel.innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">ACCURACY<br><span style="color:white; font-size:4.5rem;">${currentAcc}</span></div>
                    </div>
                    <div class="modal-neon-buttons">
                        <button class="action" onclick="resumeGame()">▶️ CONTINUAR</button>
                        <button class="action secondary" onclick="restartSong()">🔄 REINTENTAR</button>
                        <button class="action secondary" onclick="toMenu()" style="border-color:#F9393F; color:#F9393F;">🚪 SALIR</button>
                    </div>
                `;
            }
        }
    } else { window.resumeGame(); }
};

window.resumeGame = function() {
    const modal = document.getElementById('modal-pause');
    if(modal) modal.style.setProperty('display', 'none', 'important');
    window.st.paused = false;
    if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
};

// ==========================================
// ZONA TÁCTIL (MÓVILES)
// ==========================================
let activeTouches = {};
function setupTouchZones(k) {
    const touchContainer = document.getElementById('mobile-touch-zones');
    if(!touchContainer) return;
    touchContainer.innerHTML = '';
    touchContainer.style.display = 'flex';
    
    let currentKeys = window.cfg.keys && window.cfg.keys[k] ? window.cfg.keys[k] : MASTER_KEYS[k];

    for(let i=0; i<k; i++) {
        let zone = document.createElement('div');
        zone.style.flex = "1";
        zone.style.height = "100%";
        zone.style.opacity = "0"; 
        touchContainer.appendChild(zone);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        let rect = touchContainer.getBoundingClientRect();
        let laneWidth = rect.width / k;

        for(let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let x = t.clientX - rect.left;
            let newLane = Math.floor(x / laneWidth);
            if(newLane < 0) newLane = 0;
            if(newLane >= k) newLane = k - 1;

            let oldLane = activeTouches[t.identifier];
            
            if(oldLane !== undefined && oldLane !== newLane) {
                if(typeof window.onKu === 'function') window.onKu({ key: currentKeys[oldLane], preventDefault: ()=>{} });
                if(touchContainer.children[oldLane]) touchContainer.children[oldLane].style.background = 'transparent';
            }
            if(activeTouches[t.identifier] !== newLane) {
                activeTouches[t.identifier] = newLane;
                touchContainer.children[newLane].style.background = 'rgba(255,255,255,0.1)';
                if(typeof window.onKd === 'function') window.onKd({ key: currentKeys[newLane], preventDefault: ()=>{} });
            }
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        for(let i = 0; i < e.changedTouches.length; i++) {
            let t = e.changedTouches[i];
            let oldLane = activeTouches[t.identifier];
            if(oldLane !== undefined) {
                if(typeof window.onKu === 'function') window.onKu({ key: currentKeys[oldLane], preventDefault: ()=>{} });
                if(touchContainer.children[oldLane]) touchContainer.children[oldLane].style.background = 'transparent';
                delete activeTouches[t.identifier];
            }
        }
    }

    touchContainer.addEventListener('touchstart', handleTouchMove, { passive: false });
    touchContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

// ==========================================
// 6. MOTOR GRÁFICO (LOOP PRINCIPAL)
// ==========================================
function loop() {
    if (!window.st || !window.st.act || window.st.paused) {
        if(window.st && window.st.act) gameLoopId = requestAnimationFrame(loop);
        return;
    }

    let now = (window.st.ctx.currentTime - window.st.t0) * 1000;
    
    if (window.st.songDuration > 0) {
        let progress = Math.min(100, (now / (window.st.songDuration * 1000)) * 100);
        const pFill = document.getElementById('top-progress-fill');
        if(pFill) pFill.style.width = progress + "%";
        
        const pTime = document.getElementById('top-progress-time');
        if(pTime) {
            let currentSec = Math.floor(now / 1000);
            let totalSec = Math.floor(window.st.songDuration);
            let curM = Math.floor(currentSec / 60);
            let curS = currentSec % 60;
            let totM = Math.floor(totalSec / 60);
            let totS = totalSec % 60;
            pTime.innerText = `${curM}:${curS.toString().padStart(2, '0')} / ${totM}:${totS.toString().padStart(2, '0')}`;
        }
    }

    let kCount = window.kCount || 4;
    const w = 100 / kCount;

    for (let i = 0; i < window.st.notes.length; i++) {
        const n = window.st.notes[i];
        if (n.s) continue; 
        if (n.type === 'fx_flash' || n.type === 'custom_fx') { n.s = true; window.st.spawned.push(n); continue; }

        if (n.t - now < 4000) { 
            if (n.t - now > -200) { 
                const el = document.createElement('div');
                const dirClass = window.cfg.down ? 'hold-down' : 'hold-up';
                el.className = `arrow-wrapper ${n.type === 'hold' ? 'hold-note ' + dirClass : ''}`;
                
                el.style.cssText = `left: ${n.l * w}%; width: ${w}%; top: 0px; height: 80px; position: absolute; z-index: 10; display: flex; justify-content: center; align-items: center;`; 
                
                let conf = { c: '#00ffff', s: 'circle' };
                if (window.cfg && window.cfg.modes && window.cfg.modes[kCount] && window.cfg.modes[kCount][n.l]) {
                    conf = window.cfg.modes[kCount][n.l];
                }
                
                let color = conf.c || '#00ffff'; 
                
                let activeSkin = null;
                if (window.cfg && window.cfg.noteSkin && window.cfg.noteSkin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
                    activeSkin = SHOP_ITEMS.find(item => item.id === window.cfg.noteSkin);
                } else if (window.user && window.user.equipped && window.user.equipped.skin && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
                    activeSkin = SHOP_ITEMS.find(item => item.id === window.user.equipped.skin);
                }

                let isImageSkin = false;
                if (activeSkin) { 
                    if (activeSkin.fixed) color = activeSkin.color; 
                    if (activeSkin.img) isImageSkin = true;
                }

                let svgStyles = `display: block; width: 100%; height: 100%; position: relative; z-index: 5; filter: drop-shadow(0 0 5px ${color});`;
                let svgHTML = '';
                
                if (n.type === 'mine') {
                    svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}"><circle cx="50" cy="50" r="35" fill="#111" stroke="#F9393F" stroke-width="5"/><path d="M 50 15 L 50 0 M 50 85 L 50 100 M 15 50 L 0 50 M 85 50 L 100 50 M 25 25 L 15 15 M 75 75 L 85 85 M 25 75 L 15 85 M 75 25 L 85 15" stroke="#F9393F" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#F9393F"/></svg>`;
                } else if (n.type === 'dodge') {
                    svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}"><polygon points="50,10 90,85 10,85" fill="rgba(0,255,255,0.2)" stroke="#00ffff" stroke-width="6"/><rect x="45" y="35" width="10" height="25" fill="#00ffff" rx="5"/><circle cx="50" cy="72" r="6" fill="#00ffff"/></svg>`;
                } else {
                    if (isImageSkin) {
                        svgHTML = `<img src="${activeSkin.img}" style="${svgStyles} object-fit: contain;">`;
                    } else {
                        let innerPath = '';
                        let shapeType = conf.s || 'circle';

                        if (shapeType === 'diamond') {
                            innerPath = `<polygon points="50,10 90,50 50,90 10,50" fill="${color}" stroke="white" stroke-width="5"/>`;
                        } else if (shapeType === 'bar') {
                            innerPath = `<rect x="15" y="35" width="70" height="30" rx="10" fill="${color}" stroke="white" stroke-width="5"/>`;
                        } else if (shapeType === 'ring') {
                            innerPath = `<circle cx="50" cy="50" r="35" fill="none" stroke="${color}" stroke-width="15"/>`;
                        } else if (activeSkin && activeSkin.shape && typeof SKIN_PATHS !== 'undefined' && SKIN_PATHS[activeSkin.shape]) {
                            innerPath = `<path d="${SKIN_PATHS[activeSkin.shape]}" fill="${color}" stroke="white" stroke-width="2"/>`;
                        } else {
                            innerPath = `<circle cx="50" cy="50" r="40" fill="${color}" stroke="white" stroke-width="5"/>`; 
                        }
                        // 🚨 FIX: Etiqueta xmlns obligatoria para compatibilidad entre navegadores
                        svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="${svgStyles}">${innerPath}</svg>`;
                    }
                }

                let trailHTML = '';
                let noteLen = n.len || n.dur || 0;
                
                if (n.type === 'hold' && noteLen > 0) { 
                    let opacityVal = ((window.cfg.noteOp||100)/100) * 0.6;
                    let tStyle = `position: absolute; left: 50%; transform: translateX(-50%); width: 26%; z-index: 1; opacity: ${opacityVal}; background: ${color}; box-shadow: 0 0 15px ${color}; border-radius: 12px;`;
                    
                    if (window.cfg.down) { 
                        tStyle += ` bottom: 50%; transform-origin: bottom center;`; 
                    } else { 
                        tStyle += ` top: 50%; transform-origin: top center;`; 
                    } 
                    trailHTML = `<div class="sustain-trail" style="${tStyle}"></div>`; 
                }
                
                el.innerHTML = trailHTML + svgHTML; 
                if (elTrack) elTrack.appendChild(el); 
                
                n.el = el;
                if (n.type === 'hold') n.trailEl = el.querySelector('.sustain-trail');
                
                n.h = false; n.missed = false; n.broken = false; n.finished = false;
            }
            n.s = true; window.st.spawned.push(n);
        } else break; 
    }

    for (let i = window.st.spawned.length - 1; i >= 0; i--) {
        const n = window.st.spawned[i];
        
        if (n.type === 'fx_flash') {
            if (now >= n.t && !n.h) {
                const bg = document.getElementById('game-layer');
                if(bg) {
                    bg.style.animation = 'flashEffect 0.5s ease-out';
                    setTimeout(()=> bg.style.animation = '', 500);
                }
                n.h = true; window.st.spawned.splice(i, 1);
            }
            continue;
        }
        if (n.type === 'custom_fx') {
            if (now >= n.t && !n.h) { n.h = true; window.st.spawned.splice(i, 1); }
            continue;
        }

        let diff = n.t - now;
        let noteLen = n.len || n.dur || 0;
        const spd = parseFloat(window.cfg.spd) || 25;
        let targetY = window.cfg.down ? (window.innerHeight - 140) : 80;
        
        // 🚨 EL FIX MAESTRO PARA EL UPSCROLL (Calcula si debe sumar o restar altura)
        let y = window.cfg.down ? (targetY - (diff * (spd / 20))) : (targetY + (diff * (spd / 20)));

        if (n.el) {
            if(window.cfg.fov && window.cfg.fov > 0) {
                let baseScale = window.cfg.down ? 0.5 : 1;
                let scaleProg = window.cfg.down ? (y / targetY) : (1 - (y / window.innerHeight));
                let scale = baseScale + (scaleProg * 0.5);
                if(scale < 0) scale = 0;
                n.el.style.transform = `translateY(${y}px) scale(${scale})`;
            } else {
                n.el.style.transform = `translateY(${y}px)`;
            }

            if (n.type === 'hold') {
                if (n.h && !n.broken) {
                    if (now >= n.t + noteLen) {
                        n.finished = true;
                        if (n.el) n.el.remove();
                        window.st.spawned.splice(i, 1);
                        const rec = document.getElementById(`rec-${n.l}`);
                        if(rec) rec.classList.remove('pressed');
                        continue;
                    } else {
                        if (n.el) n.el.style.transform = `translateY(${targetY}px)`;
                        if (n.trailEl) {
                            let holdProg = (now - n.t) / noteLen;
                            n.trailEl.style.transform = window.cfg.down ? `scaleY(${1 - holdProg})` : `scaleY(${1 - holdProg})`;
                        }
                    }
                } else if (n.trailEl) {
                    let totalH = noteLen * (spd / 20);
                    n.trailEl.style.height = totalH + 'px';
                }
            }
        }

        if (!n.h && diff < -120) {
            n.missed = true; n.h = true;
            if(n.type !== 'mine' && n.type !== 'dodge') {
                window.st.stats.m++; window.st.hp -= 5; window.st.cmb = 0; window.st.fcStatus = "CLEAR";
                if(typeof showJudge === 'function') showJudge("MISS", "#F9393F", diff); 
                if(typeof updHUD === 'function') updHUD();
                if(n.type === 'hold') n.broken = true;
                if(n.el) n.el.style.opacity = '0.3';
            } else {
                if(n.el) n.el.remove();
            }
        }

        if (n.type !== 'hold') {
            if (n.h && (diff < -200 || n.missed)) {
                if(n.el) n.el.remove();
                window.st.spawned.splice(i, 1);
            }
        } else if (n.broken) {
            if (now > n.t + noteLen + 200) {
                if(n.el) n.el.remove();
                window.st.spawned.splice(i, 1);
            }
        }
    }

    if (window.st.hp <= 0 && window.st.songDuration > 0) {
        if(typeof window.end === 'function') window.end(true); 
        return;
    }

    if (window.st.notes.length > 0 && window.st.notes.every(n => n.s) && window.st.spawned.length === 0) {
        let extraWait = (window.isMultiplayer) ? 2000 : 1000;
        setTimeout(() => { if(typeof window.end === 'function') window.end(false); }, extraWait); 
        return;
    } else if (window.st.songDuration > 0 && now > (window.st.songDuration * 1000) + 2000) {
        if(typeof window.end === 'function') window.end(false); 
        return;
    }

    gameLoopId = requestAnimationFrame(loop);
}
