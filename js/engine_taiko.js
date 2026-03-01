/* === js/engine_taiko.js - MOTOR TAIKO PRO OPTIMIZADO 🥁 (NO LAG/CRASH) === */

window.startTaikoEngine = async function(songObj) {
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
    return { hitObjects, audioFile };
}

function runTaikoEngine(audioBuffer, map, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;
    
    let canvas = document.getElementById('taiko-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'taiko-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d', { alpha: false }); // Renderizado Rápido

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
            <div id="tk-combo" style="color:var(--accent); font-size:3rem; font-weight:900;">0x</div>
        </div>
        <div id="tk-judgement" style="position:absolute; top:40%; left:200px; font-size:4rem; font-weight:900; transform:translate(-50%, -50%);"></div>
        <div id="near-death-vignette" style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle, transparent 50%, rgba(249,57,63,0.4) 100%); opacity:0; transition:0.3s;"></div>
    `;
    document.body.appendChild(ui);

    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    let isRunning = true;
    const scrollSpeed = 0.9;
    const receptorX = 200;
    const laneY = window.innerHeight / 2;
    let drumScale = 1;
    let particles = [];
    let animationId;

    const bgImg = new Image(); if(songObj.imageURL) bgImg.src = songObj.imageURL;

    if(window.st.src) try { window.st.src.stop(); } catch(e){}
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = audioBuffer; window.st.src.connect(window.st.ctx.destination);
    window.st.t0 = window.st.ctx.currentTime;
    window.st.src.start(window.st.t0 + 3);
    window.st.src.onended = () => { if(isRunning && window.st.act) endEngine(false); };

    function spawnHitParticle(col) {
        if (particles.length > 30) particles.splice(0, 5); // Limitar partículas para evitar lag
        for(let i=0; i<8; i++) {
            particles.push({
                x: receptorX, y: laneY,
                vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
                life: 1, color: col
            });
        }
    }

    function draw() {
        if (!isRunning || !window.st.act) return;
        if (window.st.paused) { animationId = requestAnimationFrame(draw); return; }

        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = 0.25;
        if(bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        
        ctx.fillStyle = 'rgba(10,10,15,0.9)'; ctx.fillRect(0, laneY - 80, canvas.width, 160);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.strokeRect(0, laneY - 80, canvas.width, 160);

        drumScale += (1 - drumScale) * 0.15;
        ctx.beginPath(); ctx.arc(receptorX, laneY, 50 * drumScale, 0, Math.PI * 2);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = '#222'; ctx.fill(); // Relleno rápido

        // Partículas Rápidas
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= 0.08;
            ctx.beginPath(); ctx.arc(p.x, p.y, 6*p.life, 0, Math.PI*2);
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life); ctx.fill();
            if(p.life <= 0) particles.splice(i,1);
        }
        ctx.globalAlpha = 1.0;

        // Notas (Pintado Rápido sin Gradiente pesado)
        map.forEach(n => {
            if (n.clicked || n.missed) return;
            let x = receptorX + (n.t - now) * scrollSpeed;
            
            if (x < -50) { 
                n.missed = true; window.st.cmb = 0; window.st.stats.m++; window.st.hp -= 10;
                showTkJudgement("MISS", "#F9393F"); checkDeath();
            }

            if (x < canvas.width + 100) {
                ctx.beginPath(); ctx.arc(x, laneY, 40, 0, Math.PI * 2);
                ctx.fillStyle = n.isBlue ? '#00e5ff' : '#ff0055'; // Color sólido en lugar de gradiente
                ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.stroke();
            }
        });

        updateTkHUD();
        animationId = requestAnimationFrame(draw);
    }

    function checkDeath() {
        if(window.st.hp <= 0) { window.st.hp = 0; endEngine(true); }
    }

    function showTkJudgement(txt, col) {
        const el = document.getElementById('tk-judgement');
        el.innerText = txt; el.style.color = col; el.style.textShadow = `0 0 10px ${col}`;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'popFade 0.4s forwards';
    }

    function updateTkHUD() {
        document.getElementById('tk-score').innerText = window.st.sc.toLocaleString();
        document.getElementById('tk-combo').innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
        
        const hpBar = document.getElementById('engine-hp-fill');
        if (hpBar) {
            hpBar.style.width = Math.max(0, window.st.hp) + "%";
            hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)';
        }
        
        const vign = document.getElementById('near-death-vignette');
        if (vign) vign.style.opacity = window.st.hp < 20 ? '1' : '0';
    }

    function handleTkInput(isBlue) {
        if(!isRunning || window.st.paused) return;
        drumScale = 1.3;
        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        const target = map.find(n => !n.clicked && !n.missed && Math.abs(n.t - now) < 150);

        if (target && target.isBlue === isBlue) {
            const diff = Math.abs(target.t - now);
            target.clicked = true;
            let col = isBlue ? "#00e5ff" : "#ff0055";
            spawnHitParticle(col);

            if (diff < 50) { window.st.sc += 300; window.st.cmb++; window.st.stats.s++; showTkJudgement("SICK!!", "#00ffff"); }
            else { window.st.sc += 150; window.st.cmb++; window.st.stats.g++; showTkJudgement("GOOD", "#12FA05"); }
            
            window.st.hp = Math.min(100, window.st.hp + 3);
            if(window.st.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.st.hitBuf; s.connect(window.st.ctx.destination); s.start(0); }
        } else {
            window.st.cmb = 0; window.st.hp -= 2; checkDeath();
        }
    }

    const tkHandler = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); toggleEnginePause(); return; }
        if (!e.repeat) {
            if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'j') handleTkInput(false);
            if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'k') handleTkInput(true);
        }
    };

    function resizeTk() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeTk();
    window.addEventListener('resize', resizeTk);
    window.addEventListener('keydown', tkHandler);

    function toggleEnginePause() {
        window.st.paused = !window.st.paused;
        const modal = document.getElementById('modal-pause');
        if(window.st.paused) {
            window.st.pauseTime = performance.now();
            if(window.st.ctx && window.st.ctx.state === 'running') window.st.ctx.suspend();
            if(modal) {
                modal.style.setProperty('display', 'flex', 'important'); modal.style.setProperty('z-index', '999999', 'important');
                modal.querySelector('.modal-panel').innerHTML = `
                    <div class="modal-neon-header"><h2 class="modal-neon-title">⏸️ JUEGO PAUSADO</h2></div>
                    <div class="modal-neon-content"><div style="font-size:3rem; font-weight:900; color:var(--blue); margin-bottom:20px;">TAMBORES DETENIDOS</div></div>
                    <div class="modal-neon-buttons"><button class="action" onclick="window.resumeEngineGame()">▶️ CONTINUAR</button><button class="action secondary" onclick="window.toMenu()">🚪 SALIR</button></div>`;
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
        
        // DESTRUCCIÓN VITAL DE EVENTOS (CERO LAG EN EL SIGUIENTE PLAY)
        window.removeEventListener('keydown', tkHandler);
        window.removeEventListener('resize', resizeTk);

        canvas.style.display = 'none'; ui.remove();
        
        const modal = document.getElementById('modal-res');
        if(modal) {
            modal.style.display = 'flex';
            const r = died ? "F" : "S";
            const c = died ? "#F9393F" : "var(--gold)";
            const titleHTML = died ? `<div id="loser-msg" style="color:#F9393F; font-size:2rem; font-weight:900;">💀 JUEGO TERMINADO</div>` : `<div id="winner-msg" style="color:#12FA05; font-size:2rem; font-weight:900;">¡MAPA COMPLETADO!</div>`;
            
            modal.querySelector('.modal-panel').innerHTML = `
                <div class="modal-neon-header" style="border-bottom-color: ${c};"><h2 class="modal-neon-title" style="color:${c};">🏆 RESULTADOS TAIKO</h2></div>
                <div class="modal-neon-content">
                    ${titleHTML}
                    <div style="display:flex; justify-content:center; align-items:center; gap:30px; margin: 25px 0;">
                        <div class="rank-big" style="color:${c}; font-size:6rem; font-weight:900; text-shadow:0 0 20px ${c};">${r}</div>
                        <div style="text-align:left;">
                            <div style="font-size:3rem; font-weight:900; color:white;">${window.st.sc.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div class="modal-neon-buttons"><button class="action" onclick="window.toMenu()">VOLVER AL MENU</button></div>
            `;
        }
    }

    animationId = requestAnimationFrame(draw);
};
