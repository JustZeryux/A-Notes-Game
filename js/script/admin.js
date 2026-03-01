/* === js/script/admin.js - SISTEMA GOD MODE === */

// Tu lista de administradores (Sensible a mayúsculas)
const ADMIN_USERS = ['Zeryux']; 

// 1. Mostrar el botón si eres admin (Esto se ejecutará al iniciar sesión)
window.checkAdminStatus = function() {
    if (window.user && ADMIN_USERS.includes(window.user.name)) {
        const btn = document.getElementById('nav-admin');
        if(btn) btn.style.display = 'block';
    }
};

window.openAdminPanel = async function() {
    if (!window.user || !ADMIN_USERS.includes(window.user.name)) return notify("Acceso Denegado", "error");
    document.getElementById('modal-admin').style.display = 'flex';
    
    // Leer el estado actual del servidor
    const doc = await window.db.collection('server').doc('config').get();
    if(doc.exists) {
        const isMaint = doc.data().maintenance;
        const statusEl = document.getElementById('admin-maint-status');
        statusEl.innerText = isMaint ? "ACTIVO (BLOQUEADO)" : "APAGADO (JUGABLE)";
        statusEl.style.color = isMaint ? "#ff003c" : "#12FA05";
    }
};

// 2. Encender o Apagar Mantenimiento
window.toggleMaintenance = async function() {
    if (!window.user || !ADMIN_USERS.includes(window.user.name)) return;
    const docRef = window.db.collection('server').doc('config');
    const doc = await docRef.get();
    let isMaint = false;
    if(doc.exists) isMaint = doc.data().maintenance || false;
    
    await docRef.set({ maintenance: !isMaint }, { merge: true });
    notify(`Mantenimiento ${!isMaint ? 'ACTIVADO' : 'APAGADO'}`, "success");
    openAdminPanel();
};

// 3. Enviar Megáfono a todos
window.sendGlobalAnnouncement = async function() {
    if (!window.user || !ADMIN_USERS.includes(window.user.name)) return;
    const title = document.getElementById('admin-ann-title').value.trim();
    const msg = document.getElementById('admin-ann-msg').value.trim();
    if(!title || !msg) return notify("Llena ambos campos", "error");

    await window.db.collection('server').doc('announcement').set({
        title: title, msg: msg, timestamp: Date.now()
    });
    
    document.getElementById('admin-ann-title').value = '';
    document.getElementById('admin-ann-msg').value = '';
    notify("¡Anuncio Global Enviado a todos los servidores!", "success");
};

// 4. Regalar SP
window.adminGiveSP = async function() {
    if (!window.user || !ADMIN_USERS.includes(window.user.name)) return;
    const target = document.getElementById('admin-target-user').value.trim();
    const amount = parseInt(document.getElementById('admin-target-sp').value);
    if(!target || isNaN(amount)) return notify("Datos inválidos", "error");

    try {
        const uRef = window.db.collection('users').doc(target);
        const doc = await uRef.get();
        if(!doc.exists) return notify("El jugador no existe", "error");
        
        const currentSP = doc.data().sp || 0;
        await uRef.update({ sp: currentSP + amount });
        notify(`Se añadieron ${amount} SP a ${target}`, "success");
    } catch(e) { notify("Error de red", "error"); }
};

// 5. Borrar / Banear Usuario
window.adminWipeUser = async function() {
    if (!window.user || !ADMIN_USERS.includes(window.user.name)) return;
    const target = document.getElementById('admin-target-user').value.trim();
    if(!target) return;
    if(ADMIN_USERS.includes(target)) return notify("No puedes banear a un Admin bro", "error");

    if(confirm(`¿Estás 100% seguro de que quieres BORRAR la cuenta de ${target}? Esto no se puede deshacer.`)) {
        await window.db.collection('users').doc(target).delete();
        notify(`La cuenta ${target} ha sido aniquilada.`, "success");
    }
};

// =========================================================
// 📡 EL RADAR GLOBAL (ESTO CORRE PARA TODOS LOS JUGADORES)
// =========================================================
window.listenToServerEvents = function() {
    if(!window.db) return;

    // A) Escuchar el Mantenimiento
    window.db.collection('server').doc('config').onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            const maintScreen = document.getElementById('maintenance-screen');
            
            if (data.maintenance) {
                // Si está en mantenimiento, revisar si eres Zeryux
                if (window.user && ADMIN_USERS.includes(window.user.name)) {
                    // Eres Admin: Puedes jugar, te avisamos discretamente
                    console.log("Mantenimiento activo. Tú eres inmune por ser Admin.");
                    if(maintScreen) maintScreen.style.display = 'none';
                } else {
                    // Es un jugador normal: LO EXPULSAMOS DE LA CANCIÓN Y BLOQUEAMOS LA PANTALLA
                    if(typeof window.toMenu === 'function') window.toMenu();
                    if(maintScreen) maintScreen.style.display = 'flex';
                }
            } else {
                // Mantenimiento apagado: Liberar a todos
                if(maintScreen) maintScreen.style.display = 'none';
            }
        }
    });

    // B) Escuchar Anuncios
    window.db.collection('server').doc('announcement').onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            // Solo mostrar si es un mensaje nuevo (comprobando el tiempo)
            if (window.lastAnnounceTime && data.timestamp > window.lastAnnounceTime) {
                const ga = document.getElementById('global-announcement');
                document.getElementById('ga-title').innerText = data.title;
                document.getElementById('ga-msg').innerText = data.msg;
                
                ga.style.top = '0px'; // Bajar cartel
                
                // Hacer un sonido de alerta si tienes configurado el audio
                try { if(window.st && window.st.ctx) playHit(); } catch(e){}

                setTimeout(() => { ga.style.top = '-150px'; }, 8000); // Subir cartel a los 8s
            }
            window.lastAnnounceTime = data.timestamp || Date.now(); // Guardar el tiempo inicial
        }
    });
};

// Iniciar radar cada par de segundos por si Firebase carga tarde
setTimeout(() => { if(typeof listenToServerEvents === 'function') listenToServerEvents(); }, 3000);
