/* =========================================================
   CHESS AI FINAL - PART 1/4
   ========================================================= */

const loadingScreen = document.getElementById('loadingScreen');
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const loadingProgress = document.getElementById('loadingProgress');
const boardEl = document.getElementById('board');
const turnText = document.getElementById('turnText');
const thinkingEl = document.getElementById('thinking');
const difficultyText = document.getElementById('difficultyText');
const resultPopup = document.getElementById('resultPopup');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');

let board = [];
let selectedSquare = null;
let currentPlayer = 'w';
let gameActive = false;
let aiThinking = false;
let difficulty = 'easy';
let lastMove = null;
let enPassantTarget = null;
let castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
let squareEls = [];

const PIECE_SYMBOLS = {
    wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
    bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

let progress = 0;
const loadingInterval = setInterval(() => {
    progress += Math.random() * 18;
    if (progress >= 100) {
        progress = 100;
        clearInterval(loadingInterval);
        setTimeout(() => {
            loadingScreen.classList.remove('active');
            menuScreen.classList.add('active');
        }, 400);
    }
    loadingProgress.style.width = progress + '%';
}, 150);

document.querySelectorAll('.difficulty').forEach(btn => {
    btn.addEventListener('click', () => {
        difficulty = btn.dataset.level;
        const names = { easy:'Mudah', medium:'Sedang', hard:'Sulit' };
        difficultyText.textContent = names[difficulty];
        menuScreen.classList.remove('active');
        gameScreen.classList.add('active');
        startNewGame();
    });
});

document.getElementById('backBtn').addEventListener('click', () => {
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    gameActive = false;
    aiThinking = false;
});

document.getElementById('restartBtn').addEventListener('click', () => {
    startNewGame();
});

document.getElementById('newGameBtn').addEventListener('click', () => {
    startNewGame();
});

document.getElementById('playAgain').addEventListener('click', () => {
    resultPopup.classList.add('hidden');
    startNewGame();
});

document.getElementById('backMenu').addEventListener('click', () => {
    resultPopup.classList.add('hidden');
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    gameActive = false;
    aiThinking = false;
});

/* =========================================================
   CHESS AI FINAL - PART 2/4
   ========================================================= */

function buildBoardUI() {
    boardEl.innerHTML = '';
    squareEls = [];
    for (let r = 0; r < 8; r++) {
        squareEls[r] = [];
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            const light = (r + c) % 2 === 0;
            sq.className = `square ${light ? 'light' : 'dark'}`;
            sq.dataset.row = r;
            sq.dataset.col = c;
            sq.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(sq);
            squareEls[r][c] = sq;
        }
    }
}

function createInitialBoard() {
    const back = ['R','N','B','Q','K','B','N','R'];
    const b = Array.from({length:8}, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
        b[0][c] = 'b' + back[c];
        b[1][c] = 'bP';
        b[6][c] = 'wP';
        b[7][c] = 'w' + back[c];
    }
    return b;
}

function startNewGame() {
    board = createInitialBoard();
    currentPlayer = 'w';
    selectedSquare = null;
    gameActive = true;
    aiThinking = false;
    lastMove = null;
    enPassantTarget = null;
    castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
    resultPopup.classList.add('hidden');
    turnText.textContent = 'Giliran kamu';
    thinkingEl.classList.add('hidden');

    if (squareEls.length === 0) buildBoardUI();
    updateBoardUI();
}

function updateBoardUI() {
    const checkedKing = findKingInCheck(currentPlayer);

    let validMoves = [];
    if (selectedSquare) {
        validMoves = getLegalMoves(selectedSquare.r, selectedSquare.c);
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = squareEls[r][c];
            const piece = board[r][c];

            sq.classList.remove('selected','valid-move','valid-capture','check','last-move');

            if (lastMove && ((lastMove.from.r===r && lastMove.from.c===c) ||
                (lastMove.to.r===r && lastMove.to.c===c))) {
                sq.classList.add('last-move');
            }

            if (selectedSquare && selectedSquare.r===r && selectedSquare.c===c) {
                sq.classList.add('selected');
            }

            if (selectedSquare) {
                const mv = validMoves.find(m => m.r===r && m.c===c);
                if (mv) {
                    const t = board[r][c];
                    sq.classList.add((t || mv.isEnPassant) ? 'valid-capture' : 'valid-move');
                }
            }

            if (checkedKing && checkedKing.r===r && checkedKing.c===c) {
                sq.classList.add('check');
            }

            updatePieceInSquare(sq, piece);
        }
    }
}

function updatePieceInSquare(sq, piece) {
    let pieceEl = sq.querySelector('.piece');
    if (!piece) {
        if (pieceEl) pieceEl.remove();
        return;
    }
    if (!pieceEl) {
        pieceEl = document.createElement('span');
        pieceEl.className = 'piece';
        sq.appendChild(pieceEl);
    }
    const symbol = PIECE_SYMBOLS[piece];
    if (pieceEl.textContent !== symbol) {
        pieceEl.textContent = symbol;
        pieceEl.style.animation = 'none';
        void pieceEl.offsetWidth;
        pieceEl.style.animation = 'dotPop 0.25s ease';
    }
    pieceEl.className = 'piece ' + (piece[0]==='w' ? 'piece-white' : 'piece-black');
}

function handleSquareClick(r, c) {
    // PANIC: kalau bukan giliran player tapi game masih jalan, paksa balik
    if (gameActive && !aiThinking && currentPlayer !== 'w') {
        currentPlayer = 'w';
        turnText.textContent = 'Giliran kamu';
    }

    if (!gameActive || aiThinking || currentPlayer !== 'w') return;

    const piece = board[r][c];

    if (piece && piece[0] === 'w') {
        if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
            selectedSquare = null;
        } else {
            selectedSquare = { r, c };
        }
        updateBoardUI();
        return;
    }

    if (selectedSquare) {
        const moves = getLegalMoves(selectedSquare.r, selectedSquare.c);
        const mv = moves.find(m => m.r === r && m.c === c);
        if (mv) {
            executeMove(selectedSquare, { r, c }, mv);
            return;
        }
    }

    selectedSquare = null;
    updateBoardUI();
}

function executeMove(from, to, info) {
    try {
        const piece = board[from.r][from.c];
        if (!piece) return;
        const captured = board[to.r][to.c];

        if (captured || (info && info.isEnPassant)) {
            const flashSq = squareEls[to.r][to.c];
            flashSq.classList.add('captured-flash');
            setTimeout(() => flashSq.classList.remove('captured-flash'), 400);
        }

        const fromSq = squareEls[from.r][from.c];
        const pieceEl = fromSq.querySelector('.piece');
        if (pieceEl) {
            const dx = (to.c - from.c) * 100;
            const dy = (to.r - from.r) * 100;
            pieceEl.style.transform = `translate(${dx}%, ${dy}%)`;
            pieceEl.style.zIndex = '10';
        }

        if (info && info.isCastle) {
            board[to.r][to.c] = piece;
            board[from.r][from.c] = null;
            if (info.side === 'K') {
                board[to.r][5] = board[to.r][7];
                board[to.r][7] = null;
            } else {
                board[to.r][3] = board[to.r][0];
                board[to.r][0] = null;
            }
        } else if (info && info.isEnPassant) {
            board[to.r][to.c] = piece;
            board[from.r][from.c] = null;
            board[from.r][to.c] = null;
        } else {
            board[to.r][to.c] = piece;
            board[from.r][from.c] = null;
        }

        if (piece[1] === 'P' && (to.r === 0 || to.r === 7)) {
            board[to.r][to.c] = piece[0] + 'Q';
        }

        updateCastlingRights(piece, from, to, captured);

        enPassantTarget = null;
        if (piece[1] === 'P' && Math.abs(to.r - from.r) === 2) {
            enPassantTarget = { r: (from.r + to.r) / 2, c: from.c };
        }

        lastMove = { from, to };
        selectedSquare = null;

        setTimeout(() => {
            currentPlayer = currentPlayer === 'w' ? 'b' : 'w';
            updateBoardUI();

            if (checkGameOver()) return;

            if (currentPlayer === 'b') {
                turnText.textContent = 'Giliran AI';
                aiThinking = true;
                thinkingEl.classList.remove('hidden');
                setTimeout(aiMove, 300);
            } else {
                turnText.textContent = 'Giliran kamu';
            }
        }, 280);

    } catch (err) {
        console.error('ExecuteMove error:', err);
        aiThinking = false;
        currentPlayer = 'w';
        selectedSquare = null;
        turnText.textContent = 'Giliran kamu';
        thinkingEl.classList.add('hidden');
        updateBoardUI();
    }
}

function updateCastlingRights(piece, from, to, captured) {
    if (piece === 'wK') { castlingRights.wK = false; castlingRights.wQ = false; }
    if (piece === 'bK') { castlingRights.bK = false; castlingRights.bQ = false; }
    if (piece === 'wR') {
        if (from.c === 0 && from.r === 7) castlingRights.wQ = false;
        if (from.c === 7 && from.r === 7) castlingRights.wK = false;
    }
    if (piece === 'bR') {
        if (from.c === 0 && from.r === 0) castlingRights.bQ = false;
        if (from.c === 7 && from.r === 0) castlingRights.bK = false;
    }
    if (captured === 'wR') {
        if (to.c === 0 && to.r === 7) castlingRights.wQ = false;
        if (to.c === 7 && to.r === 7) castlingRights.wK = false;
    }
    if (captured === 'bR') {
        if (to.c === 0 && to.r === 0) castlingRights.bQ = false;
        if (to.c === 7 && to.r === 0) castlingRights.bK = false;
    }
}

/* =========================================================
   CHESS AI FINAL - PART 3/4
   ========================================================= */

function getLegalMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const pseudo = getPseudoMoves(r, c);

    return pseudo.filter(mv => {
        const saved = board.map(row => [...row]);
        const savedEP = enPassantTarget;
        const savedCastle = { ...castlingRights };

        if (mv.isCastle) {
            board[mv.r][mv.c] = piece;
            board[r][c] = null;
            if (mv.side === 'K') {
                board[mv.r][5] = board[mv.r][7];
                board[mv.r][7] = null;
            } else {
                board[mv.r][3] = board[mv.r][0];
                board[mv.r][0] = null;
            }
        } else if (mv.isEnPassant) {
            board[mv.r][mv.c] = piece;
            board[r][c] = null;
            board[r][mv.c] = null;
        } else {
            board[mv.r][mv.c] = piece;
            board[r][c] = null;
        }

        const inCheck = isKingInCheck(color, board);

        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 8; j++)
                board[i][j] = saved[i][j];
        enPassantTarget = savedEP;
        castlingRights = savedCastle;

        return !inCheck;
    });
}

function getPseudoMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    const add = (nr, nc, extra = {}) => {
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
        const t = board[nr][nc];
        if (t && t[0] === color) return false;
        moves.push({ r: nr, c: nc, ...extra });
        return !t;
    };

    const slide = (dr, dc) => {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
            const t = board[nr][nc];
            if (t && t[0] === color) break;
            moves.push({ r: nr, c: nc });
            if (t) break;
            nr += dr; nc += dc;
        }
    };

    switch (type) {
        case 'P': {
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            if (r + dir >= 0 && r + dir <= 7 && !board[r + dir][c]) {
                moves.push({ r: r + dir, c });
                if (r === startRow && !board[r + 2*dir][c]) {
                    moves.push({ r: r + 2*dir, c });
                }
            }
            for (const dc of [-1, 1]) {
                const nr = r + dir, nc = c + dc;
                if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
                    const t = board[nr][nc];
                    if (t && t[0] !== color) moves.push({ r: nr, c: nc });
                    if (enPassantTarget && enPassantTarget.r === nr && enPassantTarget.c === nc) {
                        moves.push({ r: nr, c: nc, isEnPassant: true });
                    }
                }
            }
            break;
        }
        case 'N':
            [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
                .forEach(([dr,dc]) => add(r+dr, c+dc));
            break;
        case 'B': slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
        case 'R': slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
        case 'Q':
            slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1);
            slide(-1,0); slide(1,0); slide(0,-1); slide(0,1);
            break;
        case 'K': {
            [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
                .forEach(([dr,dc]) => add(r+dr, c+dc));

            if (color === 'w' && r === 7 && c === 4) {
                if (castlingRights.wK && !board[7][5] && !board[7][6] &&
                    board[7][7] === 'wR' && !isSquareAttacked(7,4,'b') &&
                    !isSquareAttacked(7,5,'b') && !isSquareAttacked(7,6,'b')) {
                    moves.push({ r: 7, c: 6, isCastle: true, side: 'K' });
                }
                if (castlingRights.wQ && !board[7][3] && !board[7][2] && !board[7][1] &&
                    board[7][0] === 'wR' && !isSquareAttacked(7,4,'b') &&
                    !isSquareAttacked(7,3,'b') && !isSquareAttacked(7,2,'b')) {
                    moves.push({ r: 7, c: 2, isCastle: true, side: 'Q' });
                }
            }
            if (color === 'b' && r === 0 && c === 4) {
                if (castlingRights.bK && !board[0][5] && !board[0][6] &&
                    board[0][7] === 'bR' && !isSquareAttacked(0,4,'w') &&
                    !isSquareAttacked(0,5,'w') && !isSquareAttacked(0,6,'w')) {
                    moves.push({ r: 0, c: 6, isCastle: true, side: 'K' });
                }
                if (castlingRights.bQ && !board[0][3] && !board[0][2] && !board[0][1] &&
                    board[0][0] === 'bR' && !isSquareAttacked(0,4,'w') &&
                    !isSquareAttacked(0,3,'w') && !isSquareAttacked(0,2,'w')) {
                    moves.push({ r: 0, c: 2, isCastle: true, side: 'Q' });
                }
            }
            break;
        }
    }
    return moves;
}

function isSquareAttacked(r, c, byColor) {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i][j];
            if (!p || p[0] !== byColor) continue;
            const moves = getPseudoMoves(i, j);
            if (moves.some(m => m.r === r && m.c === c)) return true;
        }
    }
    return false;
}

function findKingInCheck(color) {
    let kingPos = null;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === color + 'K') kingPos = { r, c };
    if (!kingPos) return null;
    const enemy = color === 'w' ? 'b' : 'w';
    return isSquareAttacked(kingPos.r, kingPos.c, enemy) ? kingPos : null;
}

function isKingInCheck(color, b) {
    const saved = board;
    board = b;
    const enemy = color === 'w' ? 'b' : 'w';
    let kingPos = null;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === color + 'K') kingPos = { r, c };
    if (!kingPos) { board = saved; return false; }
    const result = isSquareAttacked(kingPos.r, kingPos.c, enemy);
    board = saved;
    return result;
}

/* =========================================================
   CHESS AI FINAL - PART 4/4
   AI Heuristik (bukan minimax) - cepat & akurat
   ========================================================= */

const PIECE_VALUES = { P:100, N:320, B:330, R:500, Q:900, K:20000 };

// Nilai posisi: bidak di tengah lebih bagus
function centerBonus(r, c) {
    const dr = Math.min(r, 7 - r);
    const dc = Math.min(c, 7 - c);
    return (dr + dc) * 2;
}

// ===== AI MOVE =====
function aiMove() {
    aiThinking = false;
    thinkingEl.classList.add('hidden');

    if (!gameActive) return;

    try {
        const allMoves = getAllMoves('b');
        if (allMoves.length === 0) {
            checkGameOver();
            return;
        }

        let chosen;

        if (difficulty === 'easy') {
            // ===== MUDAH: 100% RANDOM =====
            // AI gak mikir sama sekali, gerak ngawur
            chosen = allMoves[Math.floor(Math.random() * allMoves.length)];
            
            // Bonus: 30% chance AI sengaja gak makan bidak kamu
            // (biar kamu bisa menang gampang)
            if (Math.random() < 0.1) {
                const nonCapture = allMoves.filter(m => !board[m.to.r][m.to.c]);
                if (nonCapture.length > 0) {
                    chosen = nonCapture[Math.floor(Math.random() * nonCapture.length)];
                }
            }
        } else if (difficulty === 'medium') {
            if (Math.random() < 0.5) {
                chosen = allMoves[Math.floor(Math.random() * allMoves.length)];
            } else {
                chosen = pickByScore(allMoves, true);
            }
        } else {
            chosen = pickByScore(allMoves, true, true);
        }

        if (!chosen) chosen = allMoves[0];

        executeMove(chosen.from, chosen.to, chosen.info);

    } catch (err) {
        console.error('AI error:', err);
        aiThinking = false;
        currentPlayer = 'w';
        turnText.textContent = 'Giliran kamu';
        thinkingEl.classList.add('hidden');
        updateBoardUI();
    }
}

// ===== PILIH MOVE TERBAIK BERDASARKAN SKOR =====
function pickByScore(moves, useHeuristic, lookAhead = false) {
    let best = moves[0];
    let bestScore = -Infinity;

    for (const mv of moves) {
        let score = 0;

        const movingPiece = board[mv.from.r][mv.from.c];
        const targetPiece = board[mv.to.r][mv.to.c];

        // 1. Nilai capture (paling penting)
        if (targetPiece) {
            score += PIECE_VALUES[targetPiece[1]] * 10;
        }

        // En passant capture
        if (mv.info.isEnPassant) {
            score += PIECE_VALUES['P'] * 10;
        }

        // 2. Promosi = bagus banget
        if (movingPiece[1] === 'P' && (mv.to.r === 0 || mv.to.r === 7)) {
            score += PIECE_VALUES['Q'] * 15;
        }

        // 3. Castling = aman
        if (mv.info.isCastle) {
            score += 60;
        }

        // 4. Center control
        score += centerBonus(mv.to.r, mv.to.c);

        // 5. Maju ke depan (pawn push)
        if (movingPiece[1] === 'P') {
            score += (mv.to.r - mv.from.r) * 5;
        }

        // 6. Heuristik: cek apakah kotak tujuan diserang musuh
        if (useHeuristic) {
            // Simulasi move dulu
            const savedBoard = board.map(row => [...row]);
            const savedEP = enPassantTarget;

            board[mv.to.r][mv.to.c] = movingPiece;
            board[mv.from.r][mv.from.c] = null;
            if (mv.info.isEnPassant) {
                board[mv.from.r][mv.to.c] = null;
            }
            if (movingPiece[1] === 'P' && (mv.to.r === 0 || mv.to.r === 7)) {
                board[mv.to.r][mv.to.c] = movingPiece[0] + 'Q';
            }

            const newPiece = board[mv.to.r][mv.to.c];

            // Kalau kotak tujuan diserang lawan, kurangin skor
            if (isSquareAttacked(mv.to.r, mv.to.c, 'w')) {
                // Cek apakah masih ada yang bela
                let defended = false;
                // Simulasi: apakah setelah white makan, white bisa dimakan balik?
                // Cukup rough: kalau nilai bidak yang pindah tinggi, hindari
                score -= PIECE_VALUES[newPiece[1]] * 3;
            }

            // Bonus kalau move ini bikin white kena skak
            // Simulasi: cek apakah white king kena skak setelah move ini
            // (skip - terlalu berat)

            // Restore
            for (let i = 0; i < 8; i++)
                for (let j = 0; j < 8; j++)
                    board[i][j] = savedBoard[i][j];
            enPassantTarget = savedEP;

            // 7. Look-ahead: cek apa white bisa capture bidak kita setelah move ini
            if (lookAhead) {
                const lookScore = evaluatePositionAfterMove(mv);
                score += lookScore;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            best = mv;
        }
    }

    return best;
}

// ===== EVALUASI POSISI SETELAH MOVE (untuk hard mode) =====
function evaluatePositionAfterMove(mv) {
    const savedBoard = board.map(row => [...row]);
    const savedEP = enPassantTarget;

    const piece = board[mv.from.r][mv.from.c];

    // Apply move
    board[mv.to.r][mv.to.c] = piece;
    board[mv.from.r][mv.from.c] = null;
    if (mv.info.isEnPassant) board[mv.from.r][mv.to.c] = null;
    if (piece[1] === 'P' && (mv.to.r === 0 || mv.to.r === 7)) {
        board[mv.to.r][mv.to.c] = piece[0] + 'Q';
    }

    let score = 0;

    // Cek semua langkah white: kalau ada yang bisa capture kita dengan untung, kurangin
    const whiteMoves = getAllMoves('w');
    let worstLoss = 0;
    for (const wm of whiteMoves) {
        const target = board[wm.to.r][wm.to.c];
        if (target && target[0] === 'b') {
            const gain = PIECE_VALUES[target[1]] - PIECE_VALUES[board[wm.from.r][wm.from.c][1]] * 0.5;
            if (gain > worstLoss) worstLoss = gain;
        }
    }

    // Kalau setelah move kita bisa kehilangan bidak mahal, kurangin
    score -= worstLoss * 2;

    // Restore
    for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++)
            board[i][j] = savedBoard[i][j];
    enPassantTarget = savedEP;

    return score;
}

// ===== GET ALL MOVES =====
function getAllMoves(color) {
    const all = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p[0] === color) {
                const moves = getLegalMoves(r, c);
                moves.forEach(m => all.push({ from: { r, c }, to: { r: m.r, c: m.c }, info: m }));
            }
        }
    return all;
}

// ===== CHECK GAME OVER =====
function checkGameOver() {
    const color = currentPlayer;
    const moves = getAllMoves(color);
    const inCheck = findKingInCheck(color);

    if (moves.length === 0) {
        gameActive = false;
        if (inCheck) {
            const winner = color === 'w' ? 'Komputer' : 'Kamu';
            showResult(color === 'w' ? '♚' : '♔', 'Skakmat!', `${winner} menang! 🎉`);
        } else {
            showResult('🤝', 'Seri!', 'Stalemate - tidak ada langkah legal.');
        }
        return true;
    }

    if (!hasEnoughMaterial()) {
        gameActive = false;
        showResult('🤝', 'Seri!', 'Materi tidak cukup untuk skakmat.');
        return true;
    }

    return false;
}

function hasEnoughMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p[1] !== 'K') pieces.push(p[1]);
        }
    if (pieces.length === 0) return false;
    if (pieces.length === 1 && (pieces[0] === 'N' || pieces[0] === 'B')) return false;
    return true;
}

function showResult(icon, title, msg) {
    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultMessage.textContent = msg;
    resultPopup.classList.remove('hidden');
}

// ===== DEBUG TOOLS =====
window.cekState = function() {
    console.log('=== CHESS AI STATE ===');
    console.log('currentPlayer:', currentPlayer);
    console.log('aiThinking:', aiThinking);
    console.log('gameActive:', gameActive);
    console.log('selectedSquare:', selectedSquare);
    console.log('board ada?', board.length === 8);
};

window.resetPaksa = function() {
    aiThinking = false;
    currentPlayer = 'w';
    selectedSquare = null;
    turnText.textContent = 'Giliran kamu';
    thinkingEl.classList.add('hidden');
    updateBoardUI();
    console.log('State di-reset ke player');
};