/* === AUDIO & ENGINE === */
function unlockAudio(){ if(!st.ctx){ st.ctx=new(window.AudioContext||window.webkitAudioContext)(); genHit(); } if(st.ctx.state==='suspended') st.ctx.resume(); }
function genHit(){ const b=st.ctx.createBuffer(1,2000,44100),d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.sin(i*0.5)*Math.exp(-i/300); hitBuf=b; }
function playHit(){ if(hitBuf&&cfg.hvol>0&&st.ctx){ const s=st.ctx.createBufferSource(); s.buffer=hitBuf; const g=st.ctx.createGain(); g.gain.value=cfg.hvol; s.connect(g); g.connect(st.ctx.destination); s.start(0); } }
function playHover(){ if(st.ctx && cfg.hvol>0 && st.ctx.state==='running') { const o=st.ctx.createOscillator(); const g=st.ctx.createGain(); o.frequency.value=600; g.gain.value=0.05; o.connect(g); g.connect(st.ctx.destination); o.start(); o.stop(st.ctx.currentTime+0.05); } }

function genMap(buf, k) {
    const d = buf.getChannelData(0); const map=[]; const step = Math.floor(buf.sampleRate/60);
    let sumVol=0; let count=0; for(let i=0;i<d.length;i+=step){ sumVol+=Math.abs(d[i]); count++; }
    const avgVol = sumVol/count; const th = avgVol * (2.8 - (cfg.den * 0.15)); const minGap = 600 - (cfg.den * 50);
    let lastT=-1000; let lastL=0; let stair=0;
    for(let i=0; i<d.length; i+=step) {
        let s=0; for(let j=0; j<step && i+j<d.length; j++) s+=d[i+j]**2;
        const rms = Math.sqrt(s/step);
        if(rms > th && rms > 0.01) {
            const t = (i/buf.sampleRate)*1000;
            if(t-lastT > minGap) {
                let l=0, type='tap', len=0;
                if(cfg.den>=4 && rms>avgVol*1.5) { if(stair<=0) stair=4; } else stair=0;
                if(stair>0) { l=(lastL+1)%k; stair--; } else { l=Math.floor(Math.random()*k); if(l===lastL && Math.random()>0.3) l=(l+1)%k; }
                if(rms > th*1.3 && Math.random()>0.5) { type='hold'; len=Math.random()*300+100; }
                map.push({t:t, l:l, type:type, len:len, h:false});
                if(cfg.den>=7 && rms>avgVol*3.0 && stair===0) { map.push({t:t, l:(l+2)%k, type:'tap', len:0, h:false}); }
                lastT=t; lastL=l;
            }
        }
    } return map;
}

function initReceptors(k) {
    const t = document.getElementById('track'); t.innerHTML = ''; document.documentElement.style.setProperty('--lane-width', (100/k)+'%');
    for(let i=0; i<k; i++){ const l = document.createElement('div'); l.className = 'lane-flash'; l.id=`flash-${i}`; l.style.left = (i*(100/k))+'%'; l.style.setProperty('--c', cfg.modes[k][i].c); t.appendChild(l); }
    const y = cfg.down ? window.innerHeight - 140 : 80;
    for(let i=0;i<k;i++){
        const conf = cfg.modes[k][i]; const r=document.createElement('div'); r.className=`arrow-wrapper receptor`; r.id=`rec-${i}`;
        r.style.left=(i*(100/k))+'%'; r.style.top=y+'px'; r.style.setProperty('--active-c', conf.c);
        const shapePath = PATHS[conf.s] || PATHS['circle']; r.innerHTML=`<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}"/></svg>`; t.appendChild(r);
    }
}

function playSong(name) {
    unlockAudio(); const s = ramSongs.find(x=>x.id===name); if(!s) return notify("Error RAM", "error"); curIdx = name;
    document.getElementById('track').innerHTML = ''; 
    st.notes = JSON.parse(JSON.stringify(s.map)); st.spawned = []; st.sc=0; st.cmb=0; st.hp=50; st.stats={s:0,g:0,b:0,m:0}; st.keys=new Array(keys).fill(0); st.maxScorePossible=0; st.totalHits=0; st.ranked = document.getElementById('chk-ranked').checked;
    st.lastPause = 0; // Inicializar variable de pausa
    opponentScore = 0; songFinished = false; 
    
    // UI Ajustes
    if(isMultiplayer) { 
        document.getElementById('vs-hud').style.display = 'flex'; 
    } else { 
        document.getElementById('vs-hud').style.display = 'none'; 
    }

    document.getElementById('menu-container').classList.add('hidden'); document.getElementById('game-layer').style.display='block'; document.getElementById('hud').style.display='flex';
    
    initReceptors(keys); updHUD();
    
    const cd=document.getElementById('countdown'); let c=3; cd.innerHTML=c;
    const iv=setInterval(async()=>{ if(st.ctx && st.ctx.state === 'suspended') st.ctx.resume(); c--; if(c>0)cd.innerHTML=c; else { clearInterval(iv); cd.innerHTML=""; st.src = st.ctx.createBufferSource(); st.src.buffer=s.buf; const gain = st.ctx.createGain(); gain.gain.value=cfg.vol; st.src.connect(gain); gain.connect(st.ctx.destination); st.startTime = performance.now() + 50; st.t0 = st.ctx.currentTime + 0.05; st.src.start(st.t0); 
    
    st.src.onended=()=>{ songFinished = true; end(false); };
    st.act=true; st.paused=false; loop(); } },600);
}

function loop(){
    if(!st.act || st.paused) return;
    let now; const audioTime = (st.ctx.currentTime - st.t0) * 1000; const visTime = performance.now() - st.startTime;
    if (st.ctx.state === 'running' && audioTime > 0) now = audioTime; else now = visTime;
    const yReceptor = cfg.down ? window.innerHeight - 140 : 80; const w = 100/keys;
    
    for(let i=0; i<st.notes.length; i++) {
        const n = st.notes[i]; if(n.s) continue; if(n.t < now-200) { n.s=true; continue; }
        if(n.t - now < 1500) {
            const el = document.createElement('div');
            const dirClass = cfg.down ? 'hold-down' : 'hold-up';
            el.className = `arrow-wrapper ${n.type==='hold'?'hold-note '+dirClass:''}`; 
            el.style.left = (n.l*w)+'%'; el.style.width = w+'%'; el.style.zIndex = 150;
            
            const conf = cfg.modes[keys][n.l]; const shapePath = PATHS[conf.s] || PATHS['circle'];
            let svg = `<svg class="arrow-svg" viewBox="0 0 100 100"><path class="arrow-path" d="${shapePath}" fill="${conf.c}" stroke="white" stroke-width="2"/></svg>`;
            
            if(n.type==='hold') { 
                const h = (n.len/1000)*cfg.spd*60; 
                svg += `<div class="sustain-trail" style="height:${h}px; background:${conf.c};"></div>`; 
            }
            el.innerHTML = svg; if(cfg.vivid) el.querySelector('.arrow-path').style.filter=`drop-shadow(0 0 8px ${conf.c})`;
            document.getElementById('track').appendChild(el); n.el = el; st.spawned.push(n); n.s = true;
        } else break;
    }

    for(let i=st.spawned.length-1; i>=0; i--) {
        const n = st.spawned[i]; 
        if(!n.el) { st.spawned.splice(i,1); continue; } 

        const diff = n.t - now + cfg.off; 
        const dist = (diff / 1000) * cfg.spd * 60; 
        let finalY = cfg.down ? (yReceptor - dist) : (yReceptor + dist);
        
        if(n.h && n.type==='hold') {
            n.el.style.top = yReceptor+'px'; n.el.style.opacity=0.8; const rem = (n.t + n.len) - now;
            if(rem <= 0) { n.el.remove(); st.spawned.splice(i,1); continue; }
            const tr = n.el.querySelector('.sustain-trail'); if(tr) tr.style.height = Math.max(0, (rem/1000)*cfg.spd*60)+'px';
            if(st.keys[n.l]) { st.hp = Math.min(100, st.hp+0.1); updHUD(); } else n.el.style.opacity=0.3;
        } else if(!n.h) {
            n.el.style.top = finalY + 'px'; 
            if(diff < -160) { miss(n); n.h=true; n.el.style.opacity=0.4; setTimeout(()=>{if(n.el)n.el.remove()},200); st.spawned.splice(i,1); }
        } else { n.el.remove(); st.spawned.splice(i,1); }
    } 
    requestAnimationFrame(loop);
}

// FIXED KEYBOARD LISTENER
function onKd(e) { 
    if(e.key==="Escape"){togglePause();return;} 
    if(["Tab","Alt","Control","Shift"].includes(e.key)) return;

    if(remapMode!==null){ 
        cfg.modes[remapMode][remapIdx].k = e.key.toLowerCase(); 
        renderLaneConfig(remapMode); 
        remapMode=null; 
        return; 
    } 
    if(!e.repeat) { 
        const idx = cfg.modes[keys].findIndex(l => l.k === e.key.toLowerCase()); 
        if(idx !== -1) hit(idx, true); 
    } 
}
function onKu(e) { const idx = cfg.modes[keys].findIndex(l => l.k === e.key.toLowerCase()); if(idx !== -1) hit(idx, false); }

function hit(l, p) {
    if(!st.act || st.paused) return;
    const r = document.getElementById(`rec-${l}`); const flash = document.getElementById(`flash-${l}`);
    if(p) {
        st.keys[l] = 1; if(r) r.classList.add('pressed'); if(flash) { flash.style.opacity = 0.6; setTimeout(() => flash.style.opacity = 0, 100); }
        const audioTime = (st.ctx.currentTime - st.t0) * 1000; const visTime = performance.now() - st.startTime; const now = (st.ctx.state === 'running' && audioTime > 0) ? audioTime : visTime;
        const n = st.spawned.find(x => x.l===l && !x.h && Math.abs(x.t-(now+cfg.off))<160);
        if(n) {
            const d = Math.abs(n.t-(now+cfg.off)); let t="BAD", c="yellow", pts=50;
            if(d<45) { t="SICK"; c="var(--sick)"; pts=350; st.stats.s++; if(cfg.shake) triggerShake(); if(cfg.vivid) createSplash(l); playHit(); }
            else if(d<90) { t="GOOD"; c="var(--good)"; pts=200; st.stats.g++; playHit(); }
            else { st.stats.b++; st.cmb=0; st.hp-=5; }
            if(pts>50) st.cmb++; st.sc+=pts; st.maxScorePossible+=350; st.hp = Math.min(100, st.hp+2);
            showJudge(t, c); updHUD(); n.h = true; if(n.len<=0 && n.el) n.el.style.display='none'; 
        } else if(!cfg.down) { st.sc-=10; st.cmb=0; st.hp-=2; updHUD(); }
    } else { st.keys[l] = 0; if(r) r.classList.remove('pressed'); }
}

function miss(n) { showJudge("MISS", "var(--miss)"); st.stats.m++; st.cmb=0; st.hp-=10; st.maxScorePossible+=350; updHUD(); if(st.hp<=0)end(true); }
function triggerShake() { const w = document.getElementById('game-layer'); w.classList.remove('shaking'); void w.offsetWidth; w.classList.add('shaking'); }
function createSplash(l) { const r=document.getElementById(`rec-${l}`).getBoundingClientRect(); const s=document.createElement('div'); s.className='splash'; s.style.color = cfg.modes[keys][l].c; s.style.left=(r.left + r.width/2 - 80)+'px'; s.style.top=(r.top + r.height/2 - 80)+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),300); }
function showJudge(t,c){ if(!cfg.judgeVis) return; const j=document.createElement('div'); j.className='judge-pop'; j.innerText=t; j.style.color=c; document.body.appendChild(j); setTimeout(()=>j.remove(),400); }

function updHUD(){
    document.getElementById('g-score').innerText=st.sc.toLocaleString();
    
    // Si es lobby de 4 jugadores, enviar score a Firestore
    if(isMultiplayer && typeof sendLobbyScore === 'function') {
        sendLobbyScore(st.sc);
    } else if (conn && conn.open) {
        conn.send({ type: 'score', val: st.sc });
    }

    document.getElementById('g-combo').innerText=st.cmb;
    const acc=st.maxScorePossible>0?Math.round((st.sc/st.maxScorePossible)*100):100;
    document.getElementById('g-acc').innerText=acc+"%";
    document.getElementById('health-fill').style.height=st.hp+"%";
    document.getElementById('h-sick').innerText=st.stats.s; document.getElementById('h-good').innerText=st.stats.g; document.getElementById('h-bad').innerText=st.stats.b; document.getElementById('h-miss').innerText=st.stats.m;
}

function togglePause(){ 
    if(!st.act) return; 
    st.paused = !st.paused; 
    
    if(st.paused){ 
        st.lastPause = performance.now(); // Guardar timestamp
        if(st.ctx) st.ctx.suspend(); 
        document.getElementById('modal-pause').style.display='flex'; 
        document.getElementById('p-sick').innerText=st.stats.s; 
        document.getElementById('p-good').innerText=st.stats.g; 
        document.getElementById('p-bad').innerText=st.stats.b; 
        document.getElementById('p-miss').innerText=st.stats.m; 
    } else {
        resumeGame(); 
    }
}

function resumeGame(){ 
    document.getElementById('modal-pause').style.display='none'; 
    if(st.ctx) st.ctx.resume(); 
    
    // Ajustar tiempo para evitar saltos en fallback visual
    if(st.lastPause) {
        const dur = performance.now() - st.lastPause;
        st.startTime += dur; 
        st.lastPause = 0;
    }

    st.paused = false; 
    loop(); // <--- REINICIA EL BUCLE (SOLUCIÓN)
}

function end(died){
    st.act=false; if(st.src)try{st.src.stop()}catch(e){}
    document.getElementById('game-layer').style.display='none'; document.getElementById('modal-res').style.display='flex';
    const acc=st.maxScorePossible>0?Math.round((st.sc/st.maxScorePossible)*100):0;
    let r="F"; let c="red";
    if(!died){ 
        if(acc===100){r="SS";c="cyan"} else if(acc>=95){r="S";c="gold"} else if(acc>=90){r="A";c="lime"} else if(acc>=80){r="B";c="yellow"} else if(acc>=70){r="C";c="orange"} else {r="D";c="red"}
    }
    
    if(isMultiplayer) {
         document.getElementById('winner-msg').innerText = "PARTIDA FINALIZADA";
         document.getElementById('winner-msg').style.display = 'block';
         document.getElementById('winner-msg').style.color = 'white';
         if(typeof leaveLobby === 'function') leaveLobby(); 
    } else { document.getElementById('winner-msg').style.display = 'none'; }

    document.getElementById('res-rank').innerText=r; document.getElementById('res-rank').style.color=c;
    document.getElementById('res-score').innerText=st.sc.toLocaleString(); document.getElementById('res-acc').innerText=acc+"%";
    
    if(!died && songFinished && user.name!=="Guest"){ 
        // XP FORMULA V2 (Faster)
        const xpGain = Math.floor(st.sc / 250); 
        user.xp += xpGain; 
        
        // SCORE POINTS (SP)
        const spGain = Math.floor(st.sc / 1000);
        if(!user.sp) user.sp = 0;
        user.sp += spGain;

        user.score += st.sc; 
        user.plays++; 
        
        // Level Up Scaling
        let xpReq = 1000 * Math.pow(1.05, user.lvl - 1);
        if(user.lvl >= 10) xpReq = 1000 * Math.pow(1.02, user.lvl - 1); 
        xpReq = Math.floor(xpReq);

        if(user.xp >= xpReq) { 
            user.xp -= xpReq; 
            user.lvl++; 
            notify("¡NIVEL " + user.lvl + " ALCANZADO!", "success", 5000); 
        }

        if(st.ranked) { 
            if(acc < 50) { user.pp = Math.max(0, user.pp - 15); document.getElementById('pp-gain-loss').innerText = "-15 PP"; document.getElementById('pp-gain-loss').style.color = "var(--miss)"; }
            else { const ppG = Math.floor(st.sc/5000); user.pp += ppG; document.getElementById('pp-gain-loss').innerText = `+${ppG} PP`; document.getElementById('pp-gain-loss').style.color = "var(--gold)"; }
        } else { document.getElementById('pp-gain-loss').innerText = "0 PP"; document.getElementById('pp-gain-loss').style.color = "white"; }
        
        save(); updateFirebaseScore(); 
        
        document.getElementById('res-xp').innerText = xpGain;
        document.getElementById('res-sp').innerText = spGain;
    } else { 
        document.getElementById('res-xp').innerText = 0; 
        document.getElementById('res-sp').innerText = 0;
    }
}
function toMenu() { location.reload(); }
function startGame(k) { keys = k; const s = ramSongs.find(x=>x.id===curSongId); if(!s) return notify("Error RAM.", "error"); s.map = genMap(s.buf, k); closeModal('diff'); playSong(curSongId); }
