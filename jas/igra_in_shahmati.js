const PIECE_SYMBOLS = {
  k: '♚\uFE0E',
  q: '♛\uFE0E',
  r: '♜\uFE0E',
  b: '♝\uFE0E',
  n: '♞\uFE0E',
  p: '♟\uFE0E'
};

let board = [];
let turn = 'w';
let selected = null;
let validMoves = [];
let castling = {};
let enPassantTarget = null;
let gameOver = false;
let history = [];
let pendingPromotion = null;

function initGame() {
  const backRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  board = Array.from({ length: 8 }, () => Array(8).fill(null));

  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRow[c], color: 'b' };
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
    board[7][c] = { type: backRow[c], color: 'w' };
  }

  turn = 'w';
  selected = null;
  validMoves = [];
  castling = { wK: true, wQ: true, bK: true, bQ: true };
  enPassantTarget = null;
  gameOver = false;
  history = [];
  pendingPromotion = null;

  document.getElementById('promo-modal').style.display = 'none';
  renderBoard();
  updateStatus();
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(b) {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function findKing(b, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] && b[r][c].type === 'k' && b[r][c].color === color) {
        return { r, c };
      }
    }
  }
  return null;
}

// Проверка: находится ли клетка (r, c) под боем фигур цвета attackerColor
function isSquareAttacked(b, r, c, attackerColor) {
  // Атака пешками
  const pawnDir = attackerColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = r + pawnDir;
    const pc = c + dc;
    if (inBounds(pr, pc)) {
      const p = b[pr][pc];
      if (p && p.color === attackerColor && p.type === 'p') return true;
    }
  }

  // Атака конями
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const p = b[nr][nc];
      if (p && p.color === attackerColor && p.type === 'n') return true;
    }
  }

  // Атака королём
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = r + dr;
      const kc = c + dc;
      if (inBounds(kr, kc)) {
        const p = b[kr][kc];
        if (p && p.color === attackerColor && p.type === 'k') return true;
      }
    }
  }

  // Атака по прямым (ладья и ферзь)
  const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of straightDirs) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = b[nr][nc];
      if (p) {
        if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // Атака по диагоналям (слон и ферзь)
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = b[nr][nc];
      if (p) {
        if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function isInCheck(b, color) {
  const king = findKing(b, color);
  if (!king) return false;
  const enemy = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(b, king.r, king.c, enemy);
}

// Генерация всех псевдолегальных ходов фигуры (без проверки на открытый шах)
function getPseudoMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  const moves = [];
  const { type, color } = piece;
  const enemy = color === 'w' ? 'b' : 'w';

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    // Шаг на 1 клетку вперёд
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push({ fromR: r, fromC: c, toR: r + dir, toC: c, isPromotion: r + dir === promoRow });
      // Шаг на 2 клетки со старта
      if (r === startRow && !board[r + 2 * dir][c]) {
        moves.push({ fromR: r, fromC: c, toR: r + 2 * dir, toC: c });
      }
    }

    // Взятия по диагонали и взятие на проходе
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (!inBounds(nr, nc)) continue;

      if (board[nr][nc] && board[nr][nc].color === enemy) {
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isPromotion: nr === promoRow });
      } else if (enPassantTarget && enPassantTarget.r === nr && enPassantTarget.c === nc) {
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isEnPassant: true });
      }
    }
  }

  if (type === 'n') {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of offsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc].color === enemy)) {
        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
      }
    }
  }

  if (type === 'b' || type === 'r' || type === 'q') {
    const dirs = [];
    if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        if (!board[nr][nc]) {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
        } else {
          if (board[nr][nc].color === enemy) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && (!board[nr][nc] || board[nr][nc].color === enemy)) {
          moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
        }
      }
    }

    // Рокировка
    const homeRow = color === 'w' ? 7 : 0;
    if (r === homeRow && c === 4 && !isInCheck(board, color)) {
      // Короткая рокировка
      const canShort = color === 'w' ? castling.wK : castling.bK;
      if (
        canShort &&
        !board[homeRow][5] && !board[homeRow][6] &&
        board[homeRow][7] && board[homeRow][7].type === 'r' && board[homeRow][7].color === color &&
        !isSquareAttacked(board, homeRow, 5, enemy) &&
        !isSquareAttacked(board, homeRow, 6, enemy)
      ) {
        moves.push({ fromR: homeRow, fromC: 4, toR: homeRow, toC: 6, isCastle: 'K' });
      }

      // Длинная рокировка
      const canLong = color === 'w' ? castling.wQ : castling.bQ;
      if (
        canLong &&
        !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
        board[homeRow][0] && board[homeRow][0].type === 'r' && board[homeRow][0].color === color &&
        !isSquareAttacked(board, homeRow, 3, enemy) &&
        !isSquareAttacked(board, homeRow, 2, enemy)
      ) {
        moves.push({ fromR: homeRow, fromC: 4, toR: homeRow, toC: 2, isCastle: 'Q' });
      }
    }
  }

  return moves;
}

function applyMoveToBoard(b, move) {
  const piece = b[move.fromR][move.fromC];
  b[move.toR][move.toC] = move.promoteTo
    ? { type: move.promoteTo, color: piece.color }
    : piece;
  b[move.fromR][move.fromC] = null;

  if (move.isEnPassant) {
    b[move.fromR][move.toC] = null;
  }

  if (move.isCastle === 'K') {
    b[move.fromR][5] = b[move.fromR][7];
    b[move.fromR][7] = null;
  } else if (move.isCastle === 'Q') {
    b[move.fromR][3] = b[move.fromR][0];
    b[move.fromR][0] = null;
  }
}

// Оставляем только ходы, после которых свой король не остаётся под шахом
function getLegalMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  return getPseudoMoves(r, c).filter(move => {
    const testBoard = cloneBoard(board);
    applyMoveToBoard(testBoard, move);
    return !isInCheck(testBoard, piece.color);
  });
}

function hasAnyLegalMoves(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === color) {
        if (getLegalMoves(r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function executeMove(move) {
  // Сохраняем состояние для кнопки «Отменить ход»
  history.push({
    board: cloneBoard(board),
    turn,
    castling: { ...castling },
    enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null
  });

  const movingPiece = board[move.fromR][move.fromC];

  // Обновляем права на рокировку
  if (movingPiece.type === 'k') {
    if (movingPiece.color === 'w') { castling.wK = false; castling.wQ = false; }
    else { castling.bK = false; castling.bQ = false; }
  }
  if ((move.fromR === 7 && move.fromC === 0) || (move.toR === 7 && move.toC === 0)) castling.wQ = false;
  if ((move.fromR === 7 && move.fromC === 7) || (move.toR === 7 && move.toC === 7)) castling.wK = false;
  if ((move.fromR === 0 && move.fromC === 0) || (move.toR === 0 && move.toC === 0)) castling.bQ = false;
  if ((move.fromR === 0 && move.fromC === 7) || (move.toR === 0 && move.toC === 7)) castling.bK = false;

  // Запоминаем поле для взятия на проходе, если пешка прыгнула на 2 клетки
  if (movingPiece.type === 'p' && Math.abs(move.toR - move.fromR) === 2) {
    enPassantTarget = { r: (move.fromR + move.toR) / 2, c: move.fromC };
  } else {
    enPassantTarget = null;
  }

  applyMoveToBoard(board, move);

  turn = turn === 'w' ? 'b' : 'w';
  selected = null;
  validMoves = [];

  if (!hasAnyLegalMoves(turn)) {
    gameOver = true;
  }

  renderBoard();
  updateStatus();
}

function choosePromotion(pieceType) {
  if (!pendingPromotion) return;
  document.getElementById('promo-modal').style.display = 'none';
  pendingPromotion.promoteTo = pieceType;
  const move = pendingPromotion;
  pendingPromotion = null;
  executeMove(move);
}

function undoMove() {
  if (history.length === 0) return;
  const prev = history.pop();
  board = prev.board;
  turn = prev.turn;
  castling = prev.castling;
  enPassantTarget = prev.enPassantTarget;
  gameOver = false;
  selected = null;
  validMoves = [];
  pendingPromotion = null;

  document.getElementById('promo-modal').style.display = 'none';
  renderBoard();
  updateStatus();
}

function handleSquareClick(r, c) {
  if (gameOver || pendingPromotion) return;

  // Если кликнули по допустимому ходу — делаем ход
  const chosenMove = validMoves.find(m => m.toR === r && m.toC === c);
  if (chosenMove) {
    if (chosenMove.isPromotion) {
      pendingPromotion = chosenMove;
      document.getElementById('promo-modal').style.display = 'block';
      return;
    }
    executeMove(chosenMove);
    return;
  }

  // Если кликнули по своей фигуре — выделяем её
  const piece = board[r][c];
  if (piece && piece.color === turn) {
    selected = { r, c };
    validMoves = getLegalMoves(r, c);
  } else {
    selected = null;
    validMoves = [];
  }

  renderBoard();
}

function updateStatus() {
  const statusEl = document.getElementById('turn-status');
  const currentName = turn === 'w' ? 'Белые' : 'Чёрные';
  const winnerName = turn === 'w' ? 'Чёрные' : 'Белые';
  const inCheck = isInCheck(board, turn);

  if (gameOver) {
    if (inCheck) {
      statusEl.textContent = `Мат! Победили ${winnerName}!`;
    } else {
      statusEl.textContent = 'Пат! Ничья.';
    }
  } else if (inCheck) {
    statusEl.textContent = `Ход: ${currentName} — ШАХ!`;
  } else {
    statusEl.textContent = `Ход: ${currentName}`;
  }
}

function renderBoard() {
  const boardEl = document.getElementById('chessboard');
  boardEl.innerHTML = '';

  const checkKing = isInCheck(board, turn) ? findKing(board, turn) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');

      if (selected && selected.r === r && selected.c === c) {
        sq.classList.add('selected');
      }

      if (checkKing && checkKing.r === r && checkKing.c === c) {
        sq.classList.add('in-check');
      }

      const moveHint = validMoves.find(m => m.toR === r && m.toC === c);
      if (moveHint) {
        if (board[r][c] || moveHint.isEnPassant) {
          sq.classList.add('capture-hint');
        } else {
          sq.classList.add('move-hint');
        }
      }

      const piece = board[r][c];
      if (piece) {
        sq.textContent = PIECE_SYMBOLS[piece.type];
        sq.classList.add(piece.color === 'w' ? 'white-piece' : 'black-piece');
      }

      sq.addEventListener('click', () => handleSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
}

initGame();
