/* === AUTH.JS REFACTORED === */

// Configurar persistencia para evitar que se desconecte al recargar
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => console.error("Error persistencia:", error));

function checkUpdate() {
    if(!db) return;
    db.collection("system").doc("status").get().then(doc => {
        if(doc.exists && doc.data().latestVersion > CURRENT_VERSION) {
             notifyInteractive("update_note", "¡ACTUALIZACIÓN!", "Nueva versión disponible. Por favor recarga la página.", 10000);
        }
    });
}

function loginGoogle() {
    if(!db) return notify("Error: Firebase no conectado", "error");
    const provider = new firebase.auth.GoogleAuthProvider();
    
    firebase.auth().signInWithPopup(provider).then(async (result) => {
        const u = result.user;
        // Limpiamos el nombre de caracteres extraños para usarlo como ID
        const cleanName = (u.displayName ? u.displayName.replace(/[^a-zA-Z0-9]/g, '') : u.email.split('@')[0]).substring(0,15);
        await handleAuthUser(cleanName, true);
    }).catch(e => notify("Error Google: " + e.message, "error"));
}

async function handleAuthUser(name, isGoogle) {
    try {
        const docRef = db.collection("users").doc(name);
        const doc = await docRef.get();

        if(doc.exists) {
            let data = doc.data();
            // Migración de datos viejos si faltan campos
            if(data.sp === undefined) data.sp = 0;
            if(data.scores === undefined) data.scores = {};
            
            user = {...user, ...data};
            finishLogin(name);
        } else {
            // CREAR NUEVO USUARIO
            const newUser = {
                name: name, 
                pass: isGoogle ? "google-auth" : null, // Si es Google, no guardamos pass
                xp:0, lvl:1, pp:0, sp:0, plays:0, score:0, 
                friends:[], avatarData:null, 
                online:true, 
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                scores: {}
            };

            // ESPERAR A QUE SE GUARDE ANTES DE CONTINUAR
            await docRef.set(newUser);
            await db.collection("leaderboard").doc(name).set({name:name, pp:0, score:0, lvl:1});
            
            user = newUser;
            notify("Cuenta creada: " + name, "success");
            setTimeout(() => finishLogin(name), 1500); // Pequeño delay para asegurar propagación
        }
    } catch (e) {
        console.error(e);
        notify("Error en base de datos: " + e.message, "error");
    }
}

function login() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    
    if(!u || !p) return notify("Ingresa usuario y contraseña", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) {
            const data = doc.data();
            // Verificamos contraseña O si es cuenta de Google intentando entrar normal (error)
            if(data.pass === "google-auth") {
                notify("Esta cuenta usa Google. Usa el botón de Google.", "error");
            } else if(data.pass === p) {
                user = {...user, ...data};
                finishLogin(u);
            } else {
                notify("Contraseña incorrecta", "error");
            }
        } else {
            notify("Usuario no encontrado", "error");
        }
    }).catch(e => notify("Error de conexión", "error"));
}

function register() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value.trim();
    
    if(!u || !p) return notify("Datos incompletos", "error");
    // Validación básica de caracteres para el ID
    if(/[^a-zA-Z0-9]/.test(u)) return notify("El usuario solo puede tener letras y números", "error");

    db.collection("users").doc(u).get().then(doc => {
        if(doc.exists) notify("El usuario ya existe", "error");
        else {
            // Pasamos contraseña manual
            createLocalUser(u, p);
        }
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
    } catch(e) { notify("Error al registrar: " + e.message, "error"); }
}

function finishLogin(name) {
    localStorage.setItem(LAST_KEY, name);
    // Recargar para aplicar cambios y limpiar estados
    location.reload();
}

function logout(){ 
    if(db && user.name !== "Guest") db.collection("users").doc(user.name).update({ online: false });
    localStorage.removeItem(LAST_KEY); 
    firebase.auth().signOut();
    location.reload(); 
}

/* FUNCIONES DE DB NO TOCADAS (Ranking, UpdateScore...) MANTENERLAS IGUAL */
function openLeaderboard() { /* ... tu código actual ... */ if(db){db.collection("leaderboard").orderBy("pp","desc").limit(50).onSnapshot(s=>{const l=document.getElementById('rank-list');l.innerHTML='';let i=1;s.forEach(d=>{const x=d.data();const tr=document.createElement('tr');if(x.name===user.name)tr.className='rank-row-me';let av='<div class="rank-av"></div>';if(x.avatarData)av=`<div class="rank-av" style="background-image:url(${x.avatarData})"></div>`;tr.innerHTML=`<td>#${i++}</td><td>${av}${x.name}</td><td style="color:var(--blue)">${x.pp}pp</td>`;l.appendChild(tr)})});openModal('rank')} }
function updateFirebaseScore() { /* ... tu código actual ... */ if(db&&user.name!=="Guest"){db.collection("leaderboard").doc(user.name).set({name:user.name,pp:user.pp,score:user.score,lvl:user.lvl,avatarData:user.avatarData},{merge:true});db.collection("users").doc(user.name).set({name:user.name,score:user.score,pp:user.pp,lvl:user.lvl,sp:user.sp,scores:user.scores},{merge:true})} }
function changePassword(){ /* ... tu código actual ... */ }