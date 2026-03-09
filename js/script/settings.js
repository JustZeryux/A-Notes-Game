/* ==========================================================
   SETTINGS.JS - MOTOR DE CONFIGURACIÓN MAESTRO (CON KEYBINDS)
   ========================================================== */

let listeningKey = null; // Guarda qué botón está esperando una tecla

// Helper para leer números sin ignorar el 0
function getNum(id, defaultValue) {
    let el = document.getElementById(id);
    if (!el || el.value === "") return defaultValue;
    let val = parseFloat(el.value);
    return isNaN(val) ? defaultValue : val;
}

// --- SISTEMA DE CAPTURA DE TECLAS ---
window.captureSingleKey = function(btnId, configKey) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // Si ya estamos escuchando, cancelamos la anterior
    if (listeningKey) {
        listeningKey.btn.classList.remove('listening');
        listeningKey.btn.innerText = listeningKey.oldText;
    }

    const oldText = btn.innerText;
    btn.innerText = "...PRESIONA...";
    btn.classList.add('listening');

    listeningKey = { btn, btnId, configKey, oldText };

    // Creamos el escuchador de una sola vez
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key !== 'Escape') {
            const newKey = e.code; // Usamos .code para evitar líos con idiomas de teclado
            btn.innerText = newKey.replace('Key', '').replace('Digit', '');
            
            // Guardar temporalmente en el objeto global
            if (!window.cfg.keys) window.cfg.keys = {};
            window.cfg.keys[configKey] = newKey;
            
            if(typeof window.notify === 'function') window.notify(`Tecla asignada: ${newKey}`, "success");
        } else {
            btn.innerText = oldText;
        }

        btn.classList.remove('listening');
        window.removeEventListener('keydown', handler);
        listeningKey = null;
    };

    window.addEventListener('keydown', handler);
};

window.saveSettings = function() {
    if (!window.cfg) window.cfg = {};

    // 1. MANIA & TECLAS
    window.cfg.spd = getNum('cfg-spd', 25);
    window.cfg.judgeY = getNum('cfg-hit-pos', 85);
    window.cfg.noteScale = getNum('cfg-note-size', 100) / 100;
    window.cfg.den = getNum('cfg-den', 5);
    window.cfg.fov = getNum('cfg-fov', 0);
    window.cfg.noteOp = getNum('cfg-noteop', 100);
    window.cfg.down = document.getElementById('cfg-down')?.checked || false;

    // 2. AUDIO (FIX DEL CERO)
    window.cfg.vol = getNum('cfg-vol', 50) / 100;
    window.cfg.hvol = getNum('cfg-hvol', 60) / 100;
    window.cfg.missVol = getNum('cfg-mvol', 40) / 100;
    window.cfg.off = getNum('cfg-off', 0);

    // 3. VISUALES Y RENDIMIENTO
    window.cfg.trackOp = getNum('cfg-dim', 50);
    window.cfg.showSplash = document.getElementById('cfg-splash')?.checked ?? true;
    window.cfg.showMs = document.getElementById('cfg-show-ms')?.checked ?? true;
    window.cfg.hideHud = document.getElementById('cfg-hide-ui')?.checked ?? false;
    window.cfg.perfMode = document.getElementById('cfg-perf-mode')?.checked ?? false;

    // 4. GUARDAR MEMORIA
    localStorage.setItem('a_notes_cfg', JSON.stringify(window.cfg));

    // Aplicar cambios de volumen al BGM del menú si existe
    const menuBgm = document.getElementById('menu-bgm');
    if(menuBgm) menuBgm.volume = window.cfg.vol * 0.5;

    if(typeof window.notify === 'function') window.notify("✅ Ajustes y Teclas guardados", "success");
    if(typeof window.closeModal === 'function') window.closeModal('settings');
};

window.loadSettings = function() {
    let saved = localStorage.getItem('a_notes_cfg');
    if (saved) {
        try {
            window.cfg = JSON.parse(saved);
        } catch(e) { console.warn("Error cargando CFG"); }
    }

    // Cargar valores en los inputs
    if (document.getElementById('cfg-spd')) document.getElementById('cfg-spd').value = window.cfg.spd ?? 25;
    if (document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol ?? 0.5) * 100;
    if (document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol ?? 0.6) * 100;
    if (document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol ?? 0.4) * 100;
    
    // Cargar textos de las teclas en los botones
    if (window.cfg.keys) {
        // Ejemplo para Standard
        if(document.getElementById('cfg-std-k1')) document.getElementById('cfg-std-k1').innerText = (window.cfg.keys.stdK1 || 'Z').replace('Key', '');
        if(document.getElementById('cfg-std-k2')) document.getElementById('cfg-std-k2').innerText = (window.cfg.keys.stdK2 || 'X').replace('Key', '');
        // Puedes añadir más aquí según tus IDs de botones
    }

    // Sincronizar checkboxes
    if (document.getElementById('cfg-down')) document.getElementById('cfg-down').checked = !!window.cfg.down;
    if (document.getElementById('cfg-perf-mode')) document.getElementById('cfg-perf-mode').checked = !!window.cfg.perfMode;
};

// Lógica de pestañas
window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.set-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if(target) target.style.display = 'block';
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
};

// Iniciar al cargar
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(window.loadSettings, 500);
});
