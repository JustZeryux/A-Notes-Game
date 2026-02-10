/* === AUTH SYSTEM (V3 FINAL) === */

if(firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error persistencia:", error));
}

function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
             notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Recarga.", 10000);
        }
    });
}

async function loadData() {
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Conectando..."; }

    firebase.auth().onAuthStateChanged(async (u) => {
        if (u) {
            console.log("Sesión activa:", u.email || u.uid);
            let userDoc = await db.collection("users").where("uid", "==", u.uid).get();
            
            if(userDoc.empty) {
                userDoc = await db.collection("users").where("email", "==", u.email).get();
            }

            if(!userDoc.empty) {
                const data = userDoc.docs[0].data();
                await fetchUserProfile(data.name);
            } else {
                console.log("Usuario Auth sin DB. Requiere registro.");
                firebase.auth().signOut();
                loadGuestConfig();
                finishLoad();
            }
        } else {
            const localName = localStorage.getItem(LAST_KEY);
            if (localName && localName !== "Guest") {
                await fetchUserProfile(localName);
            } else {
                loadGuestConfig();
                finishLoad();
            }
        }
    });
}

async function fetchUserProfile(name) {
    if(!db) { finishLoad(); return; }
    try {
        const doc = await db.collection("users").doc(name).get();
        if (doc.exists) {
            const data = doc.data();
            if(data.sp === undefined) data.sp = 0;
            if(data.scores === undefined) data.scores = {};
            user = { ...user, ...data };
            if(data.savedCfg) cfg = { ...cfg, ...data.savedCfg };
            else applyCfg();
            localStorage.setItem(LAST_KEY, name);
            notify("Hola, " + name, "success");
        }
    } catch (e) { notify("Error perfil", "error"); loadGuestConfig(); }
    finishLoad();
}

function loadGuestConfig() {
    const localCfg = localStorage.getItem(DB_KEY + "Guest_CFG");
    if(localCfg) cfg = { ...cfg, ...JSON.parse(localCfg) };
    user.name = "Guest";
}

function finishLoad() {
    if(typeof applyCfg === 'function') applyCfg();
    if(typeof updUI === 'function') updUI();
    document.getElementById('loading-overlay').style.display = 'none';
    if(typeof renderMenu === 'function') renderMenu();
}

// === GOOGLE LOGIN ===
function loginGoogle() {
    if(!db) return notify("Error: DB no conectada", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider).then(async (result) => {
        const u = result.user;
        const qUid = await db.collection("users").where("uid", "==", u.uid).get();
        if(!qUid.empty) return; 

        const qEmail = await db.collection("users").where("email", "==", u.email).get();
        if(!qEmail.empty) {
            const docId = qEmail.docs[0].id;
            await db.collection("users").doc(docId).update({ uid: u.uid });
            return;
        }

        // Si no existe, abrir modal para elegir nombre
        window.tempGoogleUser = u;
        document.getElementById('modal-finish-reg').style.display = 'flex';
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

async function finishGoogleRegistration() {
    const name = document.getElementById('reg-google-user').value.trim();
    if (!name || /[^a-zA-Z0-9]/.test(name)) return notify("Nombre inválido", "error");
    
    const check = await db.collection("users").doc(name).get();
    if (check.exists) return notify("Nombre ocupado", "error");

    const u = window.tempGoogleUser;
    const newUser = {
        name: name, email: u.email, uid: u.uid, pass: "google-auth",
        xp: 0, lvl: 1, pp: 0, sp: 0, plays: 0, score: 0,
        friends: [], avatarData: u.photoURL, online: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(), scores: {}
    };

    await db.collection("users").doc(name).set(newUser);
    await db.collection("leaderboard").doc(name).set({ name: name, pp: 0, score: 0, lvl: 1 });

    notify("Cuenta creada!", "success");
    document.getElementById('modal-finish-reg').style.display = 'none';
    location.reload();
}

function linkGoogleAccount() {
    if(!firebase.auth().currentUser) {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(async (result) => {
            await db.collection("users").doc(user.name).update({
                email: result.user.email,
                uid: result.user.uid,
                pass: "google-auth"
            });
            notify("Vinculado con éxito", "success");
        }).catch(e => notify("Error: " + e.message, "error"));
    } else {
        notify("Ya estás vinculado", "info");
    }
}

async function changeUsername() {
    const newName = document.getElementById('new-username').value.trim();
    if (!newName || /[^a-zA-Z0-9]/.test(newName)) return notify("Nombre inválido", "error");
    
    const check = await db.collection("users").doc(newName).get();
    if (check.exists) return notify("Nombre ocupado", "error");

    if(!confirm("¿Cambiar nombre a " + newName + "?")) return;

    const oldName = user.name;
    const data = {...user};
    data.name = newName;

    await db.collection("users").doc(newName).set(data);
    await db.collection("leaderboard").doc(newName).set({name:newName, pp:user.pp, score:user.score, lvl:user.lvl});
    await db.collection("users").doc(oldName).delete();
    await db.collection("leaderboard").doc(oldName).delete();

    localStorage.setItem(LAST_KEY, newName);
    notify("Nombre cambiado. Recargando...", "success");
    setTimeout(() => location.reload(), 1500);
}

function login() { const u = document.getElementById('l-user').value.trim(); const p = document.getElementById('l-pass').value.trim(); if(!u||!p)return notify("Datos?","error"); db.collection("users").doc(u).get().then(d=>{if(d.exists){if(d.data().pass===p){localStorage.setItem(LAST_KEY,u);location.reload();}else notify("Pass mal","error");}else notify("No existe","error");}); }
function register() { const u = document.getElementById('l-user').value.trim(); const p = document.getElementById('l-pass').value.trim(); if(!u||!p)return; if(/[^a-zA-Z0-9]/.test(u))return notify("Solo letras/nums","error"); db.collection("users").doc(u).get().then(d=>{if(d.exists)notify("Ya existe","error");else createLocalUser(u,p);});}
async function createLocalUser(n,p) { await db.collection("users").doc(n).set({name:n,pass:p,xp:0,lvl:1,score:0,friends:[],online:true,scores:{}}); await db.collection("leaderboard").doc(n).set({name:n,pp:0,score:0,lvl:1}); localStorage.setItem(LAST_KEY,n); location.reload(); }
function logout() { if(db&&user.name!=="Guest")db.collection("users").doc(user.name).update({online:false}); localStorage.removeItem(LAST_KEY); if(firebase.auth)firebase.auth().signOut(); location.reload(); }
function save() { const d={user:user,cfg:cfg}; if(user.name!=="Guest"){ localStorage.setItem(DB_KEY+user.name,JSON.stringify(d)); if(db)db.collection("users").doc(user.name).set({...user,savedCfg:cfg},{merge:true}); } else { localStorage.setItem(DB_KEY+"Guest_CFG",JSON.stringify(cfg)); } if(typeof updUI==='function')updUI(); }
function openLeaderboard() { if(db) { db.collection("leaderboard").orderBy("pp","desc").limit(50).onSnapshot(s=>{const l=document.getElementById('rank-list');l.innerHTML='';let i=1;s.forEach(d=>{const x=d.data();const tr=document.createElement('tr');if(x.name===user.name)tr.className='rank-row-me';let av=x.avatarData?`<div class="rank-av" style="background-image:url(${x.avatarData})"></div>`:'<div class="rank-av"></div>';tr.innerHTML=`<td>#${i++}</td><td>${av}${x.name}</td><td style="color:var(--blue)">${x.pp}pp</td>`;l.appendChild(tr);});});openModal('rank');} }
function updateFirebaseScore() { if(db&&user.name!=="Guest") { db.collection("leaderboard").doc(user.name).set({name:user.name,pp:user.pp,score:user.score,lvl:user.lvl,avatarData:user.avatarData},{merge:true}); db.collection("users").doc(user.name).set({name:user.name,score:user.score,pp:user.pp,lvl:user.lvl,sp:user.sp,scores:user.scores},{merge:true}); } }
function changePassword() { const n=document.getElementById('new-pass').value; if(!n||n.length<4)return notify("Pass corto","error"); if(user.pass==="google-auth")return notify("Es cuenta Google","error"); db.collection("users").doc(user.name).update({pass:n}).then(()=>{user.pass=n;save();notify("Pass cambiado");document.getElementById('new-pass').value="";}); }
async function initDB(){return Promise.resolve();}
