/* ==========================================================
   STUDIO_UPLOAD.JS - Editor, Cloudinary y Firebase Uploads
   ========================================================== */

window.openStudioDashboard = async function() {
    window.openModal('studio');
    const grid = document.getElementById('studio-grid');
    const loader = document.getElementById('studio-loading');
    grid.innerHTML = '';
    loader.style.display = 'block';

    let myUsername = null;
    if (window.user && window.user.name && window.user.name !== "Guest") {
        myUsername = window.user.name;
    } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        myUsername = firebase.auth().currentUser.displayName;
    }

    if (!myUsername) {
        loader.innerHTML = "⚠️ <b>ACCESO DENEGADO</b><br><br>Debes iniciar sesión en la barra lateral para ver y editar tus mapas.";
        loader.style.color = "var(--miss)";
        return;
    }

    try {
        let snapshot = await window.db.collection("globalSongs").where("uploader", "==", myUsername).get();
        loader.style.display = 'none';

        if (snapshot.empty) {
            grid.innerHTML = `<div style="width:100%; text-align:center; padding:50px; color:#aaa; font-size:1.2rem; font-weight:bold;">Aún no has subido ninguna canción. <br><br> ¡Sube tu primer MP3 en la barra lateral para empezar a mapear! ☁️</div>`;
            return;
        }

        snapshot.forEach(doc => {
            let song = doc.data();
            song.id = doc.id; 

            const card = document.createElement('div');
            card.className = 'song-card'; 
            card.style.cssText = 'position: relative; height: 180px; border-radius: 12px; overflow: hidden; border: 2px solid #00ffff; box-shadow: 0 0 15px rgba(0, 255, 255, 0.2); display:flex; flex-direction:column; background:#111;';
            
            card.innerHTML = `
                <div class="song-bg" style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${song.imageURL || 'icon.png'}'); background-size: cover; background-position: center; opacity: 0.4;"></div>
                <div style="position:relative; z-index:2; padding:15px; flex:1;">
                    <div style="font-size: 1.2rem; font-weight: 900; color: white; text-shadow: 0 2px 4px black; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title}</div>
                    <div style="font-size: 0.8rem; color: #ccc; margin-top:5px; font-weight:bold;">Artista: ${song.author || 'Desconocido'}</div>
                </div>
                <div style="position:relative; z-index:2; display:flex; gap:10px; padding:10px; background:rgba(0,0,0,0.85); border-top:1px solid #333;">
                    <button class="action btn-edit" style="flex:1; padding:5px; font-size:0.8rem; background:#ff66aa; color:black; width:auto; margin:0; box-shadow:0 0 10px rgba(255,102,170,0.4);">✏️ EDITAR MAPA</button>
                    <button class="action btn-del" style="flex:1; padding:5px; font-size:0.8rem; border-color:#F9393F; color:#F9393F; background:transparent; width:auto; margin:0;">🗑️ BORRAR</button>
                </div>
            `;
            
            card.querySelector('.btn-edit').onclick = () => {
                window.closeModal('studio');
                if(typeof openEditor === 'function') openEditor(song, 4); 
                else alert("Error: editor.js no conectado");
            };
            
            card.querySelector('.btn-del').onclick = async () => {
                if(confirm(`¿Seguro que quieres borrar "${song.title}" para siempre?`)) {
                    card.style.opacity = '0.5';
                    await window.db.collection('globalSongs').doc(song.id).delete();
                    window.openStudioDashboard(); 
                }
            };
            grid.appendChild(card);
        });
    } catch(e) { loader.innerText = "Error DB"; loader.style.color = "var(--miss)"; }
};

window.tempUploadData = { audioURL: null, imageURL: null };
const CLOUD_NAME = "djauhc6md"; 
const UPLOAD_PRESET = "subida_juego"; 

window.openCustomUploadModal = function() {
    if (!window.user || window.user.name === "Guest") return window.notify("Debes iniciar sesión para subir canciones", "error");
    
    window.tempUploadData = { audioURL: null, imageURL: null };
    document.getElementById('up-title').value = '';
    document.getElementById('up-url').value = ''; 
    
    const audioLbl = document.getElementById('lbl-up-audio');
    audioLbl.innerText = 'Ningún archivo seleccionado'; audioLbl.style.color = '#666';
    
    const btn = document.getElementById('btn-up-audio');
    btn.innerText = '1. SUBIR MP3 (UPLOADCARE)'; btn.style.background = 'white';
    
    const coverPreview = document.getElementById('up-cover-preview');
    coverPreview.style.backgroundImage = 'none'; coverPreview.style.border = '2px dashed #444';
    coverPreview.innerHTML = '<span style="font-size:3.5rem;">📷</span><span style="color:#888; font-weight:bold; margin-top:10px; text-transform: uppercase;">Subir Imagen</span>';
    
    document.getElementById('btn-publish-song').innerText = 'PUBLICAR CANCIÓN';
    window.openModal('upload');
};

window.handleUrlInput = function(val) {
    const audioLbl = document.getElementById('lbl-up-audio');
    if(val.trim() !== "") {
        window.tempUploadData.audioURL = val.trim();
        if(audioLbl) { audioLbl.innerText = "🔗 Usando enlace URL directo"; audioLbl.style.color = "var(--blue)"; }
    } else {
        window.tempUploadData.audioURL = null;
        if(audioLbl) { audioLbl.innerText = "Ningún archivo seleccionado"; audioLbl.style.color = "#666"; }
    }
};

window.triggerAudioUpload = function() {
    if (typeof cloudinary === 'undefined') return window.notify("Cloudinary no ha cargado.", "error");
    const urlInput = document.getElementById('up-url'); if(urlInput) urlInput.value = '';
    const btn = document.getElementById('btn-up-audio');
    const audioLbl = document.getElementById('lbl-up-audio');

    let myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET, sources: ['local'], resourceType: 'auto', clientAllowedFormats: ['mp3', 'ogg', 'wav', 'm4a'], maxFileSize: 15000000
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            window.tempUploadData.audioURL = result.info.secure_url;
            if(audioLbl) { audioLbl.innerText = "✅ " + result.info.original_filename; audioLbl.style.color = "#12FA05"; }
            btn.innerText = "¡MP3 CARGADO!"; btn.style.background = "#12FA05"; btn.style.color = "black";
            const titleInput = document.getElementById('up-title');
            if(titleInput && titleInput.value.trim() === '') titleInput.value = result.info.original_filename.replace('.mp3', '');
        }
    });
    myWidget.open();
};

window.triggerCoverUpload = function() {
    if (typeof cloudinary === 'undefined') return window.notify("Cloudinary no ha cargado.", "error");
    const preview = document.getElementById('up-cover-preview');

    let myWidget = cloudinary.createUploadWidget({
        cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET, sources: ['local', 'url'], resourceType: 'image', clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp']
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            window.tempUploadData.imageURL = result.info.secure_url;
            preview.innerHTML = '';
            preview.style.backgroundImage = `url(${result.info.secure_url})`;
            preview.style.border = '2px solid var(--gold)';
        }
    });
    myWidget.open();
};

window.submitSongToFirebase = async function() {
    const title = document.getElementById('up-title').value.trim();
    const lyrics = document.getElementById('up-lyrics').value.trim();
    
    if(!title) return window.notify("¡Escribe un título!", "error");
    if(!window.tempUploadData.audioURL) return window.notify("¡Falta el archivo MP3 o la URL!", "error");
    
    const btnSubmit = document.getElementById('btn-publish-song');
    btnSubmit.innerText = "GUARDANDO..."; btnSubmit.style.pointerEvents = "none";
    
    try {
        if (window.db) {
            const checkQuery = await window.db.collection("globalSongs").where("title", "==", title).get();
            if (!checkQuery.empty) {
                btnSubmit.innerText = "PUBLICAR CANCIÓN"; btnSubmit.style.pointerEvents = "auto";
                return window.notify("❌ ¡Esta canción ya fue subida por alguien más!", "error");
            }
        }

        let finalImageUrl = window.tempUploadData.imageURL;
        if (!finalImageUrl) {
            try {
                let cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=song&limit=1`);
                const data = await res.json();
                if (data.results && data.results.length > 0) finalImageUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
            } catch(e) {}
        }

        const songData = {
            title: title, audioURL: window.tempUploadData.audioURL, imageURL: finalImageUrl || null,
            uploader: window.user.name, lyrics: lyrics || null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if(window.db) {
            await window.db.collection("globalSongs").add(songData);
            window.notify("¡Canción publicada globalmente!", "success");
            window.closeModal('upload');
        }
    } catch (error) { window.notify("Error DB: " + error.message, "error"); } 
    finally { btnSubmit.innerText = "PUBLICAR CANCIÓN"; btnSubmit.style.pointerEvents = "auto"; }
};

window.autoFetchLyrics = async function() {
    const title = document.getElementById('up-title').value.trim();
    if (!title) return window.notify("Primero escribe el Título para buscar.", "error");

    const btn = document.getElementById('btn-fetch-lyrics');
    btn.innerText = "⏳ BUSCANDO..."; btn.style.pointerEvents = "none";

    try {
        const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            const bestMatch = data.find(song => song.syncedLyrics);
            if (bestMatch && bestMatch.syncedLyrics) {
                document.getElementById('up-lyrics').value = bestMatch.syncedLyrics;
                window.notify("¡Letra sincronizada encontrada!", "success");
            } else { window.notify("Encontré la canción, pero sin tiempos exactos.", "error"); }
        } else { window.notify("No se encontró la letra.", "error"); }
    } catch (error) { window.notify("Error de red.", "error"); } 
    finally { btn.innerText = "🔍 BUSCAR LRC AUTOMÁTICO"; btn.style.pointerEvents = "auto"; }
};
