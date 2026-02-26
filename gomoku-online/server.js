import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
app.use(express.static('public'));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const SIZE = 15;
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

const rooms = new Map();

function roomState(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      board: emptyBoard(),
      turn: 1,
      winner: 0,
      players: new Map(),
    });
  }
  return rooms.get(roomId);
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
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  return dirs.some(([dx,dy]) => {
    const n = 1 + countDir(board, x, y, dx, dy, side) + countDir(board, x, y, -dx, -dy, side);
    return n >= 5;
  });
}

function send(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function broadcast(state, payload) {
  for (const ws of state.players.keys()) {
    if (ws.readyState === 1) send(ws, payload);
  }
}

wss.on('connection', (ws) => {
  let joined = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      const roomId = (msg.roomId || 'default').slice(0, 32);
      const state = roomState(roomId);
      let side = 0;
      const taken = new Set(state.players.values());
      if (!taken.has(1)) side = 1;
      else if (!taken.has(2)) side = 2;

      joined = { roomId, side };
      state.players.set(ws, side);

      send(ws, { type: 'joined', roomId, side, board: state.board, turn: state.turn, winner: state.winner });
      broadcast(state, { type: 'presence', players: [...state.players.values()].filter(Boolean).length });
      return;
    }

    if (!joined) return;

    const state = roomState(joined.roomId);

    if (msg.type === 'move') {
      const { x, y } = msg;
      if (state.winner || joined.side === 0 || state.turn !== joined.side) return;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      if (state.board[y][x] !== 0) return;

      state.board[y][x] = joined.side;
      if (isWin(state.board, x, y, joined.side)) {
        state.winner = joined.side;
      } else {
        state.turn = joined.side === 1 ? 2 : 1;
      }

      broadcast(state, { type: 'state', board: state.board, turn: state.turn, winner: state.winner, last: { x, y, side: joined.side } });
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
    if (!joined) return;
    const state = roomState(joined.roomId);
    state.players.delete(ws);
    broadcast(state, { type: 'presence', players: [...state.players.values()].filter(Boolean).length });
  });
});

const PORT = process.env.PORT || 3789;
server.listen(PORT, () => {
  console.log(`Gomoku server on http://localhost:${PORT}`);
});
