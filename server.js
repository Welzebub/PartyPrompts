// Partypost – minimaler Server ohne Abhängigkeiten (nur Node >= 18)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const SEED_FILE = path.join(__dirname, 'seed.json'); // optionales Backup, mit dem der Server immer startet
const MAX_LEN = 280;        // maximale Zeichenzahl pro Beitrag
const MAX_POSTS = 1000;     // Obergrenze insgesamt
const MAX_INTRO = 200;      // Zeichen pro Intro-Zeile
const MAX_AUTHOR = 80;      // Zeichen pro Verfasser*in-Name
const MAX_LIST = 300;       // Einträge pro Liste
const COOLDOWN_MS = 4000;   // Mindestabstand pro Gerät/IP
const BOOT = crypto.randomBytes(4).toString('hex'); // ändert sich bei jedem Serverstart

const DEFAULT_INTROS = [
  'Übrigens:', 'Live aus Bielefeld:', 'Partygäste sind erschüttert:', 'Wahr oder frei erfunden?', 'Man munkelt:',
  'Ein alter Volksmythos:', 'Experten haben herausgefunden:', 'Erschütternd, aber wahr:', 'Verratet es niemandem, aber:',
  'Also das muss doch Quatsch sein:', 'Dein Arzt will nicht, dass du das weißt:', '9 von 10 Zahnärzten sind sich einig:',
  'Live aus dem Echsenmenschen-Studio:', 'Der Postillion hat es vorausgesagt:', 'Aus einem Xavier-Naidoo-Song:',
  'Vertrau, Brudi:', 'Liest das hier überhaupt jemand?', 'Neue Bibelzeile entschlüsselt:', 'Aliens schicken Nachricht:',
  'Expartnerin von Heiko S. beichtet:', 'Chefin von Franzi L. S. offenbart:', 'Gerücht im Polykül von Lex W.:',
  'Kolleg*innen von Hannes K. sind entsetzt:', 'F. Krämer schockiert: „Ich fürchte um meine Sicherheit!“ (Falk K.):',
  'Schlagzeile:', 'Bildzeitung berichtet:',
  'Eilmeldung:', 'Gerade reingekommen:', 'Aus gut unterrichteten Kreisen:', 'Wissenschaftler warnen:',
  'Das Orakel von Delphi spricht:', 'Laut meiner Oma:', 'Ein Geheimdienst bestätigt:', 'Lange verschwiegen, jetzt enthüllt:',
  'Mein Cousin schwört:', 'Fakt (nicht geprüft):', 'Was dir niemand sagt:', 'Zeitreisende bestätigen:',
  'Gefunden in einem Glückskeks:', 'Offiziell bestätigt von niemandem:', 'Beim Nachbarn belauscht:', 'Dein Horoskop warnt:',
  'Anonyme Quelle packt aus:', 'Ein Eichhörnchen berichtet:', 'Wikipedia-Eintrag kurz vor der Löschung:',
  'Du wirst es nicht glauben:', 'Kein Scherz:', 'Studie der Uni Hintertupfingen:', 'Nachrichten aus dem Paralleluniversum:',
  'Die Gerüchteküche brodelt:', 'Aus dem Chat, den es nie gab:', 'Der Weihnachtsmann bestätigt:',
  'Chemtrail-Piloten plaudern aus dem Nähkästchen:', 'Eine KI hat das geträumt:', 'Stiftung Partytest:',
  'Kurz vor Mitternacht enthüllt:', 'Das Bundesamt für Gerüchte meldet:', 'Mein Rechtsanwalt rät dringend ab:',
  'Ganz im Vertrauen:', 'Neu im Duden:', 'Weisheit des Tages:'
];
const DEFAULT_AUTHORS = [
  'Gandhi', 'tagesschau', '1&1', 'Otto Waalkes', 'R2D2', 'Anonymer Partygast', 'SPIEGEL online', 'Merkel', 'Angelo Merte',
  'Kollegah', 'Severus Snape', 'Bestimmt nicht Niklas',
  'Napoleon', 'Kleopatra', 'Sokrates', 'Goethe', 'Nostradamus', 'Rasputin', 'Graf Dracula', 'Zeus', 'Odin', 'Loki',
  'Gandalf', 'Meister Yoda', 'Chuck Norris', 'Karl Marx', 'Albert Einstein', 'Dschingis Khan', 'Baron Münchhausen',
  'Till Eulenspiegel', 'Diogenes', 'Das Orakel von Delphi', 'Nessie', 'Bigfoot', 'Der Yeti', 'Rumpelstilzchen',
  'Pepe der Frosch', 'Grumpy Cat', 'Doge', 'Rick Astley', 'Clippy', 'Siri', 'Alexa', 'Mein Horoskop', 'Der Weihnachtsmann',
  'Ein Reptiloid', 'Chemtrail-Pilot Gerd', 'Querdenker Dieter', 'David Icke', 'Erich von Däniken', 'Xavier Naidoo',
  'Michael Wendler', 'Die Illuminaten', 'Die Bielefeld-Verschwörung', 'Der Mann im Mond', 'Die Zahnfee', 'Dr. Google',
  'Frau Holle', 'Erwin aus Hintertupfingen'
];
const DEFAULT_SETTINGS = { ticker: true, intros: true, authors: true, autoSwitch: false, switchMinutes: 3 };

function clean1(s, max) { return [...String(s == null ? '' : s).replace(/\s+/g, ' ').trim()].slice(0, max).join(''); }
function cleanList(arr, max) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) { const s = clean1(x, max); if (s && !out.includes(s)) out.push(s); if (out.length >= MAX_LIST) break; }
  return out;
}
function cleanSettings(d, base) {
  d = d && typeof d === 'object' ? d : {};
  base = base || DEFAULT_SETTINGS;
  const b = k => (d[k] === undefined ? !!base[k] : !!d[k]);
  const m = Math.round(Number(d.switchMinutes));
  return { ticker: b('ticker'), intros: b('intros'), authors: b('authors'), autoSwitch: b('autoSwitch'),
           switchMinutes: m >= 1 && m <= 60 ? m : base.switchMinutes };
}
function validate(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: 'Der Beitrag ist leer.' };
  if ([...text].length > MAX_LEN) return { error: `Maximal ${MAX_LEN} Zeichen.` };
  return { text };
}
function normalizeState(d) {
  if (Array.isArray(d)) d = { posts: d };   // altes Format: nur eine Liste von Beiträgen
  d = d && typeof d === 'object' ? d : {};
  const ids = new Set(), posts = [];
  for (const x of Array.isArray(d.posts) ? d.posts : []) {
    const v = validate(x && x.text);
    if (v.error) continue;
    let id = String(x.id || '');
    if (!/^[a-f0-9]{4,32}$/.test(id) || ids.has(id)) id = crypto.randomBytes(6).toString('hex');
    ids.add(id);
    posts.push({ id, text: v.text, t: Number(x.t) || Date.now() });
    if (posts.length >= MAX_POSTS) break;
  }
  return {
    posts,
    intros: cleanList(d.intros, MAX_INTRO) || DEFAULT_INTROS.slice(),
    authors: cleanList(d.authors, MAX_AUTHOR) || DEFAULT_AUTHORS.slice(),
    settings: cleanSettings(d.settings)
  };
}

function load() {
  for (const f of [DATA_FILE, SEED_FILE]) {
    try { return normalizeState(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch {}
  }
  return normalizeState({});
}
let S = load();
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(S)); } catch (e) { console.error(e.message); } }

const lastPost = new Map();
const pages = { '/': 'index.html', '/show': 'show.html', '/admin': 'admin.html' };

function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Boot': BOOT, ...extra });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function isAdmin(url) { return ADMIN_KEY && url.searchParams.get('key') === ADMIN_KEY; }
function readJson(req, cb, limit = 8192) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > limit) req.destroy(); });
  req.on('end', () => { let d = {}; try { d = JSON.parse(raw); } catch {} cb(d); });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'GET' && pages[p]) {
    for (const dir of [path.join(__dirname, 'public'), __dirname]) {
      try {
        return send(res, 200, fs.readFileSync(path.join(dir, pages[p]), 'utf8'), 'text/html; charset=utf-8');
      } catch {}
    }
    return send(res, 500, 'Datei ' + pages[p] + ' fehlt im Repo (Ordner public oder neben server.js).', 'text/plain; charset=utf-8');
  }

  // Alles, was Anzeige und Moderation brauchen: Beiträge (chronologisch), Einstellungen, Listen
  if (p === '/api/state' && req.method === 'GET') {
    return send(res, 200, { posts: S.posts.map(({ id, text }) => ({ id, text })), settings: S.settings, intros: S.intros, authors: S.authors });
  }
  if (p === '/api/posts' && req.method === 'GET') {
    return send(res, 200, S.posts.map(({ id, text }) => ({ id, text })));
  }

  if (p === '/api/posts' && req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < COOLDOWN_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    return readJson(req, d => {
      const v = validate(d.text);
      if (v.error) return send(res, 400, { error: v.error });
      if (S.posts.length >= MAX_POSTS) return send(res, 507, { error: 'Die Wand ist voll.' });
      lastPost.set(ip, now);
      S.posts.push({ id: crypto.randomBytes(6).toString('hex'), text: v.text, t: now });
      save();
      send(res, 201, { ok: true });
    });
  }

  const one = p.match(/^\/api\/posts\/([a-f0-9]+)$/);
  if (one && req.method === 'DELETE') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    S.posts = S.posts.filter(x => x.id !== one[1]);
    save();
    return send(res, 200, { ok: true });
  }
  if (one && req.method === 'PUT') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      const v = validate(d.text);
      if (v.error) return send(res, 400, { error: v.error });
      const post = S.posts.find(x => x.id === one[1]);
      if (!post) return send(res, 404, { error: 'Beitrag nicht gefunden.' });
      post.text = v.text;
      save();
      send(res, 200, { ok: true });
    });
  }

  if (p === '/api/settings' && req.method === 'PUT') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      S.settings = cleanSettings(d, S.settings);
      save();
      send(res, 200, { ok: true, settings: S.settings });
    });
  }

  // Intro-Zeilen und Verfasser*innen: Array = speichern, null = auf Standard zurücksetzen
  if (p === '/api/lists' && req.method === 'PUT') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      if (d.intros === null) S.intros = DEFAULT_INTROS.slice();
      else if (Array.isArray(d.intros)) S.intros = cleanList(d.intros, MAX_INTRO);
      if (d.authors === null) S.authors = DEFAULT_AUTHORS.slice();
      else if (Array.isArray(d.authors)) S.authors = cleanList(d.authors, MAX_AUTHOR);
      save();
      send(res, 200, { ok: true, intros: S.intros, authors: S.authors });
    }, 262144);
  }

  // Dauerhafte Sicherung: alles als Datei herunterladen / wieder einspielen
  if (p === '/api/backup' && req.method === 'GET') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    const day = new Date().toISOString().slice(0, 10);
    return send(res, 200, JSON.stringify({ app: 'partypost', saved: new Date().toISOString(), ...S }, null, 1),
      'application/json; charset=utf-8', { 'Content-Disposition': `attachment; filename="partypost-backup-${day}.json"` });
  }
  if (p === '/api/restore' && req.method === 'POST') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      if (!d || typeof d !== 'object' || !(Array.isArray(d) || Array.isArray(d.posts))) {
        return send(res, 400, { error: 'Das sieht nicht nach einem Partypost-Backup aus.' });
      }
      S = normalizeState(d);
      save();
      send(res, 200, { ok: true, posts: S.posts.length });
    }, 3000000);
  }

  send(res, 404, { error: 'Nicht gefunden.' });
}).listen(PORT, () => console.log('Partypost läuft auf Port ' + PORT));
