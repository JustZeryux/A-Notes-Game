/* ==========================================================================
   ENGINE TAIKO V-PRO (ANTI-CRASH + TOUCH ZONES + SKINS + LYRICS) 🥁
   ========================================================================== */

window.startTaikoEngine = async function(songObj) {
    if(window.currentLobbyId) window.isMultiplayer = true;
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO TAMBORES TAIKO..."; }

    try {
        let response = null;
        for (let url of [`https://api.nerinyan.moe/d/${songObj.id}`, `https://catboy.best/d/${songObj.id}`]) {
            try { response = await fetch(url); if (response.ok) break; } catch (e) {}
        }
        if (!response) throw new Error("Servidores ocupados.");

        const oszBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(oszBuffer);
        const files = Object.keys(zip.files);
        const osuFiles = files.filter(f => f.endsWith('.osu'));
        let osuText = await zip.file(osuFiles[0]).async("string");
        
        const parsed = parseTaikoMap(osuText);
        const audioKey = files.find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArrayBuffer = await (await zip.file(audioKey).async("blob")).arrayBuffer();
        
        if(!window.st.ctx) { window.st.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
        const audioBuffer = await window.st.ctx.decodeAudioData(audioArrayBuffer);

        if (loader) loader.style.display = 'none';
        document.getElementById('menu-container').classList.add('hidden');
        
        if (window.cfg && window.cfg.subtitles && !songObj.lyrics) {
            try {
                let cleanTitle = songObj.title.replace(/\([^)]*\)/g, '').trim();
                const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
                const data = await res.json();
                const bestMatch = data.find(s => s.syncedLyrics);
                if (bestMatch) songObj.lyrics = bestMatch.syncedLyrics;
            } catch(e) {}
        }
        
        if(window.currentLobbyId && typeof window.notifyLobbyLoaded === 'function') window.notifyLobbyLoaded();
        runTaikoEngine(audioBuffer, parsed.hitObjects, songObj);
    } catch (e) {
        if (loader) loader.style.display = 'none';
        alert("Error en Taiko: " + e.message);
    }
};

function parseTaikoMap(text) {
    const lines = text.split('\n').map(l => l.trim());
    let hitObjIdx = lines.findIndex(l => l.includes('[HitObjects]'));
    let audioFile = "audio.mp3";

    for(let i=0; i<hitObjIdx; i++) {
        if(lines[i].startsWith('AudioFilename:')) audioFile = lines[i].split(':')[1].trim();
    }

    const hitObjects = [];
    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const p = lines[i].split(',');
        if(p.length >= 5) {
            let isBlue = (parseInt(p[4]) & 2) !== 0 || (parseInt(p[4]) & 8) !== 0;
            hitObjects.push({ t: parseInt(p[2]) + 3000, isBlue: isBlue, clicked: false, missed: false });
        }
    }
    return { hitObjects: hitObjects.sort((a,b) => a.t - b.t), audioFile };
}

function runTaikoEngine(audioBuffer, map, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;
    
    let canvas = document.getElementById('taiko-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'taiko-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; touch-action:none;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d', { alpha: false }); 

    let ui = document.getElementById('taiko-ui');
    if(ui) ui.remove();
    ui = document.createElement('div');
    ui.id = 'taiko-ui';
    ui.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;';
    
    const avUrl = (window.user && window.user.avatarData) ? window.user.avatarData : 'icon.png';
    const uName = window.user ? window.user.name : 'Guest';
    const uLvl = window.user ? window.user.lvl : 1;

    ui.innerHTML = `
        <div style="position:fixed; top:20px; left:20px; background:rgba(10,10,14,0.95); padding:6px 20px 6px 6px; border-radius:50px; border:1px solid var(--accent); display:flex; align-items:center; gap:12px; box-shadow:0 0 20px rgba(255,0,85,0.3); z-index:9500; backdrop-filter:blur(8px);">
            <div style="width:45px; height:45px; border-radius:50%; background:url('${avUrl}') center/cover; border:2px solid white;"></div>
            <div style="display:flex; flex-direction:column; justify-content:center; padding-right:10px;">
                <div style="color:white; font-weight:900; font-size:1rem; text-transform:uppercase; letter-spacing:1px; line-height:1;">${uName}</div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                    <div style="color:var(--gold); font-weight:900; font-size:0.7rem;">LVL ${uLvl}</div>
                    <div style="width:100px; height:8px; background:#111; border-radius:4px; overflow:hidden; border:1px solid #333;">
                        <div id="engine-hp-fill" style="width:100%; height:100%; background:var(--good); transition:0.2s;"></div>
                    </div>
                </div>
            </div>
        </div>
        <div style="position:absolute; top:20px; right:30px; text-align:right;">
            <div id="tk-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 15px white;">0</div>
            <div id="tk-acc" style="color:#00ffff; font-size:2rem; font-weight:bold;">100.00%</div>
            <div id="hud-fc" style="color:cyan; font-size:1.2rem; font-weight:bold; margin-top:5px;">PFC</div>
        </div>
        <div id="tk-combo" style="position:absolute; bottom:20px; left:30px; color:white; font-size:5rem; font-weight:900; text-shadow:0 0 30px var(--accent);">0x</div>
        <div id="tk-judgement" style="position:absolute; top:40%; left:200px; font-size:4rem; font-weight:900; transform:translate(-50%, -50%);"></div>
        <div id="subtitles-container" style="position:absolute; bottom:15%; left:0; width:100%; text-align:center; display:none;">
            <div id="subtitles-text" style="display:inline-block; background:rgba(0,0,0,0.7); padding:10px 20px; border-radius:10px; color:white; font-size:2rem; font-weight:bold; border:2px solid var(--blue); text-shadow:0 0 10px var(--blue);"></div>
        </div>
        <div id="near-death-vignette" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; pointer-events:none; transition:0.3s; box-shadow: inset 0 0 150px 50px rgba(249,57,63,0.8);"></div>
        
        <div id="tk-touch-zones" style="position:absolute; top:0; left:0; width:100%; height:100%; display:none; pointer-events:auto; z-index:9100;">
            <div id="tk-zone-blue-l" style="position:absolute; left:0; width:20%; height:100%;"></div>
            <div id="tk-zone-red-l" style="position:absolute; left:20%; width:30%; height:100%;"></div>
            <div id="tk-zone-red-r" style="position:absolute; right:20%; width:30%; height:100%;"></div>
            <div id="tk-zone-blue-r" style="position:absolute; right:0; width:20%; height:100%;"></div>
        </div>
    `;
    document.body.appendChild(ui);

    if('ontouchstart' in window) document.getElementById('tk-touch-zones').style.display = 'block';

    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.fcStatus = "PFC";
    window.st.trueMaxScore = map.length * 300;
    window.st.nextNote = 0; window.st.spawned = [];
    
    let isRunning = true;
    const scrollSpeed = 0.9; const receptorX = 200; let laneY = window.innerHeight / 2;
    let drumScale = 1; let particles = [];

    let activeSkin = null;
    if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }
    const customColor = activeSkin && activeSkin.fixed ? activeSkin.color : null;

    if (window.cfg && window.cfg.subtitles && songObj.lyrics) {
        document.getElementById('subtitles-container').style.display = 'block';
        window.st.parsedLyrics = []; window.st.currentLyricIdx = 0;
        const lines = songObj.lyrics.split('\n');
        lines.forEach(l => {
            const match = l.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/);
            if(match) window.st.parsedLyrics.push({ t: (parseInt(match[1])*60 + parseFloat(match[2])) * 1000, tx: match[3].trim() });
        });
        window.st.parsedLyrics.sort((a,b) => a.t - b.t);
    }

    const bgImg = new Image(); if(songObj.imageURL) bgImg.src = songObj.imageURL;

    if(window.st.src) try { window.st.src.stop(); } catch(e){}
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = audioBuffer; 
    const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);

    window.st.t0 = window.st.ctx.currentTime;
    window.st.src.start(window.st.t0 + 3);
    window.st.src.onended = () => { if(isRunning && window.st.act) endEngine(false); };

    function spawnHitParticle(col) {
        if (particles.length > 30) particles.splice(0, 5); 
        for(let i=0; i<8; i++) { particles.push({ x: receptorX, y: laneY, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 1, color: col }); }
    }

    function draw() {
        if (!isRunning || !window.st.act) return;
        if (window.st.paused) { window.st.animId = requestAnimationFrame(draw); return; }

        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        let songTime = now - 3000;

        if (window.st.parsedLyrics && window.st.parsedLyrics.length > 0) {
            let idx = window.st.currentLyricIdx;
            if (idx < window.st.parsedLyrics.length && songTime >= window.st.parsedLyrics[idx].t) {
                const subEl = document.getElementById('subtitles-text');
                if(subEl) {
                    subEl.innerText = window.st.parsedLyrics[idx].tx;
                    subEl.style.animation = 'none'; void subEl.offsetWidth; subEl.style.animation = 'subPop 0.2s ease-out forwards';
                }
                window.st.currentLyricIdx++;
            }
        }
        
        while(window.st.nextNote < map.length && map[window.st.nextNote].t - now <= 2500) {
            window.st.spawned.push(map[window.st.nextNote]);
            window.st.nextNote++;
        }

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = (window.cfg && window.cfg.bgEffects === false) ? 0.05 : 0.25;
        if(bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        
        ctx.fillStyle = 'rgba(10,10,15,0.9)'; ctx.fillRect(0, laneY - 80, canvas.width, 160);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.strokeRect(0, laneY - 80, canvas.width, 160);

        drumScale += (1 - drumScale) * 0.15;
        ctx.beginPath(); ctx.arc(receptorX, laneY, 50 * drumScale, 0, Math.PI * 2);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = customColor ? customColor : '#222'; ctx.fill(); 

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.08;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6*p.life, 0, Math.PI*2);
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.fill();
            if(p.life <= 0) particles.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        for(let i = window.st.spawned.length - 1; i >= 0; i--) {
            const n = window.st.spawned[i];
            let x = receptorX + (n.t - now) * scrollSpeed;
            
            if (x < -50) { 
                n.missed = true; window.st.cmb = 0; window.st.stats.m++; window.st.hp -= 10; window.st.fcStatus = "CLEAR";
                showTkJudgement("MISS", "#F9393F"); checkDeath();
                window.st.spawned.splice(i, 1);
                continue;
            }

            if (x < canvas.width + 100) {
                ctx.beginPath(); ctx.arc(x, laneY, 40, 0, Math.PI * 2);
                let noteColor = n.isBlue ? '#00e5ff' : '#ff0055';
                if(customColor) noteColor = customColor; 
                ctx.fillStyle = noteColor; ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.stroke();
            }
        }

        updateTkHUD();
        window.st.animId = requestAnimationFrame(draw);
    }

    function checkDeath() { if(window.st.hp <= 0 && isRunning) { window.st.hp = 0; endEngine(true); } }

    function showTkJudgement(txt, col) {
        if(!isRunning) return; // BLINDAJE CONTRA DOM LEAK
        const el = document.getElementById('tk-judgement');
        if(!el) return;
        el.innerText = txt; el.style.color = col; el.style.textShadow = `0 0 10px ${col}`;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'popFade 0.4s forwards';
    }

    function updateTkHUD() {
        if(!isRunning) return; // BLINDAJE CONTRA DOM LEAK
        try {
            document.getElementById('tk-score').innerText = window.st.sc.toLocaleString();
            document.getElementById('tk-combo').innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
            const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
            const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*150) / (total*300))*100).toFixed(2) : "100.00";
            document.getElementById('tk-acc').innerText = acc + "%";

            const fcEl = document.getElementById('hud-fc');
            if(fcEl) { fcEl.innerText = window.st.fcStatus; fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red"))); }
            
            const hpBar = document.getElementById('engine-hp-fill');
            if (hpBar) { hpBar.style.width = Math.max(0, window.st.hp) + "%"; hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)'; }
            
            const vign = document.getElementById('near-death-vignette');
            if (vign) { if (window.st.hp < 20) vign.style.opacity = '1'; else vign.style.opacity = '0'; }
            if(window.isMultiplayer && typeof sendLobbyScore === 'function') sendLobbyScore(window.st.sc);
        } catch(e) {}
    }

    function handleTkInput(isBlue) {
        if(!isRunning || window.st.paused) return;
        drumScale = 1.3;
        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        let targetIdx = -1; let target = null;
        for(let i=0; i<window.st.spawned.length; i++) {
            if(!window.st.spawned[i].clicked && !window.st.spawned[i].missed && Math.abs(window.st.spawned[i].t - now) < 150) {
                target = window.st.spawned[i]; targetIdx = i; break;
            }
        }

        if (target && target.isBlue === isBlue) {
            const diff = Math.abs(target.t - now);
            target.clicked = true;
            let col = customColor ? customColor : (isBlue ? "#00e5ff" : "#ff0055");
            spawnHitParticle(col);

            if (diff < 50) { window.st.sc += 300; window.st.cmb++; window.st.stats.s++; showTkJudgement("SICK!!", "#00ffff"); }
            else { window.st.sc += 150; window.st.cmb++; window.st.stats.g++; showTkJudgement("GOOD", "#12FA05"); if(window.st.fcStatus==="PFC") window.st.fcStatus="GFC"; }
            
            window.st.hp = Math.min(100, window.st.hp + 3);
            try { if(typeof window.playHit === 'function') window.playHit(); } catch(e){}
            window.st.spawned.splice(targetIdx, 1);
        } else {
            window.st.cmb = 0; window.st.hp -= 2; window.st.fcStatus = "CLEAR"; checkDeath();
            try { if(typeof window.playMiss === 'function') window.playMiss(); } catch(e){}
        }
    }

    window.st.tkKeyHandler = (e) => {
        if (e.key === 'Escape' && isRunning) { e.preventDefault(); e.stopPropagation(); window.toggleEnginePause(); return; }
        if (!e.repeat) {
            if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'j') handleTkInput(false);
            if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'k') handleTkInput(true);
        }
    };
    window.addEventListener('keydown', window.st.tkKeyHandler, {capture: true}); // Evitar que game.js lo lea

    const zBlueL = document.getElementById('tk-zone-blue-l'); if(zBlueL) zBlueL.ontouchstart = (e) => { e.preventDefault(); handleTkInput(true); };
    const zBlueR = document.getElementById('tk-zone-blue-r'); if(zBlueR) zBlueR.ontouchstart = (e) => { e.preventDefault(); handleTkInput(true); };
    const zRedL = document.getElementById('tk-zone-red-l'); if(zRedL) zRedL.ontouchstart = (e) => { e.preventDefault(); handleTkInput(false); };
    const zRedR = document.getElementById('tk-zone-red-r'); if(zRedR) zRedR.ontouchstart = (e) => { e.preventDefault(); handleTkInput(false); };

    window.st.tkResizeHandler = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; laneY = window.innerHeight / 2; };
    window.st.tkResizeHandler();
    window.addEventListener('resize', window.st.tkResizeHandler);

    window.toggleEnginePause = function() {
        if(!window.st.act || !isRunning) return;
        window.st.paused = !window.st.paused;
        const modal = document.getElementById('modal-pause');
        let vign = document.getElementById('near-death-vignette');
        if(vign) vign.style.opacity = '0';

        if(window.st.paused) {
            window.st.pauseTime = performance.now();
            if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
            if(modal) {
                modal.style.setProperty('display', 'flex', 'important'); modal.style.setProperty('z-index', '999999', 'important');
                const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
                const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*150) / (total*300))*100).toFixed(2) : "100.00";
                
                modal.querySelector('.modal-panel').innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">
                            ACCURACY<br><span style="color:white; font-size:4.5rem;">${acc}%</span>
                        </div>
                        <div class="res-stats-grid">
                            <div class="res-stat-box" style="color:var(--sick)">SICK<br><span style="color:white">${window.st.stats.s}</span></div>
                            <div class="res-stat-box" style="color:var(--good)">GOOD<br><span style="color:white">${window.st.stats.g}</span></div>
                            <div class="res-stat-box" style="color:var(--bad)">BAD<br><span style="color:white">${window.st.stats.b}</span></div>
                            <div class="res-stat-box" style="color:var(--miss)">MISS<br><span style="color:white">${window.st.stats.m}</span></div>
                        </div>
                    </div>
                    <div class="modal-neon-buttons">
                        <button class="action" onclick="window.resumeEngineGame()">▶️ CONTINUAR</button>
                        <button class="action secondary" onclick="window.toMenu()" style="border-color:#F9393F; color:#F9393F;">🚪 SALIR</button>
                    </div>`;
            }
        } else { window.resumeEngineGame(); }
    };

    window.resumeEngineGame = function() {
        document.getElementById('modal-pause').style.setProperty('display', 'none', 'important');
        if(window.st.pauseTime) { window.st.t0 += (performance.now() - window.st.pauseTime)/1000; window.st.pauseTime = null; }
        window.st.paused = false;
        if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
    };

    function endEngine(died) {
        if(!isRunning) return; // FIX DE SEGURIDAD DEFINITIVO
        isRunning = false; window.st.act = false;
        cancelAnimationFrame(window.st.animId);
        try{ window.st.src.stop(); window.st.src.disconnect(); }catch(e){}
        
        window.removeEventListener('keydown', window.st.tkKeyHandler, {capture: true});
        window.removeEventListener('resize', window.st.tkResizeHandler);

        if(canvas) canvas.style.display = 'none'; 
        if(ui) ui.remove();
        if(window.isMultiplayer) return;
        
        const modal = document.getElementById('modal-res');
        if(modal) {
            modal.style.display = 'flex';
            const totalMax = window.st.trueMaxScore || 1; 
            const finalAcc = Math.round((window.st.sc / totalMax) * 1000) / 10 || 0;
            let r="D", c="#F9393F", titleHTML="";
            
            if (!died) {
                if (finalAcc >= 98) { r="SS"; c="#00FFFF" } else if (finalAcc >= 95) { r="S"; c="var(--gold)" } else if (finalAcc >= 90) { r="A"; c="#12FA05" } else if (finalAcc >= 80) { r="B"; c="yellow" } else if (finalAcc >= 70) { r="C"; c="orange" }
                titleHTML = `<div id="winner-msg">¡MAPA COMPLETADO!</div>`;
            } else { r="F"; c="#F9393F"; titleHTML = `<div id="loser-msg">💀 JUEGO TERMINADO</div>`; }
            
            let xpGain = 0;
            if (!died && window.user && window.user.name !== "Guest") { 
                xpGain = Math.floor(window.st.sc / 250); 
                window.user.xp = (window.user.xp || 0) + xpGain; 
                if(typeof save === 'function') save(); 
            }

            modal.querySelector('.modal-panel').innerHTML = `
                <div class="modal-neon-header" style="border-bottom-color: var(--gold);">
                    <h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS TAIKO</h2>
                </div>
                <div class="modal-neon-content">
                    ${titleHTML}
                    <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin-bottom: 25px;">
                        <div class="rank-big" style="color:${c}; text-shadow:0 0 20px ${c};">${r}</div>
                        <div style="text-align:left;">
                            <div id="res-score">${window.st.sc.toLocaleString()}</div>
                            <div style="color:#aaa; font-size:1.5rem; font-weight:900;">ACC: <span style="color:white">${finalAcc}%</span></div>
                            <div id="pp-gain-loss" style="color:var(--gold); font-weight:bold; font-size:1.1rem; margin-top:5px;">+0 PP <span style="font-weight:normal; color:#888;">(Unranked)</span></div>
                        </div>
                    </div>
                    <div class="res-stats-grid">
                        <div class="res-stat-box" style="color:var(--sick)">SICK<br><span style="color:white">${window.st.stats.s}</span></div>
                        <div class="res-stat-box" style="color:var(--good)">GOOD<br><span style="color:white">${window.st.stats.g}</span></div>
                        <div class="res-stat-box" style="color:var(--bad)">BAD<br><span style="color:white">${window.st.stats.b}</span></div>
                        <div class="res-stat-box" style="color:var(--miss)">MISS<br><span style="color:white">${window.st.stats.m}</span></div>
                    </div>
                    <div style="display:flex; justify-content:space-around; background:#111; padding:15px; border-radius:10px; border:1px solid #333; margin-bottom:20px; font-weight:bold;">
                        <div style="color:var(--blue); font-size:1.3rem;">💙 +<span id="res-xp">${xpGain}</span> XP GAINED</div>
                        <div style="color:var(--gold); font-size:1.3rem;">💰 +<span id="res-sp">0</span> SP SAVED</div>
                    </div>
                </div>
                <div class="modal-neon-buttons">
                    <button class="action" onclick="window.toMenu()">VOLVER AL MENU</button>
                </div>
            `;
        }
    }

    window.st.animId = requestAnimationFrame(draw);
};
