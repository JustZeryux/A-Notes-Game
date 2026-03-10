/* ==========================================================
   CREATOR STUDIO PRO V11 - BUGFIXES & PERFECT ALIGNMENT 🎯
   ========================================================== */

window.edMap = [];
window.isEditing = false;
window.edK = 4;
window.edMode = 'mania'; 
window.edAudio = null;

window.edSnap = 50; 
window.edDragNote = null; 
window.edMechanics = []; 
window.edBrush = 'tap'; 
window.creatingStdSlider = null; 
window.edGhostPoint = null; 

window.openEditor = async function(songData, keys = 4, mode = 'mania') {
    if(!songData || !songData.id) return window.notify("Error: Canción inválida para editar", "error");
    
    window.edK = keys;
    window.edMode = mode;
    window.curSongData = songData; 
    window.edMechanics = songData.mechanics || [];
    
    let mapKey = mode === 'standard' ? 'notes_standard' : `notes_${mode}_${keys}k`; 
    window.edMap = Array.isArray(songData[mapKey]) ? [...songData[mapKey]] : (Array.isArray(songData.notes) ? [...songData.notes] : []);
    
    const layer = document.getElementById('editor-layer');
    layer.style.display = 'flex';
    window.isEditing = true;

    const icons = { mania: '🎹', taiko: '🥁', catch: '🍎', standard: '🎯' };
    document.getElementById('ed-title').innerText = `${icons[mode] || '🎹'} EDITANDO: ${songData.title} (${mode.toUpperCase()})`;
    
    window.edAudio = document.getElementById('ed-audio');
    window.edAudio.src = songData.audioURL || songData.url;
    window.edAudio.load();

    injectProTools(); 
    injectTimeline(); 
    initEditorGrid();
    drawEditorGrid();
    
    if (mode === 'standard') window.notify("NUEVO: Para Sliders, haz clic punto por punto. Clic Derecho para terminar.", "success");
    else window.notify("Studio Listo. Selecciona tu pincel.", "success");
};

function injectProTools() {
    if(document.getElementById('pro-tools-container')) return;
    const sidebar = document.querySelector('#editor-layer > div:nth-child(2) > div:nth-child(1)');
    const html = `
        <div id="pro-tools-container" style="display:flex; flex-direction:column; gap:15px; margin-top:20px; border-top:1px solid #333; padding-top:20px;">
            <div style="color:var(--gold); font-weight:bold;">⚡ HERRAMIENTAS</div>
            <div>
                <div style="font-size:0.8rem; color:#aaa; margin-bottom:5px;">Imán (Snap)</div>
                <select class="set-input" onchange="window.edSnap = parseInt(this.value)">
                    <option value="25">Rápido (25ms)</option>
                    <option value="50" selected>Normal (50ms)</option>
                    <option value="100">Lento (100ms)</option>
                </select>
            </div>
            <div style="background:#222; padding:10px; border-radius:8px;">
                <div style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">Pincel Actual</div>
                <select class="set-input" style="background:#000; color:#00ffff; border-color:#00ffff; font-size:0.9rem;" onchange="window.edBrush = this.value">
                    <option value="tap">🟦 Nota Normal (Círculo)</option>
                    <option value="slider">🎯 Slider (Clic punto por punto)</option>
                    <option value="mine">💣 Mina (Daño)</option>
                    <option value="dodge">🛑 Dodge (Esquivar)</option>
                    <option value="custom_fx">✨ FX Custom</option>
                </select>
            </div>
            <button class="action" style="background:#444; color:white; padding:10px;" onclick="testMap()">▶️ PROBAR MAPA</button>
        </div>`;
    sidebar.insertAdjacentHTML('beforeend', html);
}

function injectTimeline() {
    let mainArea = document.querySelector('#editor-layer > div:nth-child(2) > div:nth-child(2)');
    if (document.getElementById('ed-timeline-box')) return;

    let tl = document.createElement('div');
    tl.id = 'ed-timeline-box';
    tl.style.cssText = "height: 60px; background: #111; border-top: 2px solid #333; display: flex; align-items: center; padding: 0 20px; gap: 15px;";
    tl.innerHTML = `
        <button onclick="window.edAudio.paused ? window.edAudio.play() : window.edAudio.pause()" style="background:var(--accent); border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">⏯️ PLAY</button>
        <span id="ed-time-display" style="color:#00ffff; font-family:monospace; font-size:1.2rem; font-weight:bold;">0.000s</span>
        <input type="range" id="ed-time-slider" min="0" max="100" value="0" step="0.001" style="flex:1; cursor:pointer;">
    `;
    mainArea.appendChild(tl);

    const slider = document.getElementById('ed-time-slider');
    slider.addEventListener('input', (e) => {
        if(window.edAudio && window.edAudio.duration) {
            window.edAudio.currentTime = (e.target.value / 100) * window.edAudio.duration;
            drawEditorGrid();
        }
    });
}

function initEditorGrid() {
    const grid = document.getElementById('ed-grid');
    grid.innerHTML = '';
    
    if (window.edMode === 'standard') {
        grid.style.width = '512px'; grid.style.height = '384px';
        grid.style.position = 'absolute'; grid.style.top = '50%'; grid.style.left = '50%';
        grid.style.transform = 'translate(-50%, -50%)';
        grid.style.background = '#0a0a0a'; grid.style.border = '2px solid #444';
        grid.style.overflow = 'hidden'; grid.style.cursor = 'crosshair';
        grid.oncontextmenu = e => e.preventDefault(); 
        
        grid.addEventListener('wheel', (e) => {
            e.preventDefault();
            if(!window.edAudio || isNaN(window.edAudio.duration)) return;
            const dir = e.deltaY > 0 ? 1 : -1; const shiftSecs = (window.edSnap / 1000) * dir;
            window.edAudio.currentTime = Math.max(0, Math.min(window.edAudio.duration, window.edAudio.currentTime + shiftSecs));
            drawEditorGrid();
        });

        const getStdCoords = (e) => {
            const rect = grid.getBoundingClientRect();
            let x = Math.round((e.clientX - rect.left) * (512 / rect.width));
            let y = Math.round((e.clientY - rect.top) * (384 / rect.height));
            return { x: Math.max(0, Math.min(512, x)), y: Math.max(0, Math.min(384, y)) };
        };

        grid.onmousedown = (e) => {
            const pos = getStdCoords(e);
            let timeMs = window.edAudio ? Math.round(window.edAudio.currentTime * 1000) : 0;
            
            if (e.button === 2) { 
                if (window.creatingStdSlider) {
                    if (window.creatingStdSlider.curvePoints.length < 2) {
                        window.creatingStdSlider.type = 'circle'; 
                        delete window.creatingStdSlider.curvePoints;
                    } else {
                        let pts = window.creatingStdSlider.curvePoints;
                        let dist = 0;
                        for(let i=1; i<pts.length; i++) dist += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
                        window.creatingStdSlider.endTime = window.creatingStdSlider.t + Math.round(dist * 2.5);
                        window.creatingStdSlider.endX = pts[pts.length-1].x;
                        window.creatingStdSlider.endY = pts[pts.length-1].y;
                        window.creatingStdSlider.slides = 1;
                    }
                    window.creatingStdSlider = null;
                    window.edGhostPoint = null;
                    window.edMap.sort((a,b) => a.t - b.t);
                    drawEditorGrid();
                    return;
                }

                let closestIdx = -1; let minDist = Infinity;
                window.edMap.forEach((n, i) => {
                    let dist = Math.hypot(n.x - pos.x, n.y - pos.y);
                    if (dist < 30 && Math.abs(n.t - timeMs) < 1500 && dist < minDist) { minDist = dist; closestIdx = i; }
                });
                if(closestIdx !== -1) { window.edMap.splice(closestIdx, 1); drawEditorGrid(); }
                return;
            }

            if (e.button !== 0) return; 
            if (window.edBrush === 'slider') {
                if (!window.creatingStdSlider) {
                    window.creatingStdSlider = { type: 'slider', x: pos.x, y: pos.y, t: timeMs, curvePoints: [{x: pos.x, y: pos.y}], endTime: timeMs + 100 };
                    window.edMap.push(window.creatingStdSlider);
                } else {
                    window.creatingStdSlider.curvePoints.push({x: pos.x, y: pos.y});
                }
                drawEditorGrid();
            } else {
                if(window.creatingStdSlider) return; 
                window.edMap.push({ type: window.edBrush, x: pos.x, y: pos.y, t: timeMs });
                window.edMap.sort((a,b) => a.t - b.t);
                drawEditorGrid();
            }
        };
        grid.onmousemove = (e) => { if (!window.creatingStdSlider) return; window.edGhostPoint = getStdCoords(e); drawEditorGrid(); };

    } else {
        grid.style.width = (window.edK * 80) + 'px'; 
        grid.style.height = 'auto'; grid.style.position = 'relative'; grid.style.top = '0'; grid.style.transform = 'none'; grid.style.margin = '0';
        
        for(let i=0; i<window.edK; i++) {
            const lane = document.createElement('div');
            lane.className = 'ed-lane'; lane.style.left = (i * 80) + 'px';
            if(window.edMode === 'taiko') lane.style.background = i === 0 ? 'rgba(249, 57, 63, 0.1)' : 'rgba(68, 185, 255, 0.1)'; 
            grid.appendChild(lane);
        }

        const getPointerPos = (e) => {
            const rect = grid.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const zoom = document.getElementById('ed-zoom').value;
            return { t: Math.round((clientY - rect.top) / (zoom / 100) / window.edSnap) * window.edSnap, l: Math.floor((clientX - rect.left) / 80) };
        };

        const startAction = (e) => {
            if(e.type === 'mousedown' && e.button !== 0) return; 
            const pos = getPointerPos(e);
            if(pos.l < 0 || pos.l >= window.edK) return;

            const existingIdx = window.edMap.findIndex(n => {
                if (n.l !== pos.l) return false;
                let endT = n.t + (n.dur || 0); 
                return pos.t >= (n.t - window.edSnap) && pos.t <= (endT + window.edSnap);
            });

            if(existingIdx !== -1) { window.edMap.splice(existingIdx, 1); drawEditorGrid(); return; }
            
            let finalType = window.edBrush || 'tap';
            window.edDragNote = { t: pos.t, l: pos.l, type: finalType, h: false, dur: 0 };
            window.edMap.push(window.edDragNote); drawEditorGrid();
        };

        const moveAction = (e) => {
            if(!window.edDragNote || window.edMode !== 'mania') return; 
            e.preventDefault(); 
            const pos = getPointerPos(e);
            let isHoldable = (window.edDragNote.type === 'tap' || window.edDragNote.type === 'mine' || window.edDragNote.type === 'dodge' || window.edDragNote.type === 'hold');
            if (isHoldable && pos.t > window.edDragNote.t + 50) {
                window.edDragNote.h = true; window.edDragNote.type = 'hold'; window.edDragNote.dur = pos.t - window.edDragNote.t; drawEditorGrid();
            }
        };

        const endAction = () => {
            if(window.edDragNote) {
                if(window.edDragNote.h && window.edDragNote.dur < 50) {
                    window.edDragNote.h = false; window.edDragNote.type = window.edBrush === 'tap' ? 'tap' : window.edBrush; window.edDragNote.dur = 0;
                }
                window.edDragNote = null; drawEditorGrid();
            }
        };

        grid.onmousedown = startAction; grid.onmousemove = moveAction; window.onmouseup = endAction;
    }
}

window.drawEditorGrid = function() {
    const grid = document.getElementById('ed-grid');
    let currentTime = window.edAudio ? window.edAudio.currentTime * 1000 : 0;
    
    const timeDisp = document.getElementById('ed-time-display');
    const timeSlid = document.getElementById('ed-time-slider');
    if (timeDisp && window.edAudio) {
        timeDisp.innerText = (window.edAudio.currentTime).toFixed(3) + "s";
        if(window.edAudio.duration) timeSlid.value = (window.edAudio.currentTime / window.edAudio.duration) * 100;
    }

    if (window.edMode === 'standard') {
        let svgContent = '';
        window.edMap.forEach((n, idx) => {
            let timeDiff = n.t - currentTime;
            let isSliderActive = n.type === 'slider' && currentTime >= n.t && currentTime <= (n.endTime || n.t);
            
            if ((timeDiff > -1500 && timeDiff < 2000) || isSliderActive || n === window.creatingStdSlider) { 
                let alpha = (timeDiff < 0 && !isSliderActive && n !== window.creatingStdSlider) ? 0.3 : 1;
                let color = n.type === 'mine' ? '#F9393F' : (n.type==='dodge' ? '#00ffff' : '#ff66aa');

                if (n.type === 'slider' && n.curvePoints) {
                    let pts = [...n.curvePoints];
                    if (n === window.creatingStdSlider && window.edGhostPoint) pts.push(window.edGhostPoint);
                    if (pts.length > 1) {
                        let pathD = `M ${pts[0].x} ${pts[0].y} `;
                        for(let j=1; j<pts.length; j++) pathD += `L ${pts[j].x} ${pts[j].y} `;
                        let endX = pts[pts.length-1].x; let endY = pts[pts.length-1].y;
                        svgContent += `<path d="${pathD}" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="60" stroke-linecap="round" stroke-linejoin="round" />`;
                        svgContent += `<path d="${pathD}" fill="none" stroke="rgba(30,30,35,0.9)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" />`;
                        svgContent += `<circle cx="${endX}" cy="${endY}" r="28" fill="${color}" fill-opacity="${alpha*0.5}" stroke="white" stroke-width="3" />`;
                    }
                }
                svgContent += `<circle cx="${n.x}" cy="${n.y}" r="28" fill="${color}" fill-opacity="${alpha}" stroke="white" stroke-width="3" />`;
                svgContent += `<text x="${n.x}" y="${n.y}" fill="white" font-size="20" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="central" opacity="${alpha}">${idx+1}</text>`;
            }
        });
        grid.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 512 384" style="pointer-events:none; position:absolute; top:0; left:0;">${svgContent}</svg>`;
        return; 
    }

    const zoom = document.getElementById('ed-zoom').value;
    const duration = window.edAudio.duration || 300;
    grid.style.height = (duration * 1000 * (zoom / 100)) + 'px';
    const oldNotes = grid.querySelectorAll('.ed-note');
    oldNotes.forEach(n => n.remove());

    window.edMap.forEach(n => {
        const note = document.createElement('div'); note.className = 'ed-note';
        note.style.left = (n.l * 80 + 5) + 'px'; note.style.top = (n.t * (zoom / 100)) + 'px'; note.style.width = '70px';
        let color = '#00ffff'; let iconHTML = '';
        if(n.type === 'mine') { color = '#F9393F'; iconHTML = '💣'; }
        else if(n.type === 'dodge') { color = '#00ffff'; iconHTML = '🛑'; }
        else if(n.type === 'fx_flash') { color = '#FFD700'; iconHTML = '🔦'; }

        note.style.background = color; note.style.display = 'flex'; note.style.justifyContent = 'center'; note.style.alignItems = 'center';
        note.innerHTML = `<span style="pointer-events:none;">${iconHTML}</span>`;

        if(n.h && n.dur > 0) {
            note.style.height = (n.dur * (zoom / 100)) + 'px'; note.style.border = `2px solid ${color}`;
            note.style.background = `linear-gradient(to bottom, ${color} 80%, transparent 100%)`;
            note.style.opacity = '0.8'; note.style.borderRadius = '5px'; note.style.transform = 'translateY(0)'; note.style.transformOrigin = 'top center'; note.style.alignItems = 'flex-start'; note.style.paddingTop = '5px'; note.style.fontSize = '1.5rem';
        } else { note.style.height = '20px'; note.style.borderRadius = '5px'; note.style.transform = 'translateY(-50%)'; }
        grid.appendChild(note);
    });
};

window.calculateStarRating = function(notes, durationMs) {
    if(!notes || notes.length === 0) return 0;
    const durationSecs = durationMs / 1000; let stars = (notes.length / durationSecs) * 0.8;
    return Math.max(1, Math.min(10, stars)).toFixed(1);
};

window.saveEditorMap = async function() {
    if(!window.curSongData || !window.curSongData.id) return window.notify("Error: No ID", "error");
    window.notify("Guardando...", "info");
    
    window.edMap.sort((a,b) => a.t - b.t);
    const mapKey = window.edMode === 'standard' ? 'notes_standard' : `notes_${window.edMode}_${window.edK}k`; 
    
    // 🚨 FIX MAESTRO: Forza el "originalMode" para que no guarde tus standards como "1K"
    let updateData = {
        originalMode: window.edMode 
    };
    
    updateData[mapKey] = window.edMap;
    updateData[`stars_${window.edMode}_${window.edMode==='standard'?'':window.edK+'k'}`] = window.calculateStarRating(window.edMap, (window.edAudio.duration||120)*1000);
    
    if(window.edMode === 'mania' && window.edK === 4) {
        updateData.notes = window.edMap;
        updateData.starRating = updateData[`stars_${window.edMode}_${window.edK}k`]; 
    }

    try {
        await window.db.collection("globalSongs").doc(window.curSongData.id).update(updateData);
        window.notify("¡Guardado Exitoso!", "success");
    } catch(e) { window.notify("Error Firebase: " + e.message, "error"); }
};

window.testMap = function() {
    window.closeEditor();
    window.curSongData.raw = { ...window.curSongData };
    window.edMap.sort((a,b) => a.t - b.t);
    
    if (window.edMode === 'standard') {
        window.curSongData.raw.notes_standard = window.edMap; 
        window.isTestingMap = true;
        if(typeof startNewEngine === 'function') startNewEngine(window.curSongData);
    } 
    else if(window.edMode === 'taiko') {
        window.curSongData.raw.notes = window.edMap; window.isTestingMap = true;
        if(typeof startTaikoEngine === 'function') startTaikoEngine(window.curSongData);
    }
    else if(window.edMode === 'catch') {
        window.curSongData.raw.notes = window.edMap; window.isTestingMap = true;
        if(typeof startCatchEngine === 'function') startCatchEngine(window.curSongData);
    }
    else { 
        window.curSongData.raw.notes = window.edMap; window.isTestingMap = true;
        window.asegurarModo(window.edK); window.startGame(window.edK); 
    }
};

window.closeEditor = function() {
    document.getElementById('editor-layer').style.display = 'none';
    window.isEditing = false;
    if(window.edAudio) window.edAudio.pause();
};

setInterval(() => {
    if(!window.isEditing || !window.edAudio) return;
    if (window.edMode !== 'standard' && !window.edAudio.paused) {
        const zoom = document.getElementById('ed-zoom').value;
        const playhead = document.getElementById('ed-playhead');
        if(playhead) {
            const pos = (window.edAudio.currentTime * 1000) * (zoom / 100);
            playhead.style.top = pos + 'px';
            // 🚨 FIX: Centra el scroll perfectamente sin desalinearse
            let container = document.getElementById('ed-scroll-area');
            container.scrollTop = pos - (container.clientHeight / 2);
        }
    } else if (window.edMode === 'standard' && !window.edAudio.paused) {
        window.drawEditorGrid();
    }
}, 16);

// =========================================================================
// 🧠 MOTOR DE AUTO-MAPEO INTELIGENTE (ANÁLISIS DE ONDAS)
// =========================================================================

window.clearAllEditorNotes = function() {
    if (!confirm("⚠️ ¿Estás seguro de que quieres borrar TODAS las notas de este mapa?")) return;
    
    // 🚨 FIX: Vaciar el array correcto (edMap, no edNotes fantasma)
    window.edMap.length = 0; 
    
    if (typeof renderEditorNotes === 'function') renderEditorNotes();
    if (typeof updateTimeline === 'function') updateTimeline();
    window.drawEditorGrid();
    
    if(typeof window.notify === 'function') window.notify("🗑️ Mapa limpiado por completo.", "success");
};

window.applyEditorAutoMap = async function() {
    if (window.edMap && window.edMap.length > 0) {
        if (!confirm("⚠️ Esto borrará todas las notas actuales del editor. ¿Estás seguro?")) return;
    }

    if(typeof window.notify === 'function') window.notify("🧠 Analizando audio... Espere.", "info");

    window.edMap.length = 0;

    let diffMult = parseFloat(document.getElementById('auto-map-diff').value) || 2;
    let audioUrl = window.curSongData.audioURL || window.curSongData.url;
    let mode = window.edMode || (window.curSongData && window.curSongData.originalMode) || 'mania';
    let keys = window.edK || 4;

    let refreshEditor = () => {
        window.drawEditorGrid();
        if (typeof window.notify === 'function') window.notify(`✅ Mapa base generado (${window.edMap.length} notas).`, "success");
    };

    let fallbackMathMap = () => {
        if(typeof window.notify === 'function') window.notify("⚠️ Usando mapeo matemático de respaldo.", "warning");
        let bpm = window.curSongData.bpm || 120;
        let rawDuration = window.st.songDuration || window.edAudioDuration;
        let durationMs = (rawDuration && rawDuration > 0) ? (rawDuration * 1000) : 180000; 
        let msPerStep = (60000 / bpm) / diffMult;
        
        for (let t = 3000; t < durationMs; t += msPerStep) {
            if (mode === 'mania') {
                let lane = Math.floor(Math.random() * keys);
                window.edMap.push({ t: Math.floor(t), l: lane, type: 'tap' });
                if (diffMult >= 2 && Math.random() > 0.8) {
                    let extraLane = Math.floor(Math.random() * keys);
                    if(extraLane !== lane) window.edMap.push({ t: Math.floor(t), l: extraLane, type: 'tap' });
                }
            } else if (mode === 'standard' || mode === 'catch') {
                let x = Math.floor(Math.random() * 400) + 56;
                let y = Math.floor(Math.random() * 280) + 52;
                window.edMap.push({ t: Math.floor(t), x: x, y: y, type: 'circle' });
            }
        }
        refreshEditor();
    };

    if (!audioUrl) return fallbackMathMap();

    try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const windowSize = Math.floor(sampleRate * 0.05);
        let energies = []; let sumEnergy = 0;

        for (let i = 0; i < channelData.length; i += windowSize) {
            let energy = 0;
            for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) { energy += Math.abs(channelData[i + j]); }
            energies.push(energy); sumEnergy += energy;
        }

        let avgEnergy = sumEnergy / energies.length;
        let threshold = avgEnergy * (3.5 - (diffMult * 0.3));
        let strongThreshold = threshold * 1.5;
        let minMsBetweenNotes = (60000 / (window.curSongData.bpm || 120)) / diffMult;
        let lastNoteTimeMs = 0;

        for (let i = 0; i < energies.length; i++) {
            if (energies[i] > threshold) {
                let timeMs = (i * windowSize / sampleRate) * 1000;
                if (timeMs > 2000 && (timeMs - lastNoteTimeMs) >= minMsBetweenNotes) {
                    if (mode === 'mania') {
                        let lane = Math.floor(Math.random() * keys);
                        window.edMap.push({ t: Math.floor(timeMs), l: lane, type: 'tap' });
                        if (energies[i] > strongThreshold && diffMult >= 2) {
                            let extraLane = Math.floor(Math.random() * keys);
                            if(extraLane !== lane) window.edMap.push({ t: Math.floor(timeMs), l: extraLane, type: 'tap' });
                        }
                    } else if (mode === 'standard' || mode === 'catch') {
                        let x = Math.floor(Math.random() * 400) + 56;
                        let y = Math.floor(Math.random() * 280) + 52;
                        window.edMap.push({ t: Math.floor(timeMs), x: x, y: y, type: 'circle' });
                    }
                    lastNoteTimeMs = timeMs;
                }
            }
        }
        refreshEditor();
    } catch (error) { fallbackMathMap(); }
};
