/* ==========================================================
   MULTIPLAYER.JS - Explorador de Salas, Buscador y Ruteo Pro
   ========================================================== */

window.currentLobbyFilter = 'all';

window.openLobbyBrowser = function() {
    window.openModal('lobbies');
    
    const contentArea = document.querySelector('#modal-lobbies .modal-neon-content');
    if(contentArea && !document.getElementById('lobby-filters-bar')) {
        const filterHTML = `
            <div id="lobby-filters-bar" style="display:flex; gap:10px; margin-bottom:15px; justify-content:center;">
                <button class="action active" onclick="window.setLobbyFilter('all', this)" style="padding: 8px 15px; font-size:0.9rem;">🌐 TODAS</button>
                <button class="action secondary" onclick="window.setLobbyFilter('waiting', this)" style="padding: 8px 15px; font-size:0.9rem;">⏳ ESPERANDO</button>
                <button class="action secondary" onclick="window.setLobbyFilter('playing', this)" style="padding: 8px 15px; font-size:0.9rem;">▶️ JUGANDO</button>
            </div>
            <input type="text" id="lobby-search-inp" placeholder="🔍 Buscar host o canción..." class="cw-input" style="width:100%; margin-bottom:20px; font-size:1.1rem; padding:12px; border-radius:8px; border:2px solid var(--accent); background:#111; color:white;" onkeyup="window.refreshLobbies()">
        `;
        contentArea.insertAdjacentHTML('afterbegin', filterHTML);
    }
    window.refreshLobbies();
};

window.setLobbyFilter = function(status, btnElement) {
    window.currentLobbyFilter = status;
    document.querySelectorAll('#lobby-filters-bar button').forEach(b => {
        b.className = 'action secondary';
    });
    btnElement.className = 'action active';
    window.refreshLobbies();
};

window.refreshLobbies = function() {
    const list = document.getElementById('lobby-list');
    if (!list) return;
    
    list.innerHTML = '<div style="padding:30px; text-align:center; color:var(--blue); font-weight:bold; font-size:1.2rem;">📡 Escaneando servidores globales...</div>';

    if (!window.db) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--miss);">Error crítico: Base de datos desconectada.</div>';
        return;
    }

    const searchQ = document.getElementById('lobby-search-inp') ? document.getElementById('lobby-search-inp').value.toLowerCase() : '';

    window.db.collection("lobbies").get().then(snapshot => {
        list.innerHTML = '';
        let visibleCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isPrivate === true) return; 

            if (window.currentLobbyFilter !== 'all' && data.status !== window.currentLobbyFilter) return;
            
            if (searchQ) {
                const hMatch = data.host && data.host.toLowerCase().includes(searchQ);
                const sMatch = data.songName && data.songName.toLowerCase().includes(searchQ);
                if (!hMatch && !sMatch) return;
            }

            visibleCount++;
            const isPlaying = data.status === 'playing';
            const statusColor = isPlaying ? 'var(--miss)' : 'var(--good)';
            const statusText = isPlaying ? 'EN CURSO' : 'ESPERANDO';

            const div = document.createElement('div');
            div.className = 'lobby-box';
            div.style.cssText = `background: #111; border: 1px solid ${isPlaying ? '#333' : 'var(--accent)'}; border-radius: 12px; padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; opacity: ${isPlaying ? '0.6' : '1'}; cursor: ${isPlaying ? 'not-allowed' : 'pointer'};`;
            
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:55px; height:55px; background:linear-gradient(45deg, #222, #444); border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.5rem; color:white; box-shadow:0 0 10px rgba(0,0,0,0.5);">VS</div>
                    <div>
                        <div style="font-weight:900; font-size:1.3rem; color:white; margin-bottom:2px;">${data.songName || 'Desconocido'}</div>
                        <div style="color:var(--blue); font-size:0.95rem; font-weight:bold;">👑 HOST: ${data.host}</div>
                        <div style="font-size:0.85rem; color:${statusColor}; font-weight:900; margin-top:4px; letter-spacing:1px;">${statusText}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:900; font-size:1.8rem; color:white; text-shadow:0 0 10px white;">${data.players ? data.players.length : 1}/8</div>
                    <div style="font-size:0.9rem; font-weight:900; color:${data.config?.ranked ? 'var(--gold)' : '#888'}; margin-bottom:8px;">${data.config?.ranked ? 'RANKED' : 'CASUAL'}</div>
                    ${!isPlaying ? `<button class="action" style="padding: 5px 20px; font-size: 0.9rem;" onclick="event.stopPropagation(); window.joinLobbyData('${doc.id}')">ENTRAR</button>` : ''}
                </div>
            `;
            if(!isPlaying) { div.onclick = function() { if(window.joinLobbyData) window.joinLobbyData(doc.id); }; }
            list.appendChild(div);
        });

        if (visibleCount === 0) list.innerHTML = '<div style="padding:30px; text-align:center; color:#888; font-size:1.2rem;">No se encontraron salas. ¡Crea una tú mismo!</div>';
    }).catch(e => { list.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Error de red.</div>'; });
};

// === BUSCADOR DE CANCIONES PARA EL HOST ===
window.openSongSelectorForLobby = function() {
    window.closeModal('lobbies');
    window.openModal('song-selector');
    
    const content = document.querySelector('#modal-song-selector .modal-neon-content');
    if (content && !document.getElementById('lobby-song-search')) {
        const searchHTML = `
            <input type="text" id="lobby-song-search" placeholder="🔍 Buscar por nombre o artista..." class="cw-input" style="width:100%; margin-bottom:20px; font-size:1.2rem; padding:15px; border-radius:10px; border:2px solid var(--blue); background:#0a0a0a; color:white; box-shadow:0 0 15px rgba(0, 229, 255, 0.2);" onkeyup="window.renderLobbySongList(this.value)">
            <div id="lobby-song-grid" style="max-height: 400px; overflow-y: auto; padding-right: 5px;"></div>
        `;
        content.innerHTML = searchHTML;
    }
    
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

    if(filtered.length === 0) {
        grid.innerHTML = '<div style="padding:20px; text-align:center; color:var(--gold);">No hay resultados.</div>';
        return;
    }

    filtered.forEach(song => {
        const card = document.createElement('div');
        card.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:#15151a; padding:12px; margin-bottom:12px; border-radius:10px; transition:0.2s;";
        card.style.border = song.isOsu ? '2px solid #ff66aa' : '2px solid #333';

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; overflow:hidden;">
                <div style="min-width:60px; height:60px; border-radius:8px; background-image:url('${song.imageURL}'), url('icon.png'); background-size:cover; background-position:center; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <div style="font-weight:900; font-size:1.2rem; color:white; text-shadow:0 1px 3px black;">${song.title}</div>
                    <div style="font-size:0.9rem; color:#aaa; font-weight:bold;">${song.artist} ${song.isOsu ? `<span style="color:#ff66aa; margin-left:8px; border:1px solid #ff66aa; padding:2px 6px; border-radius:5px; font-size:0.7rem;">${song.originalMode ? song.originalMode.toUpperCase() : 'OSU!'}</span>` : ''}</div>
                </div>
            </div>
            <button class="action" style="min-width:100px; padding:10px; font-size:0.9rem; ${song.isOsu ? 'background:#ff66aa; color:white; border:none; box-shadow:0 0 15px rgba(255,102,170,0.4);' : ''}">ELEGIR</button>
        `;
        
        card.querySelector('button').onclick = () => {
            window.closeModal('song-selector');
            let lobbyData = song.isOsu ? { id: "osu_" + song.id, title: song.title, imageURL: song.imageURL, isOsu: true, originalMode: song.originalMode } : song.raw;
            window.curSongData = lobbyData;
            
            if(typeof window.selectSongForLobby === 'function') window.selectSongForLobby(lobbyData.id, lobbyData);
        };
        card.onmouseenter = () => card.style.transform = 'scale(1.02)';
        card.onmouseleave = () => card.style.transform = 'scale(1)';
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
        
        if (data.isOsu) {
            let modeIcon = data.originalMode === 'standard' ? '🎯' : (data.originalMode === 'taiko' ? '🥁' : (data.originalMode === 'catch' ? '🍎' : '🎹'));
            configHTML = `
                <div style="background:rgba(255,102,170,0.1); padding:20px; border-radius:12px; margin-bottom:20px; border:2px solid #ff66aa; text-align:center;">
                    <div style="color:#ff66aa; font-weight:900; font-size:1.4rem; margin-bottom:5px;">${modeIcon} MAPA DE OSU!</div>
                    <div style="color:white; font-size:1rem;">Modo: <span style="text-transform:uppercase; font-weight:bold;">${data.originalMode || 'MANIA'}</span></div>
                    <input type="hidden" id="lobby-density-input" value="5">
                </div>
            `;
        } else {
            configHTML = `
                <div style="background:#111; padding:20px; border-radius:12px; margin-bottom:20px; border:2px solid var(--accent);">
                    <div style="color:white; font-weight:900; font-size:1.2rem; margin-bottom:15px; text-align:center;">⚙️ AJUSTES DE SALA</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:1.1rem; font-weight:bold;">
                        <span style="color:#ccc;">Dificultad Base:</span>
                        <input type="number" id="lobby-density-input" value="5" min="1" max="10" class="num-input" style="width:80px; font-size:1.2rem; text-align:center; background:#222; border:1px solid #555; color:white; border-radius:5px;">
                    </div>
                </div>
            `;
        }

        optsDiv.innerHTML = `
            ${configHTML}
            <button class="action" onclick="window.confirmCreateLobby()" style="width:100%; padding:15px; font-size:1.2rem;">
                ${window.lobbyTargetFriend ? '⚔️ ENVIAR DESAFÍO' : '🌐 ABRIR SALA ONLINE'}
            </button>
        `;
    }
    setTimeout(() => window.startGame(4), 100);
};

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
    
    if(window.createLobbyData) {
        window.createLobbyData(window.curSongData.id, config, false).then(() => {
            window.closeModal('diff');
            window.openHostPanel(window.curSongData, false);
            window.isCreatingLobby = false;
        });
    }
};

window.openHostPanel = function(songData, isClient = false) {
    if(!songData) return;
    window.curSongData = songData; 
    
    if(typeof window.st !== 'undefined') { window.st.act = false; window.st.paused = false; }
    const gl = document.getElementById('game-layer'); if(gl) gl.style.display = 'none';

    let modal = document.getElementById('modal-host'); 
    if(!modal) {
        modal = document.createElement('div'); modal.id = 'modal-host'; modal.className = 'modal-overlay'; 
        modal.style.display = 'none'; modal.innerHTML = '<div class="modal-panel host-panel-compact"></div>';
        document.body.appendChild(modal);
    }

    const panel = modal.querySelector('.modal-panel');
    window.isLobbyHost = !isClient;
    const currentDen = (window.cfg && window.cfg.den) ? window.cfg.den : 5;
    const bgStyle = songData.imageURL ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.8), #111), url(${songData.imageURL}); background-size: cover; background-position:center;` : 'background: linear-gradient(to bottom, #333, #111);';

    panel.innerHTML = `
        <div class="hp-header" style="${bgStyle}; padding:30px; border-bottom:2px solid var(--accent); border-radius:15px 15px 0 0;">
            <div style="font-weight:900; font-size:2rem; color:white; text-shadow:0 0 15px black;">${songData.title}</div>
            <div style="font-weight:bold; color:var(--blue); font-size:1rem;">${songData.isOsu ? 'Mapset Oficial de Osu!' : 'Comunidad A-Notes'}</div>
        </div>
        <div style="padding:20px; background:#0a0a0a;">
            <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <div style="flex:1; text-align:center; background:#111; padding:15px; border-radius:10px; border:1px solid #333; margin-right:10px;">
                    <div style="color:#888; font-weight:bold; font-size:0.9rem;">MODO</div>
                    <div style="color:var(--accent); font-weight:900; font-size:1.5rem; text-transform:uppercase;">${songData.originalMode || 'MANIA'}</div>
                </div>
                <div style="flex:1; text-align:center; background:#111; padding:15px; border-radius:10px; border:1px solid #333; margin-left:10px;">
                    <div style="color:#888; font-weight:bold; font-size:0.9rem;">DENSIDAD</div>
                    <div style="color:var(--good); font-weight:900; font-size:1.5rem;">${songData.isOsu ? 'FIJA' : currentDen}</div>
                </div>
            </div>
            <div style="color:white; font-weight:900; font-size:1.2rem; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:5px;">JUGADORES CONECTADOS</div>
            <div id="room-players" style="display:flex; flex-wrap:wrap; gap:10px; min-height:100px;"></div>
        </div>
        <div style="padding:20px; background:#050505; border-top:1px solid #222; display:flex; gap:15px;">
            <button class="action secondary" style="flex:1;" onclick="window.closeModal('host'); if(typeof window.leaveLobbyData === 'function') window.leaveLobbyData();">ABANDONAR</button>
            <button id="btn-lobby-action" class="action" style="flex:2; opacity:0.5; cursor:wait;">CONECTANDO...</button>
        </div>
    `;
    modal.style.display = 'flex';
};

window.updateHostPanelUI = function(players, hostName) {
    const container = document.getElementById('room-players');
    const btn = document.getElementById('btn-lobby-action');
    if(!container || !btn) return;
    
    container.innerHTML = ''; 
    let allReady = true; let amIHost = (window.user && window.user.name === hostName);
    let myStatus = 'not-ready'; let playersCount = players.length;

    players.forEach(p => {
        const isHost = p.name === hostName;
        const isReady = p.status === 'ready';
        if (!isReady && !isHost) allReady = false; 
        if (window.user && p.name === window.user.name) myStatus = p.status;

        const div = document.createElement('div');
        div.style.cssText = `border: 2px solid ${isReady ? 'var(--good)' : '#444'}; background: ${isReady ? 'rgba(18,250,5,0.1)' : '#111'}; padding: 10px; border-radius: 10px; width: 100px; text-align: center; box-shadow: ${isReady ? '0 0 10px rgba(18,250,5,0.2)' : 'none'}; transition: 0.3s;`;
        div.innerHTML = `
            <div style="width:40px; height:40px; background:url(${p.avatar||'icon.png'}) center/cover; border-radius:50%; border:2px solid ${isHost ? 'var(--gold)' : 'white'}; margin:0 auto 8px auto;"></div>
            <div style="font-size:0.8rem; font-weight:900; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
            <div style="font-size:0.7rem; color:${isReady?'var(--good)':(isHost?'var(--gold)':'#888')}; font-weight:bold; margin-top:3px;">${isHost ? '👑 HOST' : (isReady ? '✔ LISTO' : 'ESPERANDO')}</div>
        `;
        container.appendChild(div);
    });

    const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);

    if (amIHost) {
        newBtn.innerText = "▶ INICIAR PARTIDA";
        const canStart = (playersCount > 1 && allReady) || (playersCount === 1);
        newBtn.className = "action " + (canStart ? "btn-acc" : "secondary");
        newBtn.style.opacity = canStart ? "1" : "0.5"; newBtn.style.cursor = canStart ? "pointer" : "not-allowed";
        newBtn.onclick = () => { if(canStart) { newBtn.innerText = "INICIANDO..."; if(window.startLobbyMatchData) window.startLobbyMatchData(); } };
    } else {
        let isReady = myStatus === 'ready';
        newBtn.innerText = isReady ? "CANCELAR LISTO" : "✔ ¡ESTOY LISTO!";
        newBtn.className = isReady ? "action secondary" : "action btn-acc";
        newBtn.style.opacity = "1"; newBtn.style.cursor = "pointer";
        newBtn.onclick = () => { if(window.toggleReadyData) window.toggleReadyData(); };
    }
};

window.notifyLobbyLoaded = function() {
    const txt = document.getElementById('loading-text'); if(txt) txt.innerText = "ESPERANDO JUGADORES...";
    if(window.isLobbyHost && window.currentLobbyId) {
        setTimeout(() => { if(window.db) window.db.collection("lobbies").doc(window.currentLobbyId).update({ status: 'playing' }); }, 3000); 
    }
};

// === RUTEO MAESTRO DE MOTORES ONLINE ===
window.checkGameStart = function(lobbyData) {
    if (lobbyData.status === 'playing' && !window.hasGameStarted) {
        window.hasGameStarted = true;
        const m = document.getElementById('modal-host'); if(m) m.style.display = 'none';
        
        let sData = lobbyData.songData || window.curSongData;
        
        // Verifica si la canción requiere un motor distinto
        if (sData && sData.isOsu) {
            let mode = sData.originalMode || 'mania';
            let safeId = sData.id.replace('osu_', '');
            let payload = { id: safeId, ...sData };

            if(mode === 'standard' && typeof window.startNewEngine === 'function') window.startNewEngine(payload);
            else if(mode === 'taiko' && typeof window.startTaikoEngine === 'function') window.startTaikoEngine(payload);
            else if(mode === 'catch' && typeof window.startCatchEngine === 'function') window.startCatchEngine(payload);
            else if(typeof downloadAndPlayOsu === 'function') downloadAndPlayOsu(safeId, sData.title, sData.imageURL, lobbyData.config?.keys?.[0] || 4);
        } else {
            if (window.preparedSong && typeof window.playSongInternal === 'function') {
                window.playSongInternal(window.preparedSong);
            } else if(typeof window.prepareAndPlaySong === 'function') {
                window.prepareAndPlaySong(lobbyData.config?.keys?.[0] || 4);
            }
        }
    }
};
