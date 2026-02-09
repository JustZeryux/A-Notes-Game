function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(DB_STORE)) e.target.result.createObjectStore(DB_STORE, { keyPath: "id" }); };
        req.onsuccess = e => { idb = e.target.result; loadAllSongs(); resolve(); };
    });
}
function saveSongToDB(id, buf) {
    if(!idb) return;
    const tx = idb.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put({ id: id, buffer: buf });
}
function loadAllSongs() {
    if(!idb) return;
    const tx = idb.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = async () => {
        const results = req.result;
        if(!st.ctx) st.ctx = new (window.AudioContext||window.webkitAudioContext)();
        for(const item of results) {
            try {
                if(item.buffer.byteLength === 0) continue;
                const decoded = await st.ctx.decodeAudioData(item.buffer.slice(0)); 
                const map = genMap(decoded, 4);
                if(!ramSongs.find(s => s.id === item.id)) ramSongs.push({ id: item.id, buf: decoded, map: map });
                if(!user.songs.find(s => s.id === item.id)) user.songs.push({ id: item.id });
            } catch(e) { console.error("Error DB:", e); }
        }
        renderMenu(); 
    };
}
