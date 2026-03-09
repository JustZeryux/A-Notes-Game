/* === CORE.JS - Funciones base y herramientas universales === */

const MASTER_KEYS = {
    1: ['Space'], 
    2: ['KeyF', 'KeyJ'], 
    3: ['KeyF', 'Space', 'KeyJ'], 
    4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
    5: ['KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK'], 
    6: ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'],
    7: ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL'], 
    8: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
    9: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'], 
    10: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyV', 'KeyN', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']
};

window.asegurarModo = function(k) {
    if (!window.cfg) window.cfg = {}; 
    if (!window.cfg.keys) window.cfg.keys = {}; 
    if (!window.cfg.modes) window.cfg.modes = {};

    if (!window.cfg.modes[k] || window.cfg.modes[k].length !== k) {
        window.cfg.modes[k] = []; 
        window.cfg.keys[k] = MASTER_KEYS[k] || [];
        for(let j = 0; j < k; j++) {
            let col = (j % 2 === 0) ? '#00FFFF' : '#ff66aa';
            if(k % 2 !== 0 && j === Math.floor(k/2)) col = '#FFD700'; 
            window.cfg.modes[k].push({ k: (MASTER_KEYS[k] ? MASTER_KEYS[k][j] : 'Space'), c: col, s: 'circle' });
        }
        if(typeof save === 'function') save(); else localStorage.setItem('cfg', JSON.stringify(window.cfg));
    }
};

for(let i = 1; i <= 10; i++) window.asegurarModo(i);

function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
function setStyle(id, prop, val) { const el = document.getElementById(id); if(el) el.style[prop] = val; }

function playHover(){ 
    if(typeof st !== 'undefined' && st.ctx && typeof cfg !== 'undefined' && cfg.hvol > 0 && st.ctx.state==='running') { 
        try {
            const o=st.ctx.createOscillator(); const g=st.ctx.createGain(); 
            o.frequency.value=600; g.gain.value=0.05; o.connect(g); g.connect(st.ctx.destination); 
            o.start(); o.stop(st.ctx.currentTime+0.05); 
        } catch(e){}
    } 
}

// === SISTEMA DE NOTIFICACIONES GLOBAL ===
window.notify = function(msg, type = "info") {
    const container = document.getElementById('notification-area');
    if(!container) {
        console.log("Notificación (Oculta):", msg);
        return;
    }
    
    const div = document.createElement('div');
    div.className = 'notify-card';
    
    // Colores según el tipo de mensaje
    if(type === 'success') div.style.borderLeftColor = 'var(--good)';
    else if(type === 'error') div.style.borderLeftColor = 'var(--miss)';
    else div.style.borderLeftColor = 'var(--blue)';
    
    div.innerHTML = `<div class="notify-body">${msg}</div>`;
    container.appendChild(div);
    
    // Efecto de sonido si está activado
    if(typeof playHover === 'function') playHover();
    
    // Desaparecer automáticamente
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => div.remove(), 300);
    }, 3000);
};

// === DESBLOQUEO DE AUDIO DEL NAVEGADOR ===
window.unlockAudio = function() {
    if(typeof st !== 'undefined' && st.ctx && st.ctx.state === 'suspended') {
        st.ctx.resume().then(() => console.log("Audio desbloqueado."));
    }
};

document.addEventListener('click', function unlockOnce() {
    window.unlockAudio();
    document.removeEventListener('click', unlockOnce);
}, { once: true });


// =====================================================================
// 🌟 SISTEMA GLOBAL DE CIERRE DE MODALES Y NOTIFICACIONES (UX PRO) 🌟
// =====================================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 1. Cerrar todos los modales normales
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => {
            if(m.style.display !== 'none' && m.id !== 'loading-overlay' && m.id !== 'modal-res') {
                m.style.display = 'none';
            }
        });
        
        // 2. Cerrar notificaciones
        const notifPanel = document.getElementById('notif-panel');
        if (notifPanel) notifPanel.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    // 1. Cerrar modales si se hace clic en el fondo oscuro (.modal-overlay)
    if (e.target.classList.contains('modal-overlay') && e.target.id !== 'loading-overlay' && e.target.id !== 'modal-res') {
        e.target.style.display = 'none';
    }

    // 2. Cierre inteligente del panel de notificaciones
    const notifPanel = document.getElementById('notif-panel');
    const notifBtn = document.getElementById('btn-notifications'); // Asegúrate de que tu botón de la campana tenga este ID o cámbialo aquí
    
    if (notifPanel && notifPanel.style.display !== 'none') {
        // Si el clic NO fue dentro del panel Y NO fue en el botón de abrir...
        if (!notifPanel.contains(e.target) && (!notifBtn || !notifBtn.contains(e.target))) {
            notifPanel.style.display = 'none';
        }
    }
});

// =====================================================================
// 🎵 SISTEMA DE MÚSICA DE FONDO (BGM) GLOBAL
// =====================================================================
window.bgmStarted = false;

window.updateBgmVolume = function(val) {
    const bgm = document.getElementById('menu-bgm');
    if(bgm) bgm.volume = val / 100;
    if(window.cfg) window.cfg.bgmVol = val;
    if(typeof saveConfig === 'function') saveConfig();
};

window.setCustomBGM = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    const bgm = document.getElementById('menu-bgm');
    const url = URL.createObjectURL(file);
    bgm.src = url;
    bgm.play().catch(e => console.warn("Esperando interacción para BGM..."));
    if(typeof window.notify === 'function') window.notify("🎵 Música de menú actualizada", "success");
};

window.playRandomBGM = async function() {
    const bgm = document.getElementById('menu-bgm');
    if(!bgm) return;
    
    // Aplicar volumen guardado
    bgm.volume = (window.cfg && window.cfg.bgmVol !== undefined) ? (window.cfg.bgmVol / 100) : 0.2;

    // Si ya subió una personalizada en esta sesión, no la pisamos
    if(bgm.src && bgm.src.includes('blob:')) return;

    try {
        // Buscar una canción random top de Osu!
        const terms = ["anime", "fnf", "vocaloid", "camellia"];
        const q = terms[Math.floor(Math.random() * terms.length)];
        const res = await fetch(`https://api.nerinyan.moe/search?q=${q}&m=3`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const randomSong = data[Math.floor(Math.random() * data.length)];
            // Usamos la preview de audio de Osu para no cargar un mp3 de 5MB en el menú
            bgm.src = `https://b.ppy.sh/preview/${randomSong.id}.mp3`;
        }
    } catch(e) { console.warn("No se pudo cargar BGM de Osu", e); }
};

// Intentar reproducir en la primera interacción del usuario (Regla de navegadores)
document.addEventListener('click', function initAudioContext() {
    if(!window.bgmStarted) {
        window.bgmStarted = true;
        const bgm = document.getElementById('menu-bgm');
        if(bgm && !bgm.src) window.playRandomBGM();
        if(bgm && bgm.src && bgm.paused) bgm.play().catch(e=>{});
        
        // Desvincular para no ejecutar esto en cada clic
        document.removeEventListener('click', initAudioContext);
    }
});

// Controladores globales para apagar la música al jugar
window.pauseBGM = function() {
    const bgm = document.getElementById('menu-bgm');
    if(bgm) bgm.pause();
};
window.resumeBGM = function() {
    const bgm = document.getElementById('menu-bgm');
    // Solo resumir si no estamos en la pantalla de juego o editor
    const gameLayer = document.getElementById('game-layer');
    const editorLayer = document.getElementById('editor-layer');
    if((!gameLayer || gameLayer.style.display === 'none') && (!editorLayer || editorLayer.style.display === 'none')) {
        if(bgm) bgm.play().catch(e=>{});
    }
};

// 🚨 IMPORTANTE: Inyectar pauseBGM en tus funciones de empezar juego y resume en toMenu()
const originalToMenu = window.toMenu;
window.toMenu = function() {
    if(typeof originalToMenu === 'function') originalToMenu();
    window.resumeBGM();
};
