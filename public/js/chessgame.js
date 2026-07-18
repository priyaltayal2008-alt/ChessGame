const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let whiteTime = 0;
let blackTime = 0;
let timerInterval = null;
let activeTimer = 'w';

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    
    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement('div');
            squareElement.classList.add(
                'square',
                (rowindex + squareindex) % 2 === 0 ? 'light' : 'dark'
            );
            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            if (square) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece', square.color === 'w' ? 'white' : 'black');
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;

                // Desktop drag events
                pieceElement.addEventListener('dragstart', (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData('text/plain', '');
                    }
                });

                pieceElement.addEventListener('dragend', () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                // Mobile touch events
                pieceElement.addEventListener('touchstart', (e) => {
                    if (playerRole === square.color) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        pieceElement.style.opacity = '0.5';
                    }
                }, { passive: true });

                squareElement.appendChild(pieceElement);
            }

            // Desktop drop events
            squareElement.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedPiece && sourceSquare) {
                    const targetRow = parseInt(squareElement.dataset.row);
                    const targetCol = parseInt(squareElement.dataset.col);
                    if (targetRow === sourceSquare.row && targetCol === sourceSquare.col) return;
                    handleMove(sourceSquare, { row: targetRow, col: targetCol });
                    draggedPiece = null;
                    sourceSquare = null;
                }
            });

            // Mobile touchend
            squareElement.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (draggedPiece && sourceSquare) {
                    const touch = e.changedTouches[0];
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                    const targetSquare = targetElement?.closest('.square');
                    if (targetSquare) {
                        const targetRow = parseInt(targetSquare.dataset.row);
                        const targetCol = parseInt(targetSquare.dataset.col);
                        if (targetRow === sourceSquare.row && targetCol === sourceSquare.col) {
                            draggedPiece.style.opacity = '1';
                            draggedPiece = null;
                            sourceSquare = null;
                            return;
                        }
                        handleMove(sourceSquare, { row: targetRow, col: targetCol });
                    }
                    if (draggedPiece) draggedPiece.style.opacity = '1';
                    draggedPiece = null;
                    sourceSquare = null;
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === 'b') {
        boardElement.classList.add('flipped');
    } else {
        boardElement.classList.remove('flipped');
    }

    document.getElementById('turnIndicator').textContent =
        chess.turn() === 'w' ? "⬜ White's turn" : "⬛ Black's turn";

    if (chess.in_check()) {
        document.getElementById('turnIndicator').textContent =
            chess.turn() === 'w' ? "⚠️ White is in CHECK!" : "⚠️ Black is in CHECK!";
    }
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q'
    };
    socket.emit('move', move);
};

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♙",
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚",
        P: "♙",
        R: "♖",
        N: "♘",
        B: "♗",
        Q: "♕",
        K: "♔",
    };
    const pieceKey = piece.color === "w" ? piece.type.toUpperCase() : piece.type;
    return unicodePieces[pieceKey] || "";
};

socket.on('playerRole', function(role) {
    playerRole = role;
    renderBoard();
});

socket.on('spectatorRole', function() {
    playerRole = null;
    renderBoard();
});

socket.on('boardState', function(fen) {
    chess.load(fen);
    renderBoard();
});

socket.on('move', function(move) {
    chess.move(move);
    activeTimer = chess.turn();
    startTimer();
    renderBoard();
});

document.getElementById('submitBtn').addEventListener('click', function() {
    const name = document.getElementById('nameInput').value.trim();
    const country = document.getElementById('countryInput').value.trim();
    const timer = parseInt(document.getElementById('timerSelect').value);
    if (!name || !country || !timer) return;
    socket.emit('playerInfo', { name, country, timer });
});

socket.on('bothPlayersReady', (data) => {
    document.getElementById('playerForm').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    document.getElementById('chessboard').style.display = 'grid';
    document.getElementById("whiteName").textContent = data.white.name;
    document.getElementById("whiteCountry").textContent = "🌍 " + data.white.country;
    document.getElementById("blackName").textContent = data.black.name;
    document.getElementById("blackCountry").textContent = "🌍 " + data.black.country;
    whiteTime = data.timer * 60;
    blackTime = data.timer * 60;
    updateTimerDisplay();
    renderBoard();
    activeTimer = 'w';
    startTimer();
});

const updateTimerDisplay = () => {
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    document.getElementById('whiteTimer').textContent = formatTime(whiteTime);
    document.getElementById('blackTimer').textContent = formatTime(blackTime);
    document.getElementById('whiteTimer').style.color = activeTimer === 'w' ? '#facc15' : '#6b7280';
    document.getElementById('blackTimer').style.color = activeTimer === 'b' ? '#facc15' : '#6b7280';
};

const startTimer = () => {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (activeTimer === 'w') {
            whiteTime--;
            if (whiteTime <= 0) {
                clearInterval(timerInterval);
                showGameOver('⏰', 'Black wins!', 'White ran out of time');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                clearInterval(timerInterval);
                showGameOver('⏰', 'White wins!', 'Black ran out of time');
                return;
            }
        }
        updateTimerDisplay();
    }, 1000);
};

const showGameOver = (title, message, reason) => {
    clearInterval(timerInterval);
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverReason').textContent = reason;
    document.getElementById('gameOverScreen').style.display = 'flex';
};

socket.on('gameOver', (data) => {
    if (data.reason === 'checkmate') {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        showGameOver('👑', `${winner} wins!`, 'by Checkmate');
    } else if (data.reason === 'stalemate') {
        showGameOver('🤝', "It's a Draw!", 'by Stalemate');
    } else if (data.reason === 'draw') {
        showGameOver('🤝', "It's a Draw!", 'by Mutual Agreement');
    }
});