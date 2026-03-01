/* === js/engine_standard.js - STANDARD ENGINE (LAG-FREE + GAME.JS UI) 🎯 === */

window.startNewEngine = async function(songObj) {
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO STANDARD..."; }

    try {
        let response = null;
        for (let url of [`https://api.nerinyan.moe/d/${songObj.id}`, `https://catboy.best/d/${songObj.id}`]) {
            try { response = await fetch(url); if (response.ok) break; } catch (e) {}
        }
        if (!response) throw new Error("Servidores saturados.");

        const oszBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(oszBuffer);
        const files = Object.keys(zip.files);
        
        const osuFiles = files.filter(f => f.endsWith('.osu'));
        let osuText = await zip.file(osuFiles[0]).async("string");
        const parsed = parseStandardMap(osuText);
        
        const audioKey = files.find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArrayBuffer = await (await zip.file(audioKey).async("blob")).arrayBuffer();
        
        if(!window.st.ctx) { window.st.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
        
        const audioBuffer = await window.st.ctx.decodeAudioData(audioArrayBuffer);

        if (loader) loader.style.display = 'none';
        document.getElementById('menu-container').classList.add('hidden');
        runStandardEngine(audioBuffer, parsed.hitObjects, parsed.CS, parsed.AR, songObj);
    } catch (e) {
        if (loader) loader.style.display = 'none';
        alert("Error cargando mapa: " + e.message);
    }
};

function parseStandardMap(text) {
    const lines = text.split('\n').map(l => l.trim());
    let hitObjIdx = lines.findIndex(l => l.includes('[HitObjects]'));
    let audioFile = "audio.mp3"; let CS = 4; let AR = 5;

    for(let i=0; i<hitObjIdx; i++) {
        if(lines[i].startsWith('AudioFilename:')) audioFile = lines[i].split(':')[1].trim();
        if(lines[i].startsWith('CircleSize:')) CS = parseFloat(lines[i].split(':')[1]);
        if(lines[i].startsWith('ApproachRate:')) AR = parseFloat(lines[i].split(':')[1]);
    }

    const hitObjects = []; const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700']; let cIdx = 0;
    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const p = lines[i].split(',');
        if(p.length >= 5) {
            if((parseInt(p[3]) & 4) !== 0) cIdx = (cIdx + 1) % colors.length;
            hitObjects.push({ x: parseInt(p[0]), y: parseInt(p[1]), t: parseInt(p[2]) + 3000, clicked: false, missed: false, color: colors[cIdx] });
        }
    }
    // IMPORTANTE: Ordenar por tiempo para la cola de rendimiento
    return { hitObjects: hitObjects.sort((a,b) => a.t - b.t), audioFile, CS, AR };
}

function runStandardEngine(audioBuffer, map, CS, AR, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;

    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; cursor:none;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d', { alpha: false }); 

    let uiLayer = document.getElementById('std-ui-layer');
    if(uiLayer) uiLayer.remove();
    uiLayer = document.createElement('div');
    uiLayer.id = 'std-ui-layer';
    uiLayer.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;';
    
    const avUrl = (window.user && window.user.avatarData) ? window.user.avatarData : 'icon.png';
    const uName = window.user ? window.user.name : 'Guest';
    const uLvl = window.user ? window.user.lvl : 1;

    uiLayer.innerHTML = `
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
            <div id="std-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 15px white; line-height:1;">0</div>
            <div id="std-acc" style="color:#00ffff; font-size:2rem; font-weight:bold;">100.00%</div>
        </div>
        <div id="std-combo" style="position:absolute; bottom:20px; left:30px; color:white; font-size:5rem; font-weight:900; text-shadow:0 0 30px var(--accent); transition:transform 0.1s;">0x</div>
        <div id="std-judgements" style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
        <div id="near-death-vignette" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; pointer-events:none; transition:0.3s;"></div>
    `;
    document.body.appendChild(uiLayer);

    const preempt = 1200 - 150 * (AR - 5);
    const radius = 54.4 - 4.48 * CS;
    let scale = 1, offsetX = 0, offsetY = 0;
    
    // VARIABLES GLOBALES DEL JUEGO
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.trueMaxScore = map.length * 300;
    
    // COLA DE NOTAS (El Fix Definitivo)
    window.st.nextNote = 0;
    window.st.spawned = [];
    
    let isRunning = true;
    let particles = [];
    let cursorTrail = [];

    const bgImg = new Image(); let bgLoaded = false;
    if(songObj.imageURL) { bgImg.src = songObj.imageURL; bgImg.onload = () => bgLoaded = true; }

    function resize() {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const screenRatio = canvas.width / canvas.height; const osuRatio = 512 / 384;
        if (screenRatio > osuRatio) { scale = canvas.height / 384; offsetX = (canvas.width - (512 * scale)) / 2; offsetY = 0; } 
        else { scale = canvas.width / 512; offsetX = 0; offsetY = (canvas.height - (384 * scale)) / 2; }
    }
    resize(); 

    if(window.st.src) try { window.st.src.stop(); } catch(e){}
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = audioBuffer; window.st.src.connect(window.st.ctx.destination);
    window.st.t0 = window.st.ctx.currentTime;
    window.st.src.start(window.st.t0 + 3);
    window.st.src.onended = () => { if(isRunning && window.st.act) endEngine(false); };

    function spawnRipple(x, y, color) { particles.push({ x, y, life: 1, color }); }

    function showJudgment(txt, color, x, y) {
        const jContainer = document.getElementById('std-judgements');
        const el = document.createElement('div');
        el.innerText = txt;
        el.style.cssText = `position:absolute; left:${x}px; top:${y}px; transform:translate(-50%, -50%); color:${color}; font-size:3rem; font-weight:900; text-shadow:0 0 10px ${color}; pointer-events:none; animation: popFade 0.4s forwards;`;
        jContainer.appendChild(el);
        setTimeout(() => el.remove(), 400);
    }

    function updateHUD() {
        document.getElementById('std-score').innerText = window.st.sc.toLocaleString();
        document.getElementById('std-combo').innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
        
        const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
        const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*100 + window.st.stats.b*50) / (total*300))*100).toFixed(2) : "100.00";
        document.getElementById('std-acc').innerText = acc + "%";
        
        const hpBar = document.getElementById('engine-hp-fill');
        if(hpBar) {
            hpBar.style.width = Math.max(0, window.st.hp) + "%";
            hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)';
        }
        
        const vign = document.getElementById('near-death-vignette');
        if(vign) {
            if (window.st.hp < 20) vign.classList.add('danger-active');
            else vign.classList.remove('danger-active');
        }
    }

    function draw() {
        if (!isRunning || !window.st.act) return;
        if (window.st.paused) { window.st.animId = requestAnimationFrame(draw); return; }

        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        // --- COLA DE NOTAS (PREVIENE QUE SE PARE DE SPAWNEAR) ---
        while(window.st.nextNote < map.length && map[window.st.nextNote].t - now <= preempt) {
            window.st.spawned.push(map[window.st.nextNote]);
            window.st.nextNote++;
        }
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if(bgLoaded) {
            ctx.globalAlpha = 0.2; 
            const bgRatio = bgImg.width / bgImg.height; const cvRatio = canvas.width / canvas.height;
            let drawW, drawH;
            if(cvRatio > bgRatio) { drawW = canvas.width; drawH = canvas.width / bgRatio; } else { drawH = canvas.height; drawW = canvas.height * bgRatio; }
            ctx.drawImage(bgImg, (canvas.width - drawW)/2, (canvas.height - drawH)/2, drawW, drawH);
            ctx.globalAlpha = 1.0;
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, 512 * scale, 384 * scale);

        if (window.mouseX && window.mouseY) {
            cursorTrail.push({x: window.mouseX, y: window.mouseY, life: 1});
            if(cursorTrail.length > 20) cursorTrail.shift();
        }
        
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if(cursorTrail.length > 0) {
            ctx.beginPath(); ctx.moveTo(cursorTrail[0].x, cursorTrail[0].y);
            for(let i=1; i<cursorTrail.length; i++) {
                ctx.lineTo(cursorTrail[i].x, cursorTrail[i].y);
                cursorTrail[i].life -= 0.08; 
            }
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)'; ctx.lineWidth = 6; ctx.stroke();
            cursorTrail = cursorTrail.filter(t => t.life > 0);
        }

        // --- RENDERIZAR SOLO NOTAS ACTIVAS ---
        for(let i = window.st.spawned.length - 1; i >= 0; i--) {
            const circle = window.st.spawned[i];
            const timeDiff = circle.t - now;

            if (timeDiff < -150) {
                circle.missed = true; window.st.stats.m++; window.st.hp -= 10; window.st.cmb = 0;
                showJudgment("MISS", "#F9393F", offsetX + (circle.x * scale), offsetY + (circle.y * scale));
                window.st.spawned.splice(i, 1);
                updateHUD(); checkDeath(); continue;
            }

            const screenX = offsetX + (circle.x * scale); const screenY = offsetY + (circle.y * scale);
            const scaledRadius = radius * scale;
            const alpha = Math.min(1, 1 - (timeDiff / preempt));
            ctx.globalAlpha = alpha;
            
            ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(10,10,15,0.9)'; ctx.fill(); 
            ctx.lineWidth = 3 * scale; ctx.strokeStyle = 'white'; ctx.stroke(); 
            
            ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = circle.color; ctx.fill();

            const approachRatio = Math.max(1, timeDiff / preempt * 3 + 1);
            ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * approachRatio, 0, Math.PI * 2);
            ctx.strokeStyle = circle.color; ctx.lineWidth = 3 * scale; ctx.stroke();
        }
        ctx.globalAlpha = 1.0;

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i]; p.life -= 0.05;
            ctx.beginPath(); ctx.arc(p.x, p.y, (radius * scale) + (40 * (1-p.life)), 0, Math.PI*2);
            ctx.strokeStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.lineWidth = 4 * p.life; ctx.stroke();
            if(p.life <= 0) particles.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        if(window.mouseX && window.mouseY) {
            ctx.beginPath(); ctx.arc(window.mouseX, window.mouseY, 12, 0, Math.PI*2);
            ctx.fillStyle = '#00e5ff'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        }

        window.st.animId = requestAnimationFrame(draw);
    }
    
    function checkDeath() { if(window.st.hp <= 0) { window.st.hp = 0; endEngine(true); } }

    function handleHit(clientX, clientY) {
        if(!isRunning || window.st.paused) return;
        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        let targetCircle = null;
        let targetIdx = -1;
        for(let i=0; i<window.st.spawned.length; i++) {
            const circle = window.st.spawned[i];
            if(!circle.clicked && !circle.missed) {
                const screenX = offsetX + (circle.x * scale);
                const screenY = offsetY + (circle.y * scale);
                if (Math.hypot(clientX - screenX, clientY - screenY) <= radius * scale * 1.5) {
                    targetCircle = circle; targetIdx = i;
                    break; 
                }
            }
        }

        if(targetCircle) {
            const diff = Math.abs(targetCircle.t - now);
            targetCircle.clicked = true;
            
            let points = 50, txt = "BAD", color = "#FFD700";
            if (diff < 50) { points=300; txt="SICK!!"; color="#00FFFF"; window.st.stats.s++; }
            else if (diff < 100) { points=100; txt="GOOD"; color="#12FA05"; window.st.stats.g++; }
            else if (diff < 150) { points=50; txt="BAD"; color="#FFD700"; window.st.stats.b++; }
            else { points=0; txt="MISS"; color="#F9393F"; window.st.stats.m++; }
            
            if (points > 0) {
                window.st.cmb++; window.st.sc += points * (1 + (window.st.cmb/25));
                window.st.hp = Math.min(100, window.st.hp + 3);
                const sx = offsetX + (targetCircle.x * scale); const sy = offsetY + (targetCircle.y * scale);
                spawnRipple(sx, sy, color);
                showJudgment(txt, color, sx, sy);
                if(window.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.hitBuf; s.connect(window.st.ctx.destination); s.start(0); }
            } else { window.st.cmb = 0; window.st.hp -= 10; showJudgment(txt, color, offsetX + targetCircle.x*scale, offsetY + targetCircle.y*scale); }
            
            window.st.spawned.splice(targetIdx, 1);
            updateHUD(); checkDeath();
        }
    }

    // EVENTOS AISLADOS Y SEGUROS
    window.st.mouseMoveHandler = (e) => { window.mouseX = e.clientX; window.mouseY = e.clientY; };
    window.st.pointerDownHandler = (e) => handleHit(e.clientX, e.clientY);
    window.st.keyHitHandler = (e) => {
        if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') { handleHit(window.mouseX || canvas.width/2, window.mouseY || canvas.height/2); }
        if(e.key === "Escape" && isRunning) { e.preventDefault(); window.toggleEnginePause(); }
    };
    window.st.resizeHandler = resize;

    window.addEventListener('resize', window.st.resizeHandler);
    window.addEventListener('mousemove', window.st.mouseMoveHandler);
    canvas.addEventListener('pointerdown', window.st.pointerDownHandler);
    window.addEventListener('keydown', window.st.keyHitHandler);

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
                const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*100 + window.st.stats.b*50) / (total*300))*100).toFixed(2) : "100.00";
                
                modal.querySelector('.modal-panel').innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">
                            ACCURACY<br><span id="p-acc" style="color:white; font-size:4.5rem;">${acc}%</span>
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
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
    };

    function endEngine(died) {
        isRunning = false; window.st.act = false;
        cancelAnimationFrame(window.st.animId);
        try{ window.st.src.stop(); window.st.src.disconnect(); }catch(e){}
        
        window.removeEventListener('resize', window.st.resizeHandler);
        window.removeEventListener('mousemove', window.st.mouseMoveHandler);
        canvas.removeEventListener('pointerdown', window.st.pointerDownHandler);
        window.removeEventListener('keydown', window.st.keyHitHandler);

        canvas.style.display = 'none'; uiLayer.remove();
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
                    <h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS OSU!</h2>
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
