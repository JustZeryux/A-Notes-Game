const firebaseConfig = {
  apiKey: "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8",
  authDomain: "a-notes-game.firebaseapp.com",
  projectId: "a-notes-game",
  storageBucket: "a-notes-game.firebasestorage.app",
  messagingSenderId: "149492857447",
  appId: "1:149492857447:web:584610d0958419fea7f2c2"
};

let db, auth;
try {
    if(firebaseConfig.apiKey !== "AIzaSyAcUwZ5VavXy4WAUIlF6Tl_qMzAykI2EN8") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase OK");
    }
} catch(e) { console.error(e); }

const DB_KEY="omega_u_"; const LAST_KEY="omega_last"; const DB_NAME="OmegaDB"; const DB_STORE="songs";
const CURRENT_VERSION = 81;

let cfg = { spd:22, den:5, vol:0.5, hvol:0.6, down:false, vivid:true, shake:true, off:0, trackOp:10, judgeY:40, judgeX:50, judgeS:7, judgeVis:true, modes:{4:createLanes(4), 6:createLanes(6), 7:createLanes(7), 9:createLanes(9)} };
let user = { name:"Guest", xp:0, lvl:1, pp:0, plays:0, score:0, friends:[], requests:[], online:true, lastSeen:Date.now() };
let ramSongs=[], curIdx=-1, keys=4, remapMode=null, remapIdx=null;
let ctx=null, hitBuf=null, idb=null;
let songFinished = false; 

let peer=null, conn=null, myPeerId=null, opponentScore=0, isMultiplayer=false;
let onlineState = { myPick:null, oppPick:null };
let currentChatRoom=null, chatListener=null, selectedFriend=null;
let openChats=[];

let st = { act:false, paused:false, ctx:null, src:null, t0:0, notes:[], spawned:[], keys:[], sc:0, cmb:0, hp:50, stats:{s:0,g:0,b:0,m:0}, totalHits:0, maxScorePossible:0, ranked:false, startTime:0 };

const PATHS = {
    arrow: "M 20 20 L 50 50 L 80 20 L 80 40 L 50 70 L 20 40 Z",
    circle: "M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0",
    square: "M 15,15 L 85,15 L 85,85 L 15,85 Z",
    diamond: "M 50,10 L 90,50 L 50,90 L 10,50 Z"
};

function createLanes(k){ const arr=[]; for(let i=0;i<k;i++) arr.push({k:['d','f','j','k','s','l','a','h'][i]||'a', c:'#fff', s:'circle'}); return arr; }
