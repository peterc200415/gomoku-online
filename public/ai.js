/* ===== Gomoku AI Engine ===== */
/* Provides aiMove(board, SIZE, difficulty) → {x, y} or null */

const AI = (() => {
    'use strict';

    // ---------- Pattern scores ----------
    // Pattern key: [length, openEnds]  → score
    const PATTERN_SCORE = {
        '5_0': 100000, '5_1': 100000, '5_2': 100000,
        '4_2': 50000,   // live-4, almost unstoppable
        '4_1': 8000,    // half-open-4
        '3_2': 4000,    // live-3
        '3_1': 800,     // half-open-3
        '2_2': 400,     // live-2
        '2_1': 80,      // half-open-2
        '1_2': 20,
        '1_1': 4,
    };

    function getPatternScore(len, openEnds) {
        if (len >= 5) return PATTERN_SCORE['5_0'];
        const key = `${Math.min(len, 5)}_${Math.min(openEnds, 2)}`;
        return PATTERN_SCORE[key] || 0;
    }

    // ---------- Evaluate a single line through a point ----------
    function evalLine(board, SIZE, x, y, dx, dy, side) {
        let count = 1;
        let openEnds = 0;

        // forward
        let nx = x + dx, ny = y + dy;
        while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === side) {
            count++; nx += dx; ny += dy;
        }
        if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === 0) openEnds++;

        // backward
        nx = x - dx; ny = y - dy;
        while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === side) {
            count++; nx -= dx; ny -= dy;
        }
        if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === 0) openEnds++;

        return getPatternScore(count, openEnds);
    }

    // ---------- Evaluate position for one side ----------
    function evalSide(board, SIZE, side) {
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        let score = 0;
        const counted = new Set();

        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (board[y][x] !== side) continue;
                for (const [dx, dy] of dirs) {
                    // Avoid double-counting: only score from the "first" stone in each direction
                    const px = x - dx, py = y - dy;
                    if (px >= 0 && py >= 0 && px < SIZE && py < SIZE && board[py][px] === side) continue;

                    score += evalLine(board, SIZE, x, y, dx, dy, side);
                }
            }
        }
        return score;
    }

    // ---------- Full board evaluation (from AI/side=2 perspective) ----------
    function evaluate(board, SIZE) {
        return evalSide(board, SIZE, 2) * 1.05 - evalSide(board, SIZE, 1);
    }

    // ---------- Win check ----------
    function inBounds(x, y, SIZE) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }

    function checkWin(board, SIZE, x, y, side) {
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (const [dx, dy] of dirs) {
            let n = 1;
            for (const k of [1, -1]) {
                let nx = x + dx * k, ny = y + dy * k;
                while (inBounds(nx, ny, SIZE) && board[ny][nx] === side) { n++; nx += dx * k; ny += dy * k; }
            }
            if (n >= 5) return true;
        }
        return false;
    }

    // ---------- Candidate generation ----------
    function getCandidates(board, SIZE, radius) {
        const cands = [];
        const hasPiece = board.some(row => row.some(v => v !== 0));
        if (!hasPiece) {
            const c = Math.floor(SIZE / 2);
            return [{ x: c, y: c }];
        }

        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (board[y][x] !== 0) continue;
                let near = false;
                for (let dy = -radius; dy <= radius && !near; dy++) {
                    for (let dx = -radius; dx <= radius && !near; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (inBounds(nx, ny, SIZE) && board[ny][nx] !== 0) near = true;
                    }
                }
                if (near) cands.push({ x, y });
            }
        }
        return cands;
    }

    // ---------- Quick heuristic score for ordering ----------
    function quickScore(board, SIZE, x, y, side) {
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        let s = 0;
        board[y][x] = side;
        for (const [dx, dy] of dirs) {
            s += evalLine(board, SIZE, x, y, dx, dy, side);
        }
        board[y][x] = 0;
        return s;
    }

    // ---------- Minimax with alpha-beta ----------
    function minimax(board, SIZE, depth, alpha, beta, maximizing, maxCandidates) {
        if (depth === 0) return evaluate(board, SIZE);

        const sideToPlay = maximizing ? 2 : 1;
        const cands = getCandidates(board, SIZE, 2);
        if (cands.length === 0) return evaluate(board, SIZE);

        // Order candidates by heuristic
        const scored = cands.map(c => ({
            c,
            s: quickScore(board, SIZE, c.x, c.y, sideToPlay) +
                quickScore(board, SIZE, c.x, c.y, sideToPlay === 1 ? 2 : 1) * 0.9
        }));
        scored.sort((a, b) => b.s - a.s);
        const top = scored.slice(0, maxCandidates);

        if (maximizing) {
            let maxEval = -Infinity;
            for (const it of top) {
                const { x, y } = it.c;
                board[y][x] = 2;
                if (checkWin(board, SIZE, x, y, 2)) { board[y][x] = 0; return 1e8; }
                const val = minimax(board, SIZE, depth - 1, alpha, beta, false, maxCandidates);
                board[y][x] = 0;
                if (val > maxEval) maxEval = val;
                alpha = Math.max(alpha, val);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const it of top) {
                const { x, y } = it.c;
                board[y][x] = 1;
                if (checkWin(board, SIZE, x, y, 1)) { board[y][x] = 0; return -1e8; }
                const val = minimax(board, SIZE, depth - 1, alpha, beta, true, maxCandidates);
                board[y][x] = 0;
                if (val < minEval) minEval = val;
                beta = Math.min(beta, val);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    // ---------- Immediate threat checks ----------
    function findWinMove(board, SIZE, side) {
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (board[y][x] !== 0) continue;
                board[y][x] = side;
                if (checkWin(board, SIZE, x, y, side)) { board[y][x] = 0; return { x, y }; }
                board[y][x] = 0;
            }
        }
        return null;
    }

    // ---------- Public: compute best move ----------
    function aiMove(board, SIZE, difficulty) {
        const empty = [];
        for (let y = 0; y < SIZE; y++)
            for (let x = 0; x < SIZE; x++)
                if (board[y][x] === 0) empty.push({ x, y });
        if (empty.length === 0) return null;

        // ----- Easy: random with basic awareness -----
        if (difficulty === 'easy') {
            // Still check for immediate win/block
            const win = findWinMove(board, SIZE, 2);
            if (win) return win;
            const block = findWinMove(board, SIZE, 1);
            if (block && Math.random() < 0.6) return block; // 60% chance to block
            return empty[Math.floor(Math.random() * empty.length)];
        }

        // Always check immediate win/block first
        const win = findWinMove(board, SIZE, 2);
        if (win) return win;
        const block = findWinMove(board, SIZE, 1);
        if (block) return block;

        // ----- Medium: 1-ply pattern scoring -----
        if (difficulty === 'medium') {
            const cands = getCandidates(board, SIZE, 2);
            if (cands.length === 0) return empty[Math.floor(Math.random() * empty.length)];

            let best = null, bestS = -Infinity;
            for (const c of cands) {
                const s = quickScore(board, SIZE, c.x, c.y, 2) +
                    quickScore(board, SIZE, c.x, c.y, 1) * 0.9;
                if (s > bestS) { bestS = s; best = c; }
            }
            return best;
        }

        // ----- Hard: minimax depth 4, top 12 candidates -----
        const depth = 4;
        const maxCandidates = 12;

        const cands = getCandidates(board, SIZE, 2);
        if (cands.length === 0) {
            const c = Math.floor(SIZE / 2);
            return { x: c, y: c };
        }

        // Order root candidates for better pruning
        const scored = cands.map(c => ({
            c,
            s: quickScore(board, SIZE, c.x, c.y, 2) +
                quickScore(board, SIZE, c.x, c.y, 1) * 0.9
        }));
        scored.sort((a, b) => b.s - a.s);
        const topCands = scored.slice(0, Math.max(maxCandidates, 15));

        let bestScore = -Infinity, bestMove = null;
        for (const it of topCands) {
            const { x, y } = it.c;
            board[y][x] = 2;
            if (checkWin(board, SIZE, x, y, 2)) { board[y][x] = 0; return { x, y }; }
            const sc = minimax(board, SIZE, depth - 1, -Infinity, Infinity, false, maxCandidates);
            board[y][x] = 0;
            if (sc > bestScore) { bestScore = sc; bestMove = { x, y }; }
        }
        return bestMove;
    }

    return { aiMove, checkWin, inBounds };
})();
