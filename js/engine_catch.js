/* === js/engine_catch.js - MOTOR CATCH THE BEAT 🍎 === */

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
    return { hitObjects, audioFile };
}

function runCatchGame(audioBuffer, map, song) {
    document.getElementById('game-layer').style.display = 'none';
    let canvas = document.getElementById('std-canvas'); // Reusamos el canvas
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    // UI Superior (Stats)
    let ui = document.getElementById('catch-ui') || document.createElement('div');
    ui.id = 'catch-ui'; ui.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;";
    ui.innerHTML = `
        <div style="position:absolute; top:20px; right:30px; text-align:right; color:white; font-family:Arial;">
            <div id="ct-score" style="font-size:3.5rem; font-weight:900; text-shadow:0 0 15px white;">0</div>
            <div id="ct-acc" style="font-size:1.5rem; color:#44b9ff; font-weight:bold;">100.00%</div>
        </div>
        <div id="ct-combo" style="position:absolute; bottom:30px; left:30px; color:white; font-size:5rem; font-weight:900; text-shadow:0 0 20px #44b9ff;">0x</div>
    `;
    document.body.appendChild(ui);

    let stats = { score: 0, combo: 0, caught: 0, total: 0, catcherX: 256, speed: 8 };
    let keys = { left: false, right: false, shift: false };
    let isRunning = true;
    const catcherWidth = 80;
    const bgImg = new Image(); if(song.imageURL) bgImg.src = song.imageURL;

    const src = window.st.ctx.createBufferSource();
    src.buffer = audioBuffer; src.connect(window.st.ctx.destination);
    const startTime = window.st.ctx.currentTime;
    src.start(startTime + 3);

    function loop() {
        if(!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo Borroso
        ctx.globalAlpha = 0.25;
        if(bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // Movimiento Catcher
        let currentSpeed = keys.shift ? stats.speed * 2 : stats.speed;
        if(keys.left) stats.catcherX = Math.max(40, stats.catcherX - currentSpeed);
        if(keys.right) stats.catcherX = Math.min(472, stats.catcherX + currentSpeed);

        const scale = canvas.height / 600; // Escala interna
        const screenCatcherX = (canvas.width / 2) + (stats.catcherX - 256) * scale;
        const catcherY = canvas.height - 80;

        // Dibujar Catcher (Plato)
        ctx.fillStyle = '#44b9ff';
        ctx.shadowBlur = 15; ctx.shadowColor = '#44b9ff';
        ctx.fillRect(screenCatcherX - (catcherWidth*scale/2), catcherY, catcherWidth*scale, 15);
        ctx.shadowBlur = 0;

        // Frutas
        map.forEach(f => {
            if(f.caught || f.missed) return;
            const dropTime = 800; // Tiempo de caída
            const timeDiff = f.t - now;

            if(timeDiff <= dropTime && timeDiff > -100) {
                const x = (canvas.width / 2) + (f.x - 256) * scale;
                const y = ((dropTime - timeDiff) / dropTime) * catcherY;

                // Dibujar Fruta
                ctx.beginPath(); ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
                ctx.fillStyle = '#ff4444'; ctx.fill();
                ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();

                // Detección de Colisión
                if(y >= catcherY - 20 && y <= catcherY + 10) {
                    if(Math.abs(x - screenCatcherX) < (catcherWidth * scale / 1.5)) {
                        f.caught = true; stats.score += 300; stats.combo++; stats.caught++; stats.total++;
                        updateHUD();
                    }
                }
            } else if (timeDiff < -100) {
                f.missed = true; stats.combo = 0; stats.total++;
                updateHUD();
            }
        });

        requestAnimationFrame(loop);
    }

    function updateHUD() {
        document.getElementById('ct-score').innerText = stats.score.toLocaleString();
        document.getElementById('ct-combo').innerText = stats.combo + "x";
        const acc = stats.total > 0 ? ((stats.caught / stats.total) * 100).toFixed(2) : "100.00";
        document.getElementById('ct-acc').innerText = acc + "%";
    }

    const handleKey = (e, down) => {
        if(e.key === "ArrowLeft") keys.left = down;
        if(e.key === "ArrowRight") keys.right = down;
        if(e.key === "Shift") keys.shift = down;
        if(down && e.key === "Escape") { isRunning = false; src.stop(); canvas.style.display = 'none'; ui.remove(); document.getElementById('menu-container').classList.remove('hidden'); }
    };
    window.onkeydown = (e) => handleKey(e, true);
    window.onkeyup = (e) => handleKey(e, false);
    
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    loop();
};
