/* === MAIN INITIALIZATION === */
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
