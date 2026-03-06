/* ==========================================================================
   ENGINE STANDARD V-PRO 5.0 (ULTRA-REALISTIC + ANTI-CRASH + OSK SKINS) 🎯
   ========================================================================== */

window.handleOskUpload = async function(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    if(typeof window.notify === 'function') window.notify("⏳ Extrayendo Skin... (Puede tardar unos segundos)", "info");
    
    try {
        const zip = await JSZip.loadAsync(file);
        const skinData = {};
        
        const getB64 = async (name) => {
            const files = Object.keys(zip.files);
            const exact = files.find(f => f.toLowerCase().endsWith(name.toLowerCase()));
            const hd = files.find(f => f.toLowerCase().endsWith(name.replace('.png', '@2x.png').toLowerCase()));
            
            let fileObj = zip.files[exact] || zip.files[hd];
            if(fileObj) {
                const blob = await fileObj.async("blob");
                return new Promise(res => {
                    const reader = new FileReader();
                    reader.onload = ev => res(ev.target.result);
                    reader.readAsDataURL(blob);
                });
            }
            return null;
        };

        skinData.hitcircle = await getB64('hitcircle.png');
        skinData.hitcircleoverlay = await getB64('hitcircleoverlay.png');
        skinData.approachcircle = await getB64('approachcircle.png');
        skinData.cursor = await getB64('cursor.png');
        
        localStorage.setItem('osu_custom_skin', JSON.stringify(skinData));
        if(typeof window.notify === 'function') window.notify("✅ Skin Osu! instalada correctamente.", "success");
        else alert("Skin Instalada correctamente");
        
    } catch(err) {
        console.error(err);
        if(typeof window.notify === 'function') window.notify("❌ Error al leer el archivo .osk", "error");
        else alert("Error al leer el .osk");
    }
}

window.startNewEngine = async function(songObj) {
    if(window.currentLobbyId) window.isMultiplayer = true;
    const loader = document.getElementById('loading-overlay');
    if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "PREPARANDO OSU! STANDARD..."; }

    try {
        if(typeof unlockAudio === 'function') unlockAudio();

        let customMap = null;
        if (window.isTestingMap && window.edMode === 'standard' && window.edMap) customMap = window.edMap; 
        else customMap = songObj.raw ? (songObj.raw.notes_standard || songObj.raw.notes) : songObj.notes_standard;

        if (customMap && customMap.length > 0 && !songObj.isOsu) {
            const response = await fetch(songObj.audioURL || songObj.url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await window.st.ctx.decodeAudioData(arrayBuffer);
            
            let map = JSON.parse(JSON.stringify(customMap));
            const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#a200ff'];
            let cIdx = 0; let comboNum = 1;

            map.forEach(n => {
                n.t += 3000; 
                n.clicked = false; n.missed = false; n.active = false;
                if(!n.type) n.type = 'circle';
                n.color = colors[cIdx]; n.combo = comboNum++;
                if (comboNum > 4) { comboNum = 1; cIdx = (cIdx + 1) % colors.length; }
            });
            map.sort((a,b) => a.t - b.t);

            if (loader) loader.style.display = 'none';
            document.getElementById('menu-container').classList.add('hidden');
            if(window.currentLobbyId && typeof window.notifyLobbyLoaded === 'function') window.notifyLobbyLoaded();
            
            runStandardEngine(audioBuffer, map, 4, 5, songObj);
            return; 
        }

        let response = null;
        for (let url of [`https://api.nerinyan.moe/d/${songObj.id}`, `https://catboy.best/d/${songObj.id}`]) {
            try { response = await fetch(url); if (response.ok) break; } catch (e) {}
        }
        if (!response) throw new Error("Servidores saturados o no es un mapa válido.");

        const oszBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(oszBuffer);
        const files = Object.keys(zip.files);
        
        const osuFiles = files.filter(f => f.endsWith('.osu'));
        let osuText = await zip.file(osuFiles[0]).async("string");
        const parsed = parseStandardMap(osuText);
        
        const audioKey = files.find(f => f.toLowerCase().includes(parsed.audioFile.toLowerCase()));
        const audioArrayBuffer = await (await zip.file(audioKey).async("blob")).arrayBuffer();
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
        runStandardEngine(audioBuffer, parsed.hitObjects, parsed.CS, parsed.AR, songObj);

    } catch (e) {
        if (loader) loader.style.display = 'none';
        alert("Error cargando mapa: " + e.message);
    }
};

function parseStandardMap(text) {
    const lines = text.split('\n').map(l => l.trim());
    let hitObjIdx = lines.findIndex(l => l.includes('[HitObjects]'));
    let timingIdx = lines.findIndex(l => l.includes('[TimingPoints]'));

    let audioFile = "audio.mp3"; let CS = 4; let AR = 5; let SM = 1.4;

    for(let i=0; i<hitObjIdx; i++) {
        if(lines[i].startsWith('AudioFilename:')) audioFile = lines[i].split(':')[1].trim();
        if(lines[i].startsWith('CircleSize:')) CS = parseFloat(lines[i].split(':')[1]);
        if(lines[i].startsWith('ApproachRate:')) AR = parseFloat(lines[i].split(':')[1]);
        if(lines[i].startsWith('SliderMultiplier:')) SM = parseFloat(lines[i].split(':')[1]);
    }

    let timingPoints = [];
    if (timingIdx !== -1) {
        for(let i = timingIdx + 1; i < lines.length; i++) {
            if(!lines[i] || lines[i].startsWith('[')) break;
            const p = lines[i].split(',');
            if(p.length >= 2) {
                let time = parseFloat(p[0]); let beatLength = parseFloat(p[1]);
                if(beatLength > 0) timingPoints.push({ time: time, beatLength: beatLength });
            }
        }
    }
    if(timingPoints.length === 0) timingPoints.push({ time: 0, beatLength: 500 }); 

    const hitObjects = []; 
    const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#a200ff']; 
    let cIdx = 0; let comboNum = 1;

    for(let i = hitObjIdx + 1; i < lines.length; i++) {
        if(!lines[i]) continue;
        const p = lines[i].split(',');
        if(p.length >= 5) {
            let objType = parseInt(p[3]); let isNewCombo = (objType & 4) !== 0;
            if(isNewCombo) { cIdx = (cIdx + 1) % colors.length; comboNum = 1; }

            let x = parseInt(p[0]); let y = parseInt(p[1]);
            let tMs = parseInt(p[2]) + 3000; 

            if ((objType & 2) !== 0 && p.length >= 8) {
                let curveData = p[5].split('|'); let slides = parseInt(p[6]); let length = parseFloat(p[7]);
                let currentBP = timingPoints[0];
                for(let tp of timingPoints) { if(tp.time + 3000 <= tMs) currentBP = tp; else break; }
                let msPerBeat = currentBP.beatLength;
                let sliderDuration = (length / (SM * 100)) * msPerBeat * slides;
                
                let lastPoint = curveData[curveData.length - 1].split(':');
                let endX = parseInt(lastPoint[0]) || x; let endY = parseInt(lastPoint[1]) || y;

                hitObjects.push({
                    type: 'slider', x: x, y: y, t: tMs, endTime: tMs + sliderDuration,
                    endX: endX, endY: endY, clicked: false, missed: false,
                    active: false, broken: false, color: colors[cIdx], combo: comboNum, slides: slides
                });
                comboNum++;
            } 
            else if ((objType & 1) !== 0) {
                hitObjects.push({ type: 'circle', x: x, y: y, t: tMs, clicked: false, missed: false, color: colors[cIdx], combo: comboNum });
                comboNum++;
            }
        }
    }
    return { hitObjects: hitObjects.sort((a,b) => a.t - b.t), audioFile, CS, AR };
}

function runStandardEngine(audioBuffer, map, CS, AR, songObj) {
    document.getElementById('game-layer').style.display = 'none';
    window.st.act = true; window.st.paused = false;

    let canvas = document.getElementById('std-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas'); canvas.id = 'std-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; z-index:8000; cursor:none; touch-action:none;';
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
                <div style="color:white; font-weight:900; font-size:1rem; text-transform:uppercase; line-height:1;">${uName}</div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                    <div style="color:var(--gold); font-weight:900; font-size:0.7rem;">LVL ${uLvl}</div>
                    <div style="width:100px; height:8px; background:#111; border-radius:4px; overflow:hidden; border:1px solid #333;"><div id="engine-hp-fill" style="width:100%; height:100%; background:var(--good); transition:0.2s;"></div></div>
                </div>
            </div>
        </div>
        <div style="position:absolute; top:20px; right:30px; text-align:right;">
            <div id="std-score" style="color:white; font-size:4rem; font-weight:900; text-shadow:0 0 15px white; line-height:1;">0</div>
            <div id="std-acc" style="color:#00ffff; font-size:2rem; font-weight:bold;">100.00%</div>
            <div id="hud-fc" style="color:cyan; font-size:1.2rem; font-weight:bold; margin-top:5px;">PFC</div>
        </div>
        <div id="std-combo" style="position:absolute; bottom:20px; left:30px; color:white; font-size:5rem; font-weight:900; text-shadow:0 0 30px var(--accent); transition:transform 0.1s;">0x</div>
        <div id="std-judgements" style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
        <div id="countdown" style="position:absolute; width:100%; height:100%; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:9999; font-size:15rem; font-weight:900; color:white; text-shadow:0 0 60px black;"></div>
    `;
    document.body.appendChild(uiLayer);

    const preempt = 1200 - 150 * (AR - 5);
    const radius = 54.4 - 4.48 * CS;
    let scale = 1, offsetX = 0, offsetY = 0;
    
    window.st.sc = 0; window.st.cmb = 0; window.st.hp = 100;
    window.st.stats = { s:0, g:0, b:0, m:0 };
    window.st.fcStatus = "PFC"; window.st.trueMaxScore = map.length * 300;
    window.st.nextNote = 0; window.st.spawned = [];
    
    let isRunning = true; let particles = []; let cursorTrail = [];
    window.isPointerDown = false; 

    // === INICIALIZACIÓN DE SKINS BLINDADA ===
    let activeSkin = null;
    if (window.cfg && window.cfg.noteSkin && window.cfg.noteSkin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.cfg.noteSkin);
    } else if (window.user && window.user.equipped && window.user.equipped.skin !== 'default' && typeof SHOP_ITEMS !== 'undefined') {
        activeSkin = SHOP_ITEMS.find(i => i.id === window.user.equipped.skin);
    }

    const loadedSkin = { hitcircle: null, hitcircleoverlay: null, approachcircle: null, cursor: null };
    let hasCustomOsk = false;
    try {
        const savedOsk = JSON.parse(localStorage.getItem('osu_custom_skin'));
        if(savedOsk && (savedOsk.hitcircle || savedOsk.hitcircleoverlay)) {
            hasCustomOsk = true;
            if(savedOsk.hitcircle) { loadedSkin.hitcircle = new Image(); loadedSkin.hitcircle.src = savedOsk.hitcircle; }
            if(savedOsk.hitcircleoverlay) { loadedSkin.hitcircleoverlay = new Image(); loadedSkin.hitcircleoverlay.src = savedOsk.hitcircleoverlay; }
            if(savedOsk.approachcircle) { loadedSkin.approachcircle = new Image(); loadedSkin.approachcircle.src = savedOsk.approachcircle; }
            if(savedOsk.cursor) { loadedSkin.cursor = new Image(); loadedSkin.cursor.src = savedOsk.cursor; }
        }
    } catch(e) {}

    const bgImg = new Image(); let bgLoaded = false;
    if(songObj.imageURL) { bgImg.src = songObj.imageURL; bgImg.onload = () => bgLoaded = true; }

    function resize() {
        if(!canvas) return;
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const screenRatio = canvas.width / canvas.height; const osuRatio = 512 / 384;
        if (screenRatio > osuRatio) { scale = canvas.height / 384; offsetX = (canvas.width - (512 * scale)) / 2; offsetY = 0; } 
        else { scale = canvas.width / 512; offsetX = 0; offsetY = (canvas.height - (384 * scale)) / 2; }
    }
    resize(); 

    if(window.st.src) try { window.st.src.stop(); } catch(e){}
    window.st.src = window.st.ctx.createBufferSource();
    window.st.src.buffer = audioBuffer; 
    const g = window.st.ctx.createGain(); g.gain.value = window.cfg.vol || 0.5;
    window.st.src.connect(g); g.connect(window.st.ctx.destination);
    
    window.st.t0 = window.st.ctx.currentTime;
    window.st.src.start(window.st.t0 + 3);
    window.st.src.onended = () => { if(isRunning && window.st.act) endEngine(false); };

    const cd = document.getElementById('countdown');
    if(cd) { cd.style.display = 'flex'; cd.innerText = "3"; }
    let count = 3;
    const iv = setInterval(() => {
        count--;
        if(cd) { if (count > 0) cd.innerText = count; else { clearInterval(iv); cd.innerText = "GO!"; setTimeout(() => { cd.style.display = 'none'; }, 500); } } else { clearInterval(iv); }
    }, 1000);

    function spawnRipple(x, y, color) { particles.push({ x, y, life: 1, color }); }

    function showJudgment(txt, color, x, y) {
        if(!isRunning) return;
        const jContainer = document.getElementById('std-judgements');
        if(!jContainer) return; 
        const el = document.createElement('div');
        el.innerText = txt;
        el.style.cssText = `position:absolute; left:${x}px; top:${y}px; transform:translate(-50%, -50%); color:${color}; font-size:3rem; font-weight:900; text-shadow:0 0 10px ${color}; pointer-events:none; animation: popFade 0.4s forwards;`;
        jContainer.appendChild(el);
        setTimeout(() => { if(el.parentNode) el.remove(); }, 400);
    }

    function updateHUD() {
        if(!isRunning) return; 
        try {
            document.getElementById('std-score').innerText = window.st.sc.toLocaleString();
            document.getElementById('std-combo').innerText = window.st.cmb > 0 ? window.st.cmb + "x" : "";
            
            const total = window.st.stats.s + window.st.stats.g + window.st.stats.b + window.st.stats.m;
            const acc = total > 0 ? (((window.st.stats.s*300 + window.st.stats.g*100 + window.st.stats.b*50) / (total*300))*100).toFixed(2) : "100.00";
            document.getElementById('std-acc').innerText = acc + "%";
            
            const fcEl = document.getElementById('hud-fc');
            if(fcEl) { fcEl.innerText = window.st.fcStatus; fcEl.style.color = (window.st.fcStatus==="PFC"?"cyan":(window.st.fcStatus==="GFC"?"gold":(window.st.fcStatus==="FC"?"lime":"red"))); }

            const hpBar = document.getElementById('engine-hp-fill');
            if(hpBar) { hpBar.style.width = Math.max(0, window.st.hp) + "%"; hpBar.style.background = window.st.hp > 20 ? 'var(--good)' : 'var(--miss)'; }
        } catch(e) {}
    }

    // =======================================================
    // 🌟 MOTOR VISUAL ULTRA-REALISTA (OSU! DEFAULT) 🌟
    // =======================================================
    function drawOsuHitCircle(x, y, r, color, comboText, alphaMultiplier) {
        ctx.globalAlpha = alphaMultiplier;
        
        if (hasCustomOsk) {
            if(loadedSkin.hitcircle) ctx.drawImage(loadedSkin.hitcircle, x - r, y - r, r*2, r*2);
            if(loadedSkin.hitcircleoverlay) ctx.drawImage(loadedSkin.hitcircleoverlay, x - r, y - r, r*2, r*2);
            if (comboText !== "") {
                ctx.fillStyle = 'white'; ctx.font = `bold ${r * 0.8}px sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(comboText, x, y + (r * 0.1));
            }
        } else {
            // 1. Sombra exterior
            ctx.beginPath(); ctx.arc(x, y + (3 * scale), r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();

            // 2. Anillo Blanco Grueso
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();

            // 3. Relleno con el color de la nota
            ctx.beginPath(); ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();

            // 4. Efecto Burbuja / Shine 
            const shine = ctx.createLinearGradient(x, y - r, x, y + (r * 0.5));
            shine.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            shine.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
            shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.beginPath(); ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
            ctx.fillStyle = shine; ctx.fill();

            // 5. Contorno interior sutil
            ctx.beginPath(); ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; ctx.lineWidth = 2 * scale; ctx.stroke();

            // 6. Número del Combo
            if (comboText !== "") {
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.lineWidth = 3 * scale;
                ctx.font = `bold ${r * 0.85}px "Segoe UI", Arial, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.strokeText(comboText, x, y + (r * 0.05));
                ctx.fillText(comboText, x, y + (r * 0.05));
            }
        }
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
        
        while(window.st.nextNote < map.length && map[window.st.nextNote].t - now <= preempt) {
            window.st.spawned.push(map[window.st.nextNote]);
            window.st.nextNote++;
        }
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if(bgLoaded) {
            ctx.globalAlpha = (window.cfg && window.cfg.bgEffects === false) ? 0.05 : 0.2; 
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
            for(let i=1; i<cursorTrail.length; i++) { ctx.lineTo(cursorTrail[i].x, cursorTrail[i].y); cursorTrail[i].life -= 0.08; }
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)'; ctx.lineWidth = 6; ctx.stroke();
            cursorTrail = cursorTrail.filter(t => t.life > 0);
        }

        for(let i = window.st.spawned.length - 1; i >= 0; i--) {
            const circle = window.st.spawned[i];
            const timeDiff = circle.t - now;

            if (timeDiff < -150 && !circle.active) {
                circle.missed = true; window.st.stats.m++; window.st.hp -= 10; window.st.cmb = 0; window.st.fcStatus = "CLEAR";
                showJudgment("MISS", "#F9393F", offsetX + (circle.x * scale), offsetY + (circle.y * scale));
                window.st.spawned.splice(i, 1);
                updateHUD(); checkDeath(); continue;
            }

            const screenX = offsetX + (circle.x * scale); 
            const screenY = offsetY + (circle.y * scale);
            const scaledRadius = radius * scale;
            
            let alpha = 1;
            if (!circle.active) {
                alpha = Math.min(1, 1 - (timeDiff / preempt));
                if (alpha < 0) alpha = 0;
            }
            
            ctx.globalAlpha = alpha;
            let drawColor = activeSkin && activeSkin.fixed ? activeSkin.color : circle.color;

            // 1️⃣ DIBUJAR SLIDERS
            if (circle.type === 'slider') {
                const endX = offsetX + (circle.endX * scale); 
                const endY = offsetY + (circle.endY * scale);

                // A) Borde Exterior (Blanco)
                ctx.beginPath(); ctx.moveTo(screenX, screenY); ctx.lineTo(endX, endY);
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.lineWidth = scaledRadius * 2; 
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; 
                ctx.stroke();

                // B) Interior Oscuro
                ctx.beginPath(); ctx.moveTo(screenX, screenY); ctx.lineTo(endX, endY);
                ctx.lineWidth = scaledRadius * 2 - (6 * scale); 
                ctx.strokeStyle = 'rgba(30, 30, 35, 0.9)'; 
                ctx.stroke();

                // C) Cola
                drawOsuHitCircle(endX, endY, scaledRadius, drawColor, "", alpha);

                // D) Lógica de movimiento
                if (circle.active) {
                    let elapsed = now - circle.t; let duration = circle.endTime - circle.t; let timePerSlide = duration / circle.slides;
                    let cycle = Math.floor(elapsed / timePerSlide); let p = (elapsed % timePerSlide) / timePerSlide;
                    if (cycle % 2 === 1) p = 1 - p; 

                    let curX = screenX + (endX - screenX) * p; 
                    let curY = screenY + (endY - screenY) * p;

                    ctx.beginPath(); ctx.arc(curX, curY, scaledRadius * 0.9, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffaa00'; ctx.fill(); 
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * scale; ctx.stroke();

                    ctx.beginPath(); ctx.arc(curX, curY, scaledRadius * 1.8, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2 * scale; ctx.stroke();

                    let dist = Math.hypot((window.mouseX||0) - curX, (window.mouseY||0) - curY);
                    if (window.isPointerDown && dist < scaledRadius * 2.5) circle.tracking = true;
                    else { circle.tracking = false; if (!circle.broken) { circle.broken = true; window.st.cmb = 0; } }

                    if (now >= circle.endTime) {
                        if (!circle.broken) { window.st.sc += 300; window.st.cmb++; window.st.stats.s++; showJudgment("SICK!!", "#00FFFF", curX, curY); spawnRipple(curX, curY, "#00FFFF"); } 
                        else { window.st.sc += 50; window.st.stats.b++; showJudgment("BAD", "#FFD700", curX, curY); }
                        updateHUD(); window.st.spawned.splice(i, 1); continue;
                    }
                }
            }

            // 2️⃣ DIBUJAR CABEZA / CIRCULO NORMAL
            if (!circle.active && !circle.missed) {
                drawOsuHitCircle(screenX, screenY, scaledRadius, drawColor, circle.combo, alpha);

                const approachRatio = Math.max(1, timeDiff / preempt * 3 + 1);
                ctx.globalAlpha = alpha;
                if (hasCustomOsk && loadedSkin.approachcircle) {
                    const appSize = scaledRadius * 2 * approachRatio;
                    ctx.drawImage(loadedSkin.approachcircle, screenX - appSize/2, screenY - appSize/2, appSize, appSize);
                } else {
                    ctx.beginPath(); ctx.arc(screenX, screenY, scaledRadius * approachRatio, 0, Math.PI * 2);
                    ctx.strokeStyle = drawColor; ctx.lineWidth = 4 * scale; ctx.stroke();
                }
            }
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
            if(hasCustomOsk && loadedSkin.cursor) {
                const curSize = 40 * scale;
                ctx.drawImage(loadedSkin.cursor, window.mouseX - curSize/2, window.mouseY - curSize/2, curSize, curSize);
            } else {
                ctx.beginPath(); ctx.arc(window.mouseX, window.mouseY, 15 * scale, 0, Math.PI*2);
                ctx.fillStyle = '#ff66aa'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 3 * scale; ctx.stroke();
            }
        }

        window.st.animId = requestAnimationFrame(draw);
    }
    
    function checkDeath() { if(window.st.hp <= 0 && isRunning) { window.st.hp = 0; endEngine(true); } }

    function handleHit(clientX, clientY) {
        if(!isRunning || window.st.paused) return;
        const now = (window.st.ctx.currentTime - window.st.t0) * 1000;
        
        let targetCircle = null; let targetIdx = -1;
        for(let i=0; i<window.st.spawned.length; i++) {
            const circle = window.st.spawned[i];
            if(!circle.clicked && !circle.missed && !circle.active) {
                const screenX = offsetX + (circle.x * scale);
                const screenY = offsetY + (circle.y * scale);
                if (Math.hypot(clientX - screenX, clientY - screenY) <= radius * scale * 1.5) {
                    targetCircle = circle; targetIdx = i; break; 
                }
            }
        }

        if(targetCircle) {
            const diff = Math.abs(targetCircle.t - now);
            targetCircle.clicked = true;
            
            let points = 50, txt = "BAD", color = "#FFD700";
            if (diff < 50) { points=300; txt="SICK!!"; color="#00FFFF"; window.st.stats.s++; }
            else if (diff < 100) { points=100; txt="GOOD"; color="#12FA05"; window.st.stats.g++; if(window.st.fcStatus==="PFC") window.st.fcStatus="GFC"; }
            else if (diff < 150) { points=50; txt="BAD"; color="#FFD700"; window.st.stats.b++; if(window.st.fcStatus!=="CLEAR") window.st.fcStatus="FC"; }
            else { points=0; txt="MISS"; color="#F9393F"; window.st.stats.m++; window.st.fcStatus="CLEAR"; }
            
            if (points > 0) {
                window.st.cmb++; window.st.sc += points * (1 + (window.st.cmb/25));
                window.st.hp = Math.min(100, window.st.hp + 3);
                const sx = offsetX + (targetCircle.x * scale); const sy = offsetY + (targetCircle.y * scale);
                spawnRipple(sx, sy, color);
                showJudgment(txt, color, sx, sy);
                try { if(typeof window.playHit === 'function') window.playHit(); else if(window.hitBuf && window.st.ctx) { const s = window.st.ctx.createBufferSource(); s.buffer = window.hitBuf; s.connect(window.st.ctx.destination); s.start(0); } } catch(e){}
                
                if (targetCircle.type === 'slider') { targetCircle.active = true; return; }
            } else { 
                window.st.cmb = 0; window.st.hp -= 10; showJudgment(txt, color, offsetX + targetCircle.x*scale, offsetY + targetCircle.y*scale); 
                try { if(typeof window.playMiss === 'function') window.playMiss(); } catch(e){}
            }
            
            if (targetCircle.type !== 'slider' || points === 0) window.st.spawned.splice(targetIdx, 1);
            updateHUD(); checkDeath();
        }
    }

    window.st.mouseMoveHandler = (e) => { window.mouseX = e.clientX; window.mouseY = e.clientY; };
    window.st.pointerDownHandler = (e) => { window.isPointerDown = true; window.mouseX = e.clientX; window.mouseY = e.clientY; handleHit(e.clientX, e.clientY); };
    window.st.pointerUpHandler = () => { window.isPointerDown = false; };
    window.st.keyHitHandler = (e) => {
        if(e.key === "Escape" && isRunning) { e.preventDefault(); e.stopPropagation(); window.toggleEnginePause(); return; }
        if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') { window.isPointerDown = true; handleHit(window.mouseX || canvas.width/2, window.mouseY || canvas.height/2); }
    };
    window.st.keyUpHandler = (e) => { if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'x') window.isPointerDown = false; };
    window.st.resizeHandler = resize;

    window.addEventListener('resize', window.st.resizeHandler);
    window.addEventListener('mousemove', window.st.mouseMoveHandler);
    canvas.addEventListener('pointerdown', window.st.pointerDownHandler);
    canvas.addEventListener('pointerup', window.st.pointerUpHandler);
    window.addEventListener('keydown', window.st.keyHitHandler, {capture: true});
    window.addEventListener('keyup', window.st.keyUpHandler, {capture: true});

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
        if(window.st.ctx && window.st.ctx.state === 'suspended') window.st.ctx.resume();
    };

    function endEngine(died) {
        if(!isRunning) return; 
        isRunning = false; window.st.act = false;
        cancelAnimationFrame(window.st.animId);
        try{ window.st.src.stop(); window.st.src.disconnect(); }catch(e){}
        
        window.removeEventListener('resize', window.st.resizeHandler);
        window.removeEventListener('mousemove', window.st.mouseMoveHandler);
        canvas.removeEventListener('pointerdown', window.st.pointerDownHandler);
        canvas.removeEventListener('pointerup', window.st.pointerUpHandler);
        window.removeEventListener('keydown', window.st.keyHitHandler, {capture: true});
        window.removeEventListener('keyup', window.st.keyUpHandler, {capture: true});

        if(canvas) canvas.style.display = 'none'; 
        if(uiLayer) uiLayer.remove();
        if(window.isMultiplayer) return; 

        if (window.isTestingMap && typeof window.openEditor === 'function' && window.curSongData) {
            window.isTestingMap = false; 
            window.openEditor(window.curSongData, window.keys || 4, 'standard');
            return;
        }
        
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
                    <h2 class="modal-neon-title" style="color:var(--gold);">🏆 RESULTADOS OSU! STD</h2>
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
