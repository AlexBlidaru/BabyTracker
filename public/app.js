/* ======================================================================
   GEMENII · TRACKER — app.js
   State-ul complet trăiește în `state`, e salvat local (localStorage)
   și sincronizat pe server (Cloudflare KV) ca să fie comun pt. părinți.
   ====================================================================== */

const API = '/api/data';
const LOCAL_KEY = 'babyTrackerGemeni_v1';

const ICONS = {
  moon: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  breastL: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="9" y="14" font-size="7" fill="currentColor" stroke="none">S</text></svg>`,
  breastR: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><text x="9.3" y="14" font-size="7" fill="currentColor" stroke="none">D</text></svg>`,
  bottle: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 2h6M10 2v3.5c0 .6-.3 1-.7 1.4C8.4 7.8 8 8.7 8 9.8V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9.8c0-1.1-.4-2-1.3-2.9-.4-.4-.7-.8-.7-1.4V2M8 13h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  solid: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 16 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M2 12h20M6 16.5c1.5 2 3.7 3 6 3s4.5-1 6-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  diaper: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M4 6v3.5C4 15 7.5 19 12 20c4.5-1 8-5 8-10.5V6M9 12a3 3 0 0 0 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  activity: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  note: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 10h6M9 14h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
};

function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function nowISO(){ return new Date().toISOString(); }
function defaultState(){
  return {
    version: 1,
    babies: [
      { id:'a', name:'Bebe A', color:'#8FB49C' },
      { id:'b', name:'Bebe B', color:'#D98A96' },
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
  if(typeof s.updatedAt !== 'number') s.updatedAt = 0;
  return s;
}

function parseNum(v){
  if(v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if(s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

let state = defaultState();
let ui = {
  view: 'dashboard',
  currentBaby: 'a',          // 'a' | 'b' | 'all'  — target pt. dashboard/timeline
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
  dot.className = 'sync-dot ' + s;
}

async function pushToServer(){
  setSyncStatus('syncing');
  try{
    const res = await fetch(API, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(state),
    });
    if(!res.ok) throw new Error('bad status');
    setSyncStatus('synced');
    document.getElementById('lastSyncTime').textContent = new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    setSyncStatus('error');
  }
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
      // initial load: pick whichever is newer
      if((remote.updatedAt||0) >= (state.updatedAt||0)){
        state = normalizeState(remote);
      } else {
        // local is ahead (offline edits) — push it up
        scheduleSave();
      }
      saveLocal();
    }
    setSyncStatus('synced');
    document.getElementById('lastSyncTime').textContent = new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    setSyncStatus('error');
  }
}

/* ================= HELPERS ================= */

function baby(id){ return state.babies.find(b=>b.id===id) || state.babies[0]; }
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

/* ================= RENDER: TOP SWITCH ================= */

function renderTwinSwitch(){
  const el = document.getElementById('twinSwitch');
  const opts = [...state.babies, {id:'all', name:'Amândoi'}];
  el.innerHTML = opts.map(b=>{
    const active = ui.currentBaby === b.id ? 'active' : '';
    const dot = b.color ? `<span class="dot" style="background:${b.color}"></span>` : '';
    return `<button class="twin-tab ${active}" data-baby="${b.id}">${dot}${b.name}</button>`;
  }).join('');
  el.querySelectorAll('.twin-tab').forEach(btn=>{
    btn.onclick = ()=>{ ui.currentBaby = btn.dataset.baby; renderAll(); };
  });
}

/* ================= RENDER: DASHBOARD ================= */

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

/* ---- Upcoming tasks band (currently sourced from medication plans; ---- */
/* ---- built generically so future categories can slot in the same shape) ---- */

function relativeUntil(date){
  const diffMs = date.getTime() - Date.now();
  const totalMin = Math.round(diffMs/60000);
  if(totalMin <= 0) return 'acum';
  if(totalMin < 60) return `în ${totalMin}min`;
  const h = Math.floor(totalMin/60), m = totalMin%60;
  return `în ${h}h${m>0?' '+m+'min':''}`;
}

function getUpcomingTasks(limit=3){
  const raw = [];
  state.logs.medPlans.filter(p=>!p.paused).forEach(plan=>{
    const next = nextDoseTimeForPlan(plan);
    raw.push({ time: next, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, icon:'💊' });
  });

  // grupăm aceeași denumire dacă e programată aprox. în același interval (10 min) la ambii copii
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
    return `<div class="upcoming-chip ${overdue?'overdue':''}">
      <div class="uc-title">${t.icon} ${escapeHtml(t.name)}</div>
      <div class="uc-time">${overdue?'acum':relativeUntil(t.time)}</div>
      <div class="uc-sub">${babiesLbl}${t.doseText?' · '+escapeHtml(t.doseText):''}</div>
    </div>`;
  }).join('');
}

function activeBabyIds(){
  return ui.currentBaby === 'all' ? state.babies.map(b=>b.id) : [ui.currentBaby];
}

/* ---- Sleep prediction: learns typical "wake window" (time awake between naps) ---- */
const MIN_SLEEP_SESSIONS_FOR_PREDICTION = 6;

function computeSleepPrediction(babyId){
  const sessions = state.logs.sleep
    .filter(s=> s.babyId===babyId && s.start && s.end)
    .sort((a,b)=> new Date(a.start) - new Date(b.start));

  if(sessions.length < MIN_SLEEP_SESSIONS_FOR_PREDICTION){
    return { status:'not_enough', have: sessions.length, need: MIN_SLEEP_SESSIONS_FOR_PREDICTION };
  }

  // wake windows = timp treaz între sfârșitul unui somn și începutul următorului
  const windows = [];
  for(let i=1;i<sessions.length;i++){
    const prevEnd = new Date(sessions[i-1].end).getTime();
    const curStart = new Date(sessions[i].start).getTime();
    const diff = curStart - prevEnd;
    // ignorăm valori aberante (somn înregistrat greșit): sub 20 min sau peste 7 ore
    if(diff > 20*60*1000 && diff < 7*60*60*1000) windows.push(diff);
  }
  if(windows.length < 3){
    return { status:'not_enough', have: sessions.length, need: MIN_SLEEP_SESSIONS_FOR_PREDICTION };
  }

  const recent = windows.slice(-12);
  const avgWindow = recent.reduce((a,c)=>a+c,0) / recent.length;

  const active = activeSleepFor(babyId);
  if(active){
    return { status:'sleeping', since: active.start };
  }

  const lastSession = sessions[sessions.length-1];
  const lastWake = new Date(lastSession.end).getTime();
  const predicted = new Date(lastWake + avgWindow);

  return { status:'ok', predictedTime: predicted.toISOString(), avgWindowMs: avgWindow, sampleSize: recent.length, lastWake: lastSession.end };
}

function renderSleepPrediction(){
  const el = document.getElementById('sleepPredictionWrap');
  const babyIds = activeBabyIds();

  const rows = babyIds.map(id=>{
    const b = baby(id);
    const pred = computeSleepPrediction(id);
    if(pred.status==='not_enough'){
      return `<div class="predict-row">
        <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${b.name}</div>
        <div class="predict-hint">încă ${pred.need - pred.have > 0 ? pred.need - pred.have : 1} somnuri până la prima predicție</div>
      </div>`;
    }
    if(pred.status==='sleeping'){
      return `<div class="predict-row">
        <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${b.name}</div>
        <div style="text-align:right"><div class="predict-val">doarme acum</div><div class="predict-sub">de la ${fmtTime(pred.since)}</div></div>
      </div>`;
    }
    const windowH = Math.floor(pred.avgWindowMs/3600000);
    const windowM = Math.round((pred.avgWindowMs%3600000)/60000);
    const isPast = new Date(pred.predictedTime) < new Date();
    return `<div class="predict-row">
      <div class="predict-baby"><span class="dot" style="background:${b.color}"></span>${b.name}</div>
      <div style="text-align:right">
        <div class="predict-val">${isPast?'de acum câteva minute':fmtTime(pred.predictedTime)}</div>
        <div class="predict-sub">fereastră trează tipică: ~${windowH>0?windowH+'h ':''}${windowM}min</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="predict-card">
    <div class="predict-title">🌙 Predicție somn</div>
    ${rows}
  </div>`;
}

function babyNames(ids){ return ids.map(id=> baby(id).name).join(' & '); }

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
  if(action==='bottle') return openLogSheet('feeding', { babyIds, subtype:'bottle' });
  if(action==='solid') return openLogSheet('feeding', { babyIds, subtype:'solid' });
  if(action==='diaper') return openDiaperSheet(babyIds);
  if(action==='activity') return openLogSheet('activity', { babyIds, type:'medicament' });
  if(action==='note') return openLogSheet('activity', { babyIds, type:'altul' });
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
  };
}

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
    { key:'diaper', label:'Scutec', icon:ICONS.diaper },
    { key:'activity', label:'Activitate', icon:ICONS.activity },
    { key:'note', label:'Notă rapidă', icon:ICONS.note },
  ];
  el.innerHTML = items.map(it=>`
    <button class="quick-btn ${it.running?'running':''}" data-action="${it.key}">
      ${it.icon}<span>${it.label}</span>
    </button>`).join('');
  el.querySelectorAll('.quick-btn').forEach(btn=>{
    btn.onclick = ()=> handleQuickAction(btn.dataset.action);
  });
}

function renderTodayStats(){
  const el = document.getElementById('todayStats');
  const babiesToShow = ui.currentBaby==='all' ? state.babies.map(b=>b.id) : [ui.currentBaby];
  const isToday = (iso)=> iso && dayLabel(iso)==='Azi';

  let feedCount=0, sleepMs=0, diaperCount=0;
  state.logs.feeding.forEach(e=>{ if(babiesToShow.includes(e.babyId) && isToday(e.end||e.start)) feedCount++; });
  state.logs.sleep.forEach(e=>{ if(babiesToShow.includes(e.babyId) && e.end && isToday(e.end)) sleepMs += (new Date(e.end)-new Date(e.start)); });
  state.logs.diaper.forEach(e=>{ if(babiesToShow.includes(e.babyId) && isToday(e.time)) diaperCount++; });

  const cards = [
    { num: feedCount, lbl: 'mese/alăptări azi' },
    { num: fmtDur(sleepMs), lbl: 'somn azi' },
    { num: diaperCount, lbl: 'scutece azi' },
  ];
  el.innerHTML = cards.map(c=>`<div class="stat-pill"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');
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
  const map = {
    sleep: {icon:ICONS.moon, bg:'rgba(143,180,156,.18)', color:'#8FB49C'},
    diaper:{icon:ICONS.diaper, bg:'rgba(227,178,60,.18)', color:'#E3B23C'},
    activity:{icon:ICONS.activity, bg:'rgba(224,100,90,.16)', color:'#E0645A'},
  };
  if(item._type==='feeding'){
    if(item.subtype==='bottle') return {icon:ICONS.bottle, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
    if(item.subtype==='solid') return {icon:ICONS.solid, bg:'rgba(143,180,156,.18)', color:'#8FB49C'};
    return {icon: item.subtype==='breastR'?ICONS.breastR:ICONS.breastL, bg:'rgba(217,138,150,.18)', color:'#D98A96'};
  }
  return map[item._type];
}

function labelFor(item){
  if(item._type==='sleep') return 'Somn';
  if(item._type==='diaper') return {pipi:'Scutec · pipi', caca:'Scutec · caca', ambele:'Scutec · ambele'}[item.type] || 'Scutec';
  if(item._type==='activity') return {medicament:'Medicament', temperatura:'Temperatură', baie:'Baie', altul: item.value ? 'Notă' : 'Activitate'}[item.type] || 'Activitate';
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
    if(item.subtype==='bottle') return `${item.amountMl?item.amountMl+' ml · ':''}${fmtTime(item.start)}`;
    if(item.subtype==='solid') return `${item.foodDesc?item.foodDesc+' · ':''}${fmtTime(item.start)}`;
    if(!item.end) return 'în desfășurare…';
    return `${fmtTime(item.start)} – ${fmtTime(item.end)} · ${fmtDur(new Date(item.end)-new Date(item.start))}`;
  }
  if(item._type==='diaper') return fmtTime(item.time);
  if(item._type==='activity') return `${item.value?item.value+' · ':''}${fmtTime(item.time)}`;
  return '';
}

function renderFilterChips(){
  const el = document.getElementById('filterChips');
  const types = [
    {k:'all', l:'Toate'}, {k:'sleep', l:'Somn'}, {k:'feeding', l:'Mese'},
    {k:'diaper', l:'Scutece'}, {k:'activity', l:'Activități'},
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
        <div class="tl-title"><span><span class="baby-dot" style="background:${b.color}"></span>${labelFor(item)}</span></div>
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

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ================= RENDER: GROWTH ================= */

function renderGrowthBabyToggle(){
  const el = document.getElementById('growthBabyToggle');
  el.innerHTML = state.babies.map(b=>`<button class="chip ${ui.growthBaby===b.id?'active':''}" data-b="${b.id}" style="${ui.growthBaby===b.id?'border-color:'+b.color+';color:'+b.color:''}">${b.name}</button>`).join('');
  el.querySelectorAll('.chip').forEach(c=> c.onclick = ()=>{ ui.growthBaby = c.dataset.b; renderGrowth(); });
}

function renderGrowth(){
  renderGrowthBabyToggle();
  const entries = state.logs.growth.filter(g=>g.babyId===ui.growthBaby).sort((a,b)=> new Date(a.date)-new Date(b.date));
  const b = baby(ui.growthBaby);

  const ctx = document.getElementById('growthChart');
  if(chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: entries.map(e=> new Date(e.date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})),
      datasets: [{
        label: 'Greutate (kg)',
        data: entries.map(e=> e.weightKg),
        borderColor: b.color, backgroundColor: b.color+'33',
        tension: .35, pointRadius: 3, fill: true,
      }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#9a9db1' } } },
      scales:{
        x:{ ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' } },
        y:{ ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' } },
      }
    }
  });

  const listEl = document.getElementById('growthList');
  if(!entries.length){ listEl.innerHTML = `<div class="tl-empty">Nicio măsurătoare pentru ${b.name} încă.</div>`; return; }
  listEl.innerHTML = entries.slice().reverse().map(e=>`
    <div class="growth-row" data-id="${e.id}">
      <div class="g-date">${new Date(e.date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}</div>
      <div class="g-vals">
        ${e.weightKg?`<div>${e.weightKg} kg<small>greutate</small></div>`:''}
        ${e.heightCm?`<div>${e.heightCm} cm<small>înălțime</small></div>`:''}
        ${e.headCm?`<div>${e.headCm} cm<small>cap</small></div>`:''}
      </div>
    </div>`).join('');
  listEl.querySelectorAll('.growth-row').forEach(row=> row.onclick = ()=> openEditSheet('growth', row.dataset.id));
}

/* ================= RENDER: STATS / OVERVIEW ================= */

let statCharts = { sleep:null, feed:null, diaper:null };

function last7Days(){
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    days.push(d);
  }
  return days;
}
function isSameDay(a,b){ return a.toDateString()===b.toDateString(); }

function buildBarChart(canvasId, key, labels, datasets){
  const ctx = document.getElementById(canvasId);
  if(statCharts[key]) statCharts[key].destroy();
  statCharts[key] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color:'#9a9db1' } } },
      scales: {
        x: { ticks:{ color:'#686b80' }, grid:{ display:false } },
        y: { ticks:{ color:'#686b80' }, grid:{ color:'rgba(255,255,255,.05)' }, beginAtZero:true },
      }
    }
  });
}

function renderStats(){
  const days = last7Days();
  const labels = days.map(d=> d.toLocaleDateString('ro-RO',{weekday:'short'}));

  const sleepDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let ms = 0;
      state.logs.sleep.forEach(s=>{
        if(s.babyId===b.id && s.end && isSameDay(new Date(s.end), day)) ms += (new Date(s.end)-new Date(s.start));
      });
      return +(ms/3600000).toFixed(1);
    }),
  }));
  buildBarChart('statSleepChart', 'sleep', labels, sleepDatasets);

  const feedDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let count = 0;
      state.logs.feeding.forEach(f=>{
        const t = f.end || f.start;
        if(f.babyId===b.id && t && isSameDay(new Date(t), day)) count++;
      });
      return count;
    }),
  }));
  buildBarChart('statFeedChart', 'feed', labels, feedDatasets);

  const diaperDatasets = state.babies.map(b=>({
    label: b.name, backgroundColor: b.color,
    data: days.map(day=>{
      let count = 0;
      state.logs.diaper.forEach(d=>{
        if(d.babyId===b.id && isSameDay(new Date(d.time), day)) count++;
      });
      return count;
    }),
  }));
  buildBarChart('statDiaperChart', 'diaper', labels, diaperDatasets);
}



function activePlans(){ return state.logs.medPlans.filter(p=>!p.paused); }

function nextDoseTimeForPlan(plan){
  const doses = state.logs.medDoses
    .filter(d=> d.planId===plan.id)
    .sort((a,b)=> new Date(b.time)-new Date(a.time));
  const lastTime = doses.length ? doses[0].time : plan.startAt;
  return new Date(new Date(lastTime).getTime() + plan.intervalHours*3600000);
}

function renderMedsBabyToggle(){
  const el = document.getElementById('medsBabyToggle');
  const opts = [...state.babies, {id:'all', name:'Amândoi'}];
  el.innerHTML = opts.map(b=>{
    const active = ui.medsBaby===b.id ? 'active' : '';
    return `<button class="chip ${active}" data-b="${b.id}" style="${active&&b.color?'border-color:'+b.color+';color:'+b.color:''}">${b.name}</button>`;
  }).join('');
  el.querySelectorAll('.chip').forEach(c=> c.onclick = ()=>{ ui.medsBaby = c.dataset.b; renderMeds(); });
}

function medsFilterIds(){
  return ui.medsBaby==='all' ? state.babies.map(b=>b.id) : [ui.medsBaby];
}

function renderMedPlans(){
  const el = document.getElementById('medPlansList');
  const ids = medsFilterIds();
  const plans = state.logs.medPlans.filter(p=> ids.includes(p.babyId));
  if(!plans.length){ el.innerHTML = `<div class="tl-empty">Niciun plan de medicație activ.</div>`; return; }

  el.innerHTML = plans.map(plan=>{
    const b = baby(plan.babyId);
    let nextHtml = '';
    if(!plan.paused){
      const next = nextDoseTimeForPlan(plan);
      const overdue = next < new Date();
      nextHtml = `<div class="med-plan-next ${overdue?'overdue':'upcoming'}">${overdue?'Întârziat · era la ':'Următoarea la '}${fmtTime(next)} · ${dayLabel(next.toISOString())}</div>`;
    } else {
      nextHtml = `<div class="med-plan-next upcoming">Plan pus pe pauză</div>`;
    }
    return `<div class="med-plan-card ${plan.paused?'med-plan-paused':''}" data-id="${plan.id}">
      <div class="med-plan-top">
        <div>
          <div class="med-plan-name"><span class="dot" style="background:${b.color}"></span>${escapeHtml(plan.name)}</div>
          <div class="med-plan-dose">${escapeHtml(plan.doseText||'')}${plan.doseText?' · ':''}la fiecare ${plan.intervalHours}h</div>
        </div>
        <button class="med-plan-icon-btn" data-edit="${plan.id}">✎</button>
      </div>
      ${nextHtml}
      <div class="med-plan-actions">
        ${!plan.paused?`<button class="btn-give" data-give="${plan.id}">Am administrat acum</button>`:''}
        <button data-pause="${plan.id}">${plan.paused?'Reactivează':'Pauză'}</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-give]').forEach(btn=>{
    btn.onclick = ()=>{
      const plan = state.logs.medPlans.find(p=>p.id===btn.dataset.give);
      state.logs.medDoses.push({ id: uid(), planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, time: nowISO(), notes:'' });
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

  // doze deja administrate (istoric recent)
  state.logs.medDoses
    .filter(d=> ids.includes(d.babyId) && new Date(d.time) >= horizonStart)
    .forEach(d=> items.push({ _t: d.time, _status:'given', ...d }));

  // ocurențe viitoare pentru planuri active
  state.logs.medPlans.filter(p=> ids.includes(p.babyId) && !p.paused).forEach(plan=>{
    let t = nextDoseTimeForPlan(plan);
    let guard = 0;
    while(t <= horizonEnd && guard < 40){
      items.push({
        _t: t.toISOString(),
        _status: t < now ? 'overdue' : 'upcoming',
        planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText,
      });
      t = new Date(t.getTime() + plan.intervalHours*3600000);
      guard++;
      if(t < now && guard===1) continue; // permite să afișeze și pe cea imediat următoare dacă a trecut deja
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
    let statusHtml = '';
    if(item._status==='given') statusHtml = `<div class="agenda-status given">administrat</div>`;
    else if(item._status==='overdue') statusHtml = `<div class="agenda-status overdue"><button data-quick-give="${item.planId}">Am dat</button></div>`;
    else statusHtml = `<div class="agenda-status upcoming">programat</div>`;
    html += `<div class="agenda-item ${item._status==='overdue'?'overdue':''}">
      <div class="agenda-time">${fmtTime(item._t)}</div>
      <div class="agenda-body">
        <span class="baby-dot" style="background:${b.color}"></span>${escapeHtml(item.name)}
        <div class="agenda-sub">${escapeHtml(item.doseText||'')}</div>
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
      state.logs.medDoses.push({ id: uid(), planId: plan.id, babyId: plan.babyId, name: plan.name, doseText: plan.doseText, time: nowISO(), notes:'' });
      scheduleSave(); renderMeds();
    };
  });
}

function renderMeds(){
  renderMedsBabyToggle();
  renderMedPlans();
  renderMedAgenda();
}

function openMedPlanSheet(existingId){
  const plan = existingId ? state.logs.medPlans.find(p=>p.id===existingId) : null;
  const babyIds = plan ? [plan.babyId] : medsFilterIds();
  const refBaby = baby(babyIds[0]);

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${plan?'Editează planul':'Plan nou de medicație'}</h3>
    ${!plan?`<div class="form-group"><label class="form-label">Pentru</label>
      <div class="seg" id="mpBaby">
        ${state.babies.map(b=>`<button class="seg-btn ${babyIds.includes(b.id)&&babyIds.length===1&&babyIds[0]===b.id?'active':''}" data-v="${b.id}">${b.name}</button>`).join('')}
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
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="mpNotes">${plan?plan.notes||'':''}</textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="mpCancel">Renunță</button>
      <button class="btn-primary" id="mpSave" style="background:${refBaby.color}">Salvează</button>
    </div>
    ${plan?`<button class="btn-delete-entry" id="mpDelete">Șterge planul</button>`:''}
  `);

  let selectedBaby = babyIds[0];
  if(!plan){
    document.querySelectorAll('#mpBaby .seg-btn').forEach(btn=>{
      btn.onclick = ()=>{ document.querySelectorAll('#mpBaby .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); selectedBaby = btn.dataset.v; };
    });
  }

  document.getElementById('mpCancel').onclick = closeSheet;
  if(plan){
    document.getElementById('mpDelete').onclick = ()=>{
      const idx = state.logs.medPlans.findIndex(p=>p.id===existingId);
      if(idx>-1) state.logs.medPlans.splice(idx,1);
      scheduleSave(); closeSheet(); renderMeds();
    };
  }
  document.getElementById('mpSave').onclick = ()=>{
    const name = document.getElementById('mpName').value.trim();
    const doseText = document.getElementById('mpDose').value.trim();
    const intervalHours = parseNum(document.getElementById('mpInterval').value) || 8;
    const startAt = combineDateAndTime(document.getElementById('mpDate').value, document.getElementById('mpTime').value);
    const notes = document.getElementById('mpNotes').value.trim();
    if(!name){ alert('Adaugă numele medicamentului.'); return; }

    if(plan){
      Object.assign(plan, { name, doseText, intervalHours, startAt, notes });
    } else {
      state.logs.medPlans.push({ id: uid(), babyId: selectedBaby, name, doseText, intervalHours, startAt, notes, paused:false });
    }
    scheduleSave(); closeSheet(); renderMeds();
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
    const name = document.getElementById('mdName').value.trim();
    if(!name){ alert('Adaugă numele medicamentului.'); return; }
    const doseText = document.getElementById('mdDose').value.trim();
    const time = combineTimeWithDate(nowISO(), document.getElementById('mdTime').value);
    const notes = document.getElementById('mdNotes').value.trim();
    babyIds.forEach(babyId=>{
      state.logs.medDoses.push({ id: uid(), planId:null, babyId, name, doseText, time, notes });
    });
    scheduleSave(); closeSheet(); renderMeds();
  };
}


/* ================= RENDER: SETTINGS ================= */

function renderSettings(){
  const el = document.getElementById('babySettings');
  el.innerHTML = state.babies.map(b=>`
    <div class="baby-edit-row">
      <label class="color-dot-btn" style="background:${b.color}">
        <input type="color" value="${b.color}" style="opacity:0;width:0;height:0;position:absolute" data-id="${b.id}">
      </label>
      <input type="text" value="${b.name}" data-id="${b.id}" maxlength="20">
    </div>`).join('');
  el.querySelectorAll('input[type=text]').forEach(inp=>{
    inp.onchange = ()=>{ baby(inp.dataset.id).name = inp.value.trim() || 'Bebe'; scheduleSave(); renderAll(); };
  });
  el.querySelectorAll('input[type=color]').forEach(inp=>{
    inp.onchange = ()=>{ baby(inp.dataset.id).color = inp.value; scheduleSave(); renderAll(); };
  });
}

/* ================= QUICK ACTIONS / TIMERS (implemented above) ================= */
function toTimeInput(iso){ const d = new Date(iso); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function combineTimeWithDate(refISO, hhmm, isEnd, startISOForEnd){
  const ref = new Date(refISO);
  const [h,m] = hhmm.split(':').map(Number);
  const d = new Date(ref); d.setHours(h,m,0,0);
  if(isEnd && startISOForEnd && d < new Date(startISOForEnd)) d.setDate(d.getDate()+1);
  return d.toISOString();
}

function openDiaperSheet(babyIds){
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>Scutec — ${names}</h3>
    ${babyIds.length>1?`<div class="sheet-sub">Se aplică la amândoi</div>`:''}
    <div class="form-group">
      <div class="seg" id="diaperType">
        <button class="seg-btn active" data-v="pipi">Pipi</button>
        <button class="seg-btn" data-v="caca">Caca</button>
        <button class="seg-btn" data-v="ambele">Ambele</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Ora</label><input type="time" id="dTime" value="${toTimeInput(nowISO())}"></div>
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="dNotes"></textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="dCancel">Renunță</button>
      <button class="btn-primary" id="dSave" style="background:${refBaby.color}">Salvează</button>
    </div>
  `);
  let type = 'pipi';
  document.querySelectorAll('#diaperType .seg-btn').forEach(btn=>{
    btn.onclick = ()=>{ document.querySelectorAll('#diaperType .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); type = btn.dataset.v; };
  });
  document.getElementById('dCancel').onclick = closeSheet;
  document.getElementById('dSave').onclick = ()=>{
    const time = combineTimeWithDate(nowISO(), document.getElementById('dTime').value);
    const notes = document.getElementById('dNotes').value.trim();
    babyIds.forEach(babyId=>{
      state.logs.diaper.push({ id: uid(), babyId, type, time, notes });
    });
    scheduleSave(); closeSheet(); renderAll();
  };
}

function openLogSheet(kind, prefill){
  const babyIds = prefill.babyIds;
  const refBaby = baby(babyIds[0]);
  const names = babyNames(babyIds);
  const bothNote = babyIds.length>1 ? `<div class="sheet-sub">Se aplică la amândoi</div>` : '';
  if(kind==='feeding'){
    const isBottle = prefill.subtype==='bottle';
    renderSheet(`
      <div class="sheet-handle"></div>
      <h3>${isBottle?'Biberon':'Masă solidă'} — ${names}</h3>
      ${bothNote}
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="fTime" value="${toTimeInput(nowISO())}"></div>
      ${isBottle
        ? `<div class="form-group"><label class="form-label">Cantitate (ml)</label><input type="text" inputmode="decimal" id="fAmount" placeholder="ex: 120"></div>`
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
      const start = combineTimeWithDate(nowISO(), document.getElementById('fTime').value);
      const notes = document.getElementById('fNotes').value.trim();
      const amountMl = isBottle ? parseNum(document.getElementById('fAmount').value) : null;
      const foodDesc = isBottle ? null : document.getElementById('fFood').value.trim();
      babyIds.forEach(babyId=>{
        const entry = { id: uid(), babyId, subtype: prefill.subtype, start, end: start, notes };
        if(isBottle) entry.amountMl = amountMl; else entry.foodDesc = foodDesc;
        state.logs.feeding.push(entry);
      });
      scheduleSave(); closeSheet(); renderAll();
    };
    return;
  }
  if(kind==='activity'){
    const isNote = prefill.type==='altul';
    renderSheet(`
      <div class="sheet-handle"></div>
      <h3>${isNote?'Notă rapidă':'Activitate'} — ${names}</h3>
      ${bothNote}
      ${!isNote?`<div class="form-group">
        <div class="seg" id="actType">
          <button class="seg-btn active" data-v="medicament">Medicament</button>
          <button class="seg-btn" data-v="temperatura">Temperatură</button>
          <button class="seg-btn" data-v="baie">Baie</button>
          <button class="seg-btn" data-v="altul">Altceva</button>
        </div>
      </div>`:''}
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="aTime" value="${toTimeInput(nowISO())}"></div>
      <div class="form-group"><label class="form-label">${isNote?'Notă':'Detalii (ex: doză, °C)'}</label><textarea id="aValue" placeholder="${isNote?'ex: azi a zâmbit prima dată!':'ex: 37.4°C sau Nurofen 2.5ml'}"></textarea></div>
      <div class="sheet-actions">
        <button class="btn-cancel" id="aCancel">Renunță</button>
        <button class="btn-primary" id="aSave" style="background:${refBaby.color}">Salvează</button>
      </div>
    `);
    let type = prefill.type;
    if(!isNote){
      document.querySelectorAll('#actType .seg-btn').forEach(btn=>{
        btn.onclick = ()=>{ document.querySelectorAll('#actType .seg-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); type = btn.dataset.v; };
      });
    }
    document.getElementById('aCancel').onclick = closeSheet;
    document.getElementById('aSave').onclick = ()=>{
      const time = combineTimeWithDate(nowISO(), document.getElementById('aTime').value);
      const value = document.getElementById('aValue').value.trim();
      babyIds.forEach(babyId=>{
        state.logs.activity.push({ id: uid(), babyId, type, value: isNote? '' : value, notes: isNote? value : '', time });
      });
      scheduleSave(); closeSheet(); renderAll();
    };
  }
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
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openGrowthSheet(existingId){
  const entry = existingId ? state.logs.growth.find(e=>e.id===existingId) : null;
  const babyId = entry ? entry.babyId : ui.growthBaby;
  const b = baby(babyId);
  let currentPhoto = entry && entry.photo ? entry.photo : null;

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>${entry?'Editează măsurătoarea':'Măsurătoare'} — ${b.name}</h3>
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
    <div class="form-group"><label class="form-label">Notă (opțional)</label><textarea id="gNotes">${entry?entry.notes||'':''}</textarea></div>
    <div class="sheet-actions">
      <button class="btn-cancel" id="gCancel">Renunță</button>
      <button class="btn-primary" id="gSave" style="background:${b.color}">Salvează</button>
    </div>
    ${entry?`<button class="btn-delete-entry" id="gDelete">Șterge măsurătoarea</button>`:''}
  `);

  document.getElementById('gPhotoInput').onchange = async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    try{
      currentPhoto = await resizeImageFile(file);
      const img = document.getElementById('gPhotoPreview');
      img.src = currentPhoto; img.classList.add('show');
      document.getElementById('gPhotoRemove').classList.add('show');
    }catch(err){ alert('Nu am putut încărca poza.'); }
  };
  document.getElementById('gPhotoRemove').onclick = ()=>{
    currentPhoto = null;
    const img = document.getElementById('gPhotoPreview');
    img.src = ''; img.classList.remove('show');
    document.getElementById('gPhotoRemove').classList.remove('show');
  };

  document.getElementById('gCancel').onclick = closeSheet;
  if(entry){
    document.getElementById('gDelete').onclick = ()=>{
      const idx = state.logs.growth.findIndex(e=>e.id===existingId);
      if(idx>-1) state.logs.growth.splice(idx,1);
      scheduleSave(); closeSheet(); renderGrowth();
    };
  }
  document.getElementById('gSave').onclick = ()=>{
    const date = document.getElementById('gDate').value;
    const data = {
      date,
      weightKg: parseNum(document.getElementById('gWeight').value),
      heightCm: parseNum(document.getElementById('gHeight').value),
      headCm: parseNum(document.getElementById('gHead').value),
      photo: currentPhoto,
      notes: document.getElementById('gNotes').value.trim(),
    };
    if(entry){
      Object.assign(entry, data);
    } else {
      state.logs.growth.push({ id: uid(), babyId, ...data });
    }
    scheduleSave(); closeSheet(); renderGrowth();
  };
}

function toDateInput(iso){ return new Date(iso).toISOString().slice(0,10); }
function combineDateAndTime(dateStr, timeStr){
  const [y,mo,d] = dateStr.split('-').map(Number);
  const [h,mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, mo-1, d, h, mi, 0, 0);
  return dt.toISOString();
}

function openEditSheet(type, id){
  const collMap = { sleep:'sleep', feeding:'feeding', diaper:'diaper', activity:'activity', growth:'growth' };
  const coll = state.logs[collMap[type]];
  const entry = coll.find(e=>e.id===id);
  if(!entry) return;
  if(type==='growth'){ openGrowthSheet(id); return; }
  const b = baby(entry.babyId);

  const hasRange = (type==='sleep') || (type==='feeding' && (entry.subtype==='breastL'||entry.subtype==='breastR'));
  const singleTimeField = (type==='diaper') ? 'time' : (type==='activity' ? 'time' : null);

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
    const isNote = !entry.type || entry.type==='altul' && !entry.value;
    typeFieldsHtml = `
      <div class="form-group"><label class="form-label">Tip</label>
        <div class="seg" id="eActType">
          <button class="seg-btn ${entry.type==='medicament'?'active':''}" data-v="medicament">Medicament</button>
          <button class="seg-btn ${entry.type==='temperatura'?'active':''}" data-v="temperatura">Temperatură</button>
          <button class="seg-btn ${entry.type==='baie'?'active':''}" data-v="baie">Baie</button>
          <button class="seg-btn ${(!entry.type||entry.type==='altul')?'active':''}" data-v="altul">Altceva</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Detalii</label><input type="text" id="eActValue" value="${escapeHtml(entry.value||'')}" placeholder="ex: 37.4°C sau Nurofen 2.5ml"></div>`;
  }
  if(type==='feeding'){
    if(entry.subtype==='bottle'){
      typeFieldsHtml = `<div class="form-group"><label class="form-label">Cantitate (ml)</label><input type="text" inputmode="decimal" id="eAmount" value="${entry.amountMl!=null?entry.amountMl:''}"></div>`;
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
  } else if(singleTimeField){
    timeFieldsHtml = `
      <div class="form-group"><label class="form-label">Data</label><input type="date" id="eDate" value="${toDateInput(entry[singleTimeField])}"></div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="eTime" value="${toTimeInput(entry[singleTimeField])}"></div>`;
  } else {
    // feeding, momentan (bottle/solid) — start == end, single point in time
    timeFieldsHtml = `
      <div class="form-group"><label class="form-label">Data</label><input type="date" id="eDate" value="${toDateInput(entry.start)}"></div>
      <div class="form-group"><label class="form-label">Ora</label><input type="time" id="eTime" value="${toTimeInput(entry.start)}"></div>`;
  }

  renderSheet(`
    <div class="sheet-handle"></div>
    <h3>Editează înregistrare</h3>
    <div class="sheet-sub">${b.name}</div>
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
    const dateStr = document.getElementById('eDate').value;
    entry.notes = document.getElementById('eNotes').value.trim();

    if(hasRange){
      const startISO = combineDateAndTime(dateStr, document.getElementById('eStart').value);
      let endISO = combineDateAndTime(dateStr, document.getElementById('eEnd').value);
      if(new Date(endISO) < new Date(startISO)){
        const d = new Date(endISO); d.setDate(d.getDate()+1); endISO = d.toISOString();
      }
      entry.start = startISO; entry.end = endISO;
    } else if(singleTimeField){
      entry[singleTimeField] = combineDateAndTime(dateStr, document.getElementById('eTime').value);
    } else {
      const t = combineDateAndTime(dateStr, document.getElementById('eTime').value);
      entry.start = t; entry.end = t;
    }

    if(type==='diaper'){
      entry.type = document.querySelector('#eDiaperType .seg-btn.active').dataset.v;
    }
    if(type==='activity'){
      entry.type = document.querySelector('#eActType .seg-btn.active').dataset.v;
      entry.value = document.getElementById('eActValue').value.trim();
    }
    if(type==='feeding'){
      if(entry.subtype==='bottle') entry.amountMl = parseNum(document.getElementById('eAmount').value);
      if(entry.subtype==='solid') entry.foodDesc = document.getElementById('eFood').value.trim();
    }

    scheduleSave(); closeSheet(); renderAll();
  };
}

/* ================= SHEET (bottom modal) ================= */

function renderSheet(html){
  document.getElementById('sheet').innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('open');
}
function closeSheet(){
  document.getElementById('sheetOverlay').classList.remove('open');
}
document.getElementById('sheetOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='sheetOverlay') closeSheet();
});

/* ================= TIMER BAR (running timers, live) ================= */

function renderTimerBar(){
  const el = document.getElementById('timerBar');
  let chips = [];
  Object.entries(state.timers.sleep).forEach(([bId, t])=>{
    if(!t) return;
    const b = baby(bId);
    chips.push(`<div class="timer-chip" data-kind="sleep" data-baby="${bId}">
      <div class="tc-left"><span class="dot" style="background:${b.color}"></span>${b.name} · Somn</div>
      <span class="tc-time">${fmtDur(Date.now()-new Date(t.start).getTime())}</span>
      <button data-stop="sleep:${bId}">OPREȘTE</button>
    </div>`);
  });
  Object.entries(state.timers.feeding).forEach(([bId, t])=>{
    if(!t) return;
    const b = baby(bId);
    const lbl = t.subtype==='breastR' ? 'Alăptare D' : 'Alăptare S';
    chips.push(`<div class="timer-chip" data-kind="feeding" data-baby="${bId}">
      <div class="tc-left"><span class="dot" style="background:${b.color}"></span>${b.name} · ${lbl}</div>
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

/* ================= MASTER RENDER ================= */

function renderAll(){
  renderTwinSwitch();
  renderStatusRow();
  renderUpcomingBand();
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
