/* === js/engine_standard.js - STANDARD ENGINE (REMASTERIZADO EN HD) 🎯 === */

window.startNewEngine = async function(songObj) {
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO MOTOR STANDARD..."; }

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
        
        if(!window.st.ctx) { window.st.ctx = new (window.AudioContext || window.webkitAudioContext)(); window.st.ctx.resume(); }
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

    // 1. EL CANVAS PARA LOS CIRCULOS
    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; cursor:crosshair;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    // 2. LA INTERFAZ HTML SUPERPUESTA (HUD HD)
    let uiLayer = document.getElementById('std-ui-layer');
    if(uiLayer) uiLayer.remove();
    uiLayer = document.createElement('div');
    uiLayer.id = 'std-ui-layer';
    uiLayer.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000; pointer-events:none;';
    
    let avUrl = (window.user && window.user.avatarData) ? window.user.avatarData : 'icon.png';
    let uName = window.user ? window.user.name : 'Guest';
    let uLvl = window.user ? window.user.lvl : 1;

    uiLayer.innerHTML = `
        <div style="position:absolute; top:20px; left:20px; background:rgba(0,0,0,0.8); padding:10px 20px; border-radius:15px; border:2px solid #ff44b9; display:flex; align-items:center; gap:15px; box-shadow:0 0 20px rgba(255,68,185,0.4);">
            <img src="${avUrl}" style="width:50px; height:50px; border-radius:10px;">
            <div>
                <div style="color:white; font-weight:900; font-size:1.2rem;">${uName}</div>
                <div style="color:var(--gold); font-weight:bold; font-size:0.9rem;">LVL ${uLvl}</div>
            </div>
            <div style="width:150px; height:10px; background:#333; border-radius:5px; margin-left:15px; overflow:hidden;">
                <div id="std-hp-bar" style="width:100%; height:100%; background:var(--good); transition:0.2s;"></div>
            </div>
        </div>
        <div style="position:absolute; top:20px; right:30px; text-align:right;">
            <div id="std-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 10px white; line-height:1;">0</div>
            <div id="std-acc" style="color:#00ffff; font-size:2rem; font-weight:bold;">100.00%</div>
        </div>
        <div id="std-combo" style="position:absolute; bottom:20px; left:30px; color:white; font-size:5rem; font-weight:900; text-shadow:0 0 20px var(--accent); transition:0.1s;">0x</div>
        <div id="std-judgements" style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
    `;
    document.body.appendChild(uiLayer);

    const preempt = 1200 - 150 * (AR - 5);
    const radius = 54.4 - 4.48 * CS;
    let scale = 1, offsetX = 0, offsetY = 0;
    let stats = { s:0, g:0, b:0, m:0, combo:0, score:0, hp:100 };
    let isRunning = true;

    // Fondo
    const bgImg = new Image(); let bgLoaded = false;
    if(songObj.imageURL) { bgImg.src = songObj.imageURL; bgImg.onload = () => bgLoaded = true; }

    function resize() {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const screenRatio = canvas.width / canvas.height; const osuRatio = 512 / 384;
        if (screenRatio > osuRatio) { scale = canvas.height / 384; offsetX = (canvas.width - (512 * scale)) / 2; offsetY = 0; } 
        else { scale = canvas.width / 512; offsetX = 0; offsetY = (canvas.height - (384 * scale)) / 2; }
    }
    resize(); window.addEventListener('resize', resize);

    const src = window.st.ctx.createBufferSource();
    src.buffer = audioBuffer; src.connect(window.st.ctx.destination);
    const startTime = window.st.ctx.currentTime;
    src.start(startTime + 3);

    function showJudgment(txt, color, x, y) {
        const jContainer = document.getElementById('std-judgements');
        const el = document.createElement('div');
        el.innerText = txt;
        el.style.cssText = `position:absolute; left:${x}px; top:${y}px; transform:translate(-50%, -50%); color:${color}; font-size:2.5rem; font-weight:900; text-shadow:0 0 15px ${color}; pointer-events:none; animation: popFade 0.6s forwards;`;
        jContainer.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    function updateHUD() {
        document.getElementById('std-score').innerText = stats.score.toLocaleString();
        const cmb = document.getElementById('std-combo');
        cmb.innerText = stats.combo > 0 ? stats.combo + "x" : "";
        cmb.style.transform = "scale(1.2)"; setTimeout(()=> cmb.style.transform="scale(1)", 100);
        
        const total = stats.s + stats.g + stats.b + stats.m;
        const acc = total > 0 ? (((stats.s*300 + stats.g*100 + stats.b*50) / (total*300))*100).toFixed(2) : "100.00";
        document.getElementById('std-acc').innerText = acc + "%";
        
        const hpBar = document.getElementById('std-hp-bar');
        hpBar.style.width = Math.max(0, stats.hp) + "%";
        hpBar.style.background = stats.hp > 20 ? 'var(--good)' : 'var(--miss)';
    }

    // Animación CSS requerida para los textos
    if(!document.getElementById('std-anim-style')) {
        const st = document.createElement('style'); st.id = 'std-anim-style';
        st.innerHTML = `@keyframes popFade { 0%{transform:translate(-50%, -50%) scale(0.5); opacity:1;} 20%{transform:translate(-50%, -50%) scale(1.2); opacity:1;} 100%{transform:translate(-50%, -100%) scale(1); opacity:0;} }`;
        document.head.appendChild(st);
    }

    function draw() {
        if (!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if(bgLoaded) {
            ctx.globalAlpha = 0.2; 
            const bgRatio = bgImg.width / bgImg.height; const cvRatio = canvas.width / canvas.height;
            let drawW, drawH;
            if(cvRatio > bgRatio) { drawW = canvas.width; drawH = canvas.width / bgRatio; } else { drawH = canvas.height; drawW = canvas.height * bgRatio; }
            ctx.drawImage(bgImg, (canvas.width - drawW)/2, (canvas.height - drawH)/2, drawW, drawH);
            ctx.globalAlpha = 1.0;
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, 512 * scale, 384 * scale);

        for(let i = map.length - 1; i >= 0; i--) {
            const circle = map[i];
            if (circle.clicked || circle.missed) continue;
            const timeDiff = circle.t - now;

            if (timeDiff < -150) {
                circle.missed = true; stats.m++; stats.hp -= 10; stats.combo = 0;
                showJudgment("MISS", "#F9393F", offsetX + (circle.x * scale), offsetY + (circle.y * scale));
                updateHUD(); continue;
            }

            if (timeDiff <= preempt && timeDiff > -150) {
                const screenX = offsetX + (circle.x * scale); const screenY = offsetY + (circle.y * scale);
                const scaledRadius = radius * scale;
                const alpha = Math.min(1, 1 - (timeDiff / preempt));
                ctx.globalAlpha = alpha;
                
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#111'; ctx.fill(); 
                ctx.lineWidth = 4 * scale; ctx.strokeStyle = 'white'; ctx.stroke(); 
                
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = circle.color; ctx.fill();

                const approachRatio = Math.max(1, timeDiff / preempt * 3 + 1);
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * approachRatio, 0, Math.PI * 2);
                ctx.strokeStyle = circle.color; ctx.lineWidth = 3 * scale; ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;
        requestAnimationFrame(draw);
    }
    
    // Clics y Teclas (Z y X) para atrapar círculos
    function handleHit(clientX, clientY) {
        if(!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        
        let targetCircle = null;
        for(let i=0; i<map.length; i++) {
            if(!map[i].clicked && !map[i].missed && (map[i].t - now) <= preempt) { targetCircle = map[i]; break; }
        }

        if(targetCircle) {
            const screenX = offsetX + (targetCircle.x * scale);
            const screenY = offsetY + (targetCircle.y * scale);
            if (Math.hypot(clientX - screenX, clientY - screenY) <= radius * scale * 1.5) { // Un poco de margen extra
                const diff = Math.abs(targetCircle.t - now);
                targetCircle.clicked = true;
                
                let points = 50, txt = "BAD", color = "#FFD700";
                if (diff < 50) { points=300; txt="SICK!!"; color="#00FFFF"; stats.s++; }
                else if (diff < 100) { points=100; txt="GOOD"; color="#12FA05"; stats.g++; }
                else if (diff < 150) { points=50; txt="BAD"; color="#FFD700"; stats.b++; }
                else { points=0; txt="MISS"; color="#F9393F"; stats.m++; }
                
                if (points > 0) {
                    stats.combo++; stats.score += points * (1 + (stats.combo/25));
                    stats.hp = Math.min(100, stats.hp + 2);
                    try { if(window.st.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.st.hitBuf; s.connect(window.st.ctx.destination); s.start(0); } } catch(err){}
                } else { stats.combo = 0; stats.hp -= 10; }
                
                showJudgment(txt, color, screenX, screenY); updateHUD();
            }
        }
    }

    // Permitir Mouse o Teclado (Z/X clásico de Osu)
    window.addEventListener('mousemove', (e) => { window.mouseX = e.clientX; window.mouseY = e.clientY; });
    canvas.addEventListener('pointerdown', (e) => handleHit(e.clientX, e.clientY));
    
    const keyHitHandler = (e) => {
        if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') {
            handleHit(window.mouseX || canvas.width/2, window.mouseY || canvas.height/2);
        }
        if(e.key === "Escape" && isRunning) {
            isRunning = false; src.stop(); canvas.style.display = 'none'; uiLayer.remove();
            document.getElementById('menu-container').classList.remove('hidden');
            window.removeEventListener('keydown', keyHitHandler);
        }
    };
    window.addEventListener('keydown', keyHitHandler);

    requestAnimationFrame(draw);
};
