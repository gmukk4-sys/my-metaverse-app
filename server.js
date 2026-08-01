const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// index.html 및 정적 파일 제공 (Express 호환 정규식 처리)
app.use(express.static(path.join(__dirname)));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const players = {};
const activeSharingUsers = {};
const chatHistory = []; // 최근 채팅 최대 20개 보관
const MAX_CHAT = 20;

io.on('connection', (socket) => {
  console.log(`[접속] 유저 연결됨: ${socket.id}`);

  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * 600) + 100,
    y: Math.floor(Math.random() * 400) + 100,
    name: '플레이어',
    avatar: null
  };

  socket.emit('currentPlayers', players);
  socket.emit('activeScreenShares', Object.keys(activeSharingUsers));
  socket.emit('chatHistory', chatHistory); // 접속 시 최근 채팅 전송
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('chatMessage', (text) => {
    const p = players[socket.id];
    if (!p || typeof text !== 'string' || !text.trim()) return;
    const msg = {
      id: socket.id,
      name: p.name,
      avatar: p.avatar, // 현재 캐릭터 이미지 사용
      text: text.trim().substring(0, 500)
    };
    chatHistory.push(msg);
    if (chatHistory.length > MAX_CHAT) chatHistory.shift();
    io.emit('chatMessage', msg); // 보낸 사람 포함 전원에게 전송
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('changeName', (newName) => {
    if (players[socket.id]) {
      players[socket.id].name = newName;
      socket.broadcast.emit('playerRenamed', {
        id: socket.id,
        name: newName
      });
    }
  });

  socket.on('changeAvatar', (base64Image) => {
    if (players[socket.id]) {
      players[socket.id].avatar = base64Image;
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
  console.log(`🚀 메타버스 서버 가동 완료: http://localhost:${PORT}`);
});