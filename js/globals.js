// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8",
    authDomain: "a-notes-game.firebaseapp.com",
    projectId: "a-notes-game",
    // ⚠️ IMPORTANTE: Si esto falla, intenta cambiar esto a: "a-notes-game.appspot.com"
    storageBucket: "a-notes-game.firebasestorage.app", 
    messagingSenderId: "149492857447",
    appId: "1:149492857447:web:584610d0958419fea7f2c2"
};

let db = null;
let storage = null; 

try {
    if(firebaseConfig.apiKey !== "TU_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage(); 
        console.log("Firebase (DB + Storage) Conectado");
    }
} catch(e) { console.error("Error Firebase:", e); }

const DB_KEY="omega_u_"; 
const LAST_KEY="omega_last"; 
const CURRENT_VERSION = 96; 

function createLanes(k) {
    const k4=['d','f','j','k'], k6=['s','d','f','j','k','l'], k7=['s','d','f',' ','j','k','l'], k9=['a','s','d','f',' ','h','j','k','l'];
    const cols = ['#00FFFF','#12FA05','#F9393F','#FFD700','#BD00FF','#0055FF','#FF8800','#FFFFFF','#AAAAAA'];
    const arr = [];
    for(let i=0; i<k; i++) arr.push({k: (k===4?k4: (k===6?k6:(k===7?k7:k9)))[i] || 'a', c: cols[i%9], s:'circle'});
    return arr;
}

let cfg = { 
    spd:22, den:5, vol:0.5, hvol:0.6, down:false, vivid:true, shake:true, off:0, trackOp:10, judgeY:40, judgeX:50, judgeS:7, judgeVis:true,
    modes: { 4: createLanes(4), 6: createLanes(6), 7: createLanes(7), 9: createLanes(9) }
};

let user = { name:"Guest", pass:"", avatar:null, avatarData:null, bg:null, songs:[], pp:0, sp:0, plays:0, score:0, xp:0, lvl:1, scores:{} };

let ramSongs=[], curIdx=-1, keys=4, remapMode=null, remapIdx=null;
let ctx=null, hitBuf=null;
let songFinished = false; 
let curSongData = null; 

// ONLINE & LOBBY VARIABLES
let peer = null, conn = null, myPeerId = null, opponentScore = 0, isMultiplayer = false;
let onlineState = { myPick: null, oppPick: null };
let currentChatRoom = null, chatListener = null;
let selectedFriend = null; 
let currentLobbyId = null;
let isLobbyHost = false;
let lobbyPlayers = []; 
let lobbyListener = null;

let st = { 
    act:false, paused:false, ctx:null, src:null, t0:0, 
    notes:[], spawned:[], keys:[], 
    sc:0, cmb:0, hp:50, stats:{s:0,g:0,b:0,m:0}, 
    totalHits:0, maxScorePossible:0, ranked:false, startTime:0,
    songDuration: 0, lastPause: 0
};

const PATHS = {
    arrow: "M 20 20 L 50 50 L 80 20 L 80 40 L 50 70 L 20 40 Z",
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z"
};

const BOTS = [ {n:"Cookiezi", p:1500}, {n:"Mrekk", p:1450}, {n:"WhiteCat", p:1300}, {n:"Ryuk", p:1200} ];
