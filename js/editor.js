/* ==========================================================
   CREATOR STUDIO PRO V3 - MEGA MOTOR (HOLD NOTES, TAIKO, MECHANICS)
   ========================================================== */

window.edMap = [];
window.isEditing = false;
window.edK = 4;
window.edMode = 'mania'; // 'mania', 'taiko', 'catch'
window.edAudio = null;

// Configuraciones del Editor
window.edSnap = 50; // Ms de imán
window.edDragNote = null; // Para Hold Notes
window.edMechanics = []; // Mecánicas activas en este mapa

window.openEditor = async function(songData, keys = 4, mode = 'mania') {
    window.edK = keys;
    window.edMode = mode;
    window.curSongData = songData;
    
    // Si la canción ya tenía mecánicas guardadas, las cargamos
    window.edMechanics = songData.mechanics || [];
    
    // Cargamos el mapa específico del modo si existe, si no, uno vacío
    const mapKey = `notes_${mode}_${keys}k`; 
    window.edMap = Array.isArray(songData[mapKey]) ? [...songData[mapKey]] : (Array.isArray(songData.notes) ? [...songData.notes] : []);
    
    const layer = document.getElementById('editor-layer');
    layer.style.display = 'flex';
    window.isEditing = true;

    // Cambiamos el título
    const icons = { mania: '🎹', taiko: '🥁', catch: '🍎' };
    document.getElementById('ed-title').innerText = `${icons[mode]} EDITANDO: ${songData.title} (${mode.toUpperCase()} ${keys}K)`;
    
    window.edAudio = document.getElementById('ed-audio');
    window.edAudio.src = songData.audioURL || songData.url;
    window.edAudio.load();

    injectProTools(); // Inyectamos las nuevas herramientas dinámicamente
    initEditorGrid();
    drawEditorGrid();
    
    window.notify("¡Studio Pro Listo! Clic para nota normal. Mantén y arrastra para Hold Note.", "success");
};

function injectProTools() {
    // Si ya existen las herramientas pro, no las duplicamos
    if(document.getElementById('pro-tools-container')) return;
    
    const sidebar = document.querySelector('#editor-layer > div:nth-child(2) > div:nth-child(1)');
    
    const proToolsHtml = `
        <div id="pro-tools-container" style="display:flex; flex-direction:column; gap:15px; margin-top:20px; border-top:1px solid #333; padding-top:20px;">
            <div style="color:var(--gold); font-weight:bold;">⚡ HERRAMIENTAS PRO</div>
            
            <div>
                <div style="font-size:0.8rem; color:#aaa; margin-bottom:5px;">Imán Magnético (Snap)</div>
                <select class="set-input" onchange="window.edSnap = parseInt(this.value)">
                    <option value="10">Precisión Extrema (10ms)</option>
                    <option value="25">Rápido (25ms)</option>
                    <option value="50" selected>Normal (50ms)</option>
                    <option value="100">Lento (100ms)</option>
                </select>
            </div>

            <button class="action" style="background:#ff66aa; color:black; padding:10px;" onclick="autoFillMap()">🤖 AUTO-MAPEO RÍTMICO</button>
            <button class="action" style="background:#00ffff; color:black; padding:10px;" onclick="openMechanicsMenu()">⚙️ CUSTOM MECHANICS</button>
            <button class="action" style="background:#444; color:white; padding:10px;" onclick="testMap()">▶️ PROBAR MAPA</button>
        </div>
    `;
    sidebar.insertAdjacentHTML('beforeend', proToolsHtml);
}

function initEditorGrid() {
    const grid = document.getElementById('ed-grid');
    grid.style.width = (window.edK * 80) + 'px'; 
    grid.innerHTML = '';
    
    // Crear carriles (En Taiko suelen ser 2: Don y Kat. En Catch: posiciones X)
    for(let i=0; i<window.edK; i++) {
        const lane = document.createElement('div');
        lane.className = 'ed-lane';
        lane.style.left = (i * 80) + 'px';
        
        // Estilo especial para Taiko
        if(window.edMode === 'taiko') {
            lane.style.background = i === 0 ? 'rgba(249, 57, 63, 0.1)' : 'rgba(68, 185, 255, 0.1)'; // Rojo y Azul
        }
        grid.appendChild(lane);
    }

    // --- LÓGICA DE HOLD NOTES Y CLICS ---
    grid.onmousedown = (e) => {
        if(e.button !== 0) return; // Solo clic izquierdo
        const rect = grid.getBoundingClientRect();
        const zoom = document.getElementById('ed-zoom').value;
        const y = e.clientY - rect.top;
        
        const rawTime = y / (zoom / 100);
        const snappedT = Math.round(rawTime / window.edSnap) * window.edSnap;
        const lane = Math.floor((e.clientX - rect.left) / 80);

        // Si clickeamos una nota existente, la borramos (y evitamos arrastrar)
        const existingIdx = window.edMap.findIndex(n => Math.abs(n.t - snappedT) < (window.edSnap) && n.l === lane);
        if(existingIdx !== -1) {
            window.edMap.splice(existingIdx, 1);
            drawEditorGrid();
            return;
        }

        // Si no hay nota, empezamos a crear una (por defecto normal)
        window.edDragNote = { t: snappedT, l: lane, type: 'tap', h: false, dur: 0 };
        window.edMap.push(window.edDragNote);
        drawEditorGrid();
    };

    grid.onmousemove = (e) => {
        if(!window.edDragNote || window.edMode !== 'mania') return; // Hold solo en mania
        
        const rect = grid.getBoundingClientRect();
        const zoom = document.getElementById('ed-zoom').value;
        const y = e.clientY - rect.top;
        
        const rawTime = y / (zoom / 100);
        const snappedT = Math.round(rawTime / window.edSnap) * window.edSnap;
        
        // Si el mouse bajó lo suficiente, se convierte en Hold Note
        if (snappedT > window.edDragNote.t + 50) {
            window.edDragNote.h = true;
            window.edDragNote.type = 'hold';
            window.edDragNote.dur = snappedT - window.edDragNote.t;
            drawEditorGrid();
        }
    };

    window.onmouseup = () => {
        if(window.edDragNote) {
            // Asegurarse de que no guardemos holds de duración 0
            if(window.edDragNote.h && window.edDragNote.dur < 50) {
                window.edDragNote.h = false;
                window.edDragNote.type = 'tap';
                window.edDragNote.dur = 0;
            }
            window.edDragNote = null;
            drawEditorGrid();
        }
    };
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
        
        // Si es mecánica Custom (Ej. Mina)
        if(n.type === 'mine') color = '#F9393F';

        note.style.background = color;

        // Renderizado de Hold Notes (Altura dinámica)
        if(n.h && n.dur > 0) {
            note.style.height = (n.dur * (zoom / 100)) + 'px';
            note.style.border = `2px solid ${color}`;
            note.style.background = `linear-gradient(to bottom, ${color} 0%, transparent 100%)`;
            note.style.opacity = '0.8';
        } else {
            note.style.height = '20px'; // Nota normal
            note.style.borderRadius = window.edMode === 'taiko' ? '50%' : '5px';
        }

        grid.appendChild(note);
    });
};

function getLaneColor(l, mode) {
    if(mode === 'taiko') return l === 0 ? '#f95555' : '#44b9ff'; // Rojo y Azul
    if(mode === 'catch') return '#12FA05'; // Manzanas verdes
    const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#F9393F', '#a200ff'];
    return colors[l % colors.length];
}

// ==========================================
// AUTO-MAPEO ALGORÍTMICO (BETA)
// ==========================================
window.autoFillMap = function() {
    if(!confirm("¿Rellenar mapa automáticamente? Esto borrará tus notas actuales.")) return;
    
    window.edMap = [];
    const duration = (window.edAudio.duration || 120) * 1000;
    const bpm = prompt("Introduce el BPM de la canción (Ej: 120):", "120");
    if(!bpm || isNaN(bpm)) return window.notify("BPM inválido", "error");
    
    const interval = (60000 / parseInt(bpm)); // ms por beat
    
    for(let t = 0; t < duration; t += interval) {
        if(Math.random() > 0.3) { // 70% de probabilidad de nota en el beat
            const lane = Math.floor(Math.random() * window.edK);
            
            // 15% de probabilidad de Hold Note en Mania
            let isHold = (window.edMode === 'mania' && Math.random() > 0.85);
            window.edMap.push({
                t: Math.round(t),
                l: lane,
                type: isHold ? 'hold' : 'tap',
                h: isHold,
                dur: isHold ? interval : 0
            });
        }
    }
    drawEditorGrid();
    window.notify("¡Auto-mapeo completado!", "success");
};

// ==========================================
// CUSTOM MECHANICS MODAL
// ==========================================
window.openMechanicsMenu = function() {
    const html = `
        <div id="mech-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999999; display:flex; align-items:center; justify-content:center;">
            <div style="background:#111; padding:30px; border-radius:15px; border:1px solid var(--accent); width:500px;">
                <h3 style="color:white; margin-top:0;">⚙️ MECÁNICAS DEL MAPA</h3>
                <p style="color:#aaa; font-size:0.9rem;">Selecciona las mecánicas locas que tendrá este mapa. Los jugadores podrán filtrar por ellas.</p>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                    <label style="color:#12FA05;"><input type="checkbox" id="mech-mines" ${window.edMechanics.includes('mines')?'checked':''}> 💣 Minas (Pulsarlas resta vida)</label>
                    <label style="color:#00ffff;"><input type="checkbox" id="mech-sv" ${window.edMechanics.includes('sv_changes')?'checked':''}> 🎢 Velocidad Variable (SV Changes)</label>
                    <label style="color:#ff66aa;"><input type="checkbox" id="mech-flash" ${window.edMechanics.includes('flashlight')?'checked':''}> 🔦 Flashlight (Visión reducida)</label>
                    <label style="color:#FFD700;"><input type="checkbox" id="mech-poison" ${window.edMechanics.includes('poison')?'checked':''}> ☠️ Notas Venenosas</label>
                </div>
                
                <button class="action" onclick="saveMechanics()">APLICAR MECÁNICAS</button>
                <button class="action secondary" style="margin-top:10px;" onclick="document.getElementById('mech-modal').remove()">CERRAR</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveMechanics = function() {
    window.edMechanics = [];
    if(document.getElementById('mech-mines').checked) window.edMechanics.push('mines');
    if(document.getElementById('mech-sv').checked) window.edMechanics.push('sv_changes');
    if(document.getElementById('mech-flash').checked) window.edMechanics.push('flashlight');
    if(document.getElementById('mech-poison').checked) window.edMechanics.push('poison');
    
    document.getElementById('mech-modal').remove();
    window.notify("Mecánicas aplicadas", "success");
};

// ==========================================
// GUARDAR EN FIREBASE (CON MODOS Y MECÁNICAS)
// ==========================================
window.saveEditorMap = async function() {
    if(!window.curSongData.id) return;
    
    window.notify("Guardando mapa en la Nube...", "info");
    
    // Guardamos las notas en una propiedad específica para que un mapa tenga múltiples dificultades/modos
    const mapKey = `notes_${window.edMode}_${window.edK}k`; 
    
    let updateData = { mechanics: window.edMechanics };
    updateData[mapKey] = window.edMap;
    
    // Para retrocompatibilidad con el buscador actual, dejamos "notes" como el mapa por defecto
    if(window.edMode === 'mania' && window.edK === 4) {
        updateData.notes = window.edMap;
    }

    try {
        await window.db.collection("globalSongs").doc(window.curSongData.id).update(updateData);
        window.notify("¡Mapa Pro Guardado con Éxito!", "success");
    } catch(e) {
        window.notify("Error al guardar en Firebase", "error");
    }
};

window.testMap = function() {
    window.closeEditor();
    // Prepara el motor del juego para inyectar este mapa temporalmente y probarlo
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
    const pos = (window.edAudio.currentTime * 1000) * (zoom / 100);
    playhead.style.top = pos + 'px';
    if(!window.edAudio.paused) document.getElementById('ed-scroll-area').scrollTop = pos - 200;
}, 16);
