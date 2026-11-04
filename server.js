// Partypost – minimaler Server ohne Abhängigkeiten (nur Node >= 18)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const MAX_LEN = 140;        // maximale Zeichenzahl pro Beitrag
const MAX_POSTS = 1000;     // Obergrenze insgesamt
const COOLDOWN_MS = 4000;   // Mindestabstand pro Gerät/IP

let posts = [];
try { posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { posts = []; }
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(posts)); } catch (e) { console.error(e.message); } }

const lastPost = new Map();
const pages = { '/': 'index.html', '/show': 'show.html', '/admin': 'admin.html' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function isAdmin(url) { return ADMIN_KEY && url.searchParams.get('key') === ADMIN_KEY; }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'GET' && pages[p]) {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', pages[p]), 'utf8'), 'text/html; charset=utf-8');
  }

  if (p === '/api/posts' && req.method === 'GET') {
    return send(res, 200, posts.map(({ id, text }) => ({ id, text })));
  }

  if (p === '/api/posts' && req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < COOLDOWN_MS) return send(res, 429, { error: 'Kurz warten, dann nochmal.' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => {
      let text = '';
      try { text = String(JSON.parse(raw).text || ''); } catch {}
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) return send(res, 400, { error: 'Der Beitrag ist leer.' });
      if ([...text].length > MAX_LEN) return send(res, 400, { error: `Maximal ${MAX_LEN} Zeichen.` });
      if (posts.length >= MAX_POSTS) return send(res, 507, { error: 'Die Wand ist voll.' });
      lastPost.set(ip, now);
      posts.push({ id: crypto.randomBytes(6).toString('hex'), text, t: now });
      save();
      send(res, 201, { ok: true });
    });
    return;
  }

  const del = p.match(/^\/api\/posts\/([a-f0-9]+)$/);
  if (del && req.method === 'DELETE') {
    if (!isAdmin(url)) return send(res, 403, { error: 'Kein Zugriff.' });
    posts = posts.filter(x => x.id !== del[1]);
    save();
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Nicht gefunden.' });
}).listen(PORT, () => console.log('Partypost läuft auf Port ' + PORT));
