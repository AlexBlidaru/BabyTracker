/* ======================================================================
   GEMENII · TRACKER — app.js (rescris curat)
   State-ul complet trăiește în `state`, e salvat local (localStorage)
   și sincronizat pe server (Cloudflare KV) ca să fie comun pt. părinți.
   ====================================================================== */

const API = '/api/data';
const LOCAL_KEY = 'babyTrackerGemeni_v2';

/* ================= ERROR BANNER (diagnosticare vizibilă) ================= */
/* Dacă orice funcție eșuează silențios, apare o bandă roșie cu mesajul     */
/* exact al erorii — util ca să ne poți trimite o poză dacă ceva nu merge.  */

function showErrorBanner(msg){
  let el = document.getElementById('errBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'errBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#E0645A;color:#fff;padding:10px 16px;font-size:12.5px;font-family:sans-serif;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.3);';
    document.body.appendChild(el);
  }
  el.textContent = 'Eroare: ' + msg;
  el.style.display = 'block';
  clearTimeout(window.__errBannerTimeout);
  window.__errBannerTimeout = setTimeout(()=>{ el.style.display = 'none'; }, 7000);
}
window.addEventListener('error', (e)=>{
  showErrorBanner((e.error && e.error.message) || e.message || 'necunoscută');
});
window.addEventListener('unhandledrejection', (e)=>{
  showErrorBanner((e.reason && e.reason.message) || String(e.reason));
});

/* ================= ICONS ================= */

const ICONS = {
  moon: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  breastL: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="9" y="14" font-size="7" fill="currentColor" stroke="none">S</text></svg>`,
  breastR: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="9.3" y="14" font-size="7" fill="currentColor" stroke="none">D</text></svg>`,
  bottle: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 2h6M10 2v3.5c0 .6-.3 1-.7 1.4C8.4 7.8 8 8.7 8 9.8V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9.8c0-1.1-.4-2-1.3-2.9-.4-.4-.7-.8-.7-1.4V2M8 13h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  solid: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 16 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M2 12h20M6 16.5c1.5 2 3.7 3 6 3s4.5-1 6-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  diaper: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M4 6v3.5C4 15 7.5 19 12 20c4.5-1 8-5 8-10.5V6M9 12a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  note: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 10h6M9 14h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  thermometer: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  tummytime: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="15" rx="7" ry="4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`,
};

/* ================= HELPERS ================= */

function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function nowISO(){ return new Date().toISOString(); }
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function parseNum(v){
  if(v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if(s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function fmtTime(iso){ return new Date(iso).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}); }
function fmtDur(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if(h>0) return `${h}h ${m}min`;
  if(m>0) return `${m}min ${sec}sec`;
  return `${sec}sec`;
}
function timeAgo(iso){
  if(!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff/60000);
  if(min < 1) return 'chiar acum';
  if(min < 60) return `acum ${min} min`;
  const h = Math.floor(min/60);
  if(h < 24) return `acum ${h}h ${min%60}m`;
  return `acum ${Math.floor(h/24)}z`;
}
function dayLabel(iso){
  const d = new Date(iso), today = new Date();
  const isSameDay = (a,b)=> a.toDateString()===b.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  if(isSameDay(d,today)) return 'Azi';
  if(isSameDay(d,yesterday)) return 'Ieri';
  return d.toLocaleDateString('ro-RO',{day:'2-digit',month:'long'});
}
function toTimeInput(iso){ const d = new Date(iso); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function toDateInput(iso){ return new Date(iso).toISOString().slice(0,10); }
function combineTimeWithDate(refISO, hhmm, isEnd, startISOForEnd){
  const ref = new Date(refISO);
  const [h,m] = hhmm.split(':').map(Number);
  const d = new Date(ref); d.setHours(h,m,0,0);
  if(isEnd && startISOForEnd && d < new Date(startISOForEnd)) d.setDate(d.getDate()+1);
  return d.toISOString();
}
function combineDateAndTime(dateStr, timeStr){
  const [y,mo,d] = dateStr.split('-').map(Number);
  const [h,mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, mo-1, d, h, mi, 0, 0);
  return dt.toISOString();
}
function relativeUntil(date){
  const diffMs = date.getTime() - Date.now();
  const totalMin = Math.round(diffMs/60000);
  if(totalMin <= 0) return 'acum';
  if(totalMin < 60) return `în ${totalMin}min`;
  const h = Math.floor(totalMin/60), m = totalMin%60;
  return `în ${h}h${m>0?' '+m+'min':''}`;
}

/* ================= STATE MODEL ================= */

function defaultState(){
  return {
    version: 2,
    babies: [
      { id:'a', name:'Bebe A', color:'#8FB49C', birthDate:null },
      { id:'b', name:'Bebe B', color:'#D98A96', birthDate:null },
    ],
    logs: { feeding: [], sleep: [], diaper: [], growth: [], activity: [], medPlans: [], medDoses: [] },
    timers: { feeding: {}, sleep: {} },
    updatedAt: 0,
  };
}
function normalizeState(s){
  if(!s || typeof s !== 'object') return defaultState();
  s.logs = s.logs || {};
  ['feeding','sleep','diaper','growth','activity','medPlans','medDoses'].forEach(k=>{
    if(!Array.isArray(s.logs[k])) s.logs[k] = [];
  });
  s.timers = s.timers || {};
  s.timers.feeding = s.timers.feeding || {};
  s.timers.sleep = s.timers.sleep || {};
  s.babies = (s.babies && s.babies.length) ? s.babies : defaultState().babies;
  s.babies.forEach(b=>{ if(b.birthDate===undefined) b.birthDate = null; });
  s.logs.medPlans.forEach(p=>{ if(!p.endType) p.endType = 'never'; });
  if(typeof s.updatedAt !== 'number') s.updatedAt = 0;
  return s;
}

let state = defaultState();
let ui = {
  view: 'dashboard',
  currentBaby: 'a',
  growthBaby: 'a',
  timelineType: 'all',
  medsBaby: 'all',
};
let pendingSave = false;
let saveTimeout = null;
let chartInstance = null;

/* ================= PERSISTENCE / SYNC ================= */

function loadLocal(){
  try{
    const raw = localStorage.getItem(LOCAL_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}
function saveLocal(){
  try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }catch(e){}
}
function setSyncStatus(s){
  const dot = document.getElementById('syncDot');
  if(dot) dot.className = 'sync-dot ' + s;
}
async function pushToServer(){
  setSyncStatus('syncing');
  try{
    const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(state) });
    if(!res.ok) throw new Error('bad status');
    setSyncStatus('synced');
    const el = document.getElementById('lastSyncTime');
    if(el) el.textContent = new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ setSyncStatus('error'); }
  pendingSave = false;
}
function scheduleSave(){
  state.updatedAt = Date.now();
  saveLocal();
  pendingSave = true;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(pushToServer, 450);
}
async function pullFromServer({ applyIfNewer } = { applyIfNewer:false }){
  try{
    const res = await fetch(API);
    if(!res.ok) throw new Error('bad status');
    const remote = await res.json();
    if(!remote || typeof remote !== 'object') return;
    if(applyIfNewer){
      if((remote.updatedAt||0) > (state.updatedAt||0) && !pendingSave){
        state = normalizeState(remote);
        saveLocal();
        render();
      }
    } else {
      if((remote.updatedAt||0) >= (state.updatedAt||0)){
        state = normalizeState(remote);
      } else {
        scheduleSave();
      }
      saveLocal();
    }
    setSyncStatus('synced');
    const el = document.getElementById('lastSyncTime');
    if(el) el.textContent = new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ setSyncStatus('error'); }
}

/* ================= HELPERS: BABIES ================= */

function baby(id){ return state.babies.find(b=>b.id===id) || state.babies[0]; }
function activeBabyIds(){ return ui.currentBaby === 'all' ? state.babies.map(b=>b.id) : [ui.currentBaby]; }
function babyNames(ids){ return ids.map(id=> baby(id).name).join(' & '); }

/* ================= BACKGROUND TINT ================= */

function applyBackgroundTint(){
  const appEl = document.getElementById('app');
  if(!appEl) return;
  if(ui.currentBaby === 'all'){
    appEl.classList.remove('bg-tinted');
    appEl.style.removeProperty('--tint');
  } else {
    const b = baby(ui.currentBaby);
    appEl.style.setProperty('--tint', b.color);
    appEl.classList.add('bg-tinted');
  }
}

/* ================= RENDER: TOP SWITCH ================= */

function renderTwinSwitch(){
  const el = document.getElementById('twinSwitch');
  const opts = [...state.babies, {id:'all', name:'Ambele'}];
  el.innerHTML = opts.map(b=>{
    const active = ui.currentBaby === b.id ? 'active' : '';
    const dot = b.color ? `<span class="dot" style="background:${b.color}"></span>` : '';
    return `<button class="twin-tab ${active}" data-baby="${b.id}">${dot}${b.name}</button>`;
  }).join('');
  el.querySelectorAll('.twin-tab').forEach(btn=>{
    btn.onclick = ()=>{ ui.currentBaby = btn.dataset.baby; renderAll(); };
  });
}

/* ================= RENDER: DASHBOARD — STATUS ================= */

function activeSleepFor(id){ return state.timers.sleep[id] || null; }
function activeFeedFor(id){ return state.timers.feeding[id] || null; }
function lastEntry(arr, babyId){
  const filtered = arr.filter(e=>e.babyId===babyId);
  if(!filtered.length) return null;
  return filtered.reduce((a,b)=> new Date(a.end||a.start||a.time) > new Date(b.end||b.start||b.time) ? a : b);
}

function renderStatusRow(){
  const el = document.getElementById('statusRow');
  el.innerHTML = state.babies.map(b=>{
    const sleeping = activeSleepFor(b.id);
    const feeding = activeFeedFor(b.id);
    const lastSleep = lastEntry(state.logs.sleep, b.id);
    const lastFeed = lastEntry(state.logs.feeding, b.id);
    const lastDiaper = lastEntry(state.logs.diaper, b.id);

    let stateLabel, stateSub, activeClass='';
    if(sleeping){
      stateLabel = 'Doarme'; stateSub = 'de la ' + fmtTime(sleeping.start); activeClass='active-timer';
    } else if(feeding){
      const map = {breastL:'Alăptare (S)', breastR:'Alăptare (D)'};
      stateLabel = map[feeding.subtype] || 'Mănâncă'; stateSub = 'de la ' + fmtTime(feeding.start); activeClass='active-timer';
    } else {
      stateLabel = 'Treaz';
      stateSub = lastSleep ? `somn ${timeAgo(lastSleep.end||lastSleep.start)}` : 'fără date de somn';
    }
    return `<div class="status-card ${activeClass}" style="color:${b.color}">
      <div class="baby-name" style="color:var(--text)"><span class="dot" style="background:${b.color}"></span>${b.name}</div>
      <div class="state-label">${stateLabel}</div>
      <div class="state-sub">${stateSub}</div>
      <div class="state-sub" style="margin-top:6px;opacity:.8">🍼 ${lastFeed?timeAgo(lastFeed.end||lastFeed.start):'—'} · 💧 ${lastDiaper?timeAgo(lastDiaper.time):'—'}</div>
    </div>`;
  }).join('');
}

/* ================= RENDER: VITALS STRIP (referință bpm standard pe vârstă) ================= */

function getStandardBpm(birthDate){
  if(!birthDate) return null;
  const ageDays = Math.floor((Date.now() - new Date(birthDate).getTime())/(24*3600*1000));
  if(ageDays < 0) return null;
  if(ageDays < 28) return {label:'nou-născut', bpm:140};
  if(ageDays < 365) return {label:'sugar', bpm:120};
  if(ageDays < 730) return {label:'1-2 ani', bpm:110};
  return {label:'peste 2 ani', bpm:100};
}

function renderVitalsStrip(){
  const el = document.getElementById('vitalsStrip');
  if(!el) return;
  el.innerHTML = state.babies.map(b=>{
    const ref = getStandardBpm(b.birthDate);
    if(!ref){
      return `<div class="vitals-card vempty">Adaugă data nașterii pt. ${escapeHtml(b.name)} în Setări</div>`;
    }
    return `<div class="vitals-card" title="Interval standard orientativ pentru vârstă — nu e o măsurătoare reală">
      <span class="vheart" style="color:${b.color}">❤</span>
      <div class="vtext">
        <div class="vname">${escapeHtml(b.name)}</div>
        <div class="vbpm">~${ref.bpm} <small>bpm · ${ref.label}</small></div>
      </div>
    </div>`;
  }).join('');
}

/* ================= RENDER: UPCOMING TASKS BAND (din planurile de meds) ================= */

function getUpcomingTasks(limit=3){
  const raw = [];
  state.logs.medPlans.filter(p=>!p.paused && !isPlanFinished(p)).forEach(plan=>{
    const next = nextDoseTimeForPlan(plan);
    raw.push({ time: next, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, icon:'💊' });
  });
  const groups = {};
  raw.forEach(item=>{
    const key = item.name.trim().toLowerCase() + '|' + Math.round(item.time.getTime()/(10*60000));
    if(!groups[key]) groups[key] = { name:item.name, doseText:item.doseText, icon:item.icon, time:item.time, babyIds:[] };
    groups[key].babyIds.push(item.babyId);
    if(item.time < groups[key].time) groups[key].time = item.time;
  });
  return Object.values(groups).sort((a,b)=> a.time-b.time).slice(0, limit);
}

function renderUpcomingBand(){
  const el = document.getElementById('upcomingBand');
  if(!el) return;
  const tasks = getUpcomingTasks(3);
  if(!tasks.length){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const now = new Date();
  el.innerHTML = tasks.map(t=>{
    const overdue = t.time < now;
    const babiesLbl = t.babyIds.length>1 ? 'Ambele' : baby(t.babyIds[0]).name;
    return `<button type="button" class="upcoming-chip ${overdue?'overdue':''}">
      <div class="uc-title">${t.icon} ${escapeHtml(t.name)}</div>
      <div class="uc-time">${overdue?'acum':relativeUntil(t.time)}</div>
      <div class="uc-sub">${escapeHtml(babiesLbl)}${t.doseText?' · '+escapeHtml(t.doseText):''}</div>
    </button>`;
  }).join('');
  el.querySelectorAll('.upcoming-chip').forEach(chip=>{ chip.onclick = ()=> switchView('meds'); });
}

/* ================= RENDER: QUICK ACTIONS ================= */

function renderQuickGrid(){
  const el = document.getElementById('quickGrid');
  const tId = activeBabyIds()[0];
  const sleeping = activeSleepFor(tId);
  const feedL = activeFeedFor(tId) && activeFeedFor(tId).subtype==='breastL';
  const feedR = activeFeedFor(tId) && activeFeedFor(tId).subtype==='breastR';

  const items = [
    { key:'sleep', label: sleeping? 'Oprește somn':'Somn', icon:ICONS.moon, running: !!sleeping },
    { key:'breastL', label:'Alăptare S', icon:ICONS.breastL, running: feedL },
    { key:'breastR', label:'Alăptare D', icon:ICONS.breastR, running: feedR },
    { key:'bottle', label:'Biberon', icon:ICONS.bottle },
    { key:'solid', label:'Masă solidă', icon:ICONS.solid },
    { key:'altele', label:'Altele', icon:ICONS.note },
  ];
  el.innerHTML = items.map(it=>`
    <button class="quick-btn ${it.running?'running':''}" data-action="${it.key}">
      ${it.icon}<span>${it.label}</span>
    </button>`).join('');
  el.querySelectorAll('.quick-btn').forEach(btn=>{
    btn.onclick = ()=> handleQuickAction(btn.dataset.action);
  });
}

function handleQuickAction(action){
  const babyIds = activeBabyIds();
  const refId = babyIds[0];
  if(action==='sleep'){
    const active = activeSleepFor(refId);
    if(active){
      openConfirmTimerSheet('sleep', babyIds, active.start);
    } else {
      babyIds.forEach(id=>{ state.timers.sleep[id] = { start: nowISO() }; });
      scheduleSave(); renderAll();
    }
    return;
  }
  if(action==='breastL' || action==='breastR'){
    const active = activeFeedFor(refId);
    if(active && active.subtype===action){
      openConfirmTimerSheet('feeding', babyIds, active.start, action);
    } else {
      babyIds.forEach(id=>{ state.timers.feeding[id] = { subtype: action, start: nowISO() }; });
      scheduleSave(); renderAll();
    }
    return;
  }
  if(action==='bottle') return openFeedingSheet({ babyIds, subtype:'bottle' });
  if(action==='solid') return openFeedingSheet({ babyIds, subtype:'solid' });
  if(action==='altele') return openOtherTypeSheet(babyIds);
}

function openConfirmTimerSheet(kind, babyIds, start, subtype){
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  const durNow = Date.now()-new Date(start).getTime();
  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${kind==='sleep'?'Oprește somnul':'Oprește alăptarea'} — ${names}</h3>
    <div class="sheet-sub">Durată: ${fmtDur(durNow)}${babyIds.length>1?' · se aplică la amândoi':''}</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Început</label><input type="time" id="fStart" value="${toTimeInput(start)}"></div>
      <div class="form-group"><label class="form-label">Sfârșit</label><input type="time" id="fEnd" value="${toTimeInput(nowISO())}"></div>
    </div>
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="fNotes" placeholder="ex: a adormit greu"></textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="fCancel">Renunță</button>
      <button class="btn-primary" id="fSave" style="background:${refBaby.color}">Salvează</button>
    </div>
  `);
  document.getElementById('fCancel').onclick = closeSheet;
  document.getElementById('fSave').onclick = ()=>{
    try{
      const startISO = combineTimeWithDate(start, document.getElementById('fStart').value);
      const endISO = combineTimeWithDate(start, document.getElementById('fEnd').value, true, startISO);
      const notes = document.getElementById('fNotes').value.trim();
      babyIds.forEach(babyId=>{
        if(kind==='sleep'){
          if(!state.timers.sleep[babyId]) return;
          state.logs.sleep.push({ id: uid(), babyId, start: startISO, end: endISO, notes });
          delete state.timers.sleep[babyId];
        } else {
          if(!state.timers.feeding[babyId]) return;
          state.logs.feeding.push({ id: uid(), babyId, subtype, start: startISO, end: endISO, notes });
          delete state.timers.feeding[babyId];
        }
      });
      scheduleSave(); closeSheet(); renderAll();
    }catch(err){ console.error(err); alert('Eroare la salvare.'); }
  };
}

function openFeedingSheet(prefill){
  const babyIds = prefill.babyIds;
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  const bothNote = babyIds.length>1 ? `<div class="sheet-sub">Se aplică la amândoi</div>` : '';
  const isBottle = prefill.subtype==='bottle';
  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${isBottle?'Biberon':'Masă solidă'} — ${names}</h3>
    ${bothNote}
    <div class="form-group"><label class="form-label">Ora</label><input type="time" id="fTime" value="${toTimeInput(nowISO())}"></div>
    ${isBottle
      ? `<div class="form-group"><label class="form-label">Cantitate (ml)</label><input type="text" inputmode="decimal" id="fAmount" placeholder="ex: 120"></div>
         <div class="checkbox-row"><input type="checkbox" id="fBreastMilk"><label for="fBreastMilk">Lapte matern</label></div>`
      : `<div class="form-group"><label class="form-label">Ce a mâncat</label><input type="text" id="fFood" placeholder="ex: piure de morcov"></div>`
    }
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="fNotes"></textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="fCancel">Renunță</button>
      <button class="btn-primary" id="fSave" style="background:${refBaby.color}">Salvează</button>
    </div>
  `);
  document.getElementById('fCancel').onclick = closeSheet;
  document.getElementById('fSave').onclick = ()=>{
    try{
      const start = combineTimeWithDate(nowISO(), document.getElementById('fTime').value);
      const notes = document.getElementById('fNotes').value.trim();
      const amountMl = isBottle ? parseNum(document.getElementById('fAmount').value) : null;
      const breastMilk = isBottle ? document.getElementById('fBreastMilk').checked : false;
      const foodDesc = isBottle ? null : document.getElementById('fFood').value.trim();
      babyIds.forEach(babyId=>{
        const entry = { id: uid(), babyId, subtype: prefill.subtype, start, end: start, notes };
        if(isBottle){ entry.amountMl = amountMl; entry.breastMilk = breastMilk; }
        else entry.foodDesc = foodDesc;
        state.logs.feeding.push(entry);
      });
      scheduleSave(); closeSheet(); renderAll();
    }catch(err){ console.error(err); alert('Eroare la salvare.'); }
  };
}

/* ---- "Altele": Temperatură / Scutece / Tummy time / Altele (notă) ---- */

function openOtherTypeSheet(babyIds){
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  let currentType = 'temperatura';

  function fieldsHtml(type){
    if(type==='temperatura'){
      return `<div class="form-group"><label class="form-label">Temperatură (°C)</label><input type="text" inputmode="decimal" id="otValue" placeholder="ex: 37.4"></div>`;
    }
    if(type==='scutece'){
      return `<div class="form-group"><label class="form-label">Tip</label>
        <div class="seg" id="otDiaperType">
          <button class="seg-btn active" data-v="pipi">Pipi</button>
          <button class="seg-btn" data-v="caca">Caca</button>
          <button class="seg-btn" data-v="ambele">Ambele</button>
        </div></div>`;
    }
    if(type==='tummytime'){
      return `<div class="form-group"><label class="form-label">Durată (minute)</label><input type="text" inputmode="numeric" id="otValue" placeholder="ex: 10"></div>`;
    }
    return `<div class="form-group"><label class="form-label">Notă</label><textarea id="otValue" placeholder="ex: azi a zâmbit prima dată!"></textarea></div>`;
  }

  function renderBody(){
    renderSheet(`
      <div class="sheet-handle"></div>
      <h3>Altele — ${names}</h3>
      ${babyIds.length>1?`<div class="sheet-sub">Se aplică la amândoi</div>`:''}
      <div class="form-group"><label class="form-label">Tip</label>
        <div class="seg" id="otType">
          <button class="seg-btn ${currentType==='temperatura'?'active':''}" data-v="temperatura">Temperatură</button>
          <button class="seg-btn ${currentType==='scutece'?'active':''}" data-v="scutece">Scutece</button>
          <button class="seg-btn ${currentType==='tummytime'?'active':''}" data-v="tummytime">Tummy time</button>
          <button class="seg-btn ${currentType==='altele'?'active':''}" data-v="altele">Altele</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="otTime" value="${toTimeInput(nowISO())}"></div>
      <div id="otFields">${fieldsHtml(currentType)}</div>
      ${currentType!=='altele' ? `<div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="otNotes"></textarea></div>` : ''}
      <div class="sheet-actions">
        <button class="btn-cancel" id="otCancel">Renunță</button>
        <button class="btn-primary" id="otSave" style="background:${refBaby.color}">Salvează</button>
      </div>
    `);

    document.querySelectorAll('#otType .seg-btn').forEach(btn=>{
      btn.onclick = ()=>{ currentType = btn.dataset.v; renderBody(); };
    });
    if(currentType==='scutece'){
      document.querySelectorAll('#otDiaperType .seg-btn').forEach(btn=>{
        btn.onclick = ()=>{ document.querySelectorAll('#otDiaperType .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); };
      });
    }
    document.getElementById('otCancel').onclick = closeSheet;
    document.getElementById('otSave').onclick = ()=>{
      try{
        const time = combineTimeWithDate(nowISO(), document.getElementById('otTime').value);
        const notesEl = document.getElementById('otNotes');
        const notes = notesEl ? notesEl.value.trim() : '';
        babyIds.forEach(babyId=>{
          if(currentType==='scutece'){
            const diaperType = document.querySelector('#otDiaperType .seg-btn.active').dataset.v;
            state.logs.diaper.push({ id: uid(), babyId, type: diaperType, time, notes });
          } else if(currentType==='altele'){
            const value = document.getElementById('otValue').value.trim();
            state.logs.activity.push({ id: uid(), babyId, type:'altele', value:'', notes: value, time });
          } else {
            const value = document.getElementById('otValue').value.trim();
            state.logs.activity.push({ id: uid(), babyId, type: currentType, value, notes, time });
          }
        });
        scheduleSave(); closeSheet(); renderAll();
      }catch(err){ console.error(err); alert('Eroare la salvare.'); }
    };
  }

  renderBody();
}

/* ================= RENDER: TODAY STATS ================= */

function renderTodayStats(){
  const el = document.getElementById('todayStats');
  const babiesToShow = ui.currentBaby==='all' ? state.babies.map(b=>b.id) : [ui.currentBaby];
  const isToday = (iso)=> iso && dayLabel(iso)==='Azi';

  let feedCount=0, sleepMs=0;
  state.logs.feeding.forEach(e=>{ if(babiesToShow.includes(e.babyId) && isToday(e.end||e.start)) feedCount++; });
  state.logs.sleep.forEach(e=>{ if(babiesToShow.includes(e.babyId) && e.end && isToday(e.end)) sleepMs += (new Date(e.end)-new Date(e.start)); });

  const cards = [
    { num: feedCount, lbl: 'mese/alăptări azi' },
    { num: fmtDur(sleepMs), lbl: 'somn azi' },
  ];
  el.innerHTML = cards.map(c=>`<div class="stat-pill"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');
}

/* ================= RENDER: SLEEP PREDICTION ================= */

const MIN_SLEEP_SESSIONS_FOR_PREDICTION = 6;

function computeSleepPrediction(babyId){
  const sessions = state.logs.sleep
    .filter(s=> s.babyId===babyId && s.start && s.end)
    .sort((a,b)=> new Date(a.start) - new Date(b.start));

  if(sessions.length < MIN_SLEEP_SESSIONS_FOR_PREDICTION){
    return { status:'not_enough', have: sessions.length, need: MIN_SLEEP_SESSIONS_FOR_PREDICTION };
  }
  const windows = [];
  for(let i=1;i<sessions.length;i++){
    const prevEnd = new Date(sessions[i-1].end).getTime();
    const curStart = new Date(sessions[i].start).getTime();
    const diff = curStart - prevEnd;
    if(diff > 20*60*1000 && diff < 7*60*60*1000) windows.push(diff);
  }
  if(windows.length < 3){
    return { status:'not_enough', have: sessions.length, need: MIN_SLEEP_SESSIONS_FOR_PREDICTION };
  }
  const recent = windows.slice(-12);
  const avgWindow = recent.reduce((a,c)=>a+c,0) / recent.length;

  const active = activeSleepFor(babyId);
  if(active) return { status:'sleeping', since: active.start };

  const lastSession = sessions[sessions.length-1];
  const lastWake = new Date(lastSession.end).getTime();
  const predicted = new Date(lastWake + avgWindow);
  return { status:'ok', predictedTime: predicted.toISOString(), avgWindowMs: avgWindow, sampleSize: recent.length };
}

function renderSleepPrediction(){
  const el = document.getElementById('sleepPredictionWrap');
  const babyIds = activeBabyIds();
  const rows = babyIds.map(id=>{
    const b = baby(id);
    const pred = computeSleepPrediction(id);
    if(pred.status==='not_enough'){
      return `<div class="predict-row">
        <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)}</div>
        <div class="predict-hint">încă ${Math.max(1, pred.need - pred.have)} somnuri până la prima predicție</div>
      </div>`;
    }
    if(pred.status==='sleeping'){
      return `<div class="predict-row">
        <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)}</div>
        <div style="text-align:right"><div class="predict-val">doarme acum</div><div class="predict-sub">de la ${fmtTime(pred.since)}</div></div>
      </div>`;
    }
    const windowH = Math.floor(pred.avgWindowMs/3600000);
    const windowM = Math.round((pred.avgWindowMs%3600000)/60000);
    const isPast = new Date(pred.predictedTime) < new Date();
    return `<div class="predict-row">
      <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)}</div>
      <div style="text-align:right">
        <div class="predict-val">${isPast?'de acum câteva minute':fmtTime(pred.predictedTime)}</div>
        <div class="predict-sub">fereastră trează tipică: ~${windowH>0?windowH+'h ':''}${windowM}min</div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="predict-card"><div class="predict-title">🌙 Predicție somn</div>${rows}</div>`;
}

/* ================= RENDER: TIMELINE ================= */

function collectTimeline(){
  const babiesFilter = ui.currentBaby==='all' ? state.babies.map(b=>b.id) : [ui.currentBaby];
  let items = [];
  state.logs.sleep.forEach(e=> items.push({...e, _type:'sleep', _t: e.end||e.start}));
  state.logs.feeding.forEach(e=> items.push({...e, _type:'feeding', _t: e.end||e.start}));
  state.logs.diaper.forEach(e=> items.push({...e, _type:'diaper', _t: e.time}));
  state.logs.activity.forEach(e=> items.push({...e, _type:'activity', _t: e.time}));

  items = items.filter(e=> babiesFilter.includes(e.babyId));
  if(ui.timelineType!=='all') items = items.filter(e=> e._type===ui.timelineType);
  items.sort((a,b)=> new Date(b._t) - new Date(a._t));
  return items;
}

function iconAndColorFor(item){
  if(item._type==='sleep') return {icon:ICONS.moon, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
  if(item._type==='diaper') return {icon:ICONS.diaper, bg:'rgba(227,178,60,.18)', color:'#E3B23C'};
  if(item._type==='feeding'){
    if(item.subtype==='bottle') return {icon:ICONS.bottle, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
    if(item.subtype==='solid') return {icon:ICONS.solid, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
    return {icon: item.subtype==='breastR'?ICONS.breastR:ICONS.breastL, bg:'rgba(217,138,150,.18)', color:'#D98A96'};
  }
  if(item._type==='activity'){
    if(item.type==='temperatura') return {icon:ICONS.thermometer, bg:'rgba(224,100,90,.16)', color:'#E0645A'};
    if(item.type==='tummytime') return {icon:ICONS.tummytime, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
    return {icon:ICONS.note, bg:'rgba(217,138,150,.18)', color:'#D98A96'};
  }
  return {icon:ICONS.note, bg:'rgba(217,138,150,.18)', color:'#D98A96'};
}
function labelFor(item){
  if(item._type==='sleep') return 'Somn';
  if(item._type==='diaper') return {pipi:'Scutec · pipi', caca:'Scutec · caca', ambele:'Scutec · ambele'}[item.type] || 'Scutec';
  if(item._type==='activity') return {temperatura:'Temperatură', tummytime:'Tummy time'}[item.type] || 'Altele';
  if(item._type==='feeding'){
    return {breastL:'Alăptare · stânga', breastR:'Alăptare · dreapta', bottle:'Biberon', solid:'Masă solidă'}[item.subtype] || 'Masă';
  }
  return '';
}
function metaFor(item){
  if(item._type==='sleep'){
    if(!item.end) return 'în desfășurare…';
    return `${fmtTime(item.start)} – ${fmtTime(item.end)} · ${fmtDur(new Date(item.end)-new Date(item.start))}`;
  }
  if(item._type==='feeding'){
    if(item.subtype==='bottle'){
      const parts = [];
      if(item.amountMl) parts.push(item.amountMl+' ml');
      if(item.breastMilk) parts.push('lapte matern');
      parts.push(fmtTime(item.start));
      return parts.join(' · ');
    }
    if(item.subtype==='solid') return `${item.foodDesc?item.foodDesc+' · ':''}${fmtTime(item.start)}`;
    if(!item.end) return 'în desfășurare…';
    return `${fmtTime(item.start)} – ${fmtTime(item.end)} · ${fmtDur(new Date(item.end)-new Date(item.start))}`;
  }
  if(item._type==='diaper') return fmtTime(item.time);
  if(item._type==='activity'){
    let prefix = '';
    if(item.type==='temperatura' && item.value) prefix = item.value+'°C · ';
    else if(item.type==='tummytime' && item.value) prefix = item.value+' min · ';
    return `${prefix}${fmtTime(item.time)}`;
  }
  return '';
}

function renderFilterChips(){
  const el = document.getElementById('filterChips');
  const types = [
    {k:'all', l:'Toate'}, {k:'sleep', l:'Somn'}, {k:'feeding', l:'Mese'},
    {k:'diaper', l:'Scutece'}, {k:'activity', l:'Altele'},
  ];
  el.innerHTML = types.map(t=>`<button class="chip ${ui.timelineType===t.k?'active':''}" data-t="${t.k}">${t.l}</button>`).join('');
  el.querySelectorAll('.chip').forEach(c=> c.onclick = ()=>{ ui.timelineType = c.dataset.t; renderTimeline(); });
}

function renderTimeline(){
  renderFilterChips();
  const el = document.getElementById('timelineList');
  const items = collectTimeline();
  if(!items.length){ el.innerHTML = `<div class="tl-empty">Nicio înregistrare încă.<br>Folosește acțiunile rapide de pe Acasă.</div>`; return; }

  let html = '';
  let lastDay = null;
  items.forEach(item=>{
    const dl = dayLabel(item._t);
    if(dl !== lastDay){ html += `<div class="tl-day-label">${dl}</div>`; lastDay = dl; }
    const {icon,bg,color} = iconAndColorFor(item);
    const b = baby(item.babyId);
    html += `<div class="tl-item" data-id="${item.id}" data-type="${item._type}">
      <div class="tl-icon" style="background:${bg};color:${color}">${icon}</div>
      <div class="tl-body">
        <div class="tl-title">
          <span class="baby-dot" style="background:${b.color}"></span>${labelFor(item)}
          <span class="tl-baby-name">${escapeHtml(b.name)}</span>
        </div>
        <div class="tl-meta">${metaFor(item)}</div>
        ${item.notes?`<div class="tl-notes">${escapeHtml(item.notes)}</div>`:''}
      </div>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.tl-item').forEach(row=>{
    row.onclick = ()=> openEditSheet(row.dataset.type, row.dataset.id);
  });
}

/* ================= RENDER: GROWTH ================= */

function renderGrowthBabyToggle(){
  const el = document.getElementById('growthBabyToggle');
  el.innerHTML = state.babies.map(b=>`<button class="chip ${ui.growthBaby===b.id?'active':''}" data-b="${b.id}" style="${ui.growthBaby===b.id?'border-color:'+b.color+';color:'+b.color:''}">${escapeHtml(b.name)}</button>`).join('');
  el.querySelectorAll('.chip').forEach(c=> c.onclick = ()=>{ ui.growthBaby = c.dataset.b; renderGrowth(); });
}

function renderGrowth(){
  renderGrowthBabyToggle();
  const entries = state.logs.growth.filter(g=>g.babyId===ui.growthBaby).sort((a,b)=> new Date(a.date)-new Date(b.date));
  const b = baby(ui.growthBaby);

  const ctx = document.getElementById('growthChart');
  try{
    if(typeof Chart !== 'undefined' && ctx){
      if(chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: entries.map(e=> new Date(e.date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})),
          datasets: [{ label: 'Greutate (kg)', data: entries.map(e=> e.weightKg), borderColor: b.color, backgroundColor: b.color+'33', tension: .35, pointRadius: 3, fill: true }]
        },
        options: {
          responsive:true,
          plugins:{ legend:{ labels:{ color:'#9a9db1' } } },
          scales:{ x:{ ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' } }, y:{ ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' } } }
        }
      });
    } else if(ctx){
      ctx.style.display = 'none';
    }
  }catch(err){
    console.error('Graficul nu a putut fi desenat:', err);
    if(ctx) ctx.style.display = 'none';
  }

  const listEl = document.getElementById('growthList');
  if(!entries.length){ listEl.innerHTML = `<div class="tl-empty">Nicio măsurătoare pentru ${escapeHtml(b.name)} încă.</div>`; return; }
  listEl.innerHTML = entries.slice().reverse().map(e=>`
    <div class="growth-row" data-id="${e.id}">
      ${e.photo?`<img class="g-thumb" src="${e.photo}">`:''}
      <div class="g-date">${new Date(e.date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}</div>
      <div class="g-vals">
        ${e.weightKg!=null?`<div>${e.weightKg} kg<small>greutate</small></div>`:''}
        ${e.heightCm!=null?`<div>${e.heightCm} cm<small>înălțime</small></div>`:''}
        ${e.headCm!=null?`<div>${e.headCm} cm<small>cap</small></div>`:''}
      </div>
    </div>`).join('');
  listEl.querySelectorAll('.growth-row').forEach(row=> row.onclick = ()=> openGrowthSheet(row.dataset.id));
}

function resizeImageFile(file, maxW=900, quality=0.72){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > maxW){ h = Math.round(h * (maxW / w)); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=> reject(new Error('imagine invalidă'));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error('citire fișier eșuată'));
    reader.readAsDataURL(file);
  });
}

function openGrowthSheet(existingId){
  const entry = existingId ? (state.logs.growth.find(e=>e.id===existingId) || null) : null;
  const babyId = entry ? entry.babyId : ui.growthBaby;
  const b = baby(babyId);
  let currentPhoto = (entry && entry.photo) ? entry.photo : null;

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${entry?'Editează măsurătoarea':'Măsurătoare nouă'} — ${escapeHtml(b.name)}</h3>
    <div class="form-group"><label class="form-label">Data</label><input type="date" id="gDate" value="${entry?entry.date:new Date().toISOString().slice(0,10)}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Greutate (kg)</label><input type="text" inputmode="decimal" id="gWeight" placeholder="ex: 7,20" value="${entry&&entry.weightKg!=null?entry.weightKg:''}"></div>
      <div class="form-group"><label class="form-label">Înălțime (cm)</label><input type="text" inputmode="decimal" id="gHeight" placeholder="ex: 68" value="${entry&&entry.heightCm!=null?entry.heightCm:''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Circumferință cap (cm)</label><input type="text" inputmode="decimal" id="gHead" placeholder="opțional" value="${entry&&entry.headCm!=null?entry.headCm:''}"></div>
    <div class="form-group">
      <label class="form-label">Poză (opțional)</label>
      <input type="file" accept="image/*" id="gPhotoInput">
      <img id="gPhotoPreview" class="photo-preview ${currentPhoto?'show':''}" src="${currentPhoto||''}">
      <button type="button" class="photo-remove ${currentPhoto?'show':''}" id="gPhotoRemove">Șterge poza</button>
    </div>
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="gNotes">${entry?(entry.notes||''):''}</textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="gCancel">Renunță</button>
      <button class="btn-primary" id="gSave" style="background:${b.color}">Salvează</button>
    </div>
    ${entry?`<button class="btn-delete-entry" id="gDelete">Șterge măsurătoarea</button>`:''}
  `);

  const photoInputEl = document.getElementById('gPhotoInput');
  const photoPreviewEl = document.getElementById('gPhotoPreview');
  const photoRemoveEl = document.getElementById('gPhotoRemove');
  if(photoInputEl) photoInputEl.onchange = async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    try{
      currentPhoto = await resizeImageFile(file);
      photoPreviewEl.src = currentPhoto; photoPreviewEl.classList.add('show');
      photoRemoveEl.classList.add('show');
    }catch(err){ console.error(err); alert('Nu am putut încărca poza. Încearcă alta.'); }
  };
  if(photoRemoveEl) photoRemoveEl.onclick = ()=>{
    currentPhoto = null;
    photoPreviewEl.src = ''; photoPreviewEl.classList.remove('show');
    photoRemoveEl.classList.remove('show');
  };

  const cancelBtn = document.getElementById('gCancel');
  if(cancelBtn) cancelBtn.onclick = closeSheet;

  const deleteBtn = document.getElementById('gDelete');
  if(deleteBtn) deleteBtn.onclick = ()=>{
    const idx = state.logs.growth.findIndex(e=>e.id===existingId);
    if(idx>-1) state.logs.growth.splice(idx,1);
    scheduleSave(); closeSheet(); renderGrowth(); renderSettings();
  };

  const saveBtn = document.getElementById('gSave');
  saveBtn.onclick = ()=>{
    try{
      const dateVal = document.getElementById('gDate').value;
      if(!dateVal){ alert('Alege o dată.'); return; }
      const data = {
        date: dateVal,
        weightKg: parseNum(document.getElementById('gWeight').value),
        heightCm: parseNum(document.getElementById('gHeight').value),
        headCm: parseNum(document.getElementById('gHead').value),
        photo: currentPhoto,
        notes: document.getElementById('gNotes').value.trim(),
      };
      if(entry){ Object.assign(entry, data); }
      else { state.logs.growth.push({ id: uid(), babyId, ...data }); }
      scheduleSave();
      closeSheet();
      renderGrowth();
      renderSettings();
    }catch(err){
      console.error('Eroare la salvarea măsurătorii:', err);
      alert('A apărut o eroare la salvare. Verifică valorile introduse și încearcă din nou.');
    }
  };
}

/* ================= RENDER: MEDICATION ================= */

function isPlanFinished(plan){
  if(plan.endType==='date' && plan.endDate){
    return new Date() > new Date(plan.endDate+'T23:59:59');
  }
  if(plan.endType==='count' && plan.maxDoses){
    const given = state.logs.medDoses.filter(d=>d.planId===plan.id).length;
    return given >= plan.maxDoses;
  }
  return false;
}

function nextDoseTimeForPlan(plan){
  const doses = state.logs.medDoses
    .filter(d=> d.planId===plan.id)
    .sort((a,b)=> new Date(b.time)-new Date(a.time));
  const lastTime = doses.length ? doses[0].time : plan.startAt;
  return new Date(new Date(lastTime).getTime() + plan.intervalHours*3600000);
}

function renderMedsBabyToggle(){
  const el = document.getElementById('medsBabyToggle');
  const opts = [...state.babies, {id:'all', name:'Ambele'}];
  el.innerHTML = opts.map(b=>{
    const active = ui.medsBaby===b.id ? 'active' : '';
    return `<button class="chip ${active}" data-b="${b.id}" style="${active&&b.color?'border-color:'+b.color+';color:'+b.color:''}">${escapeHtml(b.name)}</button>`;
  }).join('');
  el.querySelectorAll('.chip').forEach(c=> c.onclick = ()=>{ ui.medsBaby = c.dataset.b; renderMeds(); });
}
function medsFilterIds(){ return ui.medsBaby==='all' ? state.babies.map(b=>b.id) : [ui.medsBaby]; }

function renderMedPlans(){
  const el = document.getElementById('medPlansList');
  const ids = medsFilterIds();
  const plans = state.logs.medPlans.filter(p=> ids.includes(p.babyId));
  if(!plans.length){ el.innerHTML = `<div class="tl-empty">Niciun plan de medicație.</div>`; return; }

  el.innerHTML = plans.map(plan=>{
    const b = baby(plan.babyId);
    const finished = isPlanFinished(plan);
    const givenCount = state.logs.medDoses.filter(d=>d.planId===plan.id).length;

    let progressHtml = '';
    if(plan.endType==='count' && plan.maxDoses) progressHtml = `<div class="med-plan-progress">doza ${Math.min(givenCount+1, plan.maxDoses)} din ${plan.maxDoses}</div>`;
    if(plan.endType==='date' && plan.endDate) progressHtml = `<div class="med-plan-progress">până pe ${new Date(plan.endDate).toLocaleDateString('ro-RO',{day:'2-digit',month:'long'})}</div>`;

    let nextHtml;
    if(finished){
      nextHtml = `<div class="med-plan-next finished">Tratament încheiat</div>`;
    } else if(plan.paused){
      nextHtml = `<div class="med-plan-next upcoming">Plan pus pe pauză</div>`;
    } else {
      const next = nextDoseTimeForPlan(plan);
      const overdue = next < new Date();
      nextHtml = `<div class="med-plan-next ${overdue?'overdue':'upcoming'}">${overdue?'Întârziat · era la ':'Următoarea la '}${fmtTime(next)} · ${dayLabel(next.toISOString())}</div>`;
    }

    return `<div class="med-plan-card ${plan.paused?'med-plan-paused':''} ${finished?'med-plan-finished':''}" data-id="${plan.id}">
      <div class="med-plan-top">
        <div>
          <div class="med-plan-name"><span class="dot" style="background:${b.color}"></span>${escapeHtml(plan.name)}</div>
          <div class="med-plan-dose">${escapeHtml(plan.doseText||'')}${plan.doseText?' · ':''}la fiecare ${plan.intervalHours}h</div>
          ${progressHtml}
        </div>
        <button class="med-plan-icon-btn" data-edit="${plan.id}">✎</button>
      </div>
      ${nextHtml}
      <div class="med-plan-actions">
        ${(!plan.paused && !finished)?`<button class="btn-give" data-give="${plan.id}">Am administrat acum</button>`:''}
        ${!finished?`<button data-pause="${plan.id}">${plan.paused?'Reactivează':'Pauză'}</button>`:''}
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-give]').forEach(btn=>{
    btn.onclick = ()=>{
      const plan = state.logs.medPlans.find(p=>p.id===btn.dataset.give);
      const scheduledTime = nextDoseTimeForPlan(plan).toISOString();
      state.logs.medDoses.push({ id: uid(), planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, scheduledTime, time: nowISO(), notes:'' });
      scheduleSave(); renderMeds();
    };
  });
  el.querySelectorAll('[data-pause]').forEach(btn=>{
    btn.onclick = ()=>{
      const plan = state.logs.medPlans.find(p=>p.id===btn.dataset.pause);
      plan.paused = !plan.paused;
      scheduleSave(); renderMeds();
    };
  });
  el.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.onclick = ()=> openMedPlanSheet(btn.dataset.edit);
  });
}

function renderMedAgenda(){
  const el = document.getElementById('medAgendaList');
  const ids = medsFilterIds();
  const now = new Date();
  const horizonStart = new Date(now.getTime() - 4*24*3600000);
  const horizonEnd = new Date(now.getTime() + 7*24*3600000);

  let items = [];
  state.logs.medDoses
    .filter(d=> ids.includes(d.babyId) && new Date(d.time) >= horizonStart)
    .forEach(d=> items.push({ _t: d.time, _status:'given', ...d }));

  state.logs.medPlans.filter(p=> ids.includes(p.babyId) && !p.paused && !isPlanFinished(p)).forEach(plan=>{
    let t = nextDoseTimeForPlan(plan);
    let guard = 0;
    let projectedCount = state.logs.medDoses.filter(d=>d.planId===plan.id).length;
    while(t <= horizonEnd && guard < 40){
      if(plan.endType==='date' && plan.endDate && t > new Date(plan.endDate+'T23:59:59')) break;
      if(plan.endType==='count' && plan.maxDoses && projectedCount >= plan.maxDoses) break;
      items.push({ _t: t.toISOString(), _status: t < now ? 'overdue' : 'upcoming', planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText });
      projectedCount++;
      t = new Date(t.getTime() + plan.intervalHours*3600000);
      guard++;
    }
  });

  items.sort((a,b)=> new Date(a._t) - new Date(b._t));
  if(!items.length){ el.innerHTML = `<div class="tl-empty">Niciun plan sau doză înregistrată.</div>`; return; }

  let html = '';
  let lastDay = null;
  items.forEach(item=>{
    const dl = dayLabel(item._t);
    if(dl !== lastDay){ html += `<div class="agenda-day-label">${dl}</div>`; lastDay = dl; }
    const b = baby(item.babyId);

    let subLine = escapeHtml(item.doseText||'');
    if(item._status==='given' && item.scheduledTime){
      const diffMs = Math.abs(new Date(item.time) - new Date(item.scheduledTime));
      if(diffMs > 60000){
        subLine += `${subLine?' · ':''}(programat ${fmtTime(item.scheduledTime)}, administrat ${fmtTime(item.time)})`;
      }
    }

    let statusHtml = '';
    if(item._status==='given') statusHtml = `<div class="agenda-status given">administrat</div>`;
    else if(item._status==='overdue') statusHtml = `<div class="agenda-status overdue"><button data-quick-give="${item.planId}">Am dat</button></div>`;
    else statusHtml = `<div class="agenda-status upcoming">programat</div>`;

    html += `<div class="agenda-item ${item._status==='overdue'?'overdue':''}">
      <div class="agenda-time">${fmtTime(item._t)}</div>
      <div class="agenda-body">
        <span class="baby-dot" style="background:${b.color}"></span>${escapeHtml(item.name)}
        <div class="agenda-sub">${subLine}</div>
      </div>
      ${statusHtml}
    </div>`;
  });
  el.innerHTML = html;

  el.querySelectorAll('[data-quick-give]').forEach(btn=>{
    btn.onclick = (e)=>{
      e.stopPropagation();
      const plan = state.logs.medPlans.find(p=>p.id===btn.dataset.quickGive);
      if(!plan) return;
      const scheduledTime = nextDoseTimeForPlan(plan).toISOString();
      state.logs.medDoses.push({ id: uid(), planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, scheduledTime, time: nowISO(), notes:'' });
      scheduleSave(); renderMeds();
    };
  });
}

function renderMeds(){ renderMedsBabyToggle(); renderMedPlans(); renderMedAgenda(); }

function openMedPlanSheet(existingId){
  const plan = existingId ? state.logs.medPlans.find(p=>p.id===existingId) : null;
  const babyIds = plan ? [plan.babyId] : medsFilterIds();
  const refBaby = baby(babyIds[0]);
  const initialEndType = plan ? (plan.endType||'never') : 'never';

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${plan?'Editează planul':'Plan nou de medicație'}</h3>
    ${!plan?`<div class="form-group"><label class="form-label">Pentru</label>
      <div class="seg" id="mpBaby">
        ${state.babies.map(b=>`<button class="seg-btn ${babyIds.length===1&&babyIds[0]===b.id?'active':''}" data-v="${b.id}">${escapeHtml(b.name)}</button>`).join('')}
      </div></div>`:''}
    <div class="form-group"><label class="form-label">Medicament</label><input type="text" id="mpName" placeholder="ex: Nurofen" value="${plan?escapeHtml(plan.name):''}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Doză</label><input type="text" id="mpDose" placeholder="ex: 2.5 ml" value="${plan?escapeHtml(plan.doseText||''):''}"></div>
      <div class="form-group"><label class="form-label">La fiecare (ore)</label><input type="number" min="1" id="mpInterval" placeholder="ex: 8" value="${plan?plan.intervalHours:''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Prima doză — data</label><input type="date" id="mpDate" value="${plan?toDateInput(plan.startAt):new Date().toISOString().slice(0,10)}"></div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="mpTime" value="${plan?toTimeInput(plan.startAt):toTimeInput(nowISO())}"></div>
    </div>
    <div class="form-group"><label class="form-label">Durata tratamentului</label>
      <div class="seg" id="mpEndType">
        <button class="seg-btn ${initialEndType==='never'?'active':''}" data-v="never">Fără limită</button>
        <button class="seg-btn ${initialEndType==='date'?'active':''}" data-v="date">Până la o dată</button>
        <button class="seg-btn ${initialEndType==='count'?'active':''}" data-v="count">Număr de doze</button>
      </div>
    </div>
    <div class="form-group" id="mpEndDateGroup" style="display:${initialEndType==='date'?'block':'none'}">
      <label class="form-label">Ultima zi de administrare</label>
      <input type="date" id="mpEndDate" value="${plan&&plan.endDate?plan.endDate:''}">
    </div>
    <div class="form-group" id="mpMaxDosesGroup" style="display:${initialEndType==='count'?'block':'none'}">
      <label class="form-label">Număr total de doze</label>
      <input type="number" min="1" id="mpMaxDoses" value="${plan&&plan.maxDoses?plan.maxDoses:''}">
    </div>
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="mpNotes">${plan?plan.notes||'':''}</textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="mpCancel">Renunță</button>
      <button class="btn-primary" id="mpSave" style="background:${refBaby.color}">Salvează</button>
    </div>
    ${plan?`<button class="btn-delete-entry" id="mpDelete">Șterge planul</button>`:''}
  `);

  let selectedBaby = babyIds[0];
  let selectedEndType = initialEndType;
  if(!plan){
    document.querySelectorAll('#mpBaby .seg-btn').forEach(btn=>{
      btn.onclick = ()=>{ document.querySelectorAll('#mpBaby .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); selectedBaby = btn.dataset.v; };
    });
  }
  document.querySelectorAll('#mpEndType .seg-btn').forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll('#mpEndType .seg-btn').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      selectedEndType = btn.dataset.v;
      document.getElementById('mpEndDateGroup').style.display = selectedEndType==='date' ? 'block':'none';
      document.getElementById('mpMaxDosesGroup').style.display = selectedEndType==='count' ? 'block':'none';
    };
  });

  document.getElementById('mpCancel').onclick = closeSheet;
  if(plan){
    document.getElementById('mpDelete').onclick = ()=>{
      const idx = state.logs.medPlans.findIndex(p=>p.id===existingId);
      if(idx>-1) state.logs.medPlans.splice(idx,1);
      scheduleSave(); closeSheet(); renderMeds();
    };
  }
  document.getElementById('mpSave').onclick = ()=>{
    try{
      const name = document.getElementById('mpName').value.trim();
      if(!name){ alert('Adaugă numele medicamentului.'); return; }
      const doseText = document.getElementById('mpDose').value.trim();
      const intervalHours = parseNum(document.getElementById('mpInterval').value) || 8;
      const startAt = combineDateAndTime(document.getElementById('mpDate').value, document.getElementById('mpTime').value);
      const notes = document.getElementById('mpNotes').value.trim();

      const endDate = selectedEndType==='date' ? document.getElementById('mpEndDate').value : null;
      const maxDoses = selectedEndType==='count' ? (parseInt(document.getElementById('mpMaxDoses').value,10) || null) : null;
      if(selectedEndType==='date' && !endDate){ alert('Alege o dată de final.'); return; }
      if(selectedEndType==='count' && !maxDoses){ alert('Introdu numărul de doze.'); return; }

      if(plan){
        Object.assign(plan, { name, doseText, intervalHours, startAt, notes, endType: selectedEndType, endDate, maxDoses });
      } else {
        state.logs.medPlans.push({ id: uid(), babyId: selectedBaby, name, doseText, intervalHours, startAt, notes, paused:false, endType: selectedEndType, endDate, maxDoses });
      }
      scheduleSave(); closeSheet(); renderMeds();
    }catch(err){ console.error(err); alert('Eroare la salvare.'); }
  };
}

function openMedDoseSheet(){
  const babyIds = medsFilterIds();
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>Administrare acum — ${names}</h3>
    ${babyIds.length>1?`<div class="sheet-sub">Se aplică la amândoi</div>`:''}
    <div class="form-group"><label class="form-label">Medicament</label><input type="text" id="mdName" placeholder="ex: Nurofen"></div>
    <div class="form-group"><label class="form-label">Doză</label><input type="text" id="mdDose" placeholder="ex: 2.5 ml"></div>
    <div class="form-group"><label class="form-label">Ora</label><input type="time" id="mdTime" value="${toTimeInput(nowISO())}"></div>
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="mdNotes"></textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="mdCancel">Renunță</button>
      <button class="btn-primary" id="mdSave" style="background:${refBaby.color}">Salvează</button>
    </div>
  `);
  document.getElementById('mdCancel').onclick = closeSheet;
  document.getElementById('mdSave').onclick = ()=>{
    try{
      const name = document.getElementById('mdName').value.trim();
      if(!name){ alert('Adaugă numele medicamentului.'); return; }
      const doseText = document.getElementById('mdDose').value.trim();
      const time = combineTimeWithDate(nowISO(), document.getElementById('mdTime').value);
      const notes = document.getElementById('mdNotes').value.trim();
      babyIds.forEach(babyId=>{
        state.logs.medDoses.push({ id: uid(), planId:null, babyId, name, doseText, time, notes });
      });
      scheduleSave(); closeSheet(); renderMeds();
    }catch(err){ console.error(err); alert('Eroare la salvare.'); }
  };
}

/* ================= RENDER: STATS / OVERVIEW ================= */

let statCharts = { sleep:null, feed:null, diaper:null };

function last7Days(){
  const days = [];
  for(let i=6;i>=0;i--){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); days.push(d); }
  return days;
}
function isSameDay(a,b){ return a.toDateString()===b.toDateString(); }

function buildBarChart(canvasId, key, labels, datasets){
  if(typeof Chart === 'undefined') return;
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  try{
    if(statCharts[key]) statCharts[key].destroy();
    statCharts[key] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color:'#9a9db1' } } },
        scales: { x: { ticks:{ color:'#686b80' }, grid:{ display:false } }, y: { ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' }, beginAtZero:true } }
      }
    });
  }catch(err){
    console.error('Graficul nu a putut fi desenat:', err);
  }
}

function renderStats(){
  const days = last7Days();
  const labels = days.map(d=> d.toLocaleDateString('ro-RO',{weekday:'short'}));

  const sleepDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let ms = 0;
      state.logs.sleep.forEach(s=>{ if(s.babyId===b.id && s.end && isSameDay(new Date(s.end), day)) ms += (new Date(s.end)-new Date(s.start)); });
      return +(ms/3600000).toFixed(1);
    }),
  }));
  buildBarChart('statSleepChart', 'sleep', labels, sleepDatasets);

  const feedDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let count = 0;
      state.logs.feeding.forEach(f=>{ const t = f.end || f.start; if(f.babyId===b.id && t && isSameDay(new Date(t), day)) count++; });
      return count;
    }),
  }));
  buildBarChart('statFeedChart', 'feed', labels, feedDatasets);

  const diaperDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let count = 0;
      state.logs.diaper.forEach(d=>{ if(d.babyId===b.id && isSameDay(new Date(d.time), day)) count++; });
      return count;
    }),
  }));
  buildBarChart('statDiaperChart', 'diaper', labels, diaperDatasets);
}

/* ================= RENDER: SETTINGS ================= */

function lastGrowthFor(babyId){
  const entries = state.logs.growth.filter(g=>g.babyId===babyId).sort((a,b)=> new Date(b.date)-new Date(a.date));
  return entries[0] || null;
}
function ageString(birthDate){
  if(!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  if(ms < 0) return null;
  const days = Math.floor(ms/(24*3600*1000));
  const years = Math.floor(days/365.25);
  if(years >= 1){
    const remMonths = Math.floor((days - years*365.25)/30.44);
    return `${years} an${years>1?'i':''}${remMonths>0?' și '+remMonths+' luni':''}`;
  }
  const months = Math.floor(days/30.44);
  if(months >= 1) return `${months} lun${months>1?'i':'ă'}`;
  return `${days} zile`;
}

function renderBabyProfiles(){
  const el = document.getElementById('babyProfiles');
  el.innerHTML = state.babies.map(b=>{
    const g = lastGrowthFor(b.id);
    const age = ageString(b.birthDate);
    let metaLine = 'Nicio măsurătoare încă';
    if(g){
      const parts = [];
      if(g.weightKg!=null) parts.push(g.weightKg+' kg');
      if(g.heightCm!=null) parts.push(g.heightCm+' cm');
      if(g.headCm!=null) parts.push('cap '+g.headCm+' cm');
      metaLine = (parts.join(' · ')||'—') + ' · ' + new Date(g.date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'});
    }
    const thumb = (g && g.photo)
      ? `<img class="p-thumb" src="${g.photo}">`
      : `<div class="p-thumb" style="display:flex;align-items:center;justify-content:center;color:${b.color};font-weight:700;">${escapeHtml(b.name.charAt(0))}</div>`;
    return `<div class="profile-card">
      ${thumb}
      <div>
        <div class="p-name"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)}</div>
        <div class="p-meta">${metaLine}</div>
        ${age?`<div class="p-age">${age}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function renderSettings(){
  renderBabyProfiles();
  const el = document.getElementById('babySettings');
  el.innerHTML = state.babies.map(b=>`
    <div class="baby-edit-row">
      <label class="color-dot-btn" style="background:${b.color}">
        <input type="color" value="${b.color}" style="opacity:0;width:0;height:0;position:absolute" data-id="${b.id}">
      </label>
      <input type="text" value="${escapeHtml(b.name)}" data-id="${b.id}" maxlength="20">
      <div class="bd-field">
        <label>Data nașterii</label>
        <input type="date" value="${b.birthDate||''}" data-bd="${b.id}">
      </div>
    </div>`).join('');
  el.querySelectorAll('input[type=text]').forEach(inp=>{
    inp.onchange = ()=>{ baby(inp.dataset.id).name = inp.value.trim() || 'Bebe'; scheduleSave(); renderAll(); };
  });
  el.querySelectorAll('input[type=color]').forEach(inp=>{
    inp.onchange = ()=>{ baby(inp.dataset.id).color = inp.value; scheduleSave(); renderAll(); };
  });
  el.querySelectorAll('input[type=date][data-bd]').forEach(inp=>{
    inp.onchange = ()=>{ baby(inp.dataset.bd).birthDate = inp.value || null; scheduleSave(); renderAll(); };
  });
}

/* ================= EDIT ORICE ÎNREGISTRARE ================= */

function openEditSheet(type, id){
  const collMap = { sleep:'sleep', feeding:'feeding', diaper:'diaper', activity:'activity', growth:'growth' };
  const coll = state.logs[collMap[type]];
  const entry = coll.find(e=>e.id===id);
  if(!entry) return;
  if(type==='growth'){ openGrowthSheet(id); return; }
  const b = baby(entry.babyId);

  const hasRange = (type==='sleep') || (type==='feeding' && (entry.subtype==='breastL'||entry.subtype==='breastR'));

  let typeFieldsHtml = '';
  if(type==='diaper'){
    typeFieldsHtml = `<div class="form-group"><label class="form-label">Tip</label>
      <div class="seg" id="eDiaperType">
        <button class="seg-btn ${entry.type==='pipi'?'active':''}" data-v="pipi">Pipi</button>
        <button class="seg-btn ${entry.type==='caca'?'active':''}" data-v="caca">Caca</button>
        <button class="seg-btn ${entry.type==='ambele'?'active':''}" data-v="ambele">Ambele</button>
      </div></div>`;
  }
  if(type==='activity'){
    const actLabels = {temperatura:'Temperatură (°C)', tummytime:'Durată (minute)', altele:'Detalii (opțional)'};
    typeFieldsHtml = `
      <div class="form-group"><label class="form-label">Tip</label>
        <div class="seg" id="eActType">
          <button class="seg-btn ${entry.type==='temperatura'?'active':''}" data-v="temperatura">Temperatură</button>
          <button class="seg-btn ${entry.type==='tummytime'?'active':''}" data-v="tummytime">Tummy time</button>
          <button class="seg-btn ${(!entry.type||entry.type==='altele')?'active':''}" data-v="altele">Altele</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">${actLabels[entry.type]||'Detalii'}</label><input type="text" id="eActValue" value="${escapeHtml(entry.value||'')}"></div>`;
  }
  if(type==='feeding'){
    if(entry.subtype==='bottle'){
      typeFieldsHtml = `<div class="form-group"><label class="form-label">Cantitate (ml)</label><input type="text" inputmode="decimal" id="eAmount" value="${entry.amountMl!=null?entry.amountMl:''}"></div>
        <div class="checkbox-row"><input type="checkbox" id="eBreastMilk" ${entry.breastMilk?'checked':''}><label for="eBreastMilk">Lapte matern</label></div>`;
    } else if(entry.subtype==='solid'){
      typeFieldsHtml = `<div class="form-group"><label class="form-label">Ce a mâncat</label><input type="text" id="eFood" value="${escapeHtml(entry.foodDesc||'')}"></div>`;
    }
  }

  let timeFieldsHtml;
  if(hasRange){
    timeFieldsHtml = `
      <div class="form-group"><label class="form-label">Data</label><input type="date" id="eDate" value="${toDateInput(entry.start)}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Început</label><input type="time" id="eStart" value="${toTimeInput(entry.start)}"></div>
        <div class="form-group"><label class="form-label">Sfârșit</label><input type="time" id="eEnd" value="${entry.end?toTimeInput(entry.end):toTimeInput(nowISO())}"></div>
      </div>`;
  } else if(type==='diaper' || type==='activity'){
    timeFieldsHtml = `
      <div class="form-group"><label class="form-label">Data</label><input type="date" id="eDate" value="${toDateInput(entry.time)}"></div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="eTime" value="${toTimeInput(entry.time)}"></div>`;
  } else {
    timeFieldsHtml = `
      <div class="form-group"><label class="form-label">Data</label><input type="date" id="eDate" value="${toDateInput(entry.start)}"></div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="eTime" value="${toTimeInput(entry.start)}"></div>`;
  }

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>Editează înregistrare</h3>
    <div class="sheet-sub">${escapeHtml(b.name)}</div>
    ${timeFieldsHtml}
    ${typeFieldsHtml}
    <div class="form-group"><label class="form-label">Notă</label><textarea id="eNotes">${entry.notes||''}</textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="eCancel">Renunță</button>
      <button class="btn-primary" id="eSave" style="background:${b.color}">Salvează</button>
    </div>
    <button class="btn-delete-entry" id="eDelete">Șterge înregistrarea</button>
  `);

  if(type==='diaper'){
    document.querySelectorAll('#eDiaperType .seg-btn').forEach(btn=>{
      btn.onclick = ()=>{ document.querySelectorAll('#eDiaperType .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); };
    });
  }
  if(type==='activity'){
    document.querySelectorAll('#eActType .seg-btn').forEach(btn=>{
      btn.onclick = ()=>{ document.querySelectorAll('#eActType .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); };
    });
  }

  document.getElementById('eCancel').onclick = closeSheet;
  document.getElementById('eDelete').onclick = ()=>{
    const idx = coll.findIndex(e=>e.id===id);
    if(idx>-1) coll.splice(idx,1);
    scheduleSave(); closeSheet(); renderAll();
  };
  document.getElementById('eSave').onclick = ()=>{
    try{
      const dateStr = document.getElementById('eDate').value;
      entry.notes = document.getElementById('eNotes').value.trim();

      if(hasRange){
        const startISO = combineDateAndTime(dateStr, document.getElementById('eStart').value);
        let endISO = combineDateAndTime(dateStr, document.getElementById('eEnd').value);
        if(new Date(endISO) < new Date(startISO)){ const d = new Date(endISO); d.setDate(d.getDate()+1); endISO = d.toISOString(); }
        entry.start = startISO; entry.end = endISO;
      } else if(type==='diaper' || type==='activity'){
        entry.time = combineDateAndTime(dateStr, document.getElementById('eTime').value);
      } else {
        const t = combineDateAndTime(dateStr, document.getElementById('eTime').value);
        entry.start = t; entry.end = t;
      }

      if(type==='diaper'){ entry.type = document.querySelector('#eDiaperType .seg-btn.active').dataset.v; }
      if(type==='activity'){
        entry.type = document.querySelector('#eActType .seg-btn.active').dataset.v;
        entry.value = document.getElementById('eActValue').value.trim();
      }
      if(type==='feeding'){
        if(entry.subtype==='bottle'){
          entry.amountMl = parseNum(document.getElementById('eAmount').value);
          entry.breastMilk = document.getElementById('eBreastMilk').checked;
        }
        if(entry.subtype==='solid') entry.foodDesc = document.getElementById('eFood').value.trim();
      }
      scheduleSave(); closeSheet(); renderAll();
    }catch(err){ console.error(err); alert('Eroare la salvare.'); }
  };
}

/* ================= SHEET (bottom modal) ================= */

function renderSheet(html){
  document.getElementById('sheet').innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('open');
}
function closeSheet(){ document.getElementById('sheetOverlay').classList.remove('open'); }
document.getElementById('sheetOverlay').addEventListener('click', (e)=>{ if(e.target.id==='sheetOverlay') closeSheet(); });

/* ================= TIMER BAR ================= */

function renderTimerBar(){
  const el = document.getElementById('timerBar');
  let chips = [];
  Object.entries(state.timers.sleep).forEach(([bId, t])=>{
    if(!t) return;
    const b = baby(bId);
    chips.push(`<div class="timer-chip" data-kind="sleep" data-baby="${bId}">
      <div class="tc-left"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)} · Somn</div>
      <span class="tc-time">${fmtDur(Date.now()-new Date(t.start).getTime())}</span>
      <button data-stop="sleep:${bId}">OPREȘTE</button>
    </div>`);
  });
  Object.entries(state.timers.feeding).forEach(([bId, t])=>{
    if(!t) return;
    const b = baby(bId);
    const lbl = t.subtype==='breastR' ? 'Alăptare D' : 'Alăptare S';
    chips.push(`<div class="timer-chip" data-kind="feeding" data-baby="${bId}">
      <div class="tc-left"><span class="dot" style="background:${b.color}"></span>${escapeHtml(b.name)} · ${lbl}</div>
      <span class="tc-time">${fmtDur(Date.now()-new Date(t.start).getTime())}</span>
      <button data-stop="feeding:${bId}">OPREȘTE</button>
    </div>`);
  });
  el.innerHTML = chips.join('');
  el.querySelectorAll('[data-stop]').forEach(btn=>{
    btn.onclick = ()=>{
      const [kind, bId] = btn.dataset.stop.split(':');
      if(kind==='sleep') openConfirmTimerSheet('sleep', [bId], state.timers.sleep[bId].start);
      else openConfirmTimerSheet('feeding', [bId], state.timers.feeding[bId].start, state.timers.feeding[bId].subtype);
    };
  });
}
setInterval(()=>{ if(document.getElementById('timerBar').innerHTML) renderTimerBar(); }, 1000);

/* ================= NAV / VIEWS ================= */

function switchView(v){
  ui.view = v;
  document.querySelectorAll('.view').forEach(el=> el.classList.toggle('active', el.id==='view-'+v));
  document.querySelectorAll('.nav-btn').forEach(el=> el.classList.toggle('active', el.dataset.view===v));
  if(v==='timeline') renderTimeline();
  if(v==='growth') renderGrowth();
  if(v==='meds') renderMeds();
  if(v==='stats') renderStats();
  if(v==='settings') renderSettings();
}
document.querySelectorAll('.nav-btn').forEach(btn=> btn.onclick = ()=> switchView(btn.dataset.view));
document.getElementById('btnAddGrowth').onclick = ()=> openGrowthSheet();
document.getElementById('btnMedAdhoc').onclick = openMedDoseSheet;
document.getElementById('btnMedPlan').onclick = ()=> openMedPlanSheet();

/* ================= SETTINGS: EXPORT / IMPORT / RESET ================= */

document.getElementById('btnExport').onclick = ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gemenii-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
};
document.getElementById('btnImport').onclick = ()=> document.getElementById('importFile').click();
document.getElementById('importFile').onchange = (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const imported = JSON.parse(reader.result);
      if(imported && imported.babies && imported.logs){
        state = normalizeState(imported);
        scheduleSave(); renderAll();
        alert('Backup importat cu succes.');
      } else alert('Fișier invalid.');
    }catch(err){ alert('Nu am putut citi fișierul.'); }
  };
  reader.readAsText(file);
};
document.getElementById('btnReset').onclick = ()=>{
  if(!confirm('Sigur vrei să ștergi toate datele pentru amândoi bebelușii? Această acțiune nu poate fi anulată.')) return;
  if(!confirm('Ultima verificare: chiar șterg absolut tot (somn, mese, scutece, creștere, medicamente)? Nu există cale de întoarcere.')) return;
  const babiesBackup = state.babies;
  state = defaultState();
  state.babies = babiesBackup;
  scheduleSave(); renderAll();
};

/* ================= PULL TO REFRESH ================= */

(function setupPullToRefresh(){
  const ptr = document.getElementById('ptrIndicator');
  let startY = null, lastDy = 0, refreshing = false;
  const THRESHOLD = 65;
  function scrollTop(){ return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; }

  window.addEventListener('touchstart', (e)=>{
    if(refreshing) return;
    if(scrollTop() <= 0){ startY = e.touches[0].clientY; lastDy = 0; }
    else { startY = null; }
  }, {passive:true});

  window.addEventListener('touchmove', (e)=>{
    if(startY===null || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    if(dy > 0 && scrollTop() <= 0){
      lastDy = dy;
      const shown = Math.min(dy, 90);
      ptr.style.transform = `translateX(-50%) translateY(${shown*0.5}px)`;
      ptr.classList.toggle('visible', dy > 15);
    }
  }, {passive:true});

  window.addEventListener('touchend', async ()=>{
    if(startY===null || refreshing) return;
    const shouldRefresh = lastDy > THRESHOLD;
    startY = null;
    if(shouldRefresh){
      refreshing = true;
      ptr.classList.add('spinning');
      try{ await pullFromServer({ applyIfNewer:true }); }catch(err){}
      renderAll();
      setTimeout(()=>{ ptr.classList.remove('visible','spinning'); refreshing = false; }, 350);
    } else {
      ptr.classList.remove('visible');
    }
    lastDy = 0;
  });
})();

/* ================= MASTER RENDER ================= */

function renderAll(){
  applyBackgroundTint();
  renderTwinSwitch();
  renderStatusRow();
  renderUpcomingBand();
  renderVitalsStrip();
  renderSleepPrediction();
  renderQuickGrid();
  renderTodayStats();
  renderTimerBar();
  if(ui.view==='timeline') renderTimeline();
  if(ui.view==='growth') renderGrowth();
  if(ui.view==='meds') renderMeds();
  if(ui.view==='stats') renderStats();
  if(ui.view==='settings') renderSettings();
}
function render(){ renderAll(); }

/* ================= INIT ================= */

(function init(){
  const local = loadLocal();
  if(local) state = normalizeState(local);
  renderAll();
  pullFromServer({ applyIfNewer:false }).then(()=> renderAll());
  setInterval(()=> pullFromServer({ applyIfNewer:true }), 20000);
})();
