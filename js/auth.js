/* === AUTH SYSTEM === */

if(firebase.auth) {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => console.error("Error persistencia:", error));
}

function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
             notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Recarga la página.", 10000);
        }
    });
}

// === FUNCIÓN SAVE (LA QUE FALTABA) ===
function save() {
    // 1. Guardar en LocalStorage (Cache rápido)
    const saveData = { user: user, cfg: cfg };
    if(user.name !== "Guest") {
        localStorage.setItem(DB_KEY + user.name, JSON.stringify(saveData));
        
        // 2. Guardar en Nube (Si está logueado)
        if(db) {
            // Guardamos scores, config y stats
            db.collection("users").doc(user.name).set({
                name: user.name,
                score: user.score,
                pp: user.pp,
                lvl: user.lvl,
                sp: user.sp,
                scores: user.scores || {},
                avatarData: user.avatarData || null,
                bg: user.bg || null, // Guardar fondo también
                savedCfg: cfg // Guardar config en la nube
            }, { merge: true }).catch(e => console.error("Error guardando en nube:", e));
        }
    } else {
        // Guardar config de invitado
        localStorage.setItem(DB_KEY + "Guest_CFG", JSON.stringify(cfg));
    }
    updUI();
}

async function loadData() {
    // MOSTRAR LOADER AL INICIO
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Iniciando sesión...";

    const storedName = localStorage.getItem(LAST_KEY);
    
    if (storedName && storedName !== "Guest") {
        if(!db) { 
            finishLoad(); return; 
        }
        
        try {
            const doc = await db.collection("users").doc(storedName).get();
            if (doc.exists) {
                const data = doc.data();
                if(data.sp === undefined) data.sp = 0;
                if(data.scores === undefined) data.scores = {};
                
                user = { ...user, ...data };
                
                // Cargar config si existe en la nube
                if(data.savedCfg) cfg = { ...cfg, ...data.savedCfg };
                else applyCfg(); // Aplicar defaults si no hay config

                console.log("Sesión recuperada:", storedName);
            } else {
                logout(); // Usuario borrado o inválido
            }
        } catch (e) {
            console.error("Error loading:", e);
            notify("Error de conexión", "error");
        }
    } else {
        // Cargar config local de Guest
        const localCfg = localStorage.getItem(DB_KEY + "Guest_CFG");
        if(localCfg) cfg = { ...cfg, ...JSON.parse(localCfg) };
    }
    
    applyCfg(); // Aplicar volumen, velocidad, etc.
    updUI();
    finishLoad(); // QUITAR LOADER
}

function finishLoad() {
    document.getElementById('loading-overlay').style.display = 'none';
    if(typeof renderMenu === 'function') renderMenu();
}

function loginGoogle() {
    if(!db) return notify("Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider).then(async (result) => {
        const u = result.user;
        const cleanName = (u.displayName ? u.displayName.replace(/[^a-zA-Z0-9]/g, '') : u.email.split('@')[0]).substring(0,15);
        await handleAuthUser(cleanName, true);
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

async function handleAuthUser(name, isGoogle) {
    try {
        document.getElementById('loading-overlay').style.display = 'flex';
        const docRef = db.collection("users").doc(name);
        const doc = await docRef.get();

        if(doc.exists) {
            let data = doc.data();
            if(data.savedCfg) cfg = { ...cfg, ...data.savedCfg };
            user = {...user, ...data};
            finishLogin(name);
        } else {
            const newUser = {
                name: name, 
                pass: isGoogle ? "google-auth" : null,
                xp:0, lvl:1, pp:0, sp:0, plays:0, score:0, 
                friends:[], avatarData:null, 
                online:true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                scores: {}
            };
            await docRef.set(newUser);
            await db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
            
            user = newUser;
            notify("Bienvenido " + name, "success");
            setTimeout(() => finishLogin(name), 1000);
        }
    } catch (e) {
        console.error(e);
        document.getElementById('loading-overlay').style.display = 'none';
        notify("Error DB: " + e.message, "error");
    }
}

function login() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    if(!u || !p) return notify("Ingresa datos", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            if(data.pass === "google-auth") notify("Usa el botón de Google", "error");
            else if(data.pass === p) finishLogin(u);
            else notify("Contraseña incorrecta", "error");
        } else notify("Usuario no encontrado", "error");
    }).catch(e => notify("Error conexión", "error"));
}

function register() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    if(!u || !p) return notify("Datos incompletos", "error");
    if(/[^a-zA-Z0-9]/.test(u)) return notify("Solo letras y números", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) notify("Usuario ya existe", "error");
        else createLocalUser(u, p);
    });
}

async function createLocalUser(name, pass) {
    try {
        const newUser = {
            name: name, pass: pass, xp:0, lvl:1, pp:0, sp:0, plays:0, score:0, 
            friends:[], avatarData:null, online:true, lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            scores: {}
        };
        await db.collection("users").doc(name).set(newUser);
        await db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
        user = newUser;
        notify("Registrado con éxito", "success");
        setTimeout(() => finishLogin(name), 1000);
    } catch(e) { notify("Error al registrar", "error"); }
}

function finishLogin(name) {
    localStorage.setItem(LAST_KEY, name);
    location.reload();
}

function logout(){ 
    if(db && user.name !== "Guest") db.collection("users").doc(user.name).update({ online: false });
    localStorage.removeItem(LAST_KEY); 
    if(firebase.auth) firebase.auth().signOut();
    location.reload(); 
}

function openLeaderboard() {
    if(db) {
        db.collection("leaderboard").orderBy("pp", "desc").limit(50)
        .onSnapshot((querySnapshot) => {
            const l = document.getElementById('rank-list'); l.innerHTML=''; 
            let i = 1;
            querySnapshot.forEach((doc) => {
                const d = doc.data();
                const tr = document.createElement('tr');
                if(d.name===user.name) {
                    tr.className='rank-row-me';
                    document.getElementById('p-global-rank').innerText = "#" + i;
                    if(d.pp > user.pp) { user.pp = d.pp; save(); }
                }
                let avHtml = '<div class="rank-av"></div>';
                if(d.avatarData) avHtml = `<div class="rank-av" style="background-image:url(${d.avatarData})"></div>`;
                tr.innerHTML = `<td>#${i++}</td><td>${avHtml}${d.name}</td><td style="color:var(--blue)">${d.pp}pp</td>`;
                l.appendChild(tr);
            });
        });
        openModal('rank');
    } else { notify("Firebase no configurado", "error"); }
}

function updateFirebaseScore() {
    if(db && user.name !== "Guest") {
        db.collection("leaderboard").doc(user.name).set({
            name: user.name, pp: user.pp, score: user.score, lvl: user.lvl, avatarData: user.avatarData
        }, { merge: true });
        db.collection("users").doc(user.name).set({ name: user.name, score:user.score, pp:user.pp, lvl:user.lvl, sp:user.sp, scores: user.scores }, { merge: true });
    }
}

function changePassword() {
     const newPass = document.getElementById('new-pass').value;
     if(!newPass || newPass.length < 4) return notify("Contraseña muy corta", "error");
     if(user.pass === "google-auth") return notify("Cuenta de Google no permite cambio de pass", "error");
     
     db.collection("users").doc(user.name).update({ pass: newPass }).then(() => {
         user.pass = newPass; save();
         notify("Contraseña actualizada", "success");
         document.getElementById('new-pass').value = "";
     });
}
