const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'chips2025';

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let gameData = {
  chips: ['Classic Paprika', 'Salt & Vinegar', 'Sour Cream & Onion'],
  votes: {},
  activeUsers: new Set()
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.emit('gameData', gameData);
  
  socket.on('joinGame', (username) => {
    gameData.activeUsers.add(username);
    io.emit('userUpdate', Array.from(gameData.activeUsers));
  });
  
  socket.on('addChip', (chipName) => {
    if (chipName && !gameData.chips.includes(chipName)) {
      gameData.chips.push(chipName);
      io.emit('gameData', gameData);
    }
  });
  
  socket.on('submitVote', (data) => {
    const { username, chip, criterion, rating } = data;
    
    if (!gameData.votes[username]) gameData.votes[username] = {};
    if (!gameData.votes[username][chip]) gameData.votes[username][chip] = {};
    
    gameData.votes[username][chip][criterion] = rating;
    io.emit('gameData', gameData);
  });
  
  socket.on('adminReset', (secret) => {
    if (secret === ADMIN_SECRET) {
      gameData = {
        chips: ['Classic Paprika', 'Salt & Vinegar', 'Sour Cream & Onion'],
        votes: {},
        activeUsers: new Set()
      };
      io.emit('gameData', gameData);
      io.emit('adminMessage', 'Game reset successfully!');
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
