import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(express.static('public'));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const SIZE = 15;
const HEARTBEAT_INTERVAL_MS = 30000;
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

const rooms = new Map();
const usersFile = path.resolve('users.json');
const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, 'utf-8')) : {};

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function hash(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function roomState(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      board: emptyBoard(),
      turn: 1,
      winner: 0,
      players: new Map(), // ws -> { side, username }
    });
  }
  return rooms.get(roomId);
}

function roomList() {
  return [...rooms.entries()].map(([roomId, st]) => ({
    roomId,
    players: [...st.players.values()].filter((p) => p.side).length,
    watcher: [...st.players.values()].filter((p) => !p.side).length,
  }));
}

function countDir(board, x, y, dx, dy, side) {
  let c = 0;
  let nx = x + dx;
  let ny = y + dy;
  while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === side) {
    c += 1;
    nx += dx;
    ny += dy;
  }
  return c;
}

function isWin(board, x, y, side) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  return dirs.some(([dx, dy]) => 1 + countDir(board, x, y, dx, dy, side) + countDir(board, x, y, -dx, -dy, side) >= 5);
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(state, payload) {
  for (const ws of state.players.keys()) {
    send(ws, payload);
  }
}

function broadcastRooms() {
  const payload = { type: 'rooms', rooms: roomList() };
  for (const client of wss.clients) {
    send(client, payload);
  }
}

function cleanupRoom(roomId) {
  const state = rooms.get(roomId);
  if (!state) return;
  if (state.players.size === 0) {
    rooms.delete(roomId);
  }
}

function cleanupConnection(ws) {
  const joined = ws.joined;
  if (!joined) return;

  const state = rooms.get(joined.roomId);
  ws.joined = null;
  if (!state) return;

  state.players.delete(ws);
  broadcast(state, { type: 'presence', players: [...state.players.values()] });
  cleanupRoom(joined.roomId);
  broadcastRooms();
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.auth = { username: null };
  ws.joined = null;

  send(ws, { type: 'rooms', rooms: roomList() });

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    ws.isAlive = true;

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'register') {
      const username = (msg.username || '').trim();
      const password = msg.password || '';
      if (!username || password.length < 4) return send(ws, { type: 'auth', ok: false, reason: '?????????' });
      if (users[username]) return send(ws, { type: 'auth', ok: false, reason: '?????' });
      users[username] = { passwordHash: hash(password), createdAt: Date.now() };
      saveUsers();
      ws.auth.username = username;
      return send(ws, { type: 'auth', ok: true, username });
    }

    if (msg.type === 'login') {
      const username = (msg.username || '').trim();
      const password = msg.password || '';
      if (!users[username] || users[username].passwordHash !== hash(password)) {
        return send(ws, { type: 'auth', ok: false, reason: '????' });
      }
      ws.auth.username = username;
      return send(ws, { type: 'auth', ok: true, username });
    }

    if (msg.type === 'rooms') {
      return send(ws, { type: 'rooms', rooms: roomList() });
    }

    if (msg.type === 'join') {
      if (!ws.auth.username) return send(ws, { type: 'error', message: '????' });
      const roomId = (msg.roomId || 'default').slice(0, 32);

      if (ws.joined && ws.joined.roomId !== roomId) {
        cleanupConnection(ws);
      }

      const state = roomState(roomId);
      let side = 0;
      const taken = new Set([...state.players.values()].map((v) => v.side));
      if (!taken.has(1)) side = 1;
      else if (!taken.has(2)) side = 2;

      ws.joined = { roomId, side };
      state.players.set(ws, { side, username: ws.auth.username });

      send(ws, {
        type: 'joined', roomId, side, username: ws.auth.username,
        board: state.board, turn: state.turn, winner: state.winner,
      });
      broadcast(state, { type: 'presence', players: [...state.players.values()] });
      broadcastRooms();
      return;
    }

    if (!ws.joined) return;
    const state = roomState(ws.joined.roomId);
    const me = state.players.get(ws);

    if (msg.type === 'move') {
      const { x, y } = msg;
      if (state.winner || !me?.side || state.turn !== me.side) return;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      if (state.board[y][x] !== 0) return;

      state.board[y][x] = me.side;
      if (isWin(state.board, x, y, me.side)) state.winner = me.side;
      else state.turn = me.side === 1 ? 2 : 1;

      broadcast(state, {
        type: 'state', board: state.board, turn: state.turn, winner: state.winner,
        last: { x, y, side: me.side, username: me.username },
      });
      return;
    }

    if (msg.type === 'reset') {
      state.board = emptyBoard();
      state.turn = 1;
      state.winner = 0;
      broadcast(state, { type: 'state', board: state.board, turn: state.turn, winner: state.winner });
    }
  });

  ws.on('close', () => {
    cleanupConnection(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    cleanupConnection(ws);
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      cleanupConnection(ws);
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(heartbeat);
});

const PORT = process.env.PORT || 3789;
server.listen(PORT, () => {
  console.log(`Gomoku server on http://localhost:${PORT}`);
});
