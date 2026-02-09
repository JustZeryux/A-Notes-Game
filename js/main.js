/* === MAIN INITIALIZATION === */
window.onload = async () => { 
    loadData(); 
    await initDB();
    initOnline(); 
    document.addEventListener('click', unlockAudio); 
    renderMenu(); 
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
