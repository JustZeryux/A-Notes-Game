/* === js/engine_standard.js - MOTOR STANDARD OPTIMIZADO 🎯 (NO LAG/CRASH) === */

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
    return { hitObjects, audioFile, CS, AR };
}

function runStandardEngine(audioBuffer, map, CS, AR, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;

    // CREACIÓN LIMPIA DEL CANVAS
    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; cursor:none;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimización: Fondo opaco mejora rendimiento

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
        <div id="near-death-vignette" style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle, transparent 50%, rgba(249,57,63,0.4) 100%); opacity:0; transition:0.3s;"></div>
    `;
    document.body.appendChild(uiLayer);

    const preempt = 1200 - 150 * (AR - 5);
    const radius = 54.4 - 4.48 * CS;
    let scale = 1, offsetX = 0, offsetY = 0;
    
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    let isRunning = true;
    let particles = [];
    let cursorTrail = [];
    let animationId;

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
        const cmb = document.getElementById('std-combo');
        cmb.innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
        
        const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
        const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*100 + window.st.stats.b*50) / (total*300))*100).toFixed(2) : "100.00";
        document.getElementById('std-acc').innerText = acc + "%";
        
        const hpBar = document.getElementById('engine-hp-fill');
        if(hpBar) {
            hpBar.style.width = Math.max(0, window.st.hp) + "%";
            hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)';
        }
        
        const vign = document.getElementById('near-death-vignette');
        if(vign) vign.style.opacity = window.st.hp < 20 ? '1' : '0';
    }

    function draw() {
        if (!isRunning || !window.st.act) return;
        if (window.st.paused) { animationId = requestAnimationFrame(draw); return; }

        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        // PINTAR FONDO OPACO PARA BORRAR FRAME ANTERIOR Y OPTIMIZAR GPU
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

        // Cursor Trail Optimizada
        if (window.mouseX && window.mouseY) {
            cursorTrail.push({x: window.mouseX, y: window.mouseY, life: 1});
            if(cursorTrail.length > 20) cursorTrail.shift(); // Limitar array
        }
        
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if(cursorTrail.length > 0) {
            ctx.beginPath(); ctx.moveTo(cursorTrail[0].x, cursorTrail[0].y);
            for(let i=1; i<cursorTrail.length; i++) {
                ctx.lineTo(cursorTrail[i].x, cursorTrail[i].y);
                cursorTrail[i].life -= 0.08; // Desvanece más rápido
            }
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)'; ctx.lineWidth = 6; ctx.stroke();
            cursorTrail = cursorTrail.filter(t => t.life > 0);
        }

        for(let i = map.length - 1; i >= 0; i--) {
            const circle = map[i];
            if (circle.clicked || circle.missed) continue;
            const timeDiff = circle.t - now;

            if (timeDiff < -150) {
                circle.missed = true; window.st.stats.m++; window.st.hp -= 10; window.st.cmb = 0;
                showJudgment("MISS", "#F9393F", offsetX + (circle.x * scale), offsetY + (circle.y * scale));
                updateHUD(); checkDeath(); continue;
            }

            if (timeDiff <= preempt && timeDiff > -150) {
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
        }
        ctx.globalAlpha = 1.0;

        // Ripples Optimizados
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i]; p.life -= 0.05;
            ctx.beginPath(); ctx.arc(p.x, p.y, (radius * scale) + (40 * (1-p.life)), 0, Math.PI*2);
            ctx.strokeStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.lineWidth = 4 * p.life; ctx.stroke();
            if(p.life <= 0) particles.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        // Cursor Hitbox
        if(window.mouseX && window.mouseY) {
            ctx.beginPath(); ctx.arc(window.mouseX, window.mouseY, 12, 0, Math.PI*2);
            ctx.fillStyle = '#00e5ff'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        }

        animationId = requestAnimationFrame(draw);
    }
    
    function checkDeath() { if(window.st.hp <= 0) { window.st.hp = 0; endEngine(true); } }

    function handleHit(clientX, clientY) {
        if(!isRunning || window.st.paused) return;
        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        let targetCircle = null;
        for(let i=0; i<map.length; i++) {
            if(!map[i].clicked && !map[i].missed && (map[i].t - now) <= preempt) { targetCircle = map[i]; break; }
        }

        if(targetCircle) {
            const screenX = offsetX + (targetCircle.x * scale);
            const screenY = offsetY + (targetCircle.y * scale);
            if (Math.hypot(clientX - screenX, clientY - screenY) <= radius * scale * 1.5) {
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
                    spawnRipple(screenX, screenY, color);
                    if(window.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.hitBuf; s.connect(window.st.ctx.destination); s.start(0); }
                } else { window.st.cmb = 0; window.st.hp -= 10; }
                
                showJudgment(txt, color, screenX, screenY); updateHUD(); checkDeath();
            }
        }
    }

    // === MANEJO SEGURO DE EVENTOS PARA EVITAR MEMORY LEAKS ===
    const mouseMoveHandler = (e) => { window.mouseX = e.clientX; window.mouseY = e.clientY; };
    const pointerDownHandler = (e) => handleHit(e.clientX, e.clientY);
    const keyHitHandler = (e) => {
        if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') { handleHit(window.mouseX || canvas.width/2, window.mouseY || canvas.height/2); }
        if(e.key === "Escape" && isRunning) { e.preventDefault(); toggleEnginePause(); }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', mouseMoveHandler);
    canvas.addEventListener('pointerdown', pointerDownHandler);
    window.addEventListener('keydown', keyHitHandler);

    function toggleEnginePause() {
        window.st.paused = !window.st.paused;
        const modal = document.getElementById('modal-pause');
        if(window.st.paused) {
            window.st.pauseTime = performance.now();
            if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
            if(modal) {
                modal.style.setProperty('display', 'flex', 'important'); modal.style.setProperty('z-index', '999999', 'important');
                const acc = document.getElementById('std-acc').innerText;
                modal.querySelector('.modal-panel').innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content">
                        <div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">ACCURACY<br><span style="color:white; font-size:4.5rem;">${acc}</span></div>
                    </div>
                    <div class="modal-neon-buttons">
                        <button class="action" onclick="window.resumeEngineGame()">▶️ CONTINUAR</button>
                        <button class="action secondary" onclick="window.toMenu()">🚪 SALIR</button>
                    </div>`;
            }
        } else { window.resumeEngineGame(); }
    }

    window.resumeEngineGame = function() {
        document.getElementById('modal-pause').style.setProperty('display', 'none', 'important');
        if(window.st.pauseTime) { window.st.t0 += (performance.now() - window.st.pauseTime)/1000; window.st.pauseTime = null; }
        window.st.paused = false;
        if(window.st.ctx.state === 'suspended') window.st.ctx.resume();
    };

    function endEngine(died) {
        isRunning = false; window.st.act = false;
        cancelAnimationFrame(animationId);
        try{ window.st.src.stop(); window.st.src.disconnect(); }catch(e){}
        
        // DESTRUIR EVENTOS (VITAL PARA NO LAGEAR EL JUEGO AL REINICIAR)
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', mouseMoveHandler);
        canvas.removeEventListener('pointerdown', pointerDownHandler);
        window.removeEventListener('keydown', keyHitHandler);

        canvas.style.display = 'none'; uiLayer.remove();
        
        const modal = document.getElementById('modal-res');
        if(modal) {
            modal.style.display = 'flex';
            const acc = document.getElementById('std-acc').innerText;
            const r = died ? "F" : (parseFloat(acc) >= 95 ? "S" : (parseFloat(acc)>=90 ? "A" : "B"));
            const c = died ? "#F9393F" : (r==="S" ? "var(--gold)" : "var(--good)");
            const titleHTML = died ? `<div id="loser-msg" style="color:#F9393F; font-size:2rem; font-weight:900;">💀 JUEGO TERMINADO</div>` : `<div id="winner-msg" style="color:#12FA05; font-size:2rem; font-weight:900;">¡MAPA COMPLETADO!</div>`;
            
            modal.querySelector('.modal-panel').innerHTML = `
                <div class="modal-neon-header" style="border-bottom-color: ${c};"><h2 class="modal-neon-title" style="color:${c};">🏆 RESULTADOS STANDARD</h2></div>
                <div class="modal-neon-content">
                    ${titleHTML}
                    <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin: 25px 0;">
                        <div class="rank-big" style="color:${c}; font-size:6rem; font-weight:900; text-shadow:0 0 20px ${c};">${r}</div>
                        <div style="text-align:left;">
                            <div style="font-size:3rem; font-weight:900; color:white;">${window.st.sc.toLocaleString()}</div>
                            <div style="color:#aaa; font-size:1.5rem; font-weight:900;">ACC: <span style="color:white">${acc}</span></div>
                        </div>
                    </div>
                </div>
                <div class="modal-neon-buttons"><button class="action" onclick="window.toMenu()">VOLVER AL MENU</button></div>
            `;
        }
    }

    animationId = requestAnimationFrame(draw);
};
