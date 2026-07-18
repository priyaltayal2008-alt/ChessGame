const express = require('express');
const http = require('http');
const socket = require('socket.io');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();

let players = {};
let currentPlayer = 'w';

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
    res.render('index');
});

io.on('connection', function(uniquesocket) {
    console.log('connected');

    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole', 'w');
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole', 'b');
    } else {
        uniquesocket.emit('spectatorRole');
    }

    uniquesocket.on('disconnect', function() {
        if (uniquesocket.id == players.white) {
            delete players.white;
            delete players.whiteInfo;
        } else if (uniquesocket.id == players.black) {
            delete players.black;
            delete players.blackInfo;
        }
        if (!players.white && !players.black) {
            chess.reset();
            players = {};
        }
    });

    uniquesocket.on('move', (move) => {
        try {
            if (chess.turn() == 'w' && uniquesocket.id !== players.white) return;
            if (chess.turn() == 'b' && uniquesocket.id !== players.black) return;

            let result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit('move', move);
                io.emit('boardState', chess.fen());
                if (chess.in_checkmate()) {
                    io.emit('gameOver', { reason: 'checkmate' });
                } else if (chess.in_stalemate()) {
                    io.emit('gameOver', { reason: 'stalemate' });
                } else if (chess.in_draw()) {
                    io.emit('gameOver', { reason: 'draw' });
                }
            } else {
                console.log('Invalid Move:', move);
                uniquesocket.emit('invalidMove', move);
            }
        } catch(err) {
            console.log(err);
            uniquesocket.emit('invalidMove', move);
        }
    });

    uniquesocket.on('playerInfo', (data) => {
        if (players.white == uniquesocket.id) {
            players.whiteInfo = data;
        } else if (players.black == uniquesocket.id) {
            players.blackInfo = data;
        }
        if (players.whiteInfo && players.blackInfo) {
            const timer = players.whiteInfo.timer;
            io.emit('bothPlayersReady', {
                white: players.whiteInfo,
                black: players.blackInfo,
                timer: timer
            });
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});