/* === GLOBAL CONFIG & VARIABLES (FIXED CONNECTION V2) === */

const firebaseConfig = {
    apiKey: "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8",
    authDomain: "a-notes-game.firebaseapp.com",
    projectId: "a-notes-game",
    storageBucket: "a-notes-game.appspot.com",
    messagingSenderId: "149492857447",
    appId: "1:149492857447:web:584610d0958419fea7f2c2"
};

// Definir db en el objeto window explícitamente para evitar problemas de alcance
window.db = null;

// Función de inicialización robusta (se puede llamar varias veces)
window.initFireBaseConnection = function() {
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log("🔥 Firebase Inicializado.");
            } else {
                firebase.app(); // Ya estaba iniciado
            }
            
            // Solo conectamos Firestore si no existe aún
            if (!window.db) {
                window.db = firebase.firestore();
                console.log("✅ Base de Datos Conectada (Firestore).");
                
                // Configuración de persistencia si es necesaria
                if(firebase.auth) {
                    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                        .catch(e => console.warn("Persistencia Auth:", e));
                }
            }
            return true;
        } else {
            console.warn("⚠️ Librería Firebase aún no cargada. Reintentando luego...");
            return false;
        }
    } catch(e) { 
        console.error("❌ Error Crítico Firebase:", e); 
        return false;
    }
};

// Intento inicial inmediato (puede fallar si el CDN es lento)
window.initFireBaseConnection();

const DB_KEY="omega_u_"; 
const LAST_KEY="omega_last"; 
const CURRENT_VERSION = 106; 

// === TIENDA COMPLETA V-ULTRA ===
// === DICCIONARIO DE FORMAS DE SKINS (AMPLIADO) ===
const SKIN_PATHS = {
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    demon: "M 50 5 L 95 95 L 5 95 Z", 
    angel: "M 50 50 m -30 0 a 30,30 0 1,0 60,0 a 30,30 0 1,0 -60,0",
    sniper: "M 45 0 L 55 0 L 55 45 L 100 45 L 100 55 L 55 55 L 55 100 L 45 100 L 45 55 L 0 55 L 0 45 L 45 45 Z",
    shuriken: "M 50 0 L 65 35 L 100 50 L 65 65 L 50 100 L 35 65 L 0 50 L 35 35 Z",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z",
    heart: "M 50,30 C 50,30 20,-10 0,20 C -20,50 50,90 50,90 C 50,90 120,50 100,20 C 80,-10 50,30 50,30 Z",
    star: "M 50,5 L 61,39 L 97,39 L 68,60 L 79,95 L 50,73 L 21,95 L 32,60 L 3,39 L 39,39 Z",
    hexagon: "M 50,5 L 90,25 L 90,75 L 50,95 L 10,75 L 10,25 Z"
};

// === LA MEGA TIENDA V-ULTRA (+40 ÍTEMS) ===
const SHOP_ITEMS = [
    // --- SKINS: COLORES FIJOS ---
    { id: 'skin_neon', name: 'Neón Cyberpunk', price: 500, type: 'skin', desc: 'Rosa brillante futurista.', color: '#ff007f', fixed: true, shape: 'circle' },
    { id: 'skin_cyan', name: 'Cyan Hacker', price: 600, type: 'skin', desc: 'Azul eléctrico puro.', color: '#00e5ff', fixed: true, shape: 'circle' },
    { id: 'skin_gold', name: 'Oro Imperial', price: 2000, type: 'skin', desc: 'Acabado de lujo dorado.', color: '#FFD700', fixed: true, shape: 'circle' },
    { id: 'skin_dark', name: 'Modo Dark', price: 1000, type: 'skin', desc: 'Gris oscuro, alto contraste.', color: '#444444', fixed: true, shape: 'circle' },
    { id: 'skin_plasma', name: 'Orbe de Plasma', price: 3000, type: 'skin', desc: 'Núcleo violeta inestable.', color: '#BD00FF', fixed: true, shape: 'circle' },
    { id: 'skin_toxic', name: 'Deshecho Tóxico', price: 2500, type: 'skin', desc: 'Verde radiactivo intenso.', color: '#39FF14', fixed: true, shape: 'circle' },
    { id: 'skin_blood', name: 'Sangre Pura', price: 2500, type: 'skin', desc: 'Rojo carmesí profundo.', color: '#FF0033', fixed: true, shape: 'circle' },
    { id: 'skin_white', name: 'Fantasma', price: 1500, type: 'skin', desc: 'Blanco puro cegador.', color: '#FFFFFF', fixed: true, shape: 'circle' },

    // --- SKINS: FORMAS CUSTOMIZABLES (Usan el color que tú elijas en settings) ---
    { id: 'skin_shuriken', name: 'Shuriken Ninja', price: 4000, type: 'skin', desc: 'Estrella arrojadiza (Gira).', color: '#FFF', fixed: false, shape: 'shuriken' },
    { id: 'skin_sniper', name: 'Mira Táctica', price: 3500, type: 'skin', desc: 'Crosshair de precisión FPS.', color: '#FFF', fixed: false, shape: 'sniper' },
    { id: 'skin_diamond', name: 'Rombo Prisma', price: 3000, type: 'skin', desc: 'Geometría afilada.', color: '#FFF', fixed: false, shape: 'diamond' },
    { id: 'skin_square', name: 'Cubo Voxel', price: 2500, type: 'skin', desc: 'Estilo retro 8-bits.', color: '#FFF', fixed: false, shape: 'square' },
    { id: 'skin_star', name: 'Estrella Pop', price: 4500, type: 'skin', desc: 'Para verdaderos ídolos.', color: '#FFF', fixed: false, shape: 'star' },
    { id: 'skin_hex', name: 'Colmena Hex', price: 3800, type: 'skin', desc: 'Hexágonos tecnológicos.', color: '#FFF', fixed: false, shape: 'hexagon' },

    // --- SKINS LEGENDARIAS (Tienen color y forma obligatoria única) ---
    { id: 'skin_demon', name: 'Ira de Demonio', price: 6000, type: 'skin', desc: 'Picos agresivos rojo sangre.', color: '#FF0000', fixed: true, shape: 'demon' },
    { id: 'skin_angel', name: 'Halo Divino', price: 6000, type: 'skin', desc: 'Anillos celestiales de luz.', color: '#00FFFF', fixed: true, shape: 'angel' },
    { id: 'skin_heart', name: 'Amor Verdadero', price: 7500, type: 'skin', desc: 'Corazones latientes.', color: '#FF1493', fixed: true, shape: 'heart' },
    { id: 'skin_crown', name: 'Rey del Ritmo', price: 10000, type: 'skin', desc: 'Corona dorada de campeón.', color: '#FFD700', fixed: true, shape: 'star' }, // Usa estrella como base glorificada

    // --- MARCOS UI PARA EL PERFIL ---
    { id: 'ui_cyber', name: 'Marco Cyber', price: 1500, type: 'ui', desc: 'Borde futurista azul luminoso.', color: '#00e5ff', fixed: true },
    { id: 'ui_blood', name: 'Marco Carnicero', price: 2000, type: 'ui', desc: 'Borde escarlata intenso.', color: '#FF0033', fixed: true },
    { id: 'ui_gold', name: 'Marco Leyenda', price: 4000, type: 'ui', desc: 'Borde de oro masivo.', color: '#FFD700', fixed: true },
    { id: 'ui_phantom', name: 'Marco Fantasma', price: 3000, type: 'ui', desc: 'Borde blanco ahumado.', color: '#FFFFFF', fixed: true },
    { id: 'ui_toxic', name: 'Marco Mutante', price: 1800, type: 'ui', desc: 'Borde verde ácido.', color: '#39FF14', fixed: true },
    { id: 'ui_void', name: 'Marco del Vacío', price: 5000, type: 'ui', desc: 'Oscuridad absoluta (Negro).', color: '#111111', fixed: true },

    // --- PISTAS PERSONALIZADAS (TRACKS) - ¡NUEVO! ---
    { id: 'track_neon', name: 'Pista Neón Pink', price: 5000, type: 'track', desc: 'Pista brillante color rosa.', color: '#ff007f', fixed: true },
    { id: 'track_cyber', name: 'Pista Matrix Cyan', price: 5000, type: 'track', desc: 'Pista hackeada azul luz.', color: '#00e5ff', fixed: true },
    { id: 'track_blood', name: 'Pista Infernal', price: 6500, type: 'track', desc: 'Camino de sangre y fuego.', color: '#FF0000', fixed: true },
    { id: 'track_gold', name: 'Pista VIP', price: 8000, type: 'track', desc: 'Alfombra dorada millonaria.', color: '#FFD700', fixed: true },
    
    // --- EFECTOS DE IMPACTO (HIT FX) - ¡NUEVO! ---
    { id: 'fx_classic', name: 'Onda Expansiva', price: 1000, type: 'hit_fx', desc: 'Anillo clásico (Default).', color: '#FFF', fixed: false },
    { id: 'fx_spark', name: 'Chispas Eléctricas', price: 3500, type: 'hit_fx', desc: 'Impacto agresivo.', color: '#FFF', fixed: false },
    { id: 'fx_smoke', name: 'Humo Ninja', price: 4000, type: 'hit_fx', desc: 'Desaparición en humo.', color: '#FFF', fixed: false }
];

function createLanes(k) {
    const k4=['d', 'f', 'j', 'k'], k6=['s', 'd', 'f', 'j', 'k', 'l'], k7=['s', 'd', 'f', ' ', 'j', 'k', 'l'], k9=['a', 's', 'd', 'f', ' ', 'h', 'j', 'k', 'l'];
    const cols = ['#00FFFF', '#12FA05', '#F9393F', '#FFD700', '#BD00FF', '#0055FF', '#FF8800', '#FFFFFF', '#AAAAAA'];
    const arr = [];
    for (let i = 0; i < k; i++) {
        let keyChar = 'a';
        if (k === 4) keyChar = k4[i];
        else if (k === 6) keyChar = k6[i];
        else if (k === 7) keyChar = k7[i];
        else if (k === 9) keyChar = k9[i];
        arr.push({ k: keyChar || 'a', c: cols[i % 9], s: 'circle' });
    }
    return arr;
}

window.cfg = { 
    spd: 22, den: 5, down: false, middleScroll: false, off: 0,
    vivid: true, shake: true, trackOp: 10, noteOp: 100,
    hideHud: false, judgeVis: true, judgeY: 40, judgeX: 50, judgeS: 7, 
    laneFlash: true, showSplash: true, splashType: 'classic',
    vol: 0.5, hvol: 0.6, missVol: 0.4, hitSound: true, missSound: true,
    showMs: true, showMean: true, showFC: true, fov: 0, noteScale: 1,
    modes: { 4: createLanes(4), 6: createLanes(6), 7: createLanes(7), 9: createLanes(9) }
};

window.user = { 
    name: "Guest", pass: "", avatar: null, avatarData: null, bg: null, 
    songs: [], pp: 0, sp: 0, plays: 0, score: 0, xp: 0, lvl: 1, scores: {},
    inventory: [], equipped: { skin: 'default', ui: 'default' },
    friends: [], requests: []
};

window.st = { 
    act: false, paused: false, ctx: null, src: null, t0: 0, 
    notes: [], spawned: [], keys: [], 
    sc: 0, cmb: 0, maxCmb: 0, hp: 50, 
    stats: { s: 0, g: 0, b: 0, m: 0 }, 
    maxScorePossible: 0, ranked: false, startTime: 0,
    songDuration: 0, lastPause: 0, pauseTime: null,
    totalOffset: 0, hitCount: 0, fcStatus: "GFC", trueMaxScore: 0,
    manualStop: false
};

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

// === VARIABLES MULTIPLAYER & ONLINE (AQUÍ ESTÁ EL FIX) ===
var peer = null;
var conn = null;
var myPeerId = null;
var opponentScore = 0;
var isMultiplayer = false;
var currentLobbyId = null;
var isLobbyHost = false;
var lobbyListener = null;

// NUEVAS VARIABLES PARA EL FIX DE INICIO Y SUBIDA:
window.preparedSong = null;     // <--- NECESARIA PARA INICIAR PARTIDA ONLINE
window.hasGameStarted = false;  // <--- NECESARIA PARA EVITAR DOBLE INICIO
window.isMultiplayerReady = false; // <--- NECESARIA PARA SINCRONIZACIÓN
// ========================================================

window.PATHS = {
    arrow: "M 20 20 L 50 50 L 80 20 L 80 40 L 50 70 L 20 40 Z",
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z"
};

window.notify = function(msg, type="info", duration=4000) {
    const area = document.getElementById('notification-area');
    if (!area) return console.log(msg); 
    const card = document.createElement('div');
    card.className = 'notify-card';
    if (type === "error") card.style.borderLeftColor = "#F9393F";
    else if (type === "success") card.style.borderLeftColor = "#12FA05";
    else card.style.borderLeftColor = "#44ccff";
    card.innerHTML = `<div class="notify-title">${type.toUpperCase()}</div><div class="notify-body">${msg}</div><div class="notify-progress" style="height:3px; background:rgba(255,255,255,0.5); width:100%; position:absolute; bottom:0; left:0; transition:width ${duration}ms linear;"></div>`;
    area.appendChild(card);
    setTimeout(() => { const bar = card.querySelector('.notify-progress'); if (bar) bar.style.width = '0%'; }, 50);
    setTimeout(() => { card.style.animation = "slideOut 0.3s forwards"; setTimeout(() => card.remove(), 300); }, duration);
};
