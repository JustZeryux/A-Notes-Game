/* =========================================================================
   SISTEMA DE KEYBINDS Y PREVIEW DE MANIA (RECONSTRUIDO DESDE 0)
   ========================================================================= */

// 1. DICCIONARIO DE FORMAS (SHAPES)
window.NOTE_SHAPES = ['circle', 'diamond', 'bar', 'ring'];

window.getShapeSvg = function(shapeName, color) {
    let s = shapeName || 'circle';
    let c = color || '#00ffff';
    switch(s) {
        case 'circle': 
            return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><circle cx="50" cy="50" r="40" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'diamond': 
            return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><polygon points="50,10 90,50 50,90 10,50" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'bar': 
            return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><rect x="15" y="35" width="70" height="30" rx="10" fill="${c}" stroke="white" stroke-width="5"/></svg>`;
        case 'ring': 
            return `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter:drop-shadow(0 0 5px ${c});"><circle cx="50" cy="50" r="35" fill="none" stroke="${c}" stroke-width="15"/></svg>`;
        default:
            return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${c}"/></svg>`;
    }
};

// 2. RENDERIZAR LOS CONTROLES (RESTAURA TUS CLASES ORIGINALES)
window.renderLaneConfig = function(k) {
    k = parseInt(k);
    if (!k || isNaN(k)) k = 4;
    
    const cont = document.getElementById('lanes-container');
    if(!cont) return;
    
    // Asegurar que exista la configuración base
    if(!window.cfg) window.cfg = {};
    if(!window.cfg.modes) window.cfg.modes = {};
    if(!window.cfg.modes[k]) {
        window.cfg.modes[k] = [];
        const defKeys = ['a','s','d','f','g','h','j','k','l',';'];
        for(let i=0; i<k; i++) {
            window.cfg.modes[k].push({ k: defKeys[i]||' ', c: '#00ffff', s: 'circle' });
        }
    }

    let html = '';
    window.cfg.modes[k].forEach((lane, i) => {
        let keyText = lane.k === ' ' || lane.k === 'Space' ? 'SPC' : String(lane.k).toUpperCase();
        keyText = keyText.replace('ARROW', '').replace('KEY', ''); // Limpieza visual
        
        let shapeSvg = window.getShapeSvg(lane.s, lane.c);

        html += `
        <div class="l-col" style="display:flex; flex-direction:column; align-items:center; gap:15px; margin: 0 5px;">
            <div class="key-bind" id="btn-bind-${k}-${i}" onclick="window.remapKey(${k}, ${i})" 
                 style="width:70px; height:70px; border:3px solid ${lane.c}; border-radius:15px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.8rem; cursor:pointer; background:#111; color:white; transition:0.2s; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
                ${keyText}
            </div>
            
            <div class="shape-indicator" onclick="window.cycleShape(${k}, ${i})" 
                 style="width:40px; height:40px; cursor:pointer; transition: transform 0.2s;" 
                 onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                ${shapeSvg}
            </div>
            
            <input type="color" class="col-pk" value="${lane.c}" oninput="window.updateLaneColor(${k}, ${i}, this.value)" 
                   style="width:60px; height:25px; border:none; padding:0; cursor:pointer; border-radius:5px;">
        </div>`;
    });
    
    cont.innerHTML = html;
    
    // Sincroniza el select del HTML para que muestre el modo correcto
    const selector = document.getElementById('kb-mode-select');
    if (selector) selector.value = k;
    
    window.updatePreview(k);
};

// 3. FUNCIÓN DE CAMBIO DE FORMAS (CICLO)
window.cycleShape = function(k, laneIdx) {
    if (!window.cfg.modes[k][laneIdx].s) window.cfg.modes[k][laneIdx].s = 'circle';
    let currentShape = window.cfg.modes[k][laneIdx].s;
    let idx = window.NOTE_SHAPES.indexOf(currentShape);
    let nextShape = window.NOTE_SHAPES[(idx + 1) % window.NOTE_SHAPES.length];
    
    window.cfg.modes[k][laneIdx].s = nextShape;
    window.renderLaneConfig(k); // Recarga para mostrar la nueva forma
};

window.updateLaneColor = function(k, laneIdx, newColor) {
    window.cfg.modes[k][laneIdx].c = newColor;
    window.renderLaneConfig(k); // Recarga para aplicar el color al borde, forma y preview
};

// 4. SISTEMA DE CAPTURA DE TECLAS A PRUEBA DE BALAS
window.remapKey = function(k, laneIdx) {
    const btn = document.getElementById(`btn-bind-${k}-${laneIdx}`);
    if(!btn || btn.dataset.waiting === "true") return;
    
    // Preparamos el botón visualmente
    btn.dataset.origKey = btn.innerText;
    btn.dataset.waiting = "true";
    btn.innerText = "...";
    btn.style.background = "#F9393F"; 
    btn.style.borderColor = "white";
    btn.blur();

    // Pantalla oscura de protección (Igual que en Taiko)
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(8px);";
    overlay.innerHTML = `
        <div style="color:#F9393F; font-size:4rem; font-weight:900; text-shadow:0 0 30px #F9393F; letter-spacing:3px;">ASIGNAR TECLA</div>
        <div style="color:white; font-size:1.8rem; margin-top:15px;">Presiona la tecla para el Carril ${laneIdx + 1}</div>
        <div style="color:#888; margin-top:30px; font-weight:bold; font-size:1.2rem;">Presiona [ESC] para cancelar</div>
    `;
    document.body.appendChild(overlay);

    const capture = (e) => {
        e.preventDefault(); e.stopPropagation();
        
        let key = e.key;
        if(e.code === "Space") key = " ";
        
        if (key !== "Escape") {
            window.cfg.modes[k][laneIdx].k = key;
        }
        
        // Limpiamos todo
        btn.dataset.waiting = "false";
        overlay.remove();
        document.removeEventListener('keydown', capture, true);
        window.renderLaneConfig(k); 
    };

    // Retraso de seguridad para que el clic del mouse no asigne la tecla accidentalmente
    setTimeout(() => {
        document.addEventListener('keydown', capture, true);
    }, 150);
};

// 5. RENDERIZADO DE LA VISTA PREVIA (NOTE PREVIEW)
window.updatePreview = function(k) {
    const box = document.getElementById('live-skin-preview');
    if(!box) return;
    
    let html = '';
    for(let i=0; i<k; i++) {
        let laneData = window.cfg.modes[k][i];
        let shapeSvg = window.getShapeSvg(laneData.s, laneData.c);
        
        html += `
        <div style="flex:1; height:100%; border-left:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:flex-end; padding-bottom:15px; background: linear-gradient(to top, rgba(255,255,255,0.05), transparent);">
            <div style="width:60px; height:60px; transform: translateY(0);">
                ${shapeSvg}
            </div>
        </div>`;
    }
    box.innerHTML = html;
};

// 6. ASEGURAR QUE SE CARGUE AL ABRIR LA PESTAÑA
// Reemplazamos la función de cambio de pestaña para asegurarnos que llame al render
window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.set-section').forEach(s => s.style.display = 'none');
    
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    const tab = document.getElementById(tabId);
    if(tab) tab.style.display = 'block';
    
    // Si entramos a la pestaña de Mania, dibujamos los controles
    if(tabId === 'set-mania') {
        const select = document.getElementById('kb-mode-select');
        let mode = select ? parseInt(select.value) : 4;
        if (isNaN(mode)) mode = 4;
        window.renderLaneConfig(mode);
    }
};

// Inicializador para cuando se abre el panel
window.openSettingsPanel = function() {
    if(typeof window.loadSettings === 'function') window.loadSettings();
    let modal = document.getElementById('modal-settings');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '9999999';
        
        // Forzar dibujado inicial en 4K
        const select = document.getElementById('kb-mode-select');
        let mode = select ? parseInt(select.value) : 4;
        window.renderLaneConfig(mode);
    } else if (typeof openModal === 'function') {
        openModal('settings');
    }
};
