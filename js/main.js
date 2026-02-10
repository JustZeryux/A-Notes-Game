/* === MAIN INITIALIZATION === */
window.onload = async () => { 
    // loadData se encargará de todo (Loader, Auth, y RenderMenu cuando esté listo)
    await loadData(); 
    
    initOnline(); 
    document.addEventListener('click', unlockAudio); 
    checkUpdate();
    
    // PRESENCE SYSTEM (HEARTBEAT)
    setInterval(() => {
        if(user.name !== "Guest" && db) {
            db.collection("users").doc(user.name).update({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                online: true
            });
        }
    }, 10000); 
    setupNotificationsListener();
};

window.addEventListener('keydown', onKd); 
window.addEventListener('keyup', onKu);
