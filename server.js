const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const players = {};
const activeSharingUsers = {};

io.on('connection', (socket) => {
  console.log(`[접속] 유저 연결됨: ${socket.id}`);

  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * 600) + 100,
    y: Math.floor(Math.random() * 400) + 100,
    avatar: null // 이미지 데이터 기본값
  };

  socket.emit('currentPlayers', players);
  socket.emit('activeScreenShares', Object.keys(activeSharingUsers));
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // 유저가 자신의 아바타 이미지를 바꿨을 때
  socket.on('changeAvatar', (base64Image) => {
    if (players[socket.id]) {
      players[socket.id].avatar = base64Image;
      // 나를 제외한 모든 사람들에게 변경된 이미지 알림
      socket.broadcast.emit('playerAvatarChanged', {
        id: socket.id,
        avatarBase64: base64Image
      });
    }
  });

  socket.on('startScreenShare', () => {
    activeSharingUsers[socket.id] = true;
    socket.broadcast.emit('userStartedShare', socket.id);
  });

  socket.on('stopScreenShare', () => {
    delete activeSharingUsers[socket.id];
    socket.broadcast.emit('userStoppedShare', socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`[종료] 유저 나감: ${socket.id}`);
    delete players[socket.id];
    delete activeSharingUsers[socket.id];
    io.emit('playerDisconnected', socket.id);
    io.emit('userStoppedShare', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 메타버스 서버 실행 완료: http://localhost:${PORT}`);
});