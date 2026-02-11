/* === GLOBAL CONFIG & VARIABLES (FIXED V3) === */

// 1. CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8",
    authDomain: "a-notes-game.firebaseapp.com",
    projectId: "a-notes-game",
    storageBucket: "a-notes-game.appspot.com",
    messagingSenderId: "149492857447",
    appId: "1:149492857447:web:584610d0958419fea7f2c2"
};

// 2. INICIALIZAR FIREBASE
var db = null; // Usamos var para asegurar acceso global
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        else firebase.app();
        db = firebase.firestore();
        console.log("Firebase inicializado correctamente.");
    }
} catch(e) { 
    console.error("Error crítico Firebase:", e); 
}

const DB_KEY = "omega_u_"; 
const LAST_KEY = "omega_last"; 
const CURRENT_VERSION = 104; 

// 3. ITEMS DE TIENDA
¡Hecho! Tienes toda la razón, ver solo círculos de colores no te dice nada sobre si la skin es un Shuriken, un Demonio o una Mira.

Para arreglar esto, he movido las definiciones de las formas (SVG Paths) a globals.js para que tanto el juego como la tienda puedan usarlas. Ahora la tienda renderizará la forma exacta de la nota.

Aquí tienes la actualización V115 "Shop Preview".

1. js/globals.js (Agregar Rutas de Skins)
Agregamos SKIN_PATHS aquí para que la tienda sepa qué dibujar.

JavaScript

/* === GLOBAL CONFIG (V115 - SHARED PATHS) === */

// ... (Firebase config y variables db, user, cfg siguen igual) ...

// DICCIONARIO DE FORMAS DE SKINS (Global para Tienda y Juego)
const SKIN_PATHS = {
    // Básicos
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    
    // Skins Avanzadas
    demon: "M 50 5 L 95 95 L 5 95 Z", // Triángulo agresivo
    angel: "M 50 50 m -30 0 a 30,30 0 1,0 60,0 a 30,30 0 1,0 -60,0", // Anillo fino
    sniper: "M 45 0 L 55 0 L 55 45 L 100 45 L 100 55 L 55 55 L 55 100 L 45 100 L 45 55 L 0 55 L 0 45 L 45 45 Z", // Cruz
    shuriken: "M 50 0 L 65 35 L 100 50 L 65 65 L 50 100 L 35 65 L 0 50 L 35 35 Z" // Estrella
};

const SHOP_ITEMS = [
    // SKINS BÁSICAS
    { id: 'skin_neon', name: 'Pack Neón', price: 500, type: 'skin', desc: 'Estilo Cyberpunk.', color: '#ff66aa', fixed: true, shape: 'circle' },
    { id: 'skin_gold', name: 'Pack Oro', price: 2000, type: 'skin', desc: 'Acabado dorado.', color: '#FFD700', fixed: true, shape: 'circle' },
    { id: 'skin_dark', name: 'Modo Dark', price: 1000, type: 'skin', desc: 'Alto contraste.', color: '#444', fixed: true, shape: 'circle' },
    
    // SKINS AVANZADAS (Con forma definida)
    { id: 'skin_demon', name: 'Demon Spikes', price: 3500, type: 'skin', desc: 'Notas agresivas.', color: '#FF0000', fixed: true, shape: 'demon' },
    { id: 'skin_angel', name: 'Holy Halo', price: 3500, type: 'skin', desc: 'Anillos divinos.', color: '#00FFFF', fixed: true, shape: 'angel' },
    { id: 'skin_shuriken', name: 'Ninja Star', price: 4000, type: 'skin', desc: 'Shurikens giratorios. (Tu Color)', color: '#FFF', fixed: false, shape: 'shuriken' },
    { id: 'skin_sniper', name: 'Crosshair', price: 3000, type: 'skin', desc: 'Miras tácticas. (Tu Color)', color: '#0F0', fixed: false, shape: 'sniper' },
    { id: 'skin_plasma', name: 'Plasma Orb', price: 5000, type: 'skin', desc: 'Núcleo de energía.', color: '#BD00FF', fixed: true, shape: 'circle' },
    
    // UI
    { id: 'ui_cyber', name: 'Marco Cyber', price: 1500, type: 'ui', desc: 'Borde futurista.', color: '#00FFFF', fixed: true }
];
// 4. GENERADOR DE CARRILES (TECLAS)
function createLanes(k) {
    const k4 = ['d','f','j','k'];
    const k6 = ['s','d','f','j','k','l'];
    const k7 = ['s','d','f',' ','j','k','l'];
    const k9 = ['a','s','d','f',' ','h','j','k','l'];
    
    const cols = ['#00FFFF','#12FA05','#F9393F','#FFD700','#BD00FF','#0055FF','#FF8800','#FFFFFF','#AAAAAA'];
    const arr = [];
    
    for(let i=0; i<k; i++) {
        let keyChar = 'a';
        if(k===4) keyChar = k4[i];
        else if(k===6) keyChar = k6[i];
        else if(k===7) keyChar = k7[i];
        else if(k===9) keyChar = k9[i];

        arr.push({
            k: keyChar || 'a', 
            c: cols[i % 9], 
            s: 'circle'
        });
    }
    return arr;
}

// 5. VARIABLES GLOBALES (ESTADO & CONFIG)
// Usamos window.cfg para forzar registro global
window.cfg = { 
    spd: 22, 
    den: 5, 
    down: false, 
    middleScroll: false, 
    off: 0,
    vivid: true, 
    shake: true, 
    trackOp: 10, 
    noteOp: 100,
    hideHud: false, 
    judgeVis: true, 
    judgeY: 40, 
    judgeX: 50, 
    judgeS: 7, 
    
    // === NUEVOS AJUSTES VISUALES ===
    laneFlash: true,       // Iluminar carril al pulsar
    showSplash: true,      // Mostrar efecto al dar nota
    splashType: 'classic', // Tipos: classic, fire, electric, star, text
    // ===============================

    vol: 0.5, 
    hvol: 0.6, 
    missVol: 0.4, 
    hitSound: true, 
    missSound: true,
    showMs: true, 
    showMean: true, 
    showFC: true,
    fov: 0,
    modes: { 
        4: createLanes(4), 
        6: createLanes(6), 
        7: createLanes(7), 
        9: createLanes(9) 
    }
};
// Alias corto para uso interno
var cfg = window.cfg;

window.user = { 
    name: "Guest", pass: "", avatar: null, avatarData: null, bg: null, 
    songs: [], pp: 0, sp: 0, plays: 0, score: 0, xp: 0, lvl: 1, scores: {},
    inventory: [], equipped: { skin: 'default', ui: 'default' }
};
var user = window.user;

window.st = { 
    act: false, paused: false, ctx: null, src: null, t0: 0, 
    notes: [], spawned: [], keys: [], 
    sc: 0, cmb: 0, maxCmb: 0, hp: 50, 
    stats: { s: 0, g: 0, b: 0, m: 0 }, 
    totalHits: 0, maxScorePossible: 0, ranked: false, startTime: 0,
    songDuration: 0, lastPause: 0,
    totalOffset: 0, hitCount: 0, fcStatus: "GFC", activeHolds: [] 
};
var st = window.st;

// Variables de sistema
var ramSongs = [];
var curIdx = -1;
var keys = 4;
var remapMode = null;
var remapIdx = null;
var ctx = null;
var hitBuf = null;
var missBuf = null; 
var songFinished = false; 
var curSongData = null; 

var peer = null;
var conn = null;
var myPeerId = null;
var opponentScore = 0;
var isMultiplayer = false;
var currentLobbyId = null;
var isLobbyHost = false;
var lobbyListener = null;

const PATHS = {
    arrow: "M 20 20 L 50 50 L 80 20 L 80 40 L 50 70 L 20 40 Z",
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z"
};

// 6. SISTEMA DE NOTIFICACIONES
window.notify = function(msg, type="info", duration=4000) {
    const area = document.getElementById('notification-area');
    if(!area) return console.log(msg); 
    
    const card = document.createElement('div');
    card.className = 'notify-card';
    if(type==="error") card.style.borderLeftColor = "#F9393F";
    else if(type==="success") card.style.borderLeftColor = "#12FA05";
    else card.style.borderLeftColor = "#44ccff";
    
    card.innerHTML = `
        <div class="notify-title">${type.toUpperCase()}</div>
        <div class="notify-body">${msg}</div>
        <div class="notify-progress" style="height:3px; background:rgba(255,255,255,0.5); width:100%; position:absolute; bottom:0; left:0; transition:width ${duration}ms linear;"></div>
    `;
    
    area.appendChild(card);
    setTimeout(() => { 
        const bar = card.querySelector('.notify-progress'); 
        if(bar) bar.style.width = '0%'; 
    }, 50);
    setTimeout(() => { 
        card.style.animation = "slideOut 0.3s forwards"; 
        setTimeout(() => card.remove(), 300); 
    }, duration);
};
