/* ==========================================================
   CREATOR STUDIO PRO V2 - MOTOR DE MAPEADO ÉPICO ✏️
   ========================================================== */

window.edMap = [];
window.isEditing = false;
window.edK = 4;
window.edAudio = null;
window.snapValue = 50; // Iman de notas

window.openEditor = async function(songData, keys = 4) {
    window.edK = keys;
    window.curSongData = songData;
    
    // 🚨 FIX: Aseguramos que el mapa sea un Array limpio para evitar errores de .push/forEach
    window.edMap = Array.isArray(songData.notes) ? [...songData.notes] : [];
    
    const layer = document.getElementById('editor-layer');
    layer.style.display = 'flex';
    window.isEditing = true;

    document.getElementById('ed-title').innerText = `EDITANDO: ${songData.title} (${keys}K)`;
    
    window.edAudio = document.getElementById('ed-audio');
    window.edAudio.src = songData.audioURL || songData.url;
    window.edAudio.load();

    // Renderizado inicial
    initEditorGrid();
    drawEditorGrid();
    
    window.notify("¡Bienvenido al Studio! Usa clic para poner notas.", "success");
};

function initEditorGrid() {
    const grid = document.getElementById('ed-grid');
    grid.style.width = (window.edK * 80) + 'px'; // Carriles de 80px
    grid.innerHTML = '';
    
    // Crear carriles visuales
    for(let i=0; i<window.edK; i++) {
        const lane = document.createElement('div');
        lane.className = 'ed-lane';
        lane.style.left = (i * 80) + 'px';
        grid.appendChild(lane);
    }

    grid.onclick = (e) => {
        const rect = grid.getBoundingClientRect();
        const scrollArea = document.getElementById('ed-scroll-area');
        
        // Calcular tiempo basado en el scroll
        const y = e.clientY - rect.top;
        const lane = Math.floor((e.clientX - rect.left) / 80);
        const zoom = document.getElementById('ed-zoom').value;
        const time = y / (zoom / 100);

        toggleNote(time, lane);
    };
}

function toggleNote(t, l) {
    // Iman de notas (Snapping)
    const snappedT = Math.round(t / 20) * 20; 
    
    const existing = window.edMap.findIndex(n => Math.abs(n.t - snappedT) < 15 && n.l === l);
    
    if(existing !== -1) {
        window.edMap.splice(existing, 1);
    } else {
        // 🚨 FIX: Ahora window.edMap es siempre un Array, .push funcionará perfecto
        window.edMap.push({ t: snappedT, l: l, type: 'tap', h: false });
    }
    
    drawEditorGrid();
}

window.drawEditorGrid = function() {
    const grid = document.getElementById('ed-grid');
    const zoom = document.getElementById('ed-zoom').value;
    const duration = window.edAudio.duration || 300;
    
    grid.style.height = (duration * 1000 * (zoom / 100)) + 'px';

    // Limpiar solo las notas (mantener carriles)
    const oldNotes = grid.querySelectorAll('.ed-note');
    oldNotes.forEach(n => n.remove());

    window.edMap.forEach(n => {
        const note = document.createElement('div');
        note.className = 'ed-note';
        note.style.left = (n.l * 80 + 5) + 'px';
        note.style.top = (n.t * (zoom / 100)) + 'px';
        note.style.width = '70px';
        note.style.background = getLaneColor(n.l);
        grid.appendChild(note);
    });
};

function getLaneColor(l) {
    const colors = ['#00ffff', '#ff66aa', '#12FA05', '#FFD700', '#F9393F', '#a200ff'];
    return colors[l % colors.length];
}

// Sincronización del Playhead (Línea roja)
setInterval(() => {
    if(!window.isEditing || !window.edAudio) return;
    const zoom = document.getElementById('ed-zoom').value;
    const playhead = document.getElementById('ed-playhead');
    const currentTimeMs = window.edAudio.currentTime * 1000;
    
    const pos = currentTimeMs * (zoom / 100);
    playhead.style.top = pos + 'px';
    
    // Auto-scroll para seguir la música
    if(!window.edAudio.paused) {
        const scrollArea = document.getElementById('ed-scroll-area');
        scrollArea.scrollTop = pos - 200;
    }
}, 16);

window.saveEditorMap = async function() {
    if(!window.curSongData.id) return;
    
    window.notify("Sincronizando con la Nube...", "info");
    
    try {
        await window.db.collection("globalSongs").doc(window.curSongData.id).update({
            notes: window.edMap
        });
        window.notify("¡Mapa Guardado con Éxito!", "success");
    } catch(e) {
        window.notify("Error al guardar en Firebase", "error");
    }
};

window.closeEditor = function() {
    document.getElementById('editor-layer').style.display = 'none';
    window.isEditing = false;
    if(window.edAudio) window.edAudio.pause();
};
