/* === MAIN INITIALIZATION (MODO DIAGNÓSTICO) === */

// 1. Cazador de Errores Global
window.onerror = function(message, source, lineno, colno, error) {
    alert("❌ ERROR DETECTADO:\n" + message + "\n\nEn archivo: " + source + "\nLínea: " + lineno);
    return true; // Esto evita que se spamee la consola
};

window.onload = async () => { 
    // 2. Verificar que las librerías cargaron
    if (typeof firebase === 'undefined') {
        alert("❌ ERROR CRÍTICO: Firebase no cargó. Revisa tu internet o los scripts en index.html");
        return;
    }
    if (typeof user === 'undefined' || typeof cfg === 'undefined') {
        alert("❌ ERROR CRÍTICO: globals.js tiene un error de sintaxis o no cargó.");
        return;
    }

    // 3. Iniciar el juego
    console.log("Iniciando sistema...");
    try {
        if(typeof loadData === 'function') await loadData(); 
        if(typeof initOnline === 'function') initOnline(); 
        
        document.addEventListener('click', unlockAudio); 
        
        if(typeof renderMenu === 'function') renderMenu(); 
        if(typeof checkUpdate === 'function') checkUpdate();
        
        // PRESENCE SYSTEM (HEARTBEAT)
        setInterval(() => {
            if(user && user.name !== "Guest" && db) {
                db.collection("users").doc(user.name).update({
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    online: true
                }).catch(e => console.warn("Offline"));
            }
        }, 10000); 
        
        if(typeof setupNotificationsListener === 'function') setupNotificationsListener();
        
    } catch (e) {
        alert("❌ Error al iniciar: " + e.message);
        console.error(e);
    }
};

// Listeners globales protegidos
window.addEventListener('keydown', (e) => { 
    try { if(typeof onKd === 'function') onKd(e); } catch(err){ console.error(err); } 
}); 
window.addEventListener('keyup', (e) => { 
    try { if(typeof onKu === 'function') onKu(e); } catch(err){ console.error(err); } 
});
window.onload = async () => { 
    // Verificar si globals.js cargó correctamente
    if (typeof user === 'undefined' || typeof cfg === 'undefined') {
        alert("Error Crítico: globals.js no se cargó o tiene un error de sintaxis. Revisa la consola (F12).");
        return;
    }

    // Si todo está bien, iniciar
    if(typeof loadData === 'function') await loadData(); 
    
    if(typeof initOnline === 'function') initOnline(); 
    document.addEventListener('click', unlockAudio); 
    
    if(typeof renderMenu === 'function') renderMenu(); 
    if(typeof checkUpdate === 'function') checkUpdate();
    
    // PRESENCE SYSTEM (HEARTBEAT)
    setInterval(() => {
        if(user && user.name !== "Guest" && db) {
            db.collection("users").doc(user.name).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            }).catch(e => console.log("Presencia offline"));
        }
    }, 10000); 
    
    if(typeof setupNotificationsListener === 'function') setupNotificationsListener();
};

// Listeners globales
window.addEventListener('keydown', (e) => { if(typeof onKd === 'function') onKd(e); }); 
window.addEventListener('keyup', (e) => { if(typeof onKu === 'function') onKu(e); });
