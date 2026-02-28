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
