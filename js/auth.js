/* === AUTH SYSTEM === */

// Configurar persistencia
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

// Función principal que recupera tu sesión al abrir la página
async function loadData() {
    // 1. Ver si hay un usuario guardado en el navegador
    const storedName = localStorage.getItem(LAST_KEY);
    
    if (storedName && storedName !== "Guest") {
        console.log("Intentando recuperar sesión de:", storedName);
        if(!db) return; // Si Firebase no está listo, esperar
        
        try {
            // 2. Descargar datos frescos de la nube
            const doc = await db.collection("users").doc(storedName).get();
            if (doc.exists) {
                const data = doc.data();
                // Asegurar compatibilidad
                if(data.sp === undefined) data.sp = 0;
                if(data.scores === undefined) data.scores = {};
                
                user = { ...user, ...data };
                console.log("Sesión recuperada exitosamente");
                updUI(); // Actualizar interfaz visualmente
            } else {
                // Si el usuario no existe en la nube (borrado), cerrar sesión local
                logout();
            }
        } catch (e) {
            console.error("Error al cargar datos:", e);
            notify("Error de conexión al cargar perfil", "error");
        }
    } else {
        // Cargar ajustes locales si es Guest (Volumen, velocidad, etc)
        const localCfg = localStorage.getItem(DB_KEY + "Guest_CFG");
        if(localCfg) cfg = JSON.parse(localCfg);
        applyCfg();
        updUI();
    }
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
        const docRef = db.collection("users").doc(name);
        const doc = await docRef.get();

        if(doc.exists) {
            // Usuario existe, loguear
            finishLogin(name);
        } else {
            // Usuario nuevo, crear
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
            
            notify("Bienvenido " + name, "success");
            finishLogin(name);
        }
    } catch (e) {
        console.error(e);
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
            if(data.pass === "google-auth") {
                notify("Usa el botón de Google", "error");
            } else if(data.pass === p) {
                finishLogin(u);
            } else {
                notify("Contraseña incorrecta", "error");
            }
        } else {
            notify("Usuario no encontrado", "error");
        }
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
        
        notify("Registrado con éxito", "success");
        finishLogin(name);
    } catch(e) { notify("Error al registrar", "error"); }
}

function finishLogin(name) {
    // Guardar el nombre en localStorage para que 'loadData' lo encuentre al recargar
    localStorage.setItem(LAST_KEY, name);
    setTimeout(() => {
        location.reload(); 
    }, 500); // Pequeña espera para asegurar que localStorage se guardó
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
    } else {
        notify("Firebase no configurado", "error");
    }
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
