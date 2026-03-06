#!/usr/bin/env node
/*
 * lan_server.js
 * Split Seconds LAN relay + static file server.
 *
 * Usage:
 *   node lan_server.js
 *
 * Defaults:
 *   Port: 8787 (override with PORT env var)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;

const rooms = new Map();
const MAX_EVENTS_PER_ROOM = 1200;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function now() {
  return Date.now();
}

function randomToken(len = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeRoomCode(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return '';
  if (s.length < 4) return '';
  return s.slice(0, 8);
}

function createRoom(roomCode) {
  const code = normalizeRoomCode(roomCode) || randomToken(6).toUpperCase();
  if (rooms.has(code)) return null;

  const hostToken = randomToken(32);
  const room = {
    roomCode: code,
    hostToken,
    guestToken: null,
    nextEventId: 1,
    events: [],
    createdAt: now(),
    updatedAt: now(),
    meta: {
      hostConnected: true,
      guestConnected: false
    }
  };

  rooms.set(code, room);
  pushEvent(room, 'server', 'room_created', { roomCode: code });
  return room;
}

function getRoom(roomCode) {
  const code = normalizeRoomCode(roomCode);
  if (!code) return null;
  return rooms.get(code) || null;
}

function getRoleForToken(room, token) {
  if (!room || !token) return null;
  if (token === room.hostToken) return 'host';
  if (token === room.guestToken) return 'guest';
  return null;
}

function pushEvent(room, from, type, payload) {
  const evt = {
    id: room.nextEventId++,
    from,
    type,
    payload: payload || {},
    ts: now()
  };
  room.events.push(evt);
  if (room.events.length > MAX_EVENTS_PER_ROOM) {
    room.events.splice(0, room.events.length - MAX_EVENTS_PER_ROOM);
  }
  room.updatedAt = now();
  return evt;
}

function pruneRooms() {
  const t = now();
  for (const [code, room] of rooms.entries()) {
    if (t - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function sendError(res, code, message) {
  sendJson(res, code, { ok: false, error: message });
}

async function handleApi(req, res, urlObj) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/room/host') {
    const body = await readJsonBody(req);
    const requested = normalizeRoomCode(body.roomCode);

    const room = requested ? createRoom(requested) : createRoom();
    if (!room) return sendError(res, 409, 'Room code already exists.');

    return sendJson(res, 200, {
      ok: true,
      roomCode: room.roomCode,
      role: 'host',
      token: room.hostToken
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/room/join') {
    const body = await readJsonBody(req);
    const room = getRoom(body.roomCode);
    if (!room) return sendError(res, 404, 'Room not found.');
    if (room.guestToken) return sendError(res, 409, 'Room already has a guest.');

    room.guestToken = randomToken(32);
    room.meta.guestConnected = true;
    room.updatedAt = now();
    pushEvent(room, 'server', 'guest_joined', { roomCode: room.roomCode });

    return sendJson(res, 200, {
      ok: true,
      roomCode: room.roomCode,
      role: 'guest',
      token: room.guestToken
    });
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/room/send') {
    const body = await readJsonBody(req);
    const room = getRoom(body.roomCode);
    if (!room) return sendError(res, 404, 'Room not found.');

    const role = getRoleForToken(room, String(body.token || ''));
    if (!role) return sendError(res, 401, 'Invalid token.');

    const type = String(body.type || '').trim();
    if (!type) return sendError(res, 400, 'Missing event type.');

    const evt = pushEvent(room, role, type, body.payload || {});
    return sendJson(res, 200, { ok: true, eventId: evt.id });
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/room/poll') {
    const room = getRoom(urlObj.searchParams.get('roomCode'));
    if (!room) return sendError(res, 404, 'Room not found.');

    const token = String(urlObj.searchParams.get('token') || '');
    const role = getRoleForToken(room, token);
    if (!role) return sendError(res, 401, 'Invalid token.');

    const since = Number(urlObj.searchParams.get('since') || 0);
    const events = room.events.filter((e) => e.id > since && e.from !== role);

    return sendJson(res, 200, {
      ok: true,
      roomCode: room.roomCode,
      role,
      latestEventId: room.events.length ? room.events[room.events.length - 1].id : since,
      events
    });
  }

  return sendError(res, 404, 'API route not found.');
}

function serveStatic(req, res, urlObj) {
  let relPath = decodeURIComponent(urlObj.pathname || '/');
  if (relPath === '/') relPath = '/index.html';

  const unsafePath = path.join(ROOT, relPath);
  const filePath = path.resolve(unsafePath);
  if (!filePath.startsWith(path.resolve(ROOT))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Read error');
    });
  });
}

function getLanIps() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const n of ifs[name] || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  pruneRooms();

  let urlObj;
  try {
    urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad URL');
    return;
  }

  try {
    if (urlObj.pathname.startsWith('/api/')) {
      await handleApi(req, res, urlObj);
      return;
    }
    serveStatic(req, res, urlObj);
  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ ok: false, error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  const ips = getLanIps();
  console.log(`Split Seconds LAN server running on port ${PORT}`);
  console.log(`Local:   http://localhost:${PORT}`);
  for (const ip of ips) {
    console.log(`LAN:     http://${ip}:${PORT}`);
  }
  console.log('Share one LAN URL above with the second device.');
});
