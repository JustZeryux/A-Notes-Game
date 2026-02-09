function notify(title, body, type="info", duration=5000) {
    const area = document.getElementById('notification-area');
    const id = Date.now();
    const card = document.createElement('div');
    card.className = 'notify-card'; card.id = 'notif-'+id;
    
    let color = "var(--blue)";
    if(type==="success") color = "var(--good)";
    if(type==="error") color = "var(--miss)";
    card.style.borderLeftColor = color;

    card.innerHTML = `
        <div class="notify-content">
            <div class="notify-title" style="color:${color}">${title}</div>
            <div class="notify-body">${body}</div>
        </div>
        <div class="notify-progress" style="background:${color}; transition: width ${duration}ms linear;"></div>
    `;
    
    area.appendChild(card);
    setTimeout(() => { if(card.querySelector('.notify-progress')) card.querySelector('.notify-progress').style.width = '0%'; }, 50);
    setTimeout(() => closeNotif(id), duration);
}

function notifyInteractive(id, title, body, actionsHtml) {
    const area = document.getElementById('notification-area');
    const card = document.createElement('div');
    card.className = 'notify-card'; card.id = 'notif-'+id;
    
    card.innerHTML = `
        <div class="notify-content">
            <div class="notify-title" style="color:var(--gold)">${title}</div>
            <div class="notify-body">${body}</div>
            <div class="notify-actions">${actionsHtml}</div>
        </div>
        <div class="notify-progress" style="width:100%; transition: width 15s linear; background:var(--gold)"></div>
    `;
    area.appendChild(card);
    setTimeout(() => { if(card.querySelector('.notify-progress')) card.querySelector('.notify-progress').style.width = '0%'; }, 50);
    setTimeout(() => closeNotif(id), 15000); 
}

function closeNotif(id) {
    const el = document.getElementById('notif-'+id);
    if(el) { el.classList.add('closing'); setTimeout(()=>el.remove(), 300); }
}

function filterBadWords(text) {
    const bad = ["bobo", "tonto", "idiota", "noob", "ptm", "ctm", "verga", "puto", "mierda"];
    let clean = text;
    bad.forEach(w => { const reg = new RegExp(w, "gi"); clean = clean.replace(reg, "****"); });
    return clean;
}

function triggerShake() { 
    const w = document.getElementById('game-layer'); 
    w.classList.remove('shaking'); void w.offsetWidth; w.classList.add('shaking'); 
}

function createSplash(l) { 
    const r=document.getElementById(`rec-${l}`).getBoundingClientRect(); 
    const s=document.createElement('div'); s.className='splash'; 
    s.style.color = cfg.modes[keys][l].c; 
    s.style.left=(r.left + r.width/2 - 80)+'px'; s.style.top=(r.top + r.height/2 - 80)+'px'; 
    document.body.appendChild(s); setTimeout(()=>s.remove(),300); 
}
