/* ==========================================================
   CREATOR STUDIO PRO V5 - FULL UNIFIED EDITOR (FIXED SYNTAX)
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

window.openEditor = async function(songData, keys = 4, mode = 'mania') {
    if(!songData || !songData.id) return window.notify("Error: Canción inválida para editar", "error");
    
    window.edK = keys;
    window.edMode = mode;
    window.curSongData = songData; 
    
    window.edMechanics = songData.mechanics || [];
    const mapKey = `notes_${mode}_${keys}k`; 
    window.edMap = Array.isArray(songData[mapKey]) ? [...songData[mapKey]] : (Array.isArray(songData.notes) ? [...songData.notes] : []);
    
    const layer = document.getElementById('editor-layer');
    layer.style.display = 'flex';
    window.isEditing = true;

    const icons = { mania: '🎹', taiko: '🥁', catch: '🍎' };
    document.getElementById('ed-title').innerText = `${icons[mode]} EDITANDO: ${songData.title}`;
    
    window.edAudio = document.getElementById('ed-audio');
    window.edAudio.src = songData.audioURL || songData.url;
    window.edAudio.load();

    injectProTools(); 
    initEditorGrid();
    drawEditorGrid();
    
    window.notify("Studio Móvil Listo. Toca para poner notas.", "success");
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
                <select class="set-input" style="background:#000; color:#00ffff; border-color:#00ffff;" onchange="window.edBrush = this.value">
                    <option value="tap">🟦 Nota Normal</option>
                    <option value="mine">💣 Mina (Daño)</option>
                    <option value="dodge">🛑 Dodge (Esquivar)</option>
                    <option value="fx_flash">🔦 FX: Flashlight</option>
                    <option value="fx_shake">💥 FX: Shake</option>
                    <option value="custom_fx">✨ FX Custom</option>
                </select>
            </div>

            <button class="action" style="background:#ff66aa; color:black; padding:10px;" onclick="openAutoMapModal()">🤖 AUTO-MAPEO IA</button>
            <button class="action" style="background:#00ffff; color:black; padding:10px;" onclick="openCustomMechanicCreator()">⚙️ CREADOR FX CUSTOM</button>
            <button class="action" style="background:#444; color:white; padding:10px;" onclick="testMap()">▶️ PROBAR</button>
        </div>
    `;
    sidebar.insertAdjacentHTML('beforeend', html);
}

// === GRID CON SOPORTE TÁCTIL (MÓVIL) ===
function initEditorGrid() {
    const grid = document.getElementById('ed-grid');
    grid.style.width = (window.edK * 80) + 'px'; 
    grid.innerHTML = '';
    
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

        // FIX BORRADO DE HOLD NOTES: Busca si el clic cae DENTRO del cuerpo de la nota
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
        
        // Crear nueva nota respetando el pincel seleccionado
        let finalType = window.edBrush || 'tap';
        window.edDragNote = { 
            t: pos.t, l: pos.l, 
            type: finalType, h: false, dur: 0, 
            customData: window.edActiveCustomFX || null 
        };
        window.edMap.push(window.edDragNote);
        drawEditorGrid();
    };

    const moveAction = (e) => {
        if(!window.edDragNote || window.edMode !== 'mania') return; 
        e.preventDefault(); 
        
        const pos = getPointerPos(e);
        // Solo permite estirar notas normales, minas o dodges
        let isHoldable = (window.edDragNote.type === 'tap' || window.edDragNote.type === 'mine' || window.edDragNote.type === 'dodge' || window.edDragNote.type === 'hold');
        
        if (isHoldable && pos.t > window.edDragNote.t + 50) {
            window.edDragNote.h = true;
            window.edDragNote.type = 'hold'; 
            window.edDragNote.dur = pos.t - window.edDragNote.t;
            drawEditorGrid();
        }
    };

    const endAction = () => {
        if(window.edDragNote) {
            if(window.edDragNote.h && window.edDragNote.dur < 50) {
                window.edDragNote.h = false; 
                window.edDragNote.type = window.edBrush === 'tap' ? 'tap' : window.edBrush; 
                window.edDragNote.dur = 0;
            }
            window.edDragNote = null;
            drawEditorGrid();
        }
    };

    grid.onmousedown = startAction;
    grid.onmousemove = moveAction;
    window.onmouseup = endAction;

    grid.ontouchstart = startAction;
    grid.ontouchmove = moveAction;
    window.ontouchend = endAction;
}

window.drawEditorGrid = function() {
    const grid = document.getElementById('ed-grid');
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
        
        let color = getLaneColor(n.l, window.edMode);
        
        if(n.type === 'mine') color = '#F9393F'; 
        else if(n.type === 'dodge') color = '#00ffff'; 
        else if(n.type === 'fx_flash' || n.type === 'custom_fx') color = '#FFD700'; 

        note.style.background = color;

        if(n.h && n.dur > 0) {
            note.style.height = (n.dur * (zoom / 100)) + 'px';
            note.style.border = `2px solid ${color}`;
            note.style.background = `linear-gradient(to bottom, ${color} 80%, transparent 100%)`;
            note.style.opacity = '0.8';
            note.style.borderRadius = '5px';
            
            note.style.transform = 'translateY(0)'; 
            note.style.transformOrigin = 'top center';
        } else {
            note.style.height = '20px';
            note.style.borderRadius = window.edMode === 'taiko' ? '50%' : '5px';
            note.style.transform = 'translateY(-50%)'; 
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

window.openAutoMapModal = function() {
    const html = `
        <div id="automap-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center;">
            <div style="background:#111; padding:25px; border-radius:15px; border:1px solid #ff66aa; width:350px; text-align:center;">
                <h3 style="color:#ff66aa; margin-top:0;">🤖 AUTO-MAPEO IA</h3>
                <p style="color:#ccc; font-size:0.9rem;">Elige la intensidad del algoritmo.<br>Esto borrará el mapa actual.</p>
                
                <div style="margin:20px 0;">
                    <label style="color:white; display:block; margin-bottom:5px;">Sensibilidad (Threshold)</label>
                    <input type="range" id="am-thresh" min="0.5" max="0.95" step="0.05" value="0.85" style="width:100%;">
                    <div style="display:flex; justify-content:space-between; color:#888; font-size:0.8rem;">
                        <span>Muchas Notas</span>
                        <span>Pocas Notas</span>
                    </div>
                </div>

                <button class="action" onclick="runAutoMap()">GENERAR MAPA</button>
                <button class="action secondary" style="margin-top:10px;" onclick="document.getElementById('automap-modal').remove()">CANCELAR</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.runAutoMap = async function() {
    const threshVal = parseFloat(document.getElementById('am-thresh').value);
    document.getElementById('automap-modal').remove();
    
    window.notify("⏳ Analizando audio... Espere.", "info");
    window.edMap = [];
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(window.curSongData.audioURL || window.curSongData.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        let peaks = []; 
        
        for (let i = 0; i < channelData.length; i += sampleRate / 10) { 
            let maxVol = 0;
            for (let j = 0; j < sampleRate / 10 && (i + j) < channelData.length; j++) {
                if (Math.abs(channelData[i + j]) > maxVol) maxVol = Math.abs(channelData[i + j]);
            }
            if (maxVol > threshVal) {
                let timeMs = (i / sampleRate) * 1000;
                if (peaks.length === 0 || timeMs - peaks[peaks.length - 1] > 150) peaks.push(timeMs);
            }
        }

        peaks.forEach(time => {
            let note = { t: Math.round(time), type: 'tap', h: false, dur: 0 };
            if (window.edMode === 'standard') {
                note.x = Math.floor(Math.random() * 400) + 50; note.y = Math.floor(Math.random() * 300) + 50; 
            } else {
                note.l = Math.floor(Math.random() * window.edK); 
                if (window.edMode === 'mania' && Math.random() > 0.85) {
                    note.type = 'hold'; note.h = true; note.dur = 200; 
                }
            }
            window.edMap.push(note);
        });
        
        drawEditorGrid();
        window.notify(`¡Éxito! ${peaks.length} notas generadas.`, "success");
    } catch (e) { 
        console.error(e); 
        window.notify("Error al procesar el audio.", "error"); 
    }
};

window.calculateStarRating = function(notes, durationMs) {
    if(!notes || notes.length === 0) return 0;
    const durationSecs = durationMs / 1000;
    const notesPerSecond = notes.length / durationSecs;
    let stars = notesPerSecond * 0.8;
    const holds = notes.filter(n => n.h).length;
    stars += (holds / notes.length) * 1.5;
    return Math.max(1, Math.min(10, stars)).toFixed(1);
};

window.saveEditorMap = async function() {
    if(!window.curSongData || !window.curSongData.id) return window.notify("Error: No hay ID de canción.", "error");
    window.notify("Guardando en la nube...", "info");
    
    const mapKey = `notes_${window.edMode}_${window.edK}k`; 
    let updateData = { mechanics: window.edMechanics || [] };
    updateData[mapKey] = window.edMap;
    
    const durationMs = (window.edAudio.duration || 120) * 1000;
    const calculatedStars = window.calculateStarRating(window.edMap, durationMs);
    updateData[`stars_${window.edMode}_${window.edK}k`] = calculatedStars;
    
    if(window.edMode === 'mania' && window.edK === 4) {
        updateData.notes = window.edMap;
        updateData.starRating = calculatedStars; 
    }

    try {
        await window.db.collection("globalSongs").doc(window.curSongData.id).update(updateData);
        window.notify(`¡Guardado Exitoso! Dif: ⭐ ${calculatedStars}`, "success");
    } catch(e) { window.notify("Error Firebase: " + e.message, "error"); }
};

window.testMap = function() {
    window.closeEditor();
    window.curSongData.raw = { ...window.curSongData };
    window.curSongData.raw.notes = window.edMap; 
    
    if(window.edMode === 'taiko' && typeof startTaikoEngine === 'function') startTaikoEngine(window.curSongData);
    else if(window.edMode === 'catch' && typeof startCatchEngine === 'function') startCatchEngine(window.curSongData);
    else { window.asegurarModo(window.edK); window.startGame(window.edK); }
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
    if(playhead && window.edAudio) {
        const pos = (window.edAudio.currentTime * 1000) * (zoom / 100);
        playhead.style.top = pos + 'px';
        if(!window.edAudio.paused) document.getElementById('ed-scroll-area').scrollTop = pos - 200;
    }
}, 16);

// === CREADOR DE MECÁNICAS ===
window.edActiveCustomFX = null;

window.openCustomMechanicCreator = function() {
    const html = `
        <div id="mech-creator-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
            <div style="background:#0a0a0a; padding:30px; border-radius:15px; border:2px solid #00ffff; width:500px; box-shadow: 0 0 30px rgba(0,255,255,0.2);">
                <h2 style="color:#00ffff; margin-top:0;">🛠️ CREADOR DE MECÁNICAS</h2>
                <p style="color:#888; font-size:0.9rem;">Crea un efecto visual complejo que se activará cuando la línea de tiempo llegue a la nota.</p>
                
                <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:20px;">
                    <div>
                        <label style="color:white; font-size:0.8rem;">Nombre de tu Mecánica</label>
                        <input type="text" id="cm-name" class="log-inp" placeholder="Ej: Mundo Invertido">
                    </div>
                    
                    <div>
                        <label style="color:white; font-size:0.8rem;">Filtro CSS (El motor de renderizado)</label>
                        <select id="cm-filter" class="log-inp" style="background:#111;">
                            <option value="invert(1)">Invertir Colores</option>
                            <option value="hue-rotate(90deg)">Glitch de Color (Hue)</option>
                            <option value="blur(5px)">Visión Borrosa (Blur)</option>
                            <option value="grayscale(1)">Blanco y Negro</option>
                            <option value="contrast(3)">Alto Contraste Tóxico</option>
                        </select>
                    </div>

                    <div>
                        <label style="color:white; font-size:0.8rem;">Duración (en Milisegundos)</label>
                        <input type="number" id="cm-dur" class="log-inp" value="2000" min="100" max="10000">
                    </div>
                </div>

                <div style="display:flex; gap:10px;">
                    <button class="action" onclick="saveCustomMechanic()">💾 GUARDAR COMO PINCEL</button>
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
    if(brushSelect) brushSelect.value = 'custom_fx';
    window.edBrush = 'custom_fx';

    window.notify(`Mecánica "${name}" lista. Clic en la pista para ponerla.`, "success");
    document.getElementById('mech-creator-modal').remove();
};
