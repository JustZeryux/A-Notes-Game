/* === js/engine_catch.js - CATCH PRO (LAG-FREE + GAME.JS UI) 🍎 === */

window.startCatchEngine = async function(songObj) {
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO FRUTAS..."; }

    try {
        let res = await fetch(`https://api.nerinyan.moe/d/${songObj.id}`);
        const oszBuffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(oszBuffer);
        const osuFiles = Object.keys(zip.files).filter(f => f.endsWith('.osu'));
        let osuText = await zip.file(osuFiles[0]).async("string");
        
        const parsed = parseCatchMap(osuText);
        const audioKey = Object.keys(zip.files).find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArr = await (await zip.file(audioKey).async("blob")).arrayBuffer();
        
        if(!window.st.ctx) window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
        const audioBuffer = await window.st.ctx.decodeAudioData(audioArr);

        if (loader) loader.style.display = 'none';
        document.getElementById('menu-container').classList.add('hidden');
        runCatchGame(audioBuffer, parsed.hitObjects, songObj);
    } catch (e) { alert("Error Catch: " + e.message); if(loader) loader.style.display='none'; }
};

function parseCatchMap(text) {
    const lines = text.split('\n').map(l => l.trim());
    let audioFile = "audio.mp3";
    let hitObjIdx = lines.findIndex(l => l.includes('[HitObjects]'));
    for(let i=0; i<hitObjIdx; i++) if(lines[i].startsWith('AudioFilename:')) audioFile = lines[i].split(':')[1].trim();

    const hitObjects = [];
    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        const p = lines[i].split(',');
        if(p.length >= 5) hitObjects.push({ x: parseInt(p[0]), t: parseInt(p[2]) + 3000, caught: false, missed: false });
    }
    return { hitObjects: hitObjects.sort((a,b) => a.t - b.t), audioFile };
}

function runCatchGame(audioBuffer, map, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;

    let canvas = document.getElementById('catch-canvas'); 
    if (!canvas) {
        canvas = document.createElement('canvas'); 
        canvas.id = 'catch-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d', { alpha: false });

    let ui = document.getElementById('catch-ui');
    if (ui) ui.remove(); 
    ui = document.createElement('div');
    ui.id = 'catch-ui'; ui.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;";
    
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
            <div id="ct-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 15px white; line-height:1;">0</div>
            <div id="ct-acc" style="color:#00ffff; font-size:2rem; font-weight:bold;">100.00%</div>
        </div>
        <div id="ct-combo" style="position:absolute; bottom:30px; left:30px; color:white; font-size:6rem; font-weight:900; text-shadow:0 0 30px #00ffff;">0x</div>
        <div id="near-death-vignette" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; pointer-events:none; transition:0.3s;"></div>
    `;
    document.body.appendChild(ui);

    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.trueMaxScore = map.length * 300;
    let stats = { catcherX: 256, speed: 10 };
    let keys = { left: false, right: false, shift: false };
    let isRunning = true;
    const catcherWidth = 100;
    
    // COLA DE FRUTAS
    window.st.nextNote = 0;
    window.st.spawned = [];
    
    let dashTrail = [];
    let particles = [];

    const bgImg = new Image(); if(songObj.imageURL) bgImg.src = songObj.imageURL;

    if(window.st.src) try { window.st.src.stop(); } catch(e){}
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = audioBuffer; window.st.src.connect(window.st.ctx.destination);
    window.st.t0 = window.st.ctx.currentTime;
    window.st.src.start(window.st.t0 + 3);
    window.st.src.onended = () => { if(isRunning && window.st.act) endEngine(false); };

    function spawnExplosion(x, y) {
        for(let i=0; i<10; i++) {
            particles.push({ x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1 });
        }
    }

    function loop() {
        if(!isRunning || !window.st.act) return;
        if(window.st.paused) { window.st.animId = requestAnimationFrame(loop); return; }

        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        // COLA: Extraer frutas necesarias del mapa
        while(window.st.nextNote < map.length && map[window.st.nextNote].t - now <= 1500) {
            window.st.spawned.push(map[window.st.nextNote]);
            window.st.nextNote++;
        }

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = 0.3;
        if(bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        let currentSpeed = keys.shift ? stats.speed * 2.5 : stats.speed;
        if(keys.left) stats.catcherX = Math.max(0, stats.catcherX - currentSpeed);
        if(keys.right) stats.catcherX = Math.min(512, stats.catcherX + currentSpeed);

        const scale = canvas.height / 600; 
        const screenCatcherX = (canvas.width / 2) + (stats.catcherX - 256) * scale;
        const catcherY = canvas.height - 100;

        if (keys.shift && (keys.left || keys.right)) dashTrail.push({ x: screenCatcherX, life: 1 });

        for(let i=dashTrail.length-1; i>=0; i--) {
            let t = dashTrail[i]; t.life -= 0.1;
            ctx.fillStyle = '#00ffff'; ctx.globalAlpha = t.life * 0.5;
            ctx.fillRect(t.x - (catcherWidth*scale/2), catcherY, catcherWidth*scale, 15);
            if(t.life <= 0) dashTrail.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = keys.shift ? '#ff0055' : '#00e5ff';
        ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(screenCatcherX - (catcherWidth*scale/2), catcherY, catcherWidth*scale, 15);
        ctx.shadowBlur = 0;

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6*p.life, 0, Math.PI*2);
            ctx.fillStyle = '#ffcc00'; ctx.globalAlpha = p.life; ctx.fill();
            if(p.life <= 0) particles.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        const dropTime = 1000; 
        for(let i = window.st.spawned.length - 1; i >= 0; i--) {
            const f = window.st.spawned[i];
            const timeDiff = f.t - now;

            if (timeDiff < -100) {
                f.missed = true; window.st.cmb = 0; window.st.stats.m++; window.st.hp -= 10;
                window.st.spawned.splice(i, 1);
                updateHUD(); checkDeath();
                continue;
            }

            const x = (canvas.width / 2) + (f.x - 256) * scale;
            const y = ((dropTime - timeDiff) / dropTime) * catcherY;

            ctx.beginPath(); ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ff44aa'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();

            if(y >= catcherY - 20 && y <= catcherY + 10) {
                if(Math.abs(x - screenCatcherX) < (catcherWidth * scale / 1.2)) {
                    f.caught = true; window.st.sc += 300; window.st.cmb++; window.st.stats.s++;
                    window.st.hp = Math.min(100, window.st.hp + 2);
                    spawnExplosion(x, catcherY); updateHUD();
                    window.st.spawned.splice(i, 1);
                }
            }
        }

        window.st.animId = requestAnimationFrame(loop);
    }

    function checkDeath() { if(window.st.hp <= 0) { window.st.hp = 0; endEngine(true); } }

    function updateHUD() {
        document.getElementById('ct-score').innerText = window.st.sc.toLocaleString();
        document.getElementById('ct-combo').innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
        const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
        const acc = total > 0 ? ((window.st.stats.s / total) * 100).toFixed(2) : "100.00";
        document.getElementById('ct-acc').innerText = acc + "%";
        
        const hpBar = document.getElementById('engine-hp-fill');
        if (hpBar) {
            hpBar.style.width = Math.max(0, window.st.hp) + "%";
            hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)';
        }
        
        const vign = document.getElementById('near-death-vignette');
        if(vign) {
            if(window.st.hp < 20) vign.classList.add('danger-active');
            else vign.classList.remove('danger-active');
        }
    }

    window.st.ctKeyHandler = (e, down) => {
        if(e.key === "ArrowLeft") keys.left = down;
        if(e.key === "ArrowRight") keys.right = down;
        if(e.key === "Shift") keys.shift = down;
        if(down && e.key === "Escape") { e.preventDefault(); window.toggleEnginePause(); }
    };
    window.st.ctResizeHandler = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.st.ctResizeHandler();

    window.addEventListener('keydown', (e) => window.st.ctKeyHandler(e, true));
    window.addEventListener('keyup', (e) => window.st.ctKeyHandler(e, false));
    window.addEventListener('resize', window.st.ctResizeHandler);

    window.toggleEnginePause = function() {
        if(!window.st.act) return;
        window.st.paused = !window.st.paused;
        const modal = document.getElementById('modal-pause');
        let vign = document.getElementById('near-death-vignette');
        if(vign) vign.classList.remove('danger-active');

        if(window.st.paused) {
            window.st.pauseTime = performance.now();
            if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
            if(modal) {
                modal.style.setProperty('display', 'flex', 'important'); modal.style.setProperty('z-index', '999999', 'important');
                const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
                const acc = total > 0 ? ((window.st.stats.s / total) * 100).toFixed(2) : "100.00";
                
                modal.querySelector('.modal-panel').innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">
                            ACCURACY<br><span id="p-acc" style="color:white; font-size:4.5rem;">${acc}%</span>
                        </div>
                        <div class="res-stats-grid">
                            <div class="res-stat-box" style="color:var(--sick)">CATCH<br><span style="color:white">${window.st.stats.s}</span></div>
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
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
    };

    function endEngine(died) {
        isRunning = false; window.st.act = false;
        cancelAnimationFrame(window.st.animId);
        try{ window.st.src.stop(); window.st.src.disconnect(); }catch(e){}
        
        // El onkeyup/down está global en este ejemplo pero se limpiará visualmente
        window.removeEventListener('resize', window.st.ctResizeHandler);

        canvas.style.display = 'none'; ui.remove();
        let vign = document.getElementById('near-death-vignette');
        if(vign) vign.classList.remove('danger-active');
        
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
            if (!died && window.user && window.user.name !== "Guest") { xpGain = Math.floor(window.st.sc / 250); window.user.xp += xpGain; if(typeof save === 'function') save(); }

            modal.querySelector('.modal-panel').innerHTML = `
                <div class="modal-neon-header" style="border-bottom-color: var(--gold);">
                    <h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS CATCH</h2>
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
                        <div class="res-stat-box" style="color:var(--sick)">CATCH<br><span style="color:white">${window.st.stats.s}</span></div>
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

    window.st.animId = requestAnimationFrame(loop);
};
