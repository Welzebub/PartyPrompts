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
const COOLDOWN_MS = 4000;   // Mindestabstand pro Gerät/IP (Beiträge)
const COOLDOWN_ENTRY_MS = 3000;  // Mindestabstand pro Gerät/IP (Einträge und Kommentare)
const MAX_USER_COMMENT = 100;    // Zeichen pro Gästekommentar
const MAX_USER_COMMENTS = 10;    // Gästekommentare pro Beitrag
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
const DEFAULT_USERNAMES = [
  'flyingbird33', 'xXSlayer3000Xx', 'BikerBernd', 'Gemüsehans88', 'kaffeekanne_42', 'Sabine_aus_Essen', 'DerEchteKevin',
  'pizzafan1999', 'NinjaOpa', 'wolke7_official', 'TrottelTom', 'SchnitzelKönig', 'Mettigel2000', 'lilaLaunebär',
  'xX_Dark_Dieter_Xx', 'FrauMüller_73', 'Bratwurst_Basti', 'xxMondscheinxx', 'Hobbit_Holger', 'RentnerRalf', 'GamerGisela',
  'Katzenpapa', 'der_dude_von_nebenan', 'Schnuffel_2005', 'OmaGertrud_offiziell', 'Toastbrot_Tobi', 'lecker_Lasagne',
  'NachtschichtNorbert', 'krasserKevin_99', 'bernd_das_brot_fan', 'Teppichklopfer', 'hans.dampf.123', 'Glitzerpony',
  'Stuhlkreis_Steffi', 'WLAN_Walter', 'Pfandflaschen_Paul', 'Chantal_ohne_Filter', 'Zahnarzt_Zoran', 'UserNichtGefunden404',
  'ichBinEinFisch', 'anonym_aber_laut', 'Sockenmonster', 'Müsli_Maus', 'FahrradFrank', 'Teilzeit_Tobi', 'Tante_Erna_1951',
  'Pommes_Peter', 'BasisdemokratieBernd', 'NixPlan_Nina', 'xX_NoScope_Nils_Xx', 'BrotBaron', 'Dr_Hasenfuß'
];
const DEFAULT_COMMENTS = [
  'WAAAS?', 'wusst ichs doch!!1', 'heutzutage darf man echt nichts mehr sagen', 'Fake News', 'Lügenpresse',
  'klick auf mein Profil und guck dir meine privaten Fotos an <3', 'endlich sagt es mal jemand',
  'schon wieder so nen linksversiffter blödsinn', 'früher hätts das nicht gegeben', 'wurd auch langsam mal Zeit',
  'Die da oben schon wieder', 'fffffsssdsdsd',
  'Das ist doch alles gesteuert', 'Hab ich schon vor Jahren gesagt', 'Quelle?', 'Teilen, bevor es gelöscht wird!!!',
  'Mein Onkel sagt das schon seit Jahren', 'Ich glaub nur, was ich selbst gegoogelt habe', 'lol',
  'Bielefeld gibts nicht, das passt ins Bild', 'Das haben die Echsen so gewollt', 'Ist das jetzt Satire?', 'Ich bin raus.',
  'Erster!', 'Kenn ich schon aus Telegram', 'Danke für nichts', 'Früher war mehr Lametta', 'Mein Kater hat das schon immer gesagt',
  'unfassbar', 'Quatsch mit Soße', 'ok boomer', '+1', 'Boah ey', 'Link? Sonst Fake.', 'Das glaubt ihr doch selber nicht',
  'Wer das glaubt, wird selig', 'Und wer bezahlt das alles?!', 'Ich verstehe nur Bahnhof', 'Teilen!!!1elf',
  'Jaja, die Mondlandung war auch gefälscht', 'Alles nur Ablenkung vom Wesentlichen', 'Und dafür zahle ich Steuern?!',
  'Alu-Hut sitzt ✔', 'Ich sag nur: Chemtrails.', 'Das wusste schon meine Oma', 'Hä?',
  'Mir egal, ich bin nur wegen dem Buffet hier', 'Das ist ja wohl der Gipfel', 'Bitte löschen, mein Chef liest mit',
  'nicht schon wieder', 'Das Orakel hat es kommen sehen', 'Ich hab\'s geahnt', 'Das sind doch Fakten!!!', 'Mimimi',
  'Das ist alles Propaganda!', 'Reptiloiden-Alarm', 'Ist das in der Bibel?'
];
const DEFAULT_SETTINGS = { ticker: true, intros: true, authors: true, reactions: true, autoSwitch: false, switchMinutes: 3 };
// Alle bearbeitbaren Textlisten: Schlüssel -> max. Zeichen pro Eintrag, Standardwerte
const LISTS = {
  intros:      { max: MAX_INTRO,  def: DEFAULT_INTROS },
  authors:     { max: MAX_AUTHOR, def: DEFAULT_AUTHORS },
  usernames:   { max: 60,         def: DEFAULT_USERNAMES },
  commentPool: { max: 120,        def: DEFAULT_COMMENTS }
};
// Was Gäste auf /extras hinzufügen dürfen: Typ -> Liste, max. Zeichen
const GUEST_ENTRY = {
  author:   { key: 'authors',     max: 40 },
  username: { key: 'usernames',   max: 30 },
  intro:    { key: 'intros',      max: 100 },
  comment:  { key: 'commentPool', max: 100 }
};

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
  return { ticker: b('ticker'), intros: b('intros'), authors: b('authors'), reactions: b('reactions'), autoSwitch: b('autoSwitch'),
           switchMinutes: m >= 1 && m <= 60 ? m : base.switchMinutes };
}
function validate(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: 'Der Beitrag ist leer.' };
  if ([...text].length > MAX_LEN) return { error: `Maximal ${MAX_LEN} Zeichen.` };
  return { text };
}
function validateShort(raw, max) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: 'Bitte etwas eingeben.' };
  if ([...text].length > max) return { error: `Maximal ${max} Zeichen.` };
  return { text };
}
function newId() { return crypto.randomBytes(6).toString('hex'); }
function normalizeState(d) {
  if (Array.isArray(d)) d = { posts: d };   // altes Format: nur eine Liste von Beiträgen
  d = d && typeof d === 'object' ? d : {};
  const ids = new Set(), posts = [];
  for (const x of Array.isArray(d.posts) ? d.posts : []) {
    const v = validate(x && x.text);
    if (v.error) continue;
    let id = String(x.id || '');
    if (!/^[a-f0-9]{4,32}$/.test(id) || ids.has(id)) id = newId();
    ids.add(id);
    const cids = new Set(), comments = [];
    for (const c of Array.isArray(x.comments) ? x.comments : []) {
      const text = clean1(c && c.text, MAX_USER_COMMENT);
      if (!text) continue;
      let cid = String(c.id || '');
      if (!/^[a-f0-9]{4,32}$/.test(cid) || cids.has(cid)) cid = newId();
      cids.add(cid);
      comments.push({ id: cid, text, t: Number(c.t) || Date.now() });
      if (comments.length >= MAX_USER_COMMENTS) break;
    }
    posts.push({ id, text: v.text, t: Number(x.t) || Date.now(), comments });
    if (posts.length >= MAX_POSTS) break;
  }
  const out = { posts, settings: cleanSettings(d.settings) };
  for (const k of Object.keys(LISTS)) out[k] = cleanList(d[k], LISTS[k].max) || LISTS[k].def.slice();
  return out;
}

function load() {
  for (const f of [DATA_FILE, SEED_FILE]) {
    try { return normalizeState(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch {}
  }
  return normalizeState({});
}
let S = load();
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(S)); } catch (e) { console.error(e.message); } }

const lastPost = new Map(), lastEntry = new Map();
function clientIp(req) { return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
const pages = { '/': 'index.html', '/show': 'show.html', '/admin': 'admin.html', '/extras': 'extras.html' };

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
    return send(res, 200, {
      posts: S.posts.map(({ id, text, comments }) => ({ id, text, comments: comments.map(c => ({ id: c.id, text: c.text })) })),
      settings: S.settings, intros: S.intros, authors: S.authors, usernames: S.usernames, commentPool: S.commentPool
    });
  }
  if (p === '/api/posts' && req.method === 'GET') {
    return send(res, 200, S.posts.map(({ id, text }) => ({ id, text })));
  }

  if (p === '/api/posts' && req.method === 'POST') {
    const ip = clientIp(req);
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < COOLDOWN_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    return readJson(req, d => {
      const v = validate(d.text);
      if (v.error) return send(res, 400, { error: v.error });
      if (S.posts.length >= MAX_POSTS) return send(res, 507, { error: 'Die Wand ist voll.' });
      lastPost.set(ip, now);
      S.posts.push({ id: newId(), text: v.text, t: now, comments: [] });
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

  // Textlisten (Header, Verfasser*innen, Usernamen, Kommentar-Pool): Array = speichern, null = Standard
  if (p === '/api/lists' && req.method === 'PUT') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      for (const k of Object.keys(LISTS)) {
        if (d[k] === null) S[k] = LISTS[k].def.slice();
        else if (Array.isArray(d[k])) S[k] = cleanList(d[k], LISTS[k].max);
      }
      save();
      const out = { ok: true };
      for (const k of Object.keys(LISTS)) out[k] = S[k];
      send(res, 200, out);
    }, 524288);
  }

  // Gäste: neuen Eintrag in eine Liste (Verfasser*in, Username, Header, Zufalls-Kommentar)
  if (p === '/api/entries' && req.method === 'POST') {
    const ip = clientIp(req), now = Date.now();
    if (now - (lastEntry.get(ip) || 0) < COOLDOWN_ENTRY_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    return readJson(req, d => {
      if (!Object.prototype.hasOwnProperty.call(GUEST_ENTRY, d.type)) return send(res, 400, { error: 'Unbekannte Art von Eintrag.' });
      const spec = GUEST_ENTRY[d.type];
      const v = validateShort(d.text, spec.max);
      if (v.error) return send(res, 400, { error: v.error });
      const list = S[spec.key];
      if (list.some(x => x.toLowerCase() === v.text.toLowerCase())) return send(res, 409, { error: 'Das gibt es schon.' });
      if (list.length >= MAX_LIST) return send(res, 507, { error: 'Die Liste ist voll.' });
      lastEntry.set(ip, now);
      list.push(v.text);
      save();
      send(res, 201, { ok: true });
    });
  }

  // Gästekommentar zu einem bestimmten Beitrag
  const cm = p.match(/^\/api\/posts\/([a-f0-9]+)\/comments$/);
  if (cm && req.method === 'POST') {
    const ip = clientIp(req), now = Date.now();
    if (now - (lastEntry.get(ip) || 0) < COOLDOWN_ENTRY_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    return readJson(req, d => {
      const v = validateShort(d.text, MAX_USER_COMMENT);
      if (v.error) return send(res, 400, { error: v.error });
      const post = S.posts.find(x => x.id === cm[1]);
      if (!post) return send(res, 404, { error: 'Beitrag nicht gefunden.' });
      if (post.comments.length >= MAX_USER_COMMENTS) return send(res, 507, { error: 'Hier sind schon genug Kommentare.' });
      lastEntry.set(ip, now);
      post.comments.push({ id: newId(), text: v.text, t: now });
      save();
      send(res, 201, { ok: true });
    });
  }
  const cd = p.match(/^\/api\/posts\/([a-f0-9]+)\/comments\/([a-f0-9]+)$/);
  if (cd && req.method === 'DELETE') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    const post = S.posts.find(x => x.id === cd[1]);
    if (post) { post.comments = post.comments.filter(c => c.id !== cd[2]); save(); }
    return send(res, 200, { ok: true });
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
