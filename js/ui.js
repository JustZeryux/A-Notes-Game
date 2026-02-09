function updUI(){
    document.getElementById('m-name').innerText=user.name;
    document.getElementById('p-name').innerText=user.name;
    document.getElementById('ig-name').innerText=user.name;
    document.getElementById('h-pp').innerText=user.pp;
    document.getElementById('p-score').innerText=user.score.toLocaleString();
    document.getElementById('p-plays').innerText=user.plays;
    document.getElementById('m-rank').innerText = "LVL " + user.lvl;
    document.getElementById('p-lvl-txt').innerText = "LVL " + user.lvl;
    
    // XP Logic
    const req = (user.lvl <= 10) ? 1000 * Math.pow(1.05, user.lvl-1) : 1000 * Math.pow(1.05, 9) * Math.pow(1.02, user.lvl-10);
    const pct = (user.xp / req) * 100;
    document.getElementById('p-xp-bar').style.width = pct + "%";
    document.getElementById('p-xp-txt').innerText = `${Math.floor(user.xp)} / ${Math.floor(req)} XP`;
    document.getElementById('p-global-rank').innerText = "#--";
    
    if(user.avatarData) { 
        document.getElementById('m-av').style.backgroundImage=`url(${user.avatarData})`; document.getElementById('m-av').innerText=""; 
        document.getElementById('p-av-big').style.backgroundImage=`url(${user.avatarData})`; 
        document.getElementById('ig-av').style.backgroundImage=`url(${user.avatarData})`; 
    }
    if(user.bg) { document.getElementById('bg-image').src=user.bg; document.getElementById('bg-image').style.opacity=0.3; }

    // Settings Values
    document.getElementById('set-spd').value=cfg.spd;
    document.getElementById('set-den').value=cfg.den;
    document.getElementById('set-vol').value=cfg.vol*100;
    document.getElementById('set-hvol').value=cfg.hvol*100;
    document.getElementById('set-down').checked=cfg.down;
    document.getElementById('set-vivid').checked=cfg.vivid;
    const shakeEl = document.getElementById('set-shake'); if(shakeEl) cfg.shake=shakeEl.checked;
    document.getElementById('set-off').value=cfg.off;
    document.getElementById('set-track-op').value=cfg.trackOp;
    document.getElementById('set-judge-y').value=cfg.judgeY;
    document.getElementById('set-judge-x').value=cfg.judgeX;
    document.getElementById('set-judge-s').value=cfg.judgeS;
    document.getElementById('set-judge-vis').checked=cfg.judgeVis;
    
    const isGoogle = user.pass === "google-auth";
    document.getElementById('local-acc-settings').style.display = isGoogle ? 'none' : 'block';
    document.getElementById('google-acc-settings').style.display = isGoogle ? 'block' : 'none';
}

function switchProfileTab(tab) {
    document.querySelectorAll('.settings-tabs .kb-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('ptab-'+tab).classList.add('active');
    document.getElementById('p-tab-content-resumen').style.display = tab === 'resumen' ? 'block' : 'none';
    document.getElementById('p-tab-content-cuenta').style.display = tab === 'cuenta' ? 'block' : 'none';
}

function renderMenu(f=""){ 
    const g=document.getElementById('song-grid'); g.innerHTML=''; 
    user.songs.forEach(s=>{ 
        const id = s.id || s; 
        if(f&&!id.toLowerCase().includes(f.toLowerCase()))return; 
        const c=document.createElement('div'); c.className='beatmap-card'; 
        const isLoaded = ramSongs.find(r=>r.id===id); 
        c.innerHTML=`<div class="bc-bg" style="background-image:linear-gradient(135deg,hsl(${(id.length*40)%360},60%,20%),black)"></div><div class="bc-info"><div class="bc-title">${id}</div><div class="bc-meta">${isLoaded ? '<span class="tag">READY</span>' : '<span class="tag warn">⚠️ CARGANDO DB...</span>'}<span class="tag keys">4K | 6K | 7K | 9K</span></div></div>`; 
        c.onclick=()=>{ curSongId=id; if(isLoaded) openModal('diff'); else notify("Espera a que cargue la base de datos...", "error"); }; 
        g.appendChild(c); 
    }); 
}

function openModal(id){ document.getElementById('modal-'+id).style.display='flex'; if(id==='settings')renderLaneConfig(4); if(id==='profile'){document.getElementById('login-view').style.display=user.name==='Guest'?'block':'none';document.getElementById('profile-view').style.display=user.name==='Guest'?'none':'block';} }
function closeModal(id){ document.getElementById('modal-'+id).style.display='none'; }

function saveSettings(){ cfg.spd=document.getElementById('set-spd').value; cfg.den=document.getElementById('set-den').value; cfg.vol=document.getElementById('set-vol').value/100; cfg.hvol=document.getElementById('set-hvol').value/100; cfg.down=document.getElementById('set-down').checked; cfg.vivid=document.getElementById('set-vivid').checked; const shakeEl = document.getElementById('set-shake'); if(shakeEl) cfg.shake=shakeEl.checked; cfg.off=parseInt(document.getElementById('set-off').value); cfg.trackOp=document.getElementById('set-track-op').value; cfg.judgeY=document.getElementById('set-judge-y').value; cfg.judgeX=document.getElementById('set-judge-x').value; cfg.judgeS=document.getElementById('set-judge-s').value; cfg.judgeVis=document.getElementById('set-judge-vis').checked; applyCfg(); save(); document.getElementById('modal-settings').style.display='none'; notify("Ajustes guardados"); }
function applyCfg() { document.documentElement.style.setProperty('--track-alpha', cfg.trackOp/100); document.documentElement.style.setProperty('--judge-y', cfg.judgeY + '%'); document.documentElement.style.setProperty('--judge-x', cfg.judgeX + '%'); document.documentElement.style.setProperty('--judge-scale', cfg.judgeS/10); document.documentElement.style.setProperty('--judge-op', cfg.judgeVis ? 1 : 0); }
function saveProfile(){ user.name=document.getElementById('l-user').value||"Guest"; save(); closeModal('profile'); }
function handleBg(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.bg=e.target.result;save();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function uploadAvatar(i){ if(i.files[0]){ const r=new FileReader(); r.onload=e=>{user.avatar=e.target.result;user.avatarData=e.target.result;save(); updUI(); updateFirebaseScore();}; r.readAsDataURL(i.files[0]); i.value=""; }}
function renderLaneConfig(k){ document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active')); document.getElementById('tab-'+k).classList.add('active'); const c=document.getElementById('lanes-container'); c.innerHTML=''; for(let i=0; i<k; i++){ const l = cfg.modes[k][i]; const d=document.createElement('div'); d.className='l-col'; const shapePath = PATHS[l.s] || PATHS['circle']; d.innerHTML=`<div class="key-bind ${remapIdx===i && remapMode===k?'listening':''}" onclick="remapKey(${k},${i})">${l.k.toUpperCase()}</div><div class="shape-indicator" onclick="cycleShape(${k},${i})"><svg class="shape-svg-icon" viewBox="0 0 100 100"><path d="${shapePath}"/></svg></div><input type="color" class="col-pk" value="${l.c}" onchange="updateLaneColor(${k},${i},this.value)">`; c.appendChild(d); } }
function remapKey(k,i){ if(document.activeElement) document.activeElement.blur(); remapMode=k; remapIdx=i; renderLaneConfig(k); }
function updateLaneColor(k,i,v){ cfg.modes[k][i].c=v; }
function cycleShape(k,i){ const shapes=['circle','arrow','square','diamond']; const cur=shapes.indexOf(cfg.modes[k][i].s); cfg.modes[k][i].s = shapes[(cur+1)%4]; renderLaneConfig(k); }
function switchSection(id) {
    document.querySelectorAll('.section-view').forEach(e => e.classList.remove('active'));
    document.getElementById('sec-'+id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+id).classList.add('active');
    if(id === 'hosts') refreshHosts();
}
function openLeaderboard() {
    if(db) {
        db.collection("leaderboard").orderBy("pp", "desc").limit(50)
        .onSnapshot((querySnapshot) => {
            const l = document.getElementById('rank-list'); l.innerHTML=''; 
            let i = 1;
            querySnapshot.forEach((doc) => {
                const d = doc.data();
                const tr = document.createElement('tr');
                if(d.name===user.name) {
                    tr.className='rank-row-me';
                    document.getElementById('p-global-rank').innerText = "#" + i;
                    if(d.pp > user.pp) { user.pp = d.pp; save(); }
                }
                let avHtml = '<div class="rank-av"></div>';
                if(d.avatarData) avHtml = `<div class="rank-av" style="background-image:url(${d.avatarData})"></div>`;
                tr.innerHTML = `<td>#${i++}</td><td>${avHtml}${d.name}</td><td style="color:var(--blue)">${d.pp}pp</td>`;
                l.appendChild(tr);
            });
        });
        openModal('rank');
    }
}
