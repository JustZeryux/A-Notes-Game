/* === js/editor.js - EDITOR DE MAPAS BRUTAL (SOPORTA DRAG & DROP) === */

window.edMap = [];
window.edKeys = 4;
window.edZoom = 30;

// Variables de Drag (Arrastre) para Notas Largas
let isDragging = false;
let dragStartLane = -1;
let dragStartTime = -1;
let tempNoteEl = null;

window.openStudioDashboard = function() {
    // Si tienes modales para elegir canción, se abren aquí.
    // Esto es solo un puente si haces click en "Creator Studio".
    notify("¡Bienvenido al Studio! Selecciona o sube una canción.", "info");
};

// Esta función inicia el editor real
window.openEditor = function(audioUrl, mapData, keys) {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('editor-layer').style.display = 'flex';
    
    window.edKeys = keys || 4;
    window.edMap = mapData ? JSON.parse(JSON.stringify(mapData)) : [];
    window.edZoom = parseInt(document.getElementById('ed-zoom').value) || 30;
    
    const audio = document.getElementById('ed-audio');
    audio.src = audioUrl;
    
    window.drawEditorGrid();
    
    // Animación de la línea de tiempo roja
    if(window.edInterval) cancelAnimationFrame(window.edInterval);
    function edLoop() {
        const ph = document.getElementById('ed-playhead');
        if(ph && audio && audio.duration) {
            ph.style.top = (audio.currentTime * window.edZoom) + 'px';
        }
        window.edInterval = requestAnimationFrame(edLoop);
    }
    edLoop();
};

window.closeEditor = function() {
    document.getElementById('editor-layer').style.display = 'none';
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('ed-audio').pause();
};

window.clearEditorMap = function() {
    if(confirm("¿Seguro que quieres borrar todas las notas de este mapa?")) {
        window.edMap = [];
        window.drawEditorGrid();
    }
};

window.drawEditorGrid = function() {
    window.edZoom = parseInt(document.getElementById('ed-zoom').value) || 30;
    const grid = document.getElementById('ed-grid');
    const audio = document.getElementById('ed-audio');
    if(!grid) return;
    
    grid.innerHTML = '';
    let duration = audio.duration || 180; // Si no ha cargado el audio, asume 3 minutos
    grid.style.height = (duration * window.edZoom) + 'px';
    
    // 1. Dibujar líneas separadoras de carriles
    for(let i=0; i<window.edKeys; i++) {
        let l = document.createElement('div');
        l.style.position = 'absolute'; l.style.left = (i * (100/window.edKeys)) + '%';
        l.style.width = (100/window.edKeys) + '%'; l.style.height = '100%';
        l.style.borderRight = '1px solid #333';
        l.style.pointerEvents = 'none'; // Para no estorbar los clicks
        grid.appendChild(l);
    }

    // 2. Dibujar las notas guardadas
    window.edMap.forEach((n, index) => {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = (n.l * (100/window.edKeys)) + '%';
        el.style.width = (100/window.edKeys) + '%';
        el.style.top = (n.t / 1000 * window.edZoom) + 'px';
        
        if(n.type === 'hold') {
            el.style.height = (n.len / 1000 * window.edZoom) + 'px';
            el.style.background = 'rgba(0, 255, 255, 0.4)';
            el.style.border = '2px solid cyan';
            el.style.borderTop = '4px solid white';
        } else {
            el.style.height = '10px';
            el.style.background = 'cyan';
            el.style.boxShadow = '0 0 10px cyan';
        }
        
        // Clicks para borrar la nota
        el.oncontextmenu = (e) => { e.preventDefault(); window.edMap.splice(index, 1); window.drawEditorGrid(); };
        el.ondblclick = (e) => { e.preventDefault(); window.edMap.splice(index, 1); window.drawEditorGrid(); };
        
        grid.appendChild(el);
    });
};

// =======================================================
// LÓGICA DE ARRASTRE (DRAG) PARA CREAR NOTAS LARGAS
// =======================================================
const gridEl = document.getElementById('ed-grid');
if (gridEl) {
    gridEl.addEventListener('pointerdown', function(e) {
        // Ignorar si hace click en una nota ya existente o si es click derecho
        if (e.target !== gridEl && e.target.parentElement !== gridEl) return;
        if (e.button === 2) return; 
        
        const rect = gridEl.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        dragStartLane = Math.floor((x / rect.width) * window.edKeys);
        dragStartTime = (y / window.edZoom) * 1000;
        isDragging = true;
        
        // Crear el "fantasma" de la nota mientras arrastra
        tempNoteEl = document.createElement('div');
        tempNoteEl.style.position = 'absolute';
        tempNoteEl.style.left = (dragStartLane * (100 / window.edKeys)) + '%';
        tempNoteEl.style.width = (100 / window.edKeys) + '%';
        tempNoteEl.style.top = (dragStartTime / 1000 * window.edZoom) + 'px';
        tempNoteEl.style.height = '4px';
        tempNoteEl.style.background = 'rgba(255, 102, 170, 0.8)';
        tempNoteEl.style.border = '1px solid white';
        tempNoteEl.style.pointerEvents = 'none'; // Para que no estorbe al ratón
        gridEl.appendChild(tempNoteEl);
        
        gridEl.setPointerCapture(e.pointerId);
    });

    gridEl.addEventListener('pointermove', function(e) {
        if (!isDragging || !tempNoteEl) return;
        const rect = gridEl.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        let currentTime = (y / window.edZoom) * 1000;
        
        let len = currentTime - dragStartTime;
        if (len > 0) {
            tempNoteEl.style.height = (len / 1000 * window.edZoom) + 'px';
        }
    });

    gridEl.addEventListener('pointerup', function(e) {
        if (!isDragging) return;
        isDragging = false;
        gridEl.releasePointerCapture(e.pointerId);
        
        const rect = gridEl.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        let endTime = (y / window.edZoom) * 1000;
        let len = endTime - dragStartTime;
        
        // Si arrastró muy poquito (menos de 50ms), se considera una nota Tap normal
        let type = 'tap';
        if (len >= 50) { type = 'hold'; } else { len = 0; }
        
        // Ajuste de precisión (Snap) a bloques de 10ms
        dragStartTime = Math.round(dragStartTime / 10) * 10;
        len = Math.round(len / 10) * 10;

        window.edMap.push({ t: dragStartTime, l: dragStartLane, type: type, len: len, h: false });
        
        if (tempNoteEl) { tempNoteEl.remove(); tempNoteEl = null; }
        window.drawEditorGrid();
    });
}

// Reproducir y pausar música con la barra espaciadora
window.addEventListener('keydown', (e) => {
    if(document.getElementById('editor-layer').style.display !== 'none' && e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const aud = document.getElementById('ed-audio');
        if(aud.paused) aud.play(); else aud.pause();
    }
});
