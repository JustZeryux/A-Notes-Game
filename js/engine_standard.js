/* === js/engine_standard.js - MOTOR GRÁFICO OSU! STANDARD 🎯 (V2 VISUAL UPDATE) === */

window.startNewEngine = async function(songObj) {
    if (songObj.originalMode !== 'standard') return alert("Este motor solo soporta mapas Standard.");
    
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "CARGANDO GRÁFICOS STANDARD..."; }

    try {
        let response = null;
        for (let url of [`https://api.nerinyan.moe/d/${songObj.id}`, `https://catboy.best/d/${songObj.id}`]) {
            try { response = await fetch(url); if (response.ok) break; } catch (e) {}
        }
        if (!response) throw new Error("Servidores de Osu saturados.");

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

        // Lanzar el Motor Gráfico
        document.getElementById('menu-container').classList.add('hidden');
        runStandardEngine(audioBuffer, parsed.hitObjects, parsed.CS, parsed.AR, songObj);

    } catch (e) {
        console.error(e);
        if (loader) loader.style.display = 'none';
        alert("Error cargando Standard Engine: " + e.message);
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

    const hitObjects = [];
    const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#F9393F'];
    let cIdx = 0;

    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const p = lines[i].split(',');
        if(p.length >= 5) {
            // Cambio de color cada nueva nota (Combo Color)
            let typeFlag = parseInt(p[3]);
            if((typeFlag & 4) !== 0) cIdx = (cIdx + 1) % colors.length; // New Combo
            
            hitObjects.push({
                x: parseInt(p[0]), y: parseInt(p[1]), t: parseInt(p[2]) + 3000, 
                clicked: false, missed: false, color: colors[cIdx]
            });
        }
    }
    return { hitObjects, audioFile, CS, AR };
}

function runStandardEngine(audioBuffer, map, CS, AR, songObj) {
    const gameLayer = document.getElementById('game-layer'); gameLayer.style.display = 'none';

    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:9000; cursor:crosshair;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    
    // VARIABLES DEL JUEGO
    const preempt = 1200 - 150 * (AR - 5);
    const radius = 54.4 - 4.48 * CS;
    let scale = 1, offsetX = 0, offsetY = 0;
    
    let stats = { s:0, g:0, b:0, m:0, combo:0, maxCombo:0, score:0, hp:100 };
    let judgments = []; // Para textos flotantes
    let isRunning = true;

    // CARGA DE IMÁGENES (Background y Avatar)
    const bgImg = new Image();
    let bgLoaded = false;
    if(songObj.imageURL) { bgImg.src = songObj.imageURL; bgImg.onload = () => bgLoaded = true; }

    const avImg = new Image();
    let avLoaded = false;
    if(window.user && window.user.avatarData) { avImg.src = window.user.avatarData; avImg.onload = () => avLoaded = true; }

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

    function addJudgment(txt, color, x, y) {
        judgments.push({ txt: txt, color: color, x: x, y: y, t: Date.now() });
    }

    function draw() {
        if (!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. DIBUJAR FONDO CON BLUR Y OPACIDAD
        if(bgLoaded) {
            ctx.globalAlpha = 0.25; // Fondo oscuro para ver bien las notas
            // Efecto de cubrir todo el fondo
            const bgRatio = bgImg.width / bgImg.height;
            const cvRatio = canvas.width / canvas.height;
            let drawW, drawH;
            if(cvRatio > bgRatio) { drawW = canvas.width; drawH = canvas.width / bgRatio; }
            else { drawH = canvas.height; drawW = canvas.height * bgRatio; }
            ctx.drawImage(bgImg, (canvas.width - drawW)/2, (canvas.height - drawH)/2, drawW, drawH);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,canvas.width, canvas.height);
        }

        // Borde del Área de Juego
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, 512 * scale, 384 * scale);

        // 2. DIBUJAR NOTAS DE OSU (Atrás hacia adelante)
        for(let i = map.length - 1; i >= 0; i--) {
            const circle = map[i];
            if (circle.clicked || circle.missed) continue;
            const timeDiff = circle.t - now;

            if (timeDiff < -150) {
                circle.missed = true; stats.m++; stats.hp -= 10; stats.combo = 0;
                addJudgment("MISS", "#F9393F", offsetX + (circle.x * scale), offsetY + (circle.y * scale));
                continue;
            }

            if (timeDiff <= preempt && timeDiff > -150) {
                const screenX = offsetX + (circle.x * scale); const screenY = offsetY + (circle.y * scale);
                const scaledRadius = radius * scale;
                const alpha = Math.min(1, 1 - (timeDiff / preempt));
                
                ctx.globalAlpha = alpha;
                
                // Círculo Base
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#111'; ctx.fill(); // Relleno oscuro
                ctx.lineWidth = 4 * scale; ctx.strokeStyle = 'white'; ctx.stroke(); // Borde blanco
                
                // Color interior
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = circle.color; ctx.fill();

                // Approach Circle (Anillo exterior que se cierra)
                const approachRatio = Math.max(1, timeDiff / preempt * 3 + 1);
                ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * approachRatio, 0, Math.PI * 2);
                ctx.strokeStyle = circle.color; ctx.lineWidth = 3 * scale; ctx.stroke();
            }
        }
        ctx.globalAlpha = 1.0;

        // 3. DIBUJAR TEXTOS DE JUZGAMIENTO (Sick, Miss...)
        for(let i=judgments.length-1; i>=0; i--) {
            let j = judgments[i];
            let age = Date.now() - j.t;
            if(age > 600) { judgments.splice(i, 1); continue; }
            
            ctx.globalAlpha = 1 - (age / 600);
            ctx.fillStyle = j.color;
            ctx.font = `900 ${30 + (age*0.05)}px Arial`;
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10; ctx.shadowColor = j.color;
            ctx.fillText(j.txt, j.x, j.y - (age * 0.1));
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1.0;

        // 4. INTERFAZ (HUD)
        // A. Perfil de Usuario (Arriba a la izquierda)
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(10, 10, 250, 70, 10); ctx.fill();
        if(avLoaded) { ctx.drawImage(avImg, 20, 20, 50, 50); }
        else { ctx.fillStyle = '#333'; ctx.fillRect(20, 20, 50, 50); }
        
        ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'left';
        ctx.fillText(window.user ? window.user.name : "Guest", 80, 40);
        ctx.fillStyle = 'var(--gold)'; ctx.font = 'bold 14px Arial';
        ctx.fillText("LVL " + (window.user ? window.user.lvl : 1), 80, 60);

        // B. Barra de Salud
        ctx.fillStyle = '#333'; ctx.fillRect(20, 90, 240, 10);
        ctx.fillStyle = stats.hp > 20 ? 'var(--good)' : 'var(--miss)';
        ctx.fillRect(20, 90, 240 * (Math.max(0, stats.hp) / 100), 10);

        // C. Estadísticas (Arriba a la derecha)
        ctx.fillStyle = 'white'; ctx.font = '900 40px Arial'; ctx.textAlign = 'right';
        ctx.fillText(stats.score.toLocaleString(), canvas.width - 20, 50);
        
        // Calcular Accuracy
        const totalHits = stats.s + stats.g + stats.b + stats.m;
        const totalScoreEarned = (stats.s * 300) + (stats.g * 100) + (stats.b * 50);
        const maxPossibleScore = totalHits * 300;
        const acc = totalHits > 0 ? ((totalScoreEarned / maxPossibleScore) * 100).toFixed(2) : "100.00";
        
        ctx.fillStyle = '#aaa'; ctx.font = 'bold 25px Arial';
        ctx.fillText(acc + "%", canvas.width - 20, 85);

        // D. Combo (Abajo a la izquierda)
        if(stats.combo > 0) {
            ctx.fillStyle = stats.combo > 50 ? '#00ffff' : 'white';
            ctx.font = '900 60px Arial'; ctx.textAlign = 'left';
            ctx.fillText(stats.combo + "x", 20, canvas.height - 20);
        }

        // 5. EFECTO DE MUERTE ROJA
        if (stats.hp < 20) {
            ctx.fillStyle = `rgba(249, 57, 63, ${0.15 + Math.sin(Date.now()/150)*0.1})`;
            ctx.fillRect(0,0, canvas.width, canvas.height);
        }

        requestAnimationFrame(draw);
    }
    
    // DETECCIÓN DE CLICS OPTIMIZADA
    canvas.addEventListener('pointerdown', (e) => {
        if(!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        
        let targetCircle = null;
        for(let i=0; i<map.length; i++) {
            if(!map[i].clicked && !map[i].missed && (map[i].t - now) <= preempt) {
                targetCircle = map[i]; break;
            }
        }

        if(targetCircle) {
            const screenX = offsetX + (targetCircle.x * scale);
            const screenY = offsetY + (targetCircle.y * scale);
            const dist = Math.hypot(e.clientX - screenX, e.clientY - screenY);
            
            if (dist <= radius * scale) {
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
                    if(stats.combo > stats.maxCombo) stats.maxCombo = stats.combo;
                    try { if(window.st.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.st.hitBuf; s.connect(window.st.ctx.destination); s.start(0); } } catch(err){}
                } else {
                    stats.combo = 0; stats.hp -= 10;
                }
                
                addJudgment(txt, color, screenX, screenY);
            }
        }
    });

    // Salir del juego con Escape
    window.addEventListener('keydown', function escHandler(e) {
        if(e.key === "Escape" && isRunning) {
            isRunning = false; src.stop();
            canvas.style.display = 'none';
            document.getElementById('menu-container').classList.remove('hidden');
            window.removeEventListener('keydown', escHandler);
        }
    });

    requestAnimationFrame(draw);
};
