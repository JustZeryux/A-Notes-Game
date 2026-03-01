/* ==========================================================
   MULTIPLAYER.JS - Explorador de Salas y Lógica de Host (Actualizado con Filtros)
   ========================================================== */

window.currentLobbyFilter = 'all';

window.openLobbyBrowser = function() {
    window.openModal('lobbies');
    
    // Inyectar los botones de filtro si no existen
    if(!document.getElementById('lobby-filters-bar')) {
        const titleArea = document.querySelector('#modal-lobbies .modal-neon-content');
        if(titleArea) {
            const filterHTML = `
                <div id="lobby-filters-bar" style="display:flex; gap:10px; margin-bottom:15px; justify-content:center;">
                    <button class="filter-btn active" onclick="window.setLobbyFilter('all', this)" style="padding: 5px 15px; border-radius: 5px; border: 1px solid #333; background: #111; color: white; cursor: pointer;">🌐 TODAS</button>
                    <button class="filter-btn" onclick="window.setLobbyFilter('waiting', this)" style="padding: 5px 15px; border-radius: 5px; border: 1px solid #333; background: #111; color: white; cursor: pointer;">⏳ ESPERANDO</button>
                    <button class="filter-btn" onclick="window.setLobbyFilter('playing', this)" style="padding: 5px 15px; border-radius: 5px; border: 1px solid #333; background: #111; color: white; cursor: pointer;">▶️ JUGANDO</button>
                </div>
                <input type="text" id="lobby-search-inp" placeholder="Buscar sala o anfitrión..." class="cw-input" style="width:100%; margin-bottom:20px; font-size:1rem; padding: 10px; border-radius: 5px; border: 1px solid #333; background: #111; color: white;" onkeyup="window.refreshLobbies()">
            `;
            // Lo insertamos justo al principio del panel de contenido
            titleArea.insertAdjacentHTML('afterbegin', filterHTML);
            
            // Un pequeño estilo para el botón activo
            const style = document.createElement('style');
            style.innerHTML = `
                .filter-btn.active { border-color: var(--accent) !important; background: rgba(255, 0, 85, 0.2) !important; }
                .filter-btn:hover { background: #222 !important; }
            `;
            document.head.appendChild(style);
        }
    }
    
    window.refreshLobbies();
};

window.setLobbyFilter = function(status, btnElement) {
    window.currentLobbyFilter = status;
    document.querySelectorAll('#lobby-filters-bar .filter-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    window.refreshLobbies();
};

window.refreshLobbies = function() {
    const list = document.getElementById('lobby-list');
    if (!list) return;
    
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Cargando salas...</div>';

    if (!window.db) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--miss);">Error de conexión</div>';
        return;
    }

    const searchQ = document.getElementById('lobby-search-inp') ? document.getElementById('lobby-search-inp').value.toLowerCase() : '';

    // Eliminamos el .where("status", "==", "waiting") para poder traer todas y filtrarlas en cliente
    window.db.collection("lobbies").get()
        .then(snapshot => {
            list.innerHTML = '';
            let visibleCount = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.isPrivate === true) return; 

                // --- LÓGICA DE FILTROS ---
                // 1. Filtro de Estado
                if (window.currentLobbyFilter !== 'all' && data.status !== window.currentLobbyFilter) return;
                
                // 2. Filtro de Búsqueda (Host o Título de Canción)
                if (searchQ) {
                    const hostMatch = data.host && data.host.toLowerCase().includes(searchQ);
                    const songMatch = data.songTitle && data.songTitle.toLowerCase().includes(searchQ);
                    if (!hostMatch && !songMatch) return;
                }

                visibleCount++;
                const statusColor = data.status === 'playing' ? 'var(--miss)' : 'var(--good)';
                const statusText = data.status === 'playing' ? 'EN CURSO' : 'ESPERANDO';

                const div = document.createElement('div');
                div.className = 'lobby-box';
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; background:#333; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.5rem; color:#555;">VS</div>
                        <div>
                            <div style="font-weight:900; font-size:1.2rem; color:white;">${data.songTitle || 'Desconocido'}</div>
                            <div style="color:var(--blue); font-size:0.9rem; font-weight:bold;">HOST: ${data.host}</div>
                            <div style="font-size:0.8rem; color:${statusColor}; font-weight:bold; margin-top:3px;">${statusText}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:900; font-size:1.5rem; color:white;">${data.players ? data.players.length : 1}/8</div>
                        <div style="font-size:0.8rem; font-weight:bold; color:${data.config?.ranked ? 'var(--gold)' : '#666'}">${data.config?.ranked ? 'RANKED' : 'CASUAL'}</div>
                        <button class="action ${data.status === 'playing' ? 'secondary' : ''}" style="margin-top:5px; padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.joinLobbyData('${doc.id}')" ${data.status === 'playing' ? 'disabled' : ''}>
                            ${data.status === 'playing' ? 'CERRADA' : 'ENTRAR'}
                        </button>
                    </div>
                `;
                // Mantenemos el onclick original, pero lo condicionamos a si está esperando
                if(data.status === 'waiting') {
                    div.onclick = function() { if(window.joinLobbyData) window.joinLobbyData(doc.id); };
                    div.style.cursor = 'pointer';
                } else {
                    div.style.cursor = 'not-allowed';
                    div.style.opacity = '0.7';
                }
                
                list.appendChild(div);
            });

            if (visibleCount === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No hay salas que coincidan con la búsqueda.</div>';
            }
        })
        .catch(error => { list.innerHTML = '<div style="padding:20px; text-align:center;">Error al cargar.</div>'; });
};

// === CREACIÓN DE SALA ===
window.openSongSelectorForLobby = function() {
    window.closeModal('lobbies');
    window.openModal('song-selector');
    if(typeof window.renderLobbySongList === 'function') window.renderLobbySongList();
};

window.renderLobbySongList = function(query = "") {
    const grid = document.getElementById('lobby-song-grid');
    if(!grid) return;
    grid.innerHTML = '';

    let source = window.unifiedSongs || [];
    let filtered = source.filter(s => {
        if(!query) return true;
        return s.title.toLowerCase().includes(query.toLowerCase()) || s.artist.toLowerCase().includes(query.toLowerCase());
    });

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:#111; padding:10px; margin-bottom:10px; border-radius:8px;";
        card.style.border = song.isOsu ? '1px solid #ff66aa' : '1px solid #333';

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:50px; height:50px; border-radius:8px; background-image:url('${song.imageURL}'), url('icon.png'); background-size:cover; background-position:center;"></div>
                <div>
                    <div style="font-weight:bold; font-size:1.1rem; color:white;">${song.title}</div>
                    <div style="font-size:0.8rem; color:#aaa;">${song.artist} ${song.isOsu ? '<span style="color:#ff66aa; font-weight:bold; margin-left:5px;">🌸 OSU!</span>' : ''}</div>
                </div>
            </div>
            <button class="action" style="width:auto; padding:5px 20px; font-size:0.9rem; ${song.isOsu ? 'background:#ff66aa; color:black;' : ''}">ELEGIR</button>
        `;
        
        card.querySelector('button').onclick = () => {
            window.closeModal('song-selector');
            let lobbyData = song.isOsu ? { id: "osu_" + song.id, title: song.title, imageURL: song.imageURL, isOsu: true } : song.raw;
            window.curSongData = lobbyData;
            
            if(typeof window.selectSongForLobby === 'function') {
                window.selectSongForLobby(lobbyData.id, lobbyData);
            } else {
                const rs = document.getElementById('room-song');
                if(rs) rs.innerText = song.title;
                window.openModal('host');
            }
        };
        grid.appendChild(card);
    });
};

window.selectSongForLobby = function(id, data) {
    window.curSongData = { id: id, ...data };
    window.isCreatingLobby = true; 
    window.closeModal('song-selector');
    window.openModal('diff');
    
    const optsDiv = document.getElementById('create-lobby-opts');
    if(optsDiv) {
        optsDiv.style.display = 'block';

        let configHTML = "";
        
        // Si es una canción de Osu!, mostramos un diseño especial y ocultamos la densidad
        if (data.isOsu) {
            configHTML = `
                <div style="background:rgba(255,102,170,0.1); padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #ff66aa; text-align:center;">
                    <div style="color:#ff66aa; font-weight:900; font-size:1.2rem; margin-bottom:5px;">🌸 MAPA ORIGINAL DE OSU!</div>
                    <div style="color:#aaa; font-size:0.9rem;">Este mapa está diseñado a mano. La densidad automática no aplica.</div>
                    <input type="hidden" id="lobby-density-input" value="5">
                </div>
            `;
        } else {
            // Si es una canción de la Nube, mostramos el ajustador de densidad normal
            configHTML = `
                <div style="background:#111; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #333;">
                    <div style="color:var(--accent); font-weight:bold; margin-bottom:10px;">CONFIGURACIÓN DE SALA</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span>Dificultad (Densidad):</span>
                        <input type="number" id="lobby-density-input" value="5" min="1" max="10" class="num-input" style="width:60px;">
                    </div>
                    <div style="font-size:0.9rem; color:#888;">1. Selecciona teclas arriba<br>2. Ajusta densidad<br>3. Crea la sala</div>
                </div>
            `;
        }

        optsDiv.innerHTML = `
            ${configHTML}
            <button class="action" onclick="window.confirmCreateLobby()">
                ${window.lobbyTargetFriend ? '⚔️ DESAFIAR A ' + window.lobbyTargetFriend : 'CREAR SALA ONLINE'}
            </button>
        `;
    }
    setTimeout(() => window.startGame(4), 100);
};

// === INTERCEPCIÓN DE START GAME ===
window.startGame = function(k) {
    if (window.isCreatingLobby) {
        window.selectedLobbyKeys = k;
        document.querySelectorAll('.diff-card').forEach(c => { c.style.border = "2px solid #333"; c.style.transform = "scale(1)"; });
        const cards = document.querySelectorAll('.diff-card');
        const indexMap = {4:0, 6:1, 7:2, 9:3};
        if(cards[indexMap[k]]) {
            cards[indexMap[k]].style.border = "4px solid var(--accent)";
            cards[indexMap[k]].style.transform = "scale(1.05)";
        }
        if(window.notify) window.notify(`Modo ${k}K seleccionado para la sala`, "info");
        return; 
    }
    
    window.closeModal('diff');
    if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(k);
};

window.confirmCreateLobby = function() {
    if(!window.curSongData) return;
    const denInput = document.getElementById('lobby-density-input');
    const den = denInput ? parseInt(denInput.value) : 5;
    const config = { keys: [window.selectedLobbyKeys || 4], density: den, ranked: false };
    
    if(window.notify) window.notify("Creando sala...", "info");
    
    if (window.createLobbyData) {
        window.createLobbyData(window.curSongData.id, config, false).then(() => {
            window.closeModal('diff');
            window.openHostPanel(window.curSongData, false);
            window.isCreatingLobby = false;
        });
    }
};

// === PANEL DENTRO DE LA SALA ===
window.openHostPanel = function(songData, isClient = false) {
    if(!songData) return;
    window.curSongData = songData; 
    
    if(typeof window.st !== 'undefined') { window.st.act = false; window.st.paused = false; }
    const gl = document.getElementById('game-layer');
    if(gl) gl.style.display = 'none';

    let modal = document.getElementById('modal-host'); 
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-host'; 
        modal.className = 'modal-overlay'; 
        modal.style.display = 'none';
        modal.innerHTML = '<div class="modal-panel host-panel-compact"></div>';
        document.body.appendChild(modal);
    }

    const panel = modal.querySelector('.modal-panel');
    panel.className = "modal-panel host-panel-compact"; 
    window.isLobbyHost = !isClient;
    const currentDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;

    const bgStyle = songData.imageURL ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.6), #111), url(${songData.imageURL}); background-size: cover;` : 'background: linear-gradient(to bottom, #333, #111);';

    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}">
            <div class="hp-title-info">
                <div class="hp-song-title">${songData.title}</div>
                <div class="hp-meta">Subido por: ${songData.uploader || 'N/A'}</div>
            </div>
        </div>
        <div class="hp-body">
            <div class="hp-config-col">
                <div class="hp-section-title">CONFIGURACIÓN</div>
                <div class="set-row"><span>Modo</span><strong style="color:var(--blue)">Multi</strong></div>
                <div class="set-row"><span>Densidad</span><strong style="color:var(--good)">${currentDen}</strong></div>
                <div style="margin-top:20px; font-size:0.8rem; color:#888; text-align:center;">
                    ${window.isLobbyHost ? '👑 ERES EL HOST' : 'ESPERANDO AL HOST...'}
                </div>
            </div>
            <div class="hp-players-col">
                <div class="hp-section-title">JUGADORES</div>
                <div id="room-players" class="hp-grid"></div>
            </div>
        </div>
        <div class="hp-footer">
            <button class="action secondary" onclick="window.closeModal('host'); if(typeof window.leaveLobbyData === 'function') window.leaveLobbyData();">SALIR</button>
            <button id="btn-lobby-action" class="action" style="opacity:0.5; cursor:wait;">CONECTANDO...</button>
        </div>
    `;
    modal.style.display = 'flex';
};

window.updateHostPanelUI = function(players, hostName) {
    const container = document.getElementById('room-players');
    const btn = document.getElementById('btn-lobby-action');
    if(!container || !btn) return;
    
    container.innerHTML = ''; 
    let allReady = true;
    let amIHost = (window.user && window.user.name === hostName);
    let myStatus = 'not-ready';
    let playersCount = players.length;

    players.forEach(p => {
        const isHost = p.name === hostName;
        const isReady = p.status === 'ready';
        if (!isReady && !isHost) allReady = false; 
        if (window.user && p.name === window.user.name) myStatus = p.status;

        const div = document.createElement('div');
        div.className = 'lobby-p-card';
        div.style.border = isReady ? '2px solid var(--good)' : '2px solid #444';
        div.style.background = isReady ? 'rgba(18, 250, 5, 0.1)' : 'rgba(255,255,255,0.05)';
        div.style.padding = '10px'; div.style.borderRadius = '8px'; div.style.width = '90px'; div.style.textAlign = 'center'; div.style.display = 'flex'; div.style.flexDirection = 'column'; div.style.alignItems = 'center';
        div.innerHTML = `
            <div style="width:35px; height:35px; background:url(${p.avatar||''}) center/cover; border-radius:50%; background-color:#333; margin-bottom:5px;"></div>
            <div style="font-size:0.7rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; width:100%;">${p.name}</div>
            <div style="font-size:0.6rem; color:${isReady?'var(--good)':'#888'}; font-weight:900;">${isHost ? 'HOST' : (isReady ? 'LISTO' : '...')}</div>
        `;
        container.appendChild(div);
    });

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    if (amIHost) {
        newBtn.innerText = "INICIAR PARTIDA";
        const canStart = (playersCount > 1 && allReady) || (playersCount === 1);
        newBtn.className = "action " + (canStart ? "btn-acc" : "secondary");
        newBtn.style.opacity = canStart ? "1" : "0.5";
        newBtn.style.cursor = canStart ? "pointer" : "not-allowed";
        
        newBtn.onclick = () => {
            if(canStart) {
                newBtn.innerText = "INICIANDO...";
                if(window.startLobbyMatchData) window.startLobbyMatchData();
            } else {
                if(window.notify) window.notify("Esperando a que todos estén listos", "error");
            }
        };
    } else {
        let isReady = myStatus === 'ready';
        newBtn.innerText = isReady ? "CANCELAR LISTO" : "¡ESTOY LISTO!";
        newBtn.className = isReady ? "action secondary" : "action btn-acc";
        newBtn.style.opacity = "1"; newBtn.style.cursor = "pointer";
        newBtn.onclick = () => { if(window.toggleReadyData) window.toggleReadyData(); };
    }
};

window.notifyLobbyLoaded = function() {
    const txt = document.getElementById('loading-text');
    if(txt) txt.innerText = "ESPERANDO A TODOS...";
    if(window.isLobbyHost && window.currentLobbyId) {
        setTimeout(() => {
            if(window.db) window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'playing' });
        }, 3000); 
    }
};

window.checkGameStart = function(lobbyData) {
    if (lobbyData.status === 'playing' && !window.hasGameStarted) {
        window.hasGameStarted = true;
        const m = document.getElementById('modal-lobby-room');
        if(m) m.style.display = 'none';
        
        if (window.preparedSong) {
            if(typeof window.playSongInternal === 'function') window.playSongInternal(window.preparedSong);
        } else {
            if(typeof window.prepareAndPlaySong === 'function') window.prepareAndPlaySong(window.keys || 4);
        }
    }
};
