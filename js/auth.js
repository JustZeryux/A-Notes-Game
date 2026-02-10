/* === AUTH SYSTEM (FIXED V4 - SAFETY CHECKS) === */

// Configuración de persistencia
if(typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error persistencia:", error));
}

// --- HELPER DE SEGURIDAD ---
// Esto evita el error "notify is not defined" si ui.js aún no cargó
function safeNotify(msg, type="info") {
    if (typeof notify === 'function') {
        notify(msg, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${msg}`);
    }
}

function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
             // Verificamos si existe la función interactiva antes de llamarla
             if(typeof notifyInteractive === 'function') {
                notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Recarga.", 10000);
             } else {
                console.log("¡ACTUALIZACIÓN DISPONIBLE!");
             }
        }
    });
}

async function loadData() {
    const loader = document.getElementById('loading-overlay');
    if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "Conectando..."; }

    if(!firebase.auth) {
        console.error("Firebase Auth no está inicializado");
        finishLoad();
        return;
    }

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
            
            // Actualizar variable global user
            if(typeof user !== 'undefined') {
                Object.assign(user, data); // Fusionar datos seguramente
            }
            
            // Cargar configuración guardada
            if(data.savedCfg && typeof cfg !== 'undefined') {
                Object.assign(cfg, data.savedCfg);
            } else if (typeof applyCfg === 'function') {
                applyCfg();
            }

            localStorage.setItem(LAST_KEY, name);
            safeNotify("Hola, " + name, "success");
        } else {
            // El usuario estaba en localStorage pero no en DB
            loadGuestConfig();
        }
    } catch (e) { 
        console.error(e);
        safeNotify("Error al cargar perfil", "error"); 
        loadGuestConfig(); 
    }
    finishLoad();
}

function loadGuestConfig() {
    const localCfg = localStorage.getItem(DB_KEY + "Guest_CFG");
    if(localCfg && typeof cfg !== 'undefined') Object.assign(cfg, JSON.parse(localCfg));
    if(typeof user !== 'undefined') user.name = "Guest";
}

function finishLoad() {
    if(typeof applyCfg === 'function') applyCfg();
    if(typeof updUI === 'function') updUI();
    
    const loader = document.getElementById('loading-overlay');
    if(loader) loader.style.display = 'none';
    
    if(typeof renderMenu === 'function') renderMenu();
}

// === GOOGLE LOGIN ===
function loginGoogle() {
    if(!db) return safeNotify("Error: DB no conectada", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider).then(async (result) => {
        const u = result.user;
        const qUid = await db.collection("users").where("uid", "==", u.uid).get();
        if(!qUid.empty) return; // Ya existe y se logueará automáticamente por onAuthStateChanged

        const qEmail = await db.collection("users").where("email", "==", u.email).get();
        if(!qEmail.empty) {
            // Existe por email pero no tenía UID vinculado
            const docId = qEmail.docs[0].id;
            await db.collection("users").doc(docId).update({ uid: u.uid });
            return;
        }

        // Si no existe, abrir modal para elegir nombre
        window.tempGoogleUser = u;
        const modal = document.getElementById('modal-finish-reg');
        if(modal) modal.style.display = 'flex';
        
    }).catch(e => safeNotify("Error Google: " + e.message, "error"));
}

async function finishGoogleRegistration() {
    const nameInput = document.getElementById('reg-google-user');
    const name = nameInput ? nameInput.value.trim() : "";
    
    if (!name || /[^a-zA-Z0-9]/.test(name)) return safeNotify("Nombre inválido (Solo letras/nums)", "error");
    
    const check = await db.collection("users").doc(name).get();
    if (check.exists) return safeNotify("Nombre ocupado", "error");

    const u = window.tempGoogleUser;
    if(!u) return safeNotify("Error de sesión temporal. Reintenta.", "error");

    const newUser = {
        name: name, email: u.email, uid: u.uid, pass: "google-auth",
        xp: 0, lvl: 1, pp: 0, sp: 0, plays: 0, score: 0,
        friends: [], avatarData: u.photoURL, online: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(), scores: {}
    };

    await db.collection("users").doc(name).set(newUser);
    await db.collection("leaderboard").doc(name).set({ name: name, pp: 0, score: 0, lvl: 1 });

    safeNotify("Cuenta creada!", "success");
    const modal = document.getElementById('modal-finish-reg');
    if(modal) modal.style.display = 'none';
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
            safeNotify("Vinculado con éxito", "success");
        }).catch(e => safeNotify("Error: " + e.message, "error"));
    } else {
        safeNotify("Ya estás vinculado", "info");
    }
}

async function changeUsername() {
    const input = document.getElementById('new-username');
    const newName = input ? input.value.trim() : "";
    
    if (!newName || /[^a-zA-Z0-9]/.test(newName)) return safeNotify("Nombre inválido", "error");
    
    const check = await db.collection("users").doc(newName).get();
    if (check.exists) return safeNotify("Nombre ocupado", "error");

    if(!confirm("¿Cambiar nombre a " + newName + "?")) return;

    const oldName = user.name;
    const data = {...user};
    data.name = newName;

    // Migración de datos
    await db.collection("users").doc(newName).set(data);
    await db.collection("leaderboard").doc(newName).set({name:newName, pp:user.pp, score:user.score, lvl:user.lvl});
    
    // Eliminar viejos
    await db.collection("users").doc(oldName).delete();
    await db.collection("leaderboard").doc(oldName).delete();

    localStorage.setItem(LAST_KEY, newName);
    safeNotify("Nombre cambiado. Recargando...", "success");
    setTimeout(() => location.reload(), 1500);
}

// Funciones locales (Login/Register/Etc)
function login() { 
    const u = document.getElementById('l-user').value.trim(); 
    const p = document.getElementById('l-pass').value.trim(); 
    if(!u||!p)return safeNotify("Faltan datos","error"); 
    
    db.collection("users").doc(u).get().then(d=>{
        if(d.exists){
            if(d.data().pass===p){
                localStorage.setItem(LAST_KEY,u);
                location.reload();
            } else safeNotify("Contraseña incorrecta","error");
        } else safeNotify("Usuario no existe","error");
    }); 
}

function register() { 
    const u = document.getElementById('l-user').value.trim(); 
    const p = document.getElementById('l-pass').value.trim(); 
    if(!u||!p)return; 
    if(/[^a-zA-Z0-9]/.test(u))return safeNotify("Solo letras y números","error"); 
    
    db.collection("users").doc(u).get().then(d=>{
        if(d.exists) safeNotify("Usuario ya existe","error");
        else createLocalUser(u,p);
    });
}

async function createLocalUser(n,p) { 
    await db.collection("users").doc(n).set({
        name:n, pass:p, xp:0, lvl:1, score:0, friends:[], online:true, scores:{}, sp:0, pp:0, plays:0
    }); 
    await db.collection("leaderboard").doc(n).set({name:n, pp:0, score:0, lvl:1}); 
    localStorage.setItem(LAST_KEY,n); 
    location.reload(); 
}

function logout() { 
    if(db && typeof user !== 'undefined' && user.name!=="Guest") {
        db.collection("users").doc(user.name).update({online:false});
    }
    localStorage.removeItem(LAST_KEY); 
    if(firebase.auth) firebase.auth().signOut(); 
    location.reload(); 
}

function save() { 
    if(typeof user === 'undefined' || typeof cfg === 'undefined') return;
    
    const d={user:user,cfg:cfg}; 
    if(user.name!=="Guest"){ 
        localStorage.setItem(DB_KEY+user.name,JSON.stringify(d)); 
        if(db) db.collection("users").doc(user.name).set({...user,savedCfg:cfg},{merge:true}); 
    } else { 
        localStorage.setItem(DB_KEY+"Guest_CFG",JSON.stringify(cfg)); 
    } 
    if(typeof updUI==='function') updUI(); 
}

function openLeaderboard() { 
    if(db) { 
        db.collection("leaderboard").orderBy("pp","desc").limit(50).onSnapshot(s=>{
            const l=document.getElementById('rank-list');
            if(!l) return;
            l.innerHTML='';
            let i=1;
            s.forEach(d=>{
                const x=d.data();
                const tr=document.createElement('tr');
                if(typeof user !== 'undefined' && x.name===user.name) tr.className='rank-row-me';
                let av=x.avatarData?`<div class="rank-av" style="background-image:url(${x.avatarData})"></div>`:'<div class="rank-av"></div>';
                tr.innerHTML=`<td>#${i++}</td><td>${av}${x.name}</td><td style="color:var(--blue)">${x.pp}pp</td>`;
                l.appendChild(tr);
            });
        });
        if(typeof openModal === 'function') openModal('rank');
    } 
}

function updateFirebaseScore() { 
    if(db && typeof user !== 'undefined' && user.name!=="Guest") { 
        db.collection("leaderboard").doc(user.name).set({
            name:user.name, pp:user.pp, score:user.score, lvl:user.lvl, avatarData:user.avatarData
        },{merge:true}); 
        db.collection("users").doc(user.name).set({
            name:user.name, score:user.score, pp:user.pp, lvl:user.lvl, sp:user.sp, scores:user.scores
        },{merge:true}); 
    } 
}

function changePassword() { 
    const el = document.getElementById('new-pass');
    const n = el ? el.value : "";
    
    if(!n||n.length<4) return safeNotify("Contraseña muy corta","error"); 
    if(user.pass==="google-auth") return safeNotify("Es cuenta Google, no usa contraseña","error"); 
    
    db.collection("users").doc(user.name).update({pass:n}).then(()=>{
        user.pass=n;
        save();
        safeNotify("Contraseña cambiada");
        if(el) el.value="";
    }); 
}

async function initDB(){ return Promise.resolve(); }
