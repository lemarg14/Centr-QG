/**
 * Centr QG — base de données Google Sheets + pont Google Agenda
 * ------------------------------------------------------------
 * 1. Colle ce fichier dans Extensions > Apps Script de ton Google Sheets.
 * 2. Lance la fonction `setup` une fois (bouton ▶) : elle crée les onglets,
 *    demande les autorisations et affiche ton code secret dans le journal.
 * 3. Déployer > Nouveau déploiement > Application Web
 *    (Exécuter en tant que : moi · Accès : Tout le monde).
 * 4. Colle l'URL /exec et le code secret dans Centr QG > ⚙ Réglages.
 */

const SPACES = 'spaces';        // onglet technique (1 ligne par activité, JSON)
const CHUNK = 45000;            // une cellule Sheets accepte 50 000 caractères max
const NAMES = {
  ecom: 'E-commerce', sav: 'SAV', coaching: 'Accompagnement e-com',
  logistique: 'Logistique', 'import': 'Import-export',
  verts: 'Espaces verts & nettoyage', agence: 'Agence web'
};

/* ---------- À lancer une fois ---------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TOKEN');
  if (!token) { token = Utilities.getUuid().replace(/-/g, ''); props.setProperty('TOKEN', token); }
  sheet_(SPACES, ['id', 'mis à jour', 'données (ne pas modifier)']);
  sheet_('Tâches'); sheet_('Agenda');
  const cal = CalendarApp.getDefaultCalendar().getName(); // déclenche l'autorisation Agenda
  Logger.log('Code secret à coller dans Centr QG : ' + token);
  Logger.log('Agenda relié : ' + cal);
}

/* ---------- Point d'entrée web ---------- */
function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function handle_(p) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token) throw new Error('Lance d\'abord la fonction setup dans Apps Script');
    if (p.token !== token) throw new Error('Code secret invalide');
    switch (p.action) {
      case 'ping': return out_({ ok: true, sheet: SpreadsheetApp.getActive().getName(), calendar: CalendarApp.getDefaultCalendar().getName() });
      case 'load': return out_({ ok: true, spaces: load_() });
      case 'save': save_(p.id, p.data); return out_({ ok: true });
      case 'calList': return out_({ ok: true, events: calList_(p.from, p.to) });
      case 'calCreate': return out_({ ok: true, id: calCreate_(p) });
      case 'calUpdate': calUpdate_(p); return out_({ ok: true });
      case 'calDelete': calDelete_(p.gid); return out_({ ok: true });
    }
    throw new Error('Action inconnue : ' + p.action);
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------- Données ---------- */
function sheet_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) { sh.appendRow(header); sh.setFrozenRows(1); }
  }
  return sh;
}

function load_() {
  const sh = sheet_(SPACES, ['id', 'mis à jour', 'données (ne pas modifier)']);
  const v = sh.getDataRange().getValues();
  const r = {};
  for (let i = 1; i < v.length; i++) {
    const id = v[i][0];
    if (!id) continue;
    // chaque morceau est préfixé par "~" pour que Sheets ne le prenne jamais pour une formule
    const json = v[i].slice(2).map(function (c) { return String(c || '').replace(/^~/, ''); }).join('');
    if (json) { try { r[id] = JSON.parse(json); } catch (e) {} }
  }
  return r;
}

function save_(id, data) {
  if (!/^[a-z0-9_-]+$/i.test(id || '')) throw new Error('Identifiant invalide');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(SPACES, ['id', 'mis à jour', 'données (ne pas modifier)']);
    const json = JSON.stringify(data || {});
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push('~' + json.slice(i, i + CHUNK));
    if (!parts.length) parts.push('~{}');
    const last = Math.max(1, sh.getLastRow());
    const ids = sh.getRange(1, 1, last, 1).getValues().map(function (r) { return r[0]; });
    let row = ids.indexOf(id) + 1;
    if (row < 1) row = sh.getLastRow() + 1;
    const width = Math.max(sh.getLastColumn(), parts.length + 2);
    if (width > 2) sh.getRange(row, 3, 1, width - 2).clearContent();
    sh.getRange(row, 1, 1, 2).setValues([[id, new Date()]]);
    sh.getRange(row, 3, 1, parts.length).setValues([parts]);
    mirror_();
  } finally {
    lock.releaseLock();
  }
}

/* Onglets lisibles « Tâches » et « Agenda », régénérés à chaque sauvegarde (lecture seule) */
function mirror_() {
  const sp = load_();
  const ST = { todo: 'À faire', doing: 'En cours', done: 'Fait' };
  const T = [['Activité', 'Tâche', 'Statut', 'Priorité', 'Échéance', 'Durée (min)', 'Mini-tâches', 'Notes']];
  const A = [['Activité', 'Créneau', 'Date', 'Début', 'Durée (min)', 'Dans Google Agenda']];
  Object.keys(NAMES).forEach(function (id) {
    const s = sp[id] || {};
    (s.tasks || []).forEach(function (t) {
      T.push([NAMES[id], t.title, ST[t.status] || t.status, 'P' + (t.prio || 2), t.due || '', t.dur || '',
        (t.subs || []).map(function (x) { return (x.done ? '✓ ' : '○ ') + x.t; }).join('\n'), t.note || '']);
    });
    (s.events || []).forEach(function (e) {
      A.push([NAMES[id], e.title, e.date, e.start, e.dur, e.gid ? 'oui' : '']);
    });
  });
  write_('Tâches', T);
  write_('Agenda', A);
}
function write_(name, rows) {
  const sh = sheet_(name);
  sh.clearContents();
  const safe = rows.map(function (r) {
    return r.map(function (c) { c = String(c == null ? '' : c); return /^[=+\-@]/.test(c) ? "'" + c : c; });
  });
  sh.getRange(1, 1, safe.length, safe[0].length).setValues(safe);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, safe[0].length).setFontWeight('bold');
}

/* ---------- Google Agenda ---------- */
function cal_() { return CalendarApp.getDefaultCalendar(); }
function dt_(date, start, addMin) {
  const d = date.split('-').map(Number), t = String(start || '09:00').split(':').map(Number);
  return new Date(d[0], d[1] - 1, d[2], t[0], t[1] + (addMin || 0));
}
// Renvoie tes rendez-vous Google (sauf ceux créés par Centr QG, déjà affichés dans l'app)
function calList_(from, to) {
  return cal_().getEvents(new Date(from), new Date(to))
    .filter(function (e) { return !e.getTag('centrqg'); })
    .map(function (e) {
      return { id: e.getId(), title: e.getTitle(), start: e.getStartTime().toISOString(),
               end: e.getEndTime().toISOString(), allDay: e.isAllDayEvent() };
    });
}
function calCreate_(p) {
  const ev = cal_().createEvent(p.title, dt_(p.date, p.start), dt_(p.date, p.start, +p.dur || 60),
    { description: 'Créé depuis Centr QG' });
  ev.setTag('centrqg', String(p.cid || '1'));
  return ev.getId();
}
function calUpdate_(p) {
  const ev = cal_().getEventById(p.gid);
  if (!ev) return;
  ev.setTitle(p.title);
  ev.setTime(dt_(p.date, p.start), dt_(p.date, p.start, +p.dur || 60));
}
function calDelete_(gid) {
  const ev = gid && cal_().getEventById(gid);
  if (ev) ev.deleteEvent();
}
