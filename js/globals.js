/* === GLOBAL CONFIG & VARIABLES (STABLE) === */

const firebaseConfig = {
    apiKey: "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8",
    authDomain: "a-notes-game.firebaseapp.com",
    projectId: "a-notes-game",
    storageBucket: "a-notes-game.appspot.com",
    messagingSenderId: "149492857447",
    appId: "1:149492857447:web:584610d0958419fea7f2c2"
};

let db = null;
try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    else firebase.app();
    db = firebase.firestore();
} catch(e) { console.error("Error Firebase:", e); }

const DB_KEY="omega_u_"; 
const LAST_KEY="omega_last"; 
const CURRENT_VERSION = 102; 

// Items de la tienda
const SHOP_ITEMS = [
    { id: 'skin_neon', name: 'Pack Neón', price: 500, type: 'skin', desc: 'Notas brillantes rosas y cian', color: '#ff66aa' },
    { id: 'skin_gold', name: 'Pack Oro', price: 2000, type: 'skin', desc: 'Acabado dorado de lujo', color: '#FFD700' },
    { id: 'skin_dark', name: 'Modo Dark', price: 1000, type: 'skin', desc: 'Estilo monocromático', color: '#444' },
    { id: 'ui_cyber', name: 'Marco Cyber', price: 1500, type: 'ui', desc: 'Borde futurista para avatar', color: '#00FFFF' }
];

function createLanes(k) {
    const k4=['d','f','j','k'], k6=['s','d','f','j','k','l'], k7=['s','d','f',' ','j','k','l'], k9=['a','s','d','f',' ','h','j','k','l'];
    const cols = ['#00FFFF','#12FA05','#F9393F','#FFD700','#BD00FF','#0055FF','#FF8800','#FFFFFF','#AAAAAA'];
    const arr = [];
    for(let i=0; i<k; i++) arr.push({k: (k===4?k4: (k===6?k6:(k===7?k7:k9)))[i] || 'a', c: cols[i%9], s:'circle'});
    return arr;
}

// Configuración por defecto (Evita errores de undefined)
let cfg = { 
    spd: 22, den: 5, down: false, middleScroll: false, off: 0,
    vivid: true, shake: true, trackOp: 10, noteOp: 100,
    hideHud: false, judgeVis: true, judgeY: 40, judgeX: 50, judgeS: 7, 
    vol: 0.5, hvol: 0.6, missVol: 0.4, hitSound: true, missSound: true,
    showMs: true, showMean: true, showFC: true,
    modes: { 4: createLanes(4), 6: createLanes(6), 7: createLanes(7), 9: createLanes(9) }
};

let user = { 
    name:"Guest", pass:"", avatar:null, avatarData:null, bg:null, 
    songs:[], pp:0, sp:0, plays:0, score:0, xp:0, lvl:1, scores:{},
    inventory: [], equipped: { skin: 'default', ui: 'default' }
};

let ramSongs=[], curIdx=-1, keys=4, remapMode=null, remapIdx=null;
let ctx=null, hitBuf=null, missBuf=null; 
let songFinished = false; 
let curSongData = null; 

let peer = null, conn = null, myPeerId = null, opponentScore = 0, isMultiplayer = false;
let currentLobbyId = null; let isLobbyHost = false; let lobbyListener = null;

let st = { 
    act:false, paused:false, ctx:null, src:null, t0:0, 
    notes:[], spawned:[], keys:[], 
    sc:0, cmb:0, maxCmb:0, hp:50, 
    stats:{ s:0, g:0, b:0, m:0 }, 
    totalHits:0, maxScorePossible:0, ranked:false, startTime:0,
    songDuration: 0, lastPause: 0,
    totalOffset: 0, hitCount: 0, fcStatus: "GFC", activeHolds: [] 
};

const PATHS = {
    arrow: "M 20 20 L 50 50 L 80 20 L 80 40 L 50 70 L 20 40 Z",
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z"
};
// ==========================================
// SISTEMA DE NOTIFICACIONES GLOBAL
// ==========================================
function notify(msg, type="info", duration=4000) {
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
    setTimeout(() => { const bar = card.querySelector('.notify-progress'); if(bar) bar.style.width = '0%'; }, 50);
    setTimeout(() => { card.style.animation = "slideOut 0.3s forwards"; setTimeout(() => card.remove(), 300); }, duration);
}
