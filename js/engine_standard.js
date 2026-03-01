/* === js/engine_standard.js - MOTOR GRÁFICO OSU! STANDARD 🎯 === */

window.startNewEngine = async function(songObj) {
    if (songObj.originalMode !== 'standard') return alert("Este motor solo soporta mapas Standard.");
    
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "INICIANDO MOTOR STANDARD..."; }

    try {
        // 1. Descargar el archivo .osz (Multi-Mirror)
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
        
        // 2. Parsear el mapa Standard
        const parsed = parseStandardMap(osuText);
        
        // 3. Extraer y decodificar el Audio
        const audioKey = files.find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArrayBuffer = await (await zip.file(audioKey).async("blob")).arrayBuffer();
        
        if(!window.st.ctx) {
            window.st.ctx = new (window.AudioContext || window.webkitAudioContext)();
            window.st.ctx.resume();
        }
        const audioBuffer = await window.st.ctx.decodeAudioData(audioArrayBuffer);

        if (loader) loader.style.display = 'none';

        // 4. Lanzar el Canvas y el Bucle Físico
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
    let audioFile = "audio.mp3";
    let CS = 4; // Circle Size
    let AR = 5; // Approach Rate

    for(let i=0; i<hitObjIdx; i++) {
        if(lines[i].startsWith('AudioFilename:')) audioFile = lines[i].split(':')[1].trim();
        if(lines[i].startsWith('CircleSize:')) CS = parseFloat(lines[i].split(':')[1]);
        if(lines[i].startsWith('ApproachRate:')) AR = parseFloat(lines[i].split(':')[1]);
    }

    const hitObjects = [];
    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const p = lines[i].split(',');
        if(p.length >= 5) {
            hitObjects.push({
                x: parseInt(p[0]), // 0 to 512
                y: parseInt(p[1]), // 0 to 384
                t: parseInt(p[2]), // time in ms
                clicked: false,
                missed: false
            });
        }
    }
    
    // Añadimos offset para que la canción no empiece de golpe
    hitObjects.forEach(h => h.t += 3000); 
    return { hitObjects, audioFile, CS, AR };
}

function runStandardEngine(audioBuffer, map, CS, AR, songObj) {
    // Ocultar capa VSRG normal y crear Canvas
    const gameLayer = document.getElementById('game-layer');
    gameLayer.style.display = 'none';

    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:9000; background:#000; cursor:crosshair;';
        document.body.appendChild(canvas);
    }
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    
    // Físicas de Osu Standard
    const preempt = 1200 - 150 * (AR - 5); // Tiempo que tarda en cerrarse el anillo
    const radius = 54.4 - 4.48 * CS; // Tamaño del círculo original
    
    // Escalar 512x384 a la pantalla manteniendo 4:3
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const screenRatio = canvas.width / canvas.height;
        const osuRatio = 512 / 384;

        if (screenRatio > osuRatio) {
            scale = canvas.height / 384;
            offsetX = (canvas.width - (512 * scale)) / 2;
            offsetY = 0;
        } else {
            scale = canvas.width / 512;
            offsetX = 0;
            offsetY = (canvas.height - (384 * scale)) / 2;
        }
    }
    resize();
    window.addEventListener('resize', resize);

    // Audio Player
    const src = window.st.ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(window.st.ctx.destination);
    
    const startTime = window.st.ctx.currentTime;
    src.start(startTime + 3); // 3 segundos de gracia

    let combo = 0;
    let score = 0;
    let isRunning = true;

    // Dibujar el juego frame a frame
    function draw() {
        if (!isRunning) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar Fondo borroso
        if(songObj.imageURL) {
            ctx.globalAlpha = 0.3;
            // Un truco simple para no cargar imagen en cada frame, asume que está oscuro
            ctx.fillStyle = '#111';
            ctx.fillRect(0,0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }

        const now = (window.st.ctx.currentTime - startTime) * 1000;

        // Dibujar UI Básica
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(score.toLocaleString(), canvas.width - 20, 50);
        ctx.textAlign = 'left';
        ctx.fillStyle = combo > 10 ? '#ff66aa' : 'white';
        ctx.fillText(combo + "x", 20, canvas.height - 20);

        // Borde del área de juego 4:3
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(offsetX, offsetY, 512 * scale, 384 * scale);

        // Procesar círculos
        for(let i = 0; i < map.length; i++) {
            const circle = map[i];
            if (circle.clicked || circle.missed) continue;

            const timeDiff = circle.t - now;

            // Si ya pasó el tiempo y no lo clickeaste (Miss)
            if (timeDiff < -150) {
                circle.missed = true;
                combo = 0;
                continue;
            }

            // Si está en su ventana de aparición (Preempt)
            if (timeDiff <= preempt && timeDiff > -150) {
                const screenX = offsetX + (circle.x * scale);
                const screenY = offsetY + (circle.y * scale);
                const scaledRadius = radius * scale;

                // Opacidad progresiva (Fade in)
                const alpha = Math.min(1, 1 - (timeDiff / preempt));
                ctx.globalAlpha = alpha;

                // 1. Dibujar el Círculo Base
                ctx.beginPath();
                ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#ff66aa';
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = 'white';
                ctx.stroke();

                // 2. Dibujar el Anillo de Aproximación (Approach Circle)
                const approachRatio = Math.max(1, timeDiff / preempt * 3 + 1); // Va de grande a 1
                ctx.beginPath();
                ctx.arc(screenX, screenY, scaledRadius * approachRatio, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255, 255, ' + alpha + ')'; // Cyan
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        }

        requestAnimationFrame(draw);
    }
    
    // Detectar los Clics del Ratón o Dedos
    canvas.addEventListener('pointerdown', (e) => {
        if(!isRunning) return;
        const now = (window.st.ctx.currentTime - startTime) * 1000;
        
        // Encontrar el círculo válido más viejo (el primero que debe ser presionado)
        let targetCircle = null;
        for(let i=0; i<map.length; i++) {
            if(!map[i].clicked && !map[i].missed && (map[i].t - now) <= preempt) {
                targetCircle = map[i];
                break;
            }
        }

        if(targetCircle) {
            const screenX = offsetX + (targetCircle.x * scale);
            const screenY = offsetY + (targetCircle.y * scale);
            const scaledRadius = radius * scale;

            // Teorema de Pitágoras para saber si clickeaste dentro del círculo
            const dist = Math.hypot(e.clientX - screenX, e.clientY - screenY);
            
            if (dist <= scaledRadius) {
                const diff = Math.abs(targetCircle.t - now);
                targetCircle.clicked = true;
                
                if (diff < 50) { score += 300; combo++; } // 300 (Perfecto)
                else if (diff < 100) { score += 100; combo++; } // 100 (Bien)
                else if (diff < 150) { score += 50; combo++; } // 50 (Meh)
                else { combo = 0; } // Fallaste el timing
                
                // Sonido de Hit
                try { if(window.st.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.st.hitBuf; s.connect(window.st.ctx.destination); s.start(0); } } catch(err){}
            }
        }
    });

    // Salir al presionar Escape
    window.addEventListener('keydown', function escHandler(e) {
        if(e.key === "Escape" && isRunning) {
            isRunning = false;
            src.stop();
            canvas.style.display = 'none';
            document.getElementById('menu-container').classList.remove('hidden');
            window.removeEventListener('keydown', escHandler);
        }
    });

    requestAnimationFrame(draw);
};
