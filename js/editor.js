/* ==========================================================
   CREATOR STUDIO PRO V6 - OSU! STANDARD 2D FIELD INTEGRATION
   ========================================================== */

window.edMap = [];
window.isEditing = false;
window.edK = 4;
window.edMode = 'mania'; 
window.edAudio = null;

// Configuraciones del Editor
window.edSnap = 50; 
window.edDragNote = null; 
window.edMechanics = []; 
window.edBrush = 'tap'; // Pincel por defecto
window.edActiveCustomFX = null;

window.openEditor = async function(songData, keys = 4, mode = 'mania') {
    if(!songData || !songData.id) return window.notify("Error: Canción inválida para editar", "error");
    
    window.edK = keys;
    window.edMode = mode;
    window.curSongData = songData; 
    window.edMechanics = songData.mechanics || [];
    
    // 🚨 FIX MAESTRO: Diferenciar el modo de guardado para evitar bug de 1K
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
    initEditorGrid();
    drawEditorGrid();
    
    window.notify("Studio Listo. Selecciona tu pincel en las herramientas.", "success");
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
                    <option value="tap">🟦 Nota Normal</option>
                    <option value="mine">💣 Mina (Daño)</option>
                    <option value="dodge">🛑 Dodge (Esquivar)</option>
                    <option value="fx_flash">🔦 FX: Flashlight</option>
                    <option value="custom_fx">✨ FX Custom</option>
                </select>
            </div>

            <button class="action" style="background:#ff66aa; color:black; padding:10px;" onclick="openAutoMapModal()">🤖 AUTO-MAPEO IA</button>
            <button class="action" style="background:#00ffff; color:black; padding:10px;" onclick="openCustomMechanicCreator()">⚙️ CREAR FX CUSTOM</button>
            <button class="action" style="background:#444; color:white; padding:10px;" onclick="testMap()">▶️ PROBAR MAPA</button>
        </div>
    `;
    sidebar.insertAdjacentHTML('beforeend', html);
}

function initEditorGrid() {
    const grid = document.getElementById('ed-grid');
    grid.innerHTML = '';
    
    // 🚨 TRANSFORMACIÓN A MODO OSU STANDARD (CAJA 2D) 🚨
    if (window.edMode === 'standard') {
        grid.style.width = '512px';
        grid.style.height = '384px';
        grid.style.position = 'sticky';
        grid.style.top = '50px';
        grid.style.background = '#111';
        grid.style.border = '2px solid #00ffff';
        grid.style.margin = '0 auto';
        grid.style.overflow = 'hidden';
        grid.style.cursor = 'crosshair';
        
        const standardAction = (e) => {
            if(e.type === 'mousedown' && e.button !== 0) return; 
            const rect = grid.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Coordenadas relativas a 512x384
            let x = Math.round((clientX - rect.left) * (512 / rect.width));
            let y = Math.round((clientY - rect.top) * (384 / rect.height));
            
            let timeMs = window.edAudio ? Math.round(window.edAudio.currentTime * 1000) : 0;
            
            window.edMap.push({ t: timeMs, type: window.edBrush || 'circle', x: x, y: y });
            window.edMap.sort((a,b) => a.t - b.t);
            drawEditorGrid();
        };
        
        grid.onmousedown = standardAction;
        grid.ontouchstart = standardAction;
        grid.onmousemove = null; window.onmouseup = null;

    } else {
        // === MODO MANIA / TAIKO NORMAL (CARRILES) ===
        grid.style.width = (window.edK * 80) + 'px'; 
        grid.style.height = 'auto';
        grid.style.position = 'relative';
        grid.style.top = '0';
        grid.style.border = 'none';
        grid.style.margin = '0';
        grid.style.overflow = 'visible';
        
        for(let i=0; i<window.edK; i++) {
            const lane = document.createElement('div');
            lane.className = 'ed-lane';
            lane.style.left = (i * 80) + 'px';
            if(window.edMode === 'taiko') lane.style.background = i === 0 ? 'rgba(249, 57, 63, 0.1)' : 'rgba(68, 185, 255, 0.1)'; 
            grid.appendChild(lane);
        }

        const getPointerPos = (e) => {
            const rect = grid.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const zoom = document.getElementById('ed-zoom').value;
            
            return {
                t: Math.round((clientY - rect.top) / (zoom / 100) / window.edSnap) * window.edSnap,
                l: Math.floor((clientX - rect.left) / 80)
            };
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

            if(existingIdx !== -1) {
                window.edMap.splice(existingIdx, 1);
                drawEditorGrid();
                return;
            }
            
            let finalType = window.edBrush || 'tap';
            window.edDragNote = { t: pos.t, l: pos.l, type: finalType, h: false, dur: 0, customData: window.edActiveCustomFX || null };
            window.edMap.push(window.edDragNote);
            drawEditorGrid();
        };

        const moveAction = (e) => {
            if(!window.edDragNote || window.edMode !== 'mania') return; 
            e.preventDefault(); 
            const pos = getPointerPos(e);
            let isHoldable = (window.edDragNote.type === 'tap' || window.edDragNote.type === 'mine' || window.edDragNote.type === 'dodge' || window.edDragNote.type === 'hold');
            if (isHoldable && pos.t > window.edDragNote.t + 50) {
                window.edDragNote.h = true; window.edDragNote.type = 'hold'; window.edDragNote.dur = pos.t - window.edDragNote.t;
                drawEditorGrid();
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
        grid.ontouchstart = startAction; grid.ontouchmove = moveAction; window.ontouchend = endAction;
    }
}

// === EL DIBUJADOR DE NOTAS UNIVERSAL ===
window.drawEditorGrid = function() {
    const grid = document.getElementById('ed-grid');
    
    // 🚨 DIBUJADOR PARA STANDARD 2D 🚨
    if (window.edMode === 'standard') {
        grid.innerHTML = '';
        let currentTime = window.edAudio ? window.edAudio.currentTime * 1000 : 0;
        
        window.edMap.forEach((n, idx) => {
            let timeDiff = n.t - currentTime;
            
            // Solo mostramos las notas que están en un rango de 2 segundos para no llenar la caja
            if (timeDiff > -500 && timeDiff < 2000) { 
                const note = document.createElement('div');
                note.className = 'ed-std-note';
                note.style.position = 'absolute';
                note.style.left = (n.x / 512 * 100) + '%';
                note.style.top = (n.y / 384 * 100) + '%';
                note.style.width = '40px'; note.style.height = '40px';
                note.style.transform = 'translate(-50%, -50%) scale(' + (timeDiff > 0 ? 1 + (timeDiff/2000) : 1) + ')';
                note.style.borderRadius = '50%';
                note.style.border = '2px solid white';
                note.style.background = timeDiff > 0 ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 0, 85, 0.8)';
                note.style.display = 'flex'; note.style.justifyContent = 'center'; note.style.alignItems = 'center';
                note.style.cursor = 'pointer';
                note.innerHTML = `<span style="font-size:12px; font-weight:bold;">${idx+1}</span>`;
                
                // Borrar nota si le das clic
                note.onmousedown = (e) => { e.stopPropagation(); window.edMap.splice(idx, 1); drawEditorGrid(); };
                grid.appendChild(note);
            }
        });
        return; // Terminamos aquí si es standard
    }

    // === DIBUJADOR PARA MANIA / TAIKO ===
    const zoom = document.getElementById('ed-zoom').value;
    const duration = window.edAudio.duration || 300;
    grid.style.height = (duration * 1000 * (zoom / 100)) + 'px';
    
    const oldNotes = grid.querySelectorAll('.ed-note');
    oldNotes.forEach(n => n.remove());

    window.edMap.forEach(n => {
        const note = document.createElement('div');
        note.className = 'ed-note';
        note.style.left = (n.l * 80 + 5) + 'px';
        note.style.top = (n.t * (zoom / 100)) + 'px';
        note.style.width = '70px';
        
        let color = getLaneColor(n.l, window.edMode); let iconHTML = '';
        
        if(n.type === 'mine') { color = '#F9393F'; iconHTML = '💣'; }
        else if(n.type === 'dodge') { color = '#00ffff'; iconHTML = '🛑'; }
        else if(n.type === 'fx_flash') { color = '#FFD700'; iconHTML = '🔦'; }
        else if(n.type === 'custom_fx') { color = '#FFD700'; iconHTML = '✨'; }

        note.style.background = color;
        note.style.display = 'flex'; note.style.justifyContent = 'center'; note.style.alignItems = 'center';
        note.innerHTML = `<span style="pointer-events:none;">${iconHTML}</span>`;

        if(n.h && n.dur > 0) {
            note.style.height = (n.dur * (zoom / 100)) + 'px';
            note.style.border = `2px solid ${color}`;
            note.style.background = `linear-gradient(to bottom, ${color} 80%, transparent 100%)`;
            note.style.opacity = '0.8'; note.style.borderRadius = '5px';
            note.style.transform = 'translateY(0)'; note.style.transformOrigin = 'top center';
            note.style.alignItems = 'flex-start'; note.style.paddingTop = '5px'; note.style.fontSize = '1.5rem';
        } else {
            note.style.height = '20px';
            note.style.borderRadius = window.edMode === 'taiko' ? '50%' : '5px';
            note.style.transform = 'translateY(-50%)'; note.style.fontSize = '0.9rem';
        }
        grid.appendChild(note);
    });
};

function getLaneColor(l, mode) {
    if(mode === 'taiko') return l === 0 ? '#f95555' : '#44b9ff'; 
    if(mode === 'catch') return '#12FA05'; 
    const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#F9393F', '#a200ff'];
    return colors[l % colors.length];
}

// === CREADOR DE MECÁNICAS ===
window.openCustomMechanicCreator = function() {
    const html = `
        <div id="mech-creator-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
            <div style="background:#0a0a0a; padding:30px; border-radius:15px; border:2px solid #00ffff; width:500px; box-shadow: 0 0 30px rgba(0,255,255,0.2);">
                <h2 style="color:#00ffff; margin-top:0;">🛠️ CREADOR DE MECÁNICAS</h2>
                <p style="color:#888; font-size:0.9rem;">Crea un efecto visual complejo que se activará cuando la línea de tiempo llegue a la nota.</p>
                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:20px;">
                    <div><label style="color:white; font-size:0.8rem;">Nombre de tu Mecánica</label><input type="text" id="cm-name" class="log-inp" placeholder="Ej: Mundo Invertido"></div>
                    <div><label style="color:white; font-size:0.8rem;">Filtro CSS</label>
                        <select id="cm-filter" class="log-inp" style="background:#111;">
                            <option value="invert(1)">Invertir Colores</option><option value="hue-rotate(90deg)">Glitch de Color (Hue)</option>
                            <option value="blur(5px)">Visión Borrosa (Blur)</option><option value="grayscale(1)">Blanco y Negro</option>
                            <option value="contrast(3)">Alto Contraste Tóxico</option>
                        </select>
                    </div>
                    <div><label style="color:white; font-size:0.8rem;">Duración (en Milisegundos)</label><input type="number" id="cm-dur" class="log-inp" value="2000" min="100" max="10000"></div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="action" onclick="saveCustomMechanic()">💾 GUARDAR</button>
                    <button class="action secondary" onclick="document.getElementById('mech-creator-modal').remove()">CANCELAR</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveCustomMechanic = function() {
    const name = document.getElementById('cm-name').value || "Custom FX";
    const filter = document.getElementById('cm-filter').value;
    const dur = parseInt(document.getElementById('cm-dur').value);
    window.edActiveCustomFX = { name, filter, dur };
    const brushSelect = document.querySelector('#pro-tools-container select:last-of-type');
    if(brushSelect) brushSelect.value = 'custom_fx'; window.edBrush = 'custom_fx';
    window.notify(`Mecánica "${name}" lista.`, "success");
    document.getElementById('mech-creator-modal').remove();
};

window.openAutoMapModal = function() { /* Igual */ };
window.runAutoMap = async function() { /* Igual */ };

window.calculateStarRating = function(notes, durationMs) {
    if(!notes || notes.length === 0) return 0;
    const durationSecs = durationMs / 1000; const notesPerSecond = notes.length / durationSecs;
    let stars = notesPerSecond * 0.8;
    const holds = notes.filter(n => n.h).length; stars += (holds / notes.length) * 1.5;
    return Math.max(1, Math.min(10, stars)).toFixed(1);
};

// 🚨 FIX MAESTRO DE GUARDADO: EVITAR EL BUG "1K" 🚨
window.saveEditorMap = async function() {
    if(!window.curSongData || !window.curSongData.id) return window.notify("Error: No hay ID de canción.", "error");
    window.notify("Guardando en la nube...", "info");
    
    // Si es standard, guardar como "notes_standard". Si es mania/catch, como notes_mania_4k
    const mapKey = window.edMode === 'standard' ? 'notes_standard' : `notes_${window.edMode}_${window.edK}k`; 
    
    let updateData = { mechanics: window.edMechanics || [] };
    updateData[mapKey] = window.edMap;
    
    const durationMs = (window.edAudio.duration || 120) * 1000;
    const calculatedStars = window.calculateStarRating(window.edMap, durationMs);
    updateData[`stars_${window.edMode}_${window.edK}k`] = calculatedStars;
    
    // Fallback original para Mania 4K
    if(window.edMode === 'mania' && window.edK === 4) {
        updateData.notes = window.edMap;
        updateData.starRating = calculatedStars; 
    }

    try {
        await window.db.collection("globalSongs").doc(window.curSongData.id).update(updateData);
        window.notify(`¡Guardado Exitoso! Dif: ⭐ ${calculatedStars}`, "success");
    } catch(e) { window.notify("Error Firebase: " + e.message, "error"); }
};

// 🚨 FIX MAESTRO: RUTEO CORRECTO AL PROBAR MAPAS 🚨
window.testMap = function() {
    window.closeEditor();
    window.curSongData.raw = { ...window.curSongData };
    
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
    const zoom = document.getElementById('ed-zoom').value;
    const playhead = document.getElementById('ed-playhead');
    
    if (window.edMode === 'standard' && !window.edAudio.paused) {
        window.drawEditorGrid(); // Dibuja las notas que pasan en Standard
    } 
    else if (playhead && window.edAudio && window.edMode !== 'standard') {
        const pos = (window.edAudio.currentTime * 1000) * (zoom / 100);
        playhead.style.top = pos + 'px';
        if(!window.edAudio.paused) document.getElementById('ed-scroll-area').scrollTop = pos - 200;
    }
}, 16);
