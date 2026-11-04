// Partypost – minimaler Server ohne Abhängigkeiten (nur Node >= 18)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_LEN = 280;        // maximale Zeichenzahl pro Beitrag
const MAX_POSTS = 1000;     // Obergrenze insgesamt
const COOLDOWN_MS = 4000;   // Mindestabstand pro Gerät/IP
const BOOT = crypto.randomBytes(4).toString('hex'); // ändert sich bei jedem Serverstart

let posts = [];
try { posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { posts = []; }
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(posts)); } catch (e) { console.error(e.message); } }

const lastPost = new Map();
const pages = { '/': 'index.html', '/show': 'show.html', '/admin': 'admin.html' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Boot': BOOT });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function isAdmin(url) { return ADMIN_KEY && url.searchParams.get('key') === ADMIN_KEY; }

function validate(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: 'Der Beitrag ist leer.' };
  if ([...text].length > MAX_LEN) return { error: `Maximal ${MAX_LEN} Zeichen.` };
  return { text };
}
function readJson(req, cb) {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
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

  // Beiträge in chronologischer Reihenfolge (älteste zuerst)
  if (p === '/api/posts' && req.method === 'GET') {
    return send(res, 200, posts.map(({ id, text }) => ({ id, text })));
  }

  if (p === '/api/posts' && req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < COOLDOWN_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    return readJson(req, d => {
      const v = validate(d.text);
      if (v.error) return send(res, 400, { error: v.error });
      if (posts.length >= MAX_POSTS) return send(res, 507, { error: 'Die Wand ist voll.' });
      lastPost.set(ip, now);
      posts.push({ id: crypto.randomBytes(6).toString('hex'), text: v.text, t: now });
      save();
      send(res, 201, { ok: true });
    });
  }

  const one = p.match(/^\/api\/posts\/([a-f0-9]+)$/);
  if (one && req.method === 'DELETE') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    posts = posts.filter(x => x.id !== one[1]);
    save();
    return send(res, 200, { ok: true });
  }
  if (one && req.method === 'PUT') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    return readJson(req, d => {
      const v = validate(d.text);
      if (v.error) return send(res, 400, { error: v.error });
      const post = posts.find(x => x.id === one[1]);
      if (!post) return send(res, 404, { error: 'Beitrag nicht gefunden.' });
      post.text = v.text;
      save();
      send(res, 200, { ok: true });
    });
  }

  send(res, 404, { error: 'Nicht gefunden.' });
}).listen(PORT, () => console.log('Partypost läuft auf Port ' + PORT));
