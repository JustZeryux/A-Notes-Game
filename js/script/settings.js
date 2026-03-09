/* ==========================================================
   SETTINGS.JS - MOTOR DE CONFIGURACIÓN MAESTRO V3
   ========================================================== */

// Helper anti-bugs: Evita que el número "0" sea ignorado
function getNum(id, defaultValue) {
    let el = document.getElementById(id);
    if (!el || el.value === "") return defaultValue;
    let val = parseFloat(el.value);
    return isNaN(val) ? defaultValue : val;
}

window.saveSettings = function() {
    if (!window.cfg) window.cfg = {};

    // 1. MANIA & TECLAS
    window.cfg.spd = getNum('cfg-spd', 25);
    window.cfg.judgeY = getNum('cfg-hit-pos', 85);
    window.cfg.noteScale = getNum('cfg-note-size', 100) / 100;
    window.cfg.den = getNum('cfg-den', 7);
    window.cfg.fov = getNum('cfg-fov', 0);
    window.cfg.noteOp = getNum('cfg-noteop', 100);
    
    let chkDown = document.getElementById('cfg-down');
    window.cfg.down = chkDown ? chkDown.checked : false;

    // 2. VISUALES
    window.cfg.trackOp = getNum('cfg-dim', 50);
    
    let chkSplash = document.getElementById('cfg-splash');
    window.cfg.showSplash = chkSplash ? chkSplash.checked : true;
    
    let chkMs = document.getElementById('cfg-show-ms');
    window.cfg.showMs = chkMs ? chkMs.checked : true;
    
    let chkUi = document.getElementById('cfg-hide-ui');
    window.cfg.hideHud = chkUi ? chkUi.checked : false;

    // 3. AUDIO (Convertimos de la barra 0-100 a decimal 0.0 - 1.0 para el juego)
    let hitSoundEl = document.getElementById('cfg-hitsound');
    window.cfg.hitsound = hitSoundEl ? hitSoundEl.value : 'default';
    
    // 🚨 FIX DEL VOLUMEN EN 0:
    window.cfg.vol = getNum('cfg-vol', 50) / 100;
    window.cfg.hvol = getNum('cfg-hvol', 60) / 100;
    window.cfg.missVol = getNum('cfg-mvol', 40) / 100;
    window.cfg.off = getNum('cfg-off', 0);

    // 4. RENDIMIENTO Y UX
    let chkPerf = document.getElementById('cfg-perf-mode');
    window.cfg.perfMode = chkPerf ? chkPerf.checked : false;
    window.cfg.vivid = !window.cfg.perfMode; // Si activa rendimiento, apaga lo vívido
    
    let chkFps = document.getElementById('cfg-show-fps');
    window.cfg.showFps = chkFps ? chkFps.checked : false;

    let chkSub = document.getElementById('cfg-subtitles');
    window.cfg.showLyrics = chkSub ? chkSub.checked : true;

    // GUARDAR EN LA MEMORIA DEL NAVEGADOR
    localStorage.setItem('a_notes_cfg', JSON.stringify(window.cfg));

    if(typeof window.notify === 'function') window.notify("✅ Ajustes guardados y aplicados", "success");
    if(typeof window.closeModal === 'function') window.closeModal('settings');
};

window.loadSettings = function() {
    // 1. Recuperar de la memoria
    let saved = localStorage.getItem('a_notes_cfg');
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            window.cfg = { ...window.cfg, ...parsed }; 
        } catch(e) { console.warn("Error cargando cfg"); }
    }

    // 2. Pintar los valores en los inputs del menú para que los veas al abrir
    if (document.getElementById('cfg-spd')) document.getElementById('cfg-spd').value = window.cfg.spd || 25;
    if (document.getElementById('cfg-hit-pos')) document.getElementById('cfg-hit-pos').value = window.cfg.judgeY || 85;
    if (document.getElementById('cfg-note-size')) document.getElementById('cfg-note-size').value = (window.cfg.noteScale || 1) * 100;
    if (document.getElementById('cfg-den')) document.getElementById('cfg-den').value = window.cfg.den || 7;
    if (document.getElementById('cfg-fov')) document.getElementById('cfg-fov').value = window.cfg.fov || 0;
    if (document.getElementById('cfg-noteop')) document.getElementById('cfg-noteop').value = window.cfg.noteOp || 100;
    if (document.getElementById('cfg-down')) document.getElementById('cfg-down').checked = !!window.cfg.down;

    if (document.getElementById('cfg-dim')) document.getElementById('cfg-dim').value = window.cfg.trackOp || 50;
    if (document.getElementById('cfg-splash')) document.getElementById('cfg-splash').checked = !!window.cfg.showSplash;
    if (document.getElementById('cfg-show-ms')) document.getElementById('cfg-show-ms').checked = !!window.cfg.showMs;
    if (document.getElementById('cfg-hide-ui')) document.getElementById('cfg-hide-ui').checked = !!window.cfg.hideHud;

    if (document.getElementById('cfg-hitsound')) document.getElementById('cfg-hitsound').value = window.cfg.hitsound || 'default';
    
    // Convertir de decimal (0.5) a barra visual (50)
    if (document.getElementById('cfg-vol')) document.getElementById('cfg-vol').value = (window.cfg.vol !== undefined ? window.cfg.vol : 0.5) * 100;
    if (document.getElementById('cfg-hvol')) document.getElementById('cfg-hvol').value = (window.cfg.hvol !== undefined ? window.cfg.hvol : 0.6) * 100;
    if (document.getElementById('cfg-mvol')) document.getElementById('cfg-mvol').value = (window.cfg.missVol !== undefined ? window.cfg.missVol : 0.4) * 100;
    if (document.getElementById('cfg-off')) document.getElementById('cfg-off').value = window.cfg.off || 0;

    if (document.getElementById('cfg-perf-mode')) document.getElementById('cfg-perf-mode').checked = !!window.cfg.perfMode;
    if (document.getElementById('cfg-show-fps')) document.getElementById('cfg-show-fps').checked = !!window.cfg.showFps;
    if (document.getElementById('cfg-subtitles')) document.getElementById('cfg-subtitles').checked = !!window.cfg.showLyrics;
};

// Lógica visual para cambiar entre las pestañas del menú de ajustes
window.switchSetTab = function(tabId) {
    document.querySelectorAll('.set-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.set-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    let target = document.getElementById(tabId);
    if(target) target.style.display = 'block';
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

// Cargar ajustes automáticamente cuando entras a la página
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if(typeof window.loadSettings === 'function') window.loadSettings();
    }, 500);
});
