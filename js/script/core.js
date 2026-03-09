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
// 🎵 SISTEMA DE MÚSICA DE FONDO (BGM) GLOBAL - FIJADO
// =====================================================================
window.bgmStarted = false;

window.updateBgmVolume = function(val) {
    const bgm = document.getElementById('menu-bgm');
    if(bgm) bgm.volume = val / 100;
    // Guardamos en la config global para que persista
    if(!window.cfg) window.cfg = {};
    window.cfg.bgmVol = val;
    localStorage.setItem('a_notes_cfg', JSON.stringify(window.cfg));
};

window.playRandomBGM = async function() {
    const bgm = document.getElementById('menu-bgm');
    if(!bgm || window.bgmStarted) return;
    
    if(bgm.src && bgm.src.includes('blob:')) return;

    bgm.volume = (window.cfg && window.cfg.bgmVol !== undefined) ? (window.cfg.bgmVol / 100) : 0.2;

    try {
        const terms = ["anime", "vocaloid", "camellia", "touhou", "j-pop", "hardcore"];
        const q = terms[Math.floor(Math.random() * terms.length)];
        
        // Buscamos en la API de Osu!
        const res = await fetch(`https://api.nerinyan.moe/search?q=${encodeURIComponent(q)}&m=3`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const randomSong = data[Math.floor(Math.random() * data.length)];
            
            // 🚨 EL FIX: Cambiamos 'b.ppy.sh/preview' (que es corto) por un mirror de audio completo
            bgm.src = `https://catboy.best/api/v2/audio/${randomSong.id}`;
            bgm.loop = true; // Ahora el loop durará minutos, no segundos
            
            await bgm.play();
            window.bgmStarted = true;
            console.log("🎶 BGM Full cargado: " + randomSong.title);
        }
    } catch(e) { 
        console.warn("⚠️ Mirror de audio falló, usando preview de respaldo...", e);
        // Si el mirror falla, usamos el preview como plan B
    }
};

// 🚨 TRIGGER MAESTRO: Activa el BGM en el primer clic del usuario en la pantalla
document.addEventListener('mousedown', function startEverything() {
    // Desbloqueamos el audio general del juego
    window.unlockAudio();
    
    // Si el BGM aún no suena, lo lanzamos
    if (!window.bgmStarted) {
        window.playRandomBGM();
    }
    
    // Eliminamos este "escuchador" para que no se ejecute en cada clic
    document.removeEventListener('mousedown', startEverything);
}, { once: true });
// Intentar reproducir en la primera interacción del usuario (Regla de navegadores)
// =====================================================================
// 🔔 SISTEMA GLOBAL DE CIERRE DE VENTANAS Y NOTIFICACIONES
// =====================================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => {
            if(m.style.display !== 'none' && m.id !== 'loading-overlay' && m.id !== 'modal-res' && m.id !== 'automap-modal') {
                m.style.display = 'none';
            }
        });
        const notifPanel = document.getElementById('notif-panel');
        if (notifPanel) notifPanel.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    // Cierra modal si das clic en el fondo oscuro
    if (e.target.classList.contains('modal-overlay') && e.target.id !== 'loading-overlay' && e.target.id !== 'modal-res') {
        e.target.style.display = 'none';
    }

    // 🚨 FIX: Cierre inteligente usando TU botón exacto
    const notifPanel = document.getElementById('notif-panel');
    const notifBtn = document.getElementById('notif-bell'); // <--- Conectado a tu HTML
    
    if (notifPanel && notifPanel.style.display !== 'none') {
        if (!notifPanel.contains(e.target) && (!notifBtn || !notifBtn.contains(e.target))) {
            notifPanel.style.display = 'none';
        }
    }
});

// =====================================================================
// 🔔 MOTOR INTELIGENTE DE NOTIFICACIONES (CON CONTADOR ROJO)
// =====================================================================

// Abrir el panel y limpiar el contador de mensajes nuevos
window.openNotifPanel = function(event) {
    if (event) event.stopPropagation(); 
    // 🚨 CONECTADO AL NUEVO ID ÚNICO
    const panel = document.getElementById('notif-dropdown-panel');
    const badge = document.getElementById('notif-badge');
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        if (badge) { badge.innerText = '0'; badge.style.display = 'none'; }
    } else panel.style.display = 'none';
};

function initNotifPanel() {
    let panel = document.getElementById('notif-panel');
    if (panel && !document.getElementById('notif-list')) {
        panel.innerHTML = `
            <div style="padding: 15px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; align-items: center; background: #0a0a0a;">
                <h3 style="margin: 0; color: #00ffff; font-size: 1.2rem; text-shadow: 0 0 10px #00ffff;">🔔 NOTIFICACIONES</h3>
                <button onclick="clearNotifs()" style="background: none; border: none; color: #F9393F; cursor: pointer; font-weight: bold;">Limpiar</button>
            </div>
            <div id="notif-list" style="max-height: 350px; overflow-y: auto; padding: 10px; background: #111;">
                <div id="notif-empty" style="color: #666; text-align: center; padding: 20px;">No hay notificaciones recientes.</div>
            </div>
        `;
    }
}

window.clearNotifs = function() {
    const list = document.getElementById('notif-list');
    if(list) list.innerHTML = '<div id="notif-empty" style="color: #666; text-align: center; padding: 20px;">No hay notificaciones recientes.</div>';
};

window.notify = function(msg, type = "info") {
    // 1. TOAST FLOTANTE
    let toastContainer = document.getElementById('notification-area');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'notification-area';
        toastContainer.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    let color = type === 'success' ? '#12FA05' : (type === 'error' ? '#F9393F' : '#00ffff');
    
    toast.style.cssText = `
        background: rgba(10, 10, 14, 0.95); border-left: 4px solid ${color};
        color: white; padding: 15px 20px; border-radius: 4px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-weight: bold; font-family: sans-serif;
        transform: translateX(120%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        min-width: 250px; pointer-events: none;
    `;
    toast.innerHTML = `<span style="color:${color}; margin-right:8px;">●</span> ${msg}`;
    toastContainer.appendChild(toast);
    
    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);

    // 🚨 FILTRO: Ignorar el mensaje de bienvenida para no saturar
    if (msg.toLowerCase().includes('bienvenid')) return; 

    // 2. REGISTRO EN EL PANEL
    initNotifPanel();
    const list = document.getElementById('notif-list');
    const emptyMsg = document.getElementById('notif-empty');
    
    if (list) {
        if (emptyMsg) emptyMsg.remove();
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const item = document.createElement('div');
        item.style.cssText = `padding: 12px; border-bottom: 1px solid #222; font-size: 0.95rem; display: flex; gap: 10px; align-items: start; animation: popFade 0.3s forwards;`;
        item.innerHTML = `
            <span style="color: ${color}; font-weight: 900; font-size: 0.8rem; margin-top: 3px;">[${time}]</span> 
            <span style="color: #ddd; line-height: 1.4;">${msg}</span>
        `;
        list.insertBefore(item, list.firstChild); 
        
        // 3. AUMENTAR EL CONTADOR ROJO
        const badge = document.getElementById('notif-badge');
        const panel = document.getElementById('notif-panel');
        // Solo sumamos a la bolita roja si el panel está CERRADO
        if (badge && (!panel || panel.style.display === 'none' || panel.style.display === '')) {
            let count = parseInt(badge.innerText) || 0;
            badge.innerText = count + 1;
            badge.style.display = 'block';
        }
    }
};;
