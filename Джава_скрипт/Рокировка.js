const boardElement = document.getElementById('chessboard');
  const statusElement = document.getElementById('turn-status');

  // На доске только короли (K, k) и ладьи (R, r)
  const initialPosition = [
    ['r', '',  '',  '',  'k', '',  '',  'r'],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['',  '',  '',  '',  '',  '',  '',  '' ],
    ['R', '',  '',  '',  'K', '',  '',  'R']
  ];

  const pieceIcons = {
    'K': '♔', 'R': '♖',
    'k': '♚', 'r': '♜'
  };

  let boardState = [];
  let selectedCell = null;
  let currentTurn = 'white';
  let movedPieces = {}; // Память: двигались ли король и ладьи

  function isWhitePiece(piece) {
    return piece !== '' && piece === piece.toUpperCase();
  }

  function isCurrentPlayerPiece(piece) {
    if (!piece) return false;
    return currentTurn === 'white' ? isWhitePiece(piece) : !isWhitePiece(piece);
  }

  // Проверка, свободен ли путь по прямой
  function isPathClear(fromR, fromC, toR, toC) {
    const stepR = Math.sign(toR - fromR);
    const stepC = Math.sign(toC - fromC);
    let r = fromR + stepR;
    let c = fromC + stepC;
    while (r !== toR || c !== toC) {
      if (boardState[r][c] !== '') return false;
      r += stepR;
      c += stepC;
    }
    return true;
  }

  // Проверка условий для рокировки (короткой 'short' или длинной 'long')
  function canCastle(color, side) {
    const row = color === 'white' ? 7 : 0;
    const kingKey = color === 'white' ? 'K' : 'k';
   
    // 1. Король не должен был ходить ранее
    if (movedPieces[kingKey] || boardState[row][4] !== kingKey) return false;

    if (side === 'short') {
      const rookKey = color === 'white' ? 'R_right' : 'r_right';
      if (movedPieces[rookKey]) return false;
      if (boardState[row][7] !== (color === 'white' ? 'R' : 'r')) return false;
      // Между королем и ладьей должно быть пусто
      return boardState[row][5] === '' && boardState[row][6] === '';
    } else {
      const rookKey = color === 'white' ? 'R_left' : 'r_left';
      if (movedPieces[rookKey]) return false;
      if (boardState[row][0] !== (color === 'white' ? 'R' : 'r')) return false;
      // Между королем и длинной ладьей должно быть пусто
      return boardState[row][1] === '' && boardState[row][2] === '' && boardState[row][3] === '';
    }
  }

  function isValidMove(fromR, fromC, toR, toC) {
    const piece = boardState[fromR][fromC];
    const target = boardState[toR][toC];

    // Нельзя бить свои фигуры
    if (target !== '' && isWhitePiece(piece) === isWhitePiece(target)) return false;

    const dr = toR - fromR;
    const dc = toC - fromC;
    const absR = Math.abs(dr);
    const absC = Math.abs(dc);
    const type = piece.toLowerCase();

    // Обычный ход ладьи
    if (type === 'r') {
      return (dr === 0 || dc === 0) && isPathClear(fromR, fromC, toR, toC);
    }

    // Ходы короля
    if (type === 'k') {
      // Обычный шаг на 1 клетку
      if (absR <= 1 && absC <= 1) return true;

      // Попытка рокировки (прыжок на 2 клетки вбок)
      const color = isWhitePiece(piece) ? 'white' : 'black';
      if (dr === 0 && dc === 2 && canCastle(color, 'short')) return 'castle-short';
      if (dr === 0 && dc === -2 && canCastle(color, 'long')) return 'castle-long';
    }

    return false;
  }

  function initBoard() {
    boardState = initialPosition.map(row => [...row]);

Шива:
selectedCell = null;
    currentTurn = 'white';
    // Сбрасываем историю ходов фигур
    movedPieces = {
      K: false, R_left: false, R_right: false,
      k: false, r_left: false, r_right: false
    };
    statusElement.textContent = 'Ход: Белые. Нажмите на короля для рокировки (на 2 клетки вбок)';
    renderBoard();
  }

  function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = document.createElement('div');
        square.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

        if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
          square.classList.add('selected');
        }

        // Если выбран король, подсвечиваем зелеными точками клетки для рокировки
        if (selectedCell) {
          const selPiece = boardState[selectedCell.r][selectedCell.c];
          if (selPiece && selPiece.toLowerCase() === 'k') {
            const moveCheck = isValidMove(selectedCell.r, selectedCell.c, r, c);
            if (moveCheck === 'castle-short' || moveCheck === 'castle-long') {
              square.classList.add('castling-hint');
            }
          }
        }

        const piece = boardState[r][c];
        if (piece) {
          const span = document.createElement('span');
          span.textContent = pieceIcons[piece];
          span.className = isWhitePiece(piece) ? 'white-piece' : 'black-piece';
          square.appendChild(span);
        }

        square.addEventListener('click', () => handleSquareClick(r, c));
        boardElement.appendChild(square);
      }
    }
  }

  function handleSquareClick(r, c) {
    const clickedPiece = boardState[r][c];

    if (selectedCell) {
      const fromR = selectedCell.r;
      const fromC = selectedCell.c;
      const movingPiece = boardState[fromR][fromC];

      // ДОПОЛНИТЕЛЬНОЕ УДОБСТВО: Если выбран король и игрок кликнул прямо на свою ладью,
      // автоматически засчитываем это как желание сделать рокировку в эту сторону!
      if (movingPiece.toLowerCase() === 'k' && isCurrentPlayerPiece(clickedPiece) && clickedPiece.toLowerCase() === 'r') {
        if (c === 7) c = 6; // Перенаправляем клик на клетку короткой рокировки
        if (c === 0) c = 2; // Перенаправляем клик на клетку длинной рокировки
      } else if (isCurrentPlayerPiece(clickedPiece)) {
        selectedCell = { r, c };
        renderBoard();
        return;
      }

      const moveResult = isValidMove(fromR, fromC, r, c);

      if (moveResult) {
        // Передвигаем короля или ладью
        boardState[r][c] = movingPiece;
        boardState[fromR][fromC] = '';

        let statusText = '';

        // Если это была короткая рокировка — перепрыгиваем правой ладьей через короля
        if (moveResult === 'castle-short') {
          boardState[r][5] = boardState[r][7];
          boardState[r][7] = '';
          statusText = 'Выполнена короткая рокировка (0-0)! ';
        }
        // Если это была длинная рокировка — перепрыгиваем левой ладьей через короля
        else if (moveResult === 'castle-long') {
          boardState[r][3] = boardState[r][0];
          boardState[r][0] = '';
          statusText = 'Выполнена длинная рокировка (0-0-0)! ';
        }

        // Запоминаем, какая фигура походила (теперь ей рокироваться нельзя)
        if (movingPiece === 'K') movedPieces.K = true;
        if (movingPiece === 'k') movedPieces.k = true;
        if (movingPiece === 'R' && fromR === 7 && fromC === 0) movedPieces.R_left = true;
        if (movingPiece === 'R' && fromR === 7 && fromC === 7) movedPieces.R_right = true;
        if (movingPiece === 'r' && fromR === 0 && fromC === 0) movedPieces.r_left = true;
        if (movingPiece === 'r' && fromR === 0 && fromC === 7) movedPieces.r_right = true;

        selectedCell = null;
        currentTurn = currentTurn === 'white' ? 'black' : 'white';

Шива:
statusElement.textContent = statusText + (currentTurn === 'white' ? 'Ход: Белые' : 'Ход: Черные');
        renderBoard();
      } else {
        selectedCell = null;
        renderBoard();
      }
    } else {
      if (isCurrentPlayerPiece(clickedPiece)) {
        selectedCell = { r, c };
        renderBoard();
      }
    }
  }

  initBoard();
