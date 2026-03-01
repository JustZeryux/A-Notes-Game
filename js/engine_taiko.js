/* === js/engine_taiko.js - MOTOR TAIKO PRO 🥁 === */

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
        
        // Parseo específico para Taiko
        const parsed = parseTaikoMap(osuText);
        
        const audioKey = files.find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArrayBuffer = await (await zip.file(audioKey).async("blob")).arrayBuffer();
        
        if(!window.st.ctx) { window.st.ctx = new (window.AudioContext || window.webkitAudioContext)(); window.st.ctx.resume(); }
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
            let type = parseInt(p[4]); // Determina si es nota roja o azul en Osu!
            // En Osu! Taiko, el sonido (hitSound) determina el color: par=Rojo, impar=Azul (simplificado)
            let isBlue = (parseInt(p[4]) & 2) !== 0 || (parseInt(p[4]) & 8) !== 0;
            hitObjects.push({
                t: parseInt(p[2]) + 3000,
                isBlue: isBlue,
                clicked: false,
                missed: false
            });
        }
    }
    return { hitObjects, audioFile };
}

function runTaikoEngine(audioBuffer, map, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    
    // Crear el Canvas de Taiko
    let canvas = document.getElementById('taiko-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'taiko-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; background:#0a0a0a;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    // UI Layer
    let ui = document.getElementById('taiko-ui');
    if(ui) ui.remove();
    ui = document.createElement('div');
    ui.id = 'taiko-ui';
    ui.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none; font-family:Arial, sans-serif;';
    ui.innerHTML = `
        <div style="position:absolute; top:20px; right:30px; text-align:right;">
            <div id="tk-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 10px white;">0</div>
            <div id="tk-combo" style="color:#f95555; font-size:2.5rem; font-weight:bold;">0x</div>
        </div>
        <div id="tk-judgement" style="position:absolute; top:40%; left:200px; font-size:3rem; font-weight:900; transform:translate(-50%, -50%);"></div>
    `;
    document.body.appendChild(ui);

    let stats = { score: 0, combo: 0, s:0, g:0, m:0 };
    let isRunning = true;
    const scrollSpeed = 0.8; // Velocidad de las notas
    const receptorX = 200; // Posición del tambor
    const laneY = window.innerHeight / 2;

    const bgImg = new Image(); if(songObj.imageURL) bgImg.src = songObj.imageURL;

    const src = window.st.ctx.createBufferSource();
    src.buffer = audioBuffer; src.connect(window.st.ctx.destination);
    const startTime = window.st.ctx.currentTime;
    src.start(startTime + 3);

    function draw() {
        if (!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo y Pista
        ctx.globalAlpha = 0.2;
        if(bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        
        ctx.fillStyle = '#111';
        ctx.fillRect(0, laneY - 60, canvas.width, 120);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
        ctx.strokeRect(0, laneY - 60, canvas.width, 120);

        // Tambor (Receptor)
        ctx.beginPath(); ctx.arc(receptorX, laneY, 50, 0, Math.PI * 2);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();

        // Notas
        map.forEach(n => {
            if (n.clicked || n.missed) return;
            let x = receptorX + (n.t - now) * scrollSpeed;
            
            if (x < -50) { 
                n.missed = true; stats.combo = 0; stats.m++; 
                showTkJudgement("MISS", "#F9393F");
            }

            if (x < canvas.width + 100) {
                ctx.beginPath(); ctx.arc(x, laneY, 40, 0, Math.PI * 2);
                ctx.fillStyle = n.isBlue ? '#44b9ff' : '#f95555';
                ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
            }
        });

        updateTkHUD();
        requestAnimationFrame(draw);
    }

    function showTkJudgement(txt, col) {
        const el = document.getElementById('tk-judgement');
        el.innerText = txt; el.style.color = col; el.style.textShadow = `0 0 10px ${col}`;
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'popFade 0.5s forwards';
    }

    function updateTkHUD() {
        document.getElementById('tk-score').innerText = stats.score.toLocaleString();
        document.getElementById('tk-combo').innerText = stats.combo > 0 ? stats.combo + "x" : "";
    }

    function handleTkInput(isBlue) {
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        const target = map.find(n => !n.clicked && !n.missed && Math.abs(n.t - now) < 150);

        if (target && target.isBlue === isBlue) {
            const diff = Math.abs(target.t - now);
            target.clicked = true;
            if (diff < 50) { stats.score += 300; stats.combo++; showTkJudgement("GREAT", "#FFD700"); }
            else { stats.score += 150; stats.combo++; showTkJudgement("GOOD", "#12FA05"); }
            if(window.st.hitBuf) { const s = window.st.ctx.createBufferSource(); s.buffer = window.st.hitBuf; s.connect(window.st.ctx.destination); s.start(0); }
        }
    }

    const tkHandler = (e) => {
        if (e.key === 'Escape') { 
            isRunning = false; src.stop(); canvas.style.display = 'none'; ui.remove(); 
            document.getElementById('menu-container').classList.remove('hidden');
            window.removeEventListener('keydown', tkHandler);
        }
        // Teclas Taiko: F/J = Rojo, D/K = Azul
        if (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'j') handleTkInput(false);
        if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'k') handleTkInput(true);
    };

    window.addEventListener('keydown', tkHandler);
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    requestAnimationFrame(draw);
};
