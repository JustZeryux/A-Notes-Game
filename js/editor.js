window.edData = {
    song: null,
    keys: 4,
    map: [],
    duration: 0,
    zoom: 30 // Pixeles por segundo
};

window.openEditor = function(songRaw, keys) {
    window.edData.song = songRaw;
    window.edData.keys = keys;
    
    // Si la canción ya tenía un mapa guardado en la base de datos, lo cargamos. Si no, creamos uno vacío.
    window.edData.map = songRaw.customMap ? JSON.parse(songRaw.customMap) : [];

    document.getElementById('ed-title').innerText = `✏️ Editando: ${songRaw.title} [${keys}K]`;
    document.getElementById('editor-layer').style.display = 'flex';
    
    // Configuramos el reproductor de audio
    const audio = document.getElementById('ed-audio');
    audio.src = songRaw.audioURL;
    audio.onloadedmetadata = () => {
        window.edData.duration = audio.duration;
        drawEditorGrid();
    };

    // Actualizar la línea de tiempo roja mientras se reproduce
    audio.ontimeupdate = () => {
        const playhead = document.getElementById('ed-playhead');
        const grid = document.getElementById('ed-grid');
        const scrollArea = document.getElementById('ed-scroll-area');
        
        let yPos = audio.currentTime * window.edData.zoom;
        playhead.style.top = yPos + 'px';
        
        // Auto-scroll para que la cámara siga la línea roja
        if(!audio.paused) {
            scrollArea.scrollTop = yPos - (scrollArea.clientHeight / 2);
        }
    };

    // Clic en la pista para poner notas
    document.getElementById('ed-grid').onclick = function(e) {
        // Si hicimos clic en una nota, no hacemos nada aquí (se borra en la función de la nota)
        if(e.target.classList.contains('ed-note')) return;

        const rect = this.getBoundingClientRect();
        const clickY = e.clientY - rect.top; // Posición Y dentro del grid
        const clickX = e.clientX - rect.left; // Posición X dentro del grid

        // Calculamos en qué milisegundo hicimos clic
        const timeMs = (clickY / window.edData.zoom) * 1000;
        
        // Calculamos en qué carril (0, 1, 2, 3...) hicimos clic
        const laneWidth = rect.width / window.edData.keys;
        const lane = Math.floor(clickX / laneWidth);

        // Agregamos la nota al mapa
        window.edData.map.push({ t: timeMs, l: lane, type: 'tap', len: 0, h: false });
        drawEditorGrid();
    };
};

window.closeEditor = function() {
    document.getElementById('ed-audio').pause();
    document.getElementById('editor-layer').style.display = 'none';
};

window.drawEditorGrid = function() {
    const grid = document.getElementById('ed-grid');
    window.edData.zoom = parseInt(document.getElementById('ed-zoom').value);
    
    // La altura total del mapa depende de cuánto dura la canción y el zoom
    const totalHeight = window.edData.duration * window.edData.zoom;
    grid.style.height = totalHeight + 'px';
    
    // Limpiamos notas y carriles viejos
    grid.innerHTML = '';

    // Dibujamos las líneas separadoras de carriles
    for(let i=0; i < window.edData.keys; i++) {
        let laneLine = document.createElement('div');
        laneLine.className = 'ed-lane';
        laneLine.style.width = (100 / window.edData.keys) + '%';
        laneLine.style.left = (i * (100 / window.edData.keys)) + '%';
        grid.appendChild(laneLine);
    }

    // Dibujamos las notas
    window.edData.map.forEach((n, index) => {
        let noteEl = document.createElement('div');
        noteEl.className = 'ed-note';
        
        // Posicionamiento matemático
        noteEl.style.width = (100 / window.edData.keys) + '%';
        noteEl.style.left = (n.l * (100 / window.edData.keys)) + '%';
        noteEl.style.top = (n.t / 1000) * window.edData.zoom + 'px';

        // Borrar nota al darle clic
        noteEl.onclick = (e) => {
            e.stopPropagation(); // Evita que el grid registre un clic y cree otra nota
            window.edData.map.splice(index, 1);
            drawEditorGrid();
        };

        grid.appendChild(noteEl);
    });
};

window.clearEditorMap = function() {
    if(confirm("¿Seguro que quieres borrar todas las notas?")) {
        window.edData.map = [];
        drawEditorGrid();
    }
};

window.saveEditorMap = async function() {
    if(!window.db) return alert("Error: No conectado a la base de datos");
    
    const btn = document.querySelector('.btn-acc');
    btn.innerText = "GUARDANDO...";
    
    try {
        // Ordenamos las notas por tiempo (obligatorio para el motor de juego)
        window.edData.map.sort((a,b) => a.t - b.t);
        
        // Guardamos el mapa en formato texto en la nube de Firebase
        await window.db.collection('globalSongs').doc(window.edData.song.id).update({
            customMap: JSON.stringify(window.edData.map)
        });
        
        btn.innerText = "✅ GUARDADO";
        setTimeout(() => btn.innerText = "💾 GUARDAR MAPA", 2000);
        
    } catch(e) {
        console.error(e);
        btn.innerText = "❌ ERROR";
        alert("Fallo al guardar: " + e.message);
    }
};

// Control de barra espaciadora
document.addEventListener('keydown', (e) => {
    const editor = document.getElementById('editor-layer');
    if (editor.style.display === 'flex' && e.code === 'Space') {
        e.preventDefault();
        const audio = document.getElementById('ed-audio');
        if(audio.paused) audio.play(); else audio.pause();
    }
});
