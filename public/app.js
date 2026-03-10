/* ===== Gomoku Online — Frontend App ===== */
(() => {
    'use strict';

    const SIZE = 15;
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');
    const authEl = document.getElementById('auth');
    const roomsEl = document.getElementById('rooms');
    const modeHintEl = document.getElementById('modeHint');
    const onlineAuthEl = document.getElementById('onlineAuth');
    const onlineRoomEl = document.getElementById('onlineRoom');
    const roomsWrapEl = document.getElementById('roomsWrap');
    const userEl = document.getElementById('user');
    const passEl = document.getElementById('pass');
    const roomEl = document.getElementById('room');

    const modeButtons = {
        solo: document.getElementById('modeSolo'),
        online: document.getElementById('modeOnline'),
        watch: document.getElementById('modeWatch'),
    };

    let mode = 'solo';
    let ws, side = 0, turn = 1, winner = 0, username = '';
    let board = emptyBoard();
    let reconnectTimer = null;
    let lastMove = null;      // {x, y, side}
    let winStones = null;     // [{x,y}, ...] — the winning 5

    // Star points for 15×15 board
    const STAR_POINTS = [[3, 3], [3, 7], [3, 11], [7, 3], [7, 7], [7, 11], [11, 3], [11, 7], [11, 11]];

    function emptyBoard() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    // ===== Board rendering =====
    function draw() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        canvas.width = w * dpr;
        canvas.height = w * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const pad = w * 0.055;
        const gap = (w - pad * 2) / (SIZE - 1);

        // Board background — warm wood gradient
        const bgGrad = ctx.createLinearGradient(0, 0, w, w);
        bgGrad.addColorStop(0, '#d4a85c');
        bgGrad.addColorStop(0.5, '#c89b4e');
        bgGrad.addColorStop(1, '#b8893e');
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        // Rounded rect
        const r = 10;
        ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, w - r); ctx.quadraticCurveTo(w, w, w - r, w);
        ctx.lineTo(r, w); ctx.quadraticCurveTo(0, w, 0, w - r);
        ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.fill();

        // Subtle wood grain lines
        ctx.save();
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 30; i++) {
            const yy = Math.random() * w;
            ctx.beginPath();
            ctx.moveTo(0, yy);
            ctx.bezierCurveTo(w * 0.3, yy + (Math.random() - 0.5) * 8,
                w * 0.7, yy + (Math.random() - 0.5) * 8, w, yy);
            ctx.strokeStyle = '#6b4c1e';
            ctx.lineWidth = Math.random() * 1.5 + 0.5;
            ctx.stroke();
        }
        ctx.restore();

        // Grid lines
        ctx.strokeStyle = 'rgba(60, 40, 15, 0.6)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < SIZE; i++) {
            const p = pad + i * gap;
            ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, w - pad); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(w - pad, p); ctx.stroke();
        }

        // Star points
        ctx.fillStyle = 'rgba(60, 40, 15, 0.7)';
        for (const [sx, sy] of STAR_POINTS) {
            ctx.beginPath();
            ctx.arc(pad + sx * gap, pad + sy * gap, gap * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Coordinate labels
        ctx.fillStyle = 'rgba(60, 40, 15, 0.45)';
        ctx.font = `${Math.max(9, gap * 0.3)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < SIZE; i++) {
            // Top labels (A-O)
            ctx.fillText(String.fromCharCode(65 + i), pad + i * gap, pad * 0.4);
            // Left labels (1-15)
            ctx.fillText((i + 1).toString(), pad * 0.35, pad + i * gap);
        }

        // Winning stones set for highlight
        const winSet = new Set();
        if (winStones) {
            for (const s of winStones) winSet.add(`${s.x},${s.y}`);
        }

        // Stones
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const v = board[y][x];
                if (!v) continue;
                const cx = pad + x * gap;
                const cy = pad + y * gap;
                const radius = gap * 0.4;
                const isWin = winSet.has(`${x},${y}`);
                const isLast = lastMove && lastMove.x === x && lastMove.y === y;

                // Shadow
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.35)';
                ctx.shadowBlur = gap * 0.15;
                ctx.shadowOffsetX = gap * 0.04;
                ctx.shadowOffsetY = gap * 0.06;

                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);

                if (v === 1) {
                    // Black stone with highlight
                    const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
                        cx, cy, radius);
                    grad.addColorStop(0, '#555');
                    grad.addColorStop(0.6, '#222');
                    grad.addColorStop(1, '#0a0a0a');
                    ctx.fillStyle = grad;
                } else {
                    // White stone with highlight
                    const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
                        cx, cy, radius);
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(0.6, '#eee8dd');
                    grad.addColorStop(1, '#d5cfc0');
                    ctx.fillStyle = grad;
                }
                ctx.fill();
                ctx.restore();

                // Stone border
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.strokeStyle = v === 1 ? 'rgba(0,0,0,0.4)' : 'rgba(100,90,70,0.3)';
                ctx.lineWidth = 0.5;
                ctx.stroke();

                // Last move indicator
                if (isLast && !winner) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
                    ctx.strokeStyle = v === 1 ? '#ff6b9d' : '#7c5cfc';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Win glow
                if (isWin) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = '#f0c040';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#f0c040';
                    ctx.shadowBlur = 12;
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        updateStatus();
    }

    function updateStatus() {
        let text;
        if (mode === 'solo') {
            if (winner) {
                text = `🏆 勝利：${winner === 1 ? '你（黑子）' : '電腦（白子）'}`;
                statusEl.classList.add('winner');
            } else {
                text = `單人模式 ｜ 輪到 ${turn === 1 ? '⚫ 你（黑子）' : '⚪ 電腦（白子）'}`;
                statusEl.classList.remove('winner');
            }
        } else {
            statusEl.classList.remove('winner');
            if (side) {
                text = `線上模式 ｜ 你是${side === 1 ? '⚫ 黑子' : '⚪ 白子'} ｜ 輪到 ${turn === 1 ? '⚫ 黑子' : '⚪ 白子'}`;
            } else {
                text = '👁️ 觀戰模式';
            }
            if (winner) {
                text = `🏆 勝利：${winner === 1 ? '⚫ 黑子' : '⚪ 白子'}`;
                statusEl.classList.add('winner');
            }
        }
        statusEl.textContent = text;
    }

    // ===== Win detection (for local game + finding win stones) =====
    function checkWin(x, y, s) {
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (const [dx, dy] of dirs) {
            const stones = [{ x, y }];
            for (const k of [1, -1]) {
                let nx = x + dx * k, ny = y + dy * k;
                while (AI.inBounds(nx, ny, SIZE) && board[ny][nx] === s) {
                    stones.push({ x: nx, y: ny }); nx += dx * k; ny += dy * k;
                }
            }
            if (stones.length >= 5) return stones;
        }
        return null;
    }

    function tryPlace(x, y, s) {
        if (!AI.inBounds(x, y, SIZE) || board[y][x] !== 0 || winner) return false;
        board[y][x] = s;
        lastMove = { x, y, side: s };
        const ws = checkWin(x, y, s);
        if (ws) { winner = s; winStones = ws; }
        turn = winner ? turn : (s === 1 ? 2 : 1);
        return true;
    }

    function doAiMove() {
        if (mode !== 'solo' || winner || turn !== 2) return;
        const diff = document.getElementById('aiDiff')?.value || 'medium';
        const move = AI.aiMove(board, SIZE, diff);
        if (move) {
            tryPlace(move.x, move.y, 2);
            draw();
        }
    }

    // ===== Mode management =====
    function resetLocal() {
        board = emptyBoard();
        turn = 1; winner = 0; side = 1;
        lastMove = null; winStones = null;
        draw();
    }

    function setMode(next) {
        mode = next;

        // Update button styles
        Object.entries(modeButtons).forEach(([key, btn]) => {
            btn.classList.toggle('active-mode', key === next);
            if (key !== next) btn.classList.add('secondary');
            else btn.classList.remove('secondary');
        });

        const hints = {
            solo: '（不需登入，直接下棋）',
            online: '（需登入才能下棋）',
            watch: '（不需登入，只看盤）',
        };
        modeHintEl.textContent = hints[mode];

        const showOnline = mode !== 'solo';
        onlineAuthEl.classList.toggle('hidden', mode !== 'online');
        onlineRoomEl.classList.toggle('hidden', !showOnline);
        roomsWrapEl.classList.toggle('hidden', !showOnline);

        // AI difficulty only visible in solo
        document.querySelector('.controls-right').classList.toggle('hidden', mode !== 'solo');

        if (mode === 'solo') {
            ws?.close();
            resetLocal();
        } else {
            side = 0; winner = 0; turn = 1;
            lastMove = null; winStones = null;
            connect();
            draw();
        }
    }

    // ===== WebSocket =====
    function connect() {
        if (mode === 'solo') return;
        ws?.close();
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}`);
        statusEl.textContent = '🔄 連線中...';

        ws.onopen = () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            statusEl.textContent = mode === 'watch'
                ? '✅ 已連線：觀戰模式（加入房間以觀戰）'
                : '✅ 已連線，請先登入';
            ws.send(JSON.stringify({ type: 'rooms' }));
        };

        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);

            if (msg.type === 'auth') {
                if (msg.ok) {
                    username = msg.username;
                    authEl.textContent = `✅ 已登入：${username}`;
                } else {
                    alert(msg.reason || '登入失敗');
                }
            }

            if (msg.type === 'joined') {
                side = msg.side;
                board = msg.board;
                turn = msg.turn;
                winner = msg.winner;
                lastMove = null;
                winStones = null;
                draw();
            }

            if (msg.type === 'state') {
                board = msg.board;
                turn = msg.turn;
                winner = msg.winner;
                if (msg.last) {
                    lastMove = msg.last;
                    if (winner) {
                        const ws2 = checkWin(msg.last.x, msg.last.y, msg.last.side);
                        if (ws2) winStones = ws2;
                    }
                }
                draw();
            }

            if (msg.type === 'rooms') {
                roomsEl.innerHTML = '';
                (msg.rooms || []).forEach(r => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${r.roomId}</strong> — 👥 ${r.players} 玩家 ｜ 👁️ ${r.watcher} 觀戰`;
                    li.onclick = () => { roomEl.value = r.roomId; };
                    roomsEl.appendChild(li);
                });
            }

            if (msg.type === 'presence') {
                // Could update a player list in the future
            }

            if (msg.type === 'error') {
                alert(msg.message);
            }
        };

        ws.onerror = () => {
            statusEl.textContent = '❌ WebSocket 連線錯誤';
        };

        ws.onclose = () => {
            statusEl.textContent = '🔄 連線中斷，2 秒後重連...';
            reconnectTimer = setTimeout(connect, 2000);
        };
    }

    function canSend() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    // ===== Event listeners =====
    modeButtons.solo.onclick = () => setMode('solo');
    modeButtons.online.onclick = () => setMode('online');
    modeButtons.watch.onclick = () => setMode('watch');

    document.getElementById('register').onclick = () => {
        if (!canSend()) return alert('連線尚未建立，請稍後再試');
        ws.send(JSON.stringify({ type: 'register', username: userEl.value.trim(), password: passEl.value }));
    };
    document.getElementById('login').onclick = () => {
        if (!canSend()) return alert('連線尚未建立，請稍後再試');
        ws.send(JSON.stringify({ type: 'login', username: userEl.value.trim(), password: passEl.value }));
    };
    document.getElementById('join').onclick = () => {
        if (mode === 'solo') return;
        if (!canSend()) return alert('連線尚未建立，請稍後再試');
        ws.send(JSON.stringify({ type: 'join', roomId: roomEl.value.trim() || 'demo-room' }));
    };
    document.getElementById('refreshRooms').onclick = () => canSend() && ws.send(JSON.stringify({ type: 'rooms' }));
    document.getElementById('reset').onclick = () => {
        if (mode === 'solo') { resetLocal(); return; }
        canSend() && ws.send(JSON.stringify({ type: 'reset' }));
    };

    // Board click
    canvas.addEventListener('click', (e) => {
        if (mode === 'solo') {
            if (winner || turn !== 1) return;
        } else {
            if (!ws || ws.readyState !== 1 || !side || winner || turn !== side) return;
        }

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width;
        const pad = w * 0.055;
        const gap = (w - pad * 2) / (SIZE - 1);

        const x0 = e.clientX - rect.left;
        const y0 = e.clientY - rect.top;
        const x = Math.round((x0 - pad) / gap);
        const y = Math.round((y0 - pad) / gap);

        if (mode === 'solo') {
            if (tryPlace(x, y, 1)) {
                draw();
                if (!winner) setTimeout(doAiMove, 150);
            }
            return;
        }
        ws.send(JSON.stringify({ type: 'move', x, y }));
    });

    // Handle window resize for responsive canvas
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(draw, 100);
    });

    // Init
    setMode('solo');
    draw();
})();
