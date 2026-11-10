import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { meals, filterMeals, unanimousMatch } from './meals.js';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const data = process.env.DATA_DIR || '.data';
mkdirSync(data, { recursive: true });
const db = new DatabaseSync(resolve(data, 'eatwhat.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)');
const get = db.prepare('SELECT data FROM rooms WHERE code = ?');
const save = db.prepare('INSERT OR REPLACE INTO rooms VALUES (?, ?, ?)');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function store(room) { save.run(room.code, JSON.stringify(room), Date.now()); }
function publicRoom(room, session) {
  const me = room.members.find(m => m.id === session);
  if (!me) fail(403, 'Join this room to see what’s cooking.');
  const done = m => room.mealIds.every(id => typeof m.votes[id] === 'boolean');
  const winner = room.phase === 'result' ? unanimousMatch(room) : null;
  return { code: room.code, phase: room.phase, filters: room.filters, expected: room.expected,
    members: room.members.map(m => ({ name: m.name, host: m.id === room.host, ready: m.ready, done: room.phase !== 'lobby' && done(m), me: m.id === session })),
    isHost: room.host === session, ready: me.ready, votedIds: Object.keys(me.votes),
    meals: meals.filter(m => room.mealIds.includes(m.id)), winner: meals.find(m => m.id === winner) || null };
}
function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) fail(400, 'Enter your name (1–24 characters).');
  return name.trim();
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 8192) fail(413, 'That request is too large.'); }
  try { return JSON.parse(text || '{}'); } catch { fail(400, 'Please send a valid request.'); }
}
export const server = createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) fail(403, 'Please use this app to make changes.');
      let session = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('eatwhat='))?.slice(8);
      if (!session || !/^[a-f0-9-]{36}$/.test(session)) {
        session = randomUUID();
        res.setHeader('Set-Cookie', `eatwhat=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
      }
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        const input = await body(req);
        const name = validateName(input.name);
        const { expected, budget, distance, cuisine = 'Any', vegetarian = false } = input;
        if (!Number.isInteger(expected) || expected < 2 || expected > 10) fail(400, 'Choose 2–10 people.');
        if (![15, 20, 25, 35, 50].includes(budget) || ![1, 3, 5, 10].includes(distance) || !['Any', 'Indian', 'Italian', 'Asian', 'American'].includes(cuisine) || typeof vegetarian !== 'boolean') fail(400, 'Choose valid meal filters.');
        let code;
        do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (get.get(code));
        const filters = { budget, distance, cuisine, vegetarian };
        const room = { code, host: session, phase: 'lobby', filters, expected, mealIds: filterMeals(filters).map(m => m.id), members: [{ id: session, name, ready: false, votes: {} }] };
        store(room); return send(201, publicRoom(room, session));
      }
      const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|ready|start|vote|restart))?$/);
      if (!match) fail(404, 'Room not found. Check the six-character code and try again.');
      const row = get.get(match[1]);
      if (!row) fail(404, 'Room not found. Check the six-character code and try again.');
      const room = JSON.parse(row.data), action = match[2];
      if (!action && req.method === 'GET') return send(200, publicRoom(room, session));
      if (req.method !== 'POST') fail(405, 'This action needs a POST request.');
      const input = await body(req);
      let me = room.members.find(m => m.id === session);
      if (action === 'join') {
        if (!me) {
          if (room.phase !== 'lobby') fail(409, 'Voting has already started in this room.');
          if (room.members.length >= room.expected) fail(409, 'This room is full. Ask the host to create a new room.');
          me = { id: session, name: validateName(input.name), ready: false, votes: {} }; room.members.push(me);
        }
      } else {
        if (!me) fail(403, 'Join this room first.');
        if (action === 'ready') {
          if (room.phase !== 'lobby' || typeof input.ready !== 'boolean') fail(409, 'Readiness can only change in the lobby.');
          me.ready = input.ready;
        } else if (action === 'start') {
          if (session !== room.host) fail(403, 'Only the host can start voting.');
          if (room.phase !== 'lobby' || room.members.length !== room.expected || !room.members.every(m => m.ready)) fail(409, 'Wait until everyone has joined and is ready.');
          room.phase = room.mealIds.length ? 'voting' : 'empty';
        } else if (action === 'vote') {
          if (room.phase !== 'voting' || !room.mealIds.includes(input.mealId) || typeof input.yes !== 'boolean') fail(409, 'That meal is not available for voting.');
          if (typeof me.votes[input.mealId] === 'boolean') fail(409, 'Your vote for this meal is already saved.');
          me.votes[input.mealId] = input.yes;
          if (room.members.every(m => room.mealIds.every(id => typeof m.votes[id] === 'boolean'))) room.phase = 'result';
        } else if (action === 'restart') {
          if (session !== room.host) fail(403, 'Only the host can open the lobby again.');
          if (!['result', 'empty'].includes(room.phase)) fail(409, 'Finish this round first.');
          room.phase = 'lobby'; room.members.forEach(m => { m.ready = false; m.votes = {}; });
        } else fail(404, 'Action not found.');
      }
      store(room); return send(200, publicRoom(room, session));
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed.');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root)) fail(404, 'Not found.');
    let content;
    try { content = readFileSync(path); } catch { fail(404, 'Not found.'); }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (e) { if (!e.status) console.error(e); send(e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' }); }
});
if (process.env.NODE_ENV !== 'test') server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`EATWHAT running on port ${process.env.PORT || 3000}`));
