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
  activeUsers: new Set(),
  revealMode: false
};

const adminSessions = new Set();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('gameData', gameData);
  socket.emit('revealModeUpdate', gameData.revealMode);

  socket.on('joinGame', (username) => {
    gameData.activeUsers.add(username);
    io.emit('userUpdate', Array.from(gameData.activeUsers));
    console.log(`${username} joined the tasting`);
  });

  socket.on('adminLogin', (password, callback) => {
    const isValid = password === ADMIN_SECRET;
    if (isValid) {
      adminSessions.add(socket.id);
      console.log('Admin logged in:', socket.id);
    }
    callback(isValid);
  });

  socket.on('addChip', (chipName) => {
    if (!adminSessions.has(socket.id)) {
      socket.emit('adminMessage', 'Unauthorized: Admin access required');
      return;
    }

    if (chipName && !gameData.chips.includes(chipName)) {
      gameData.chips.push(chipName);
      io.emit('gameData', gameData);
      console.log(`Admin added chip: ${chipName}`);
    }
  });

  socket.on('removeChip', (chipName) => {
    if (!adminSessions.has(socket.id)) {
      socket.emit('adminMessage', 'Unauthorized: Admin access required');
      return;
    }

    const chipIndex = gameData.chips.indexOf(chipName);
    if (chipIndex > -1) {
      gameData.chips.splice(chipIndex, 1);

      // Remove all votes for this chip
      Object.keys(gameData.votes).forEach(username => {
        if (gameData.votes[username][chipName]) {
          delete gameData.votes[username][chipName];
        }
      });

      io.emit('gameData', gameData);
      console.log(`Admin removed chip: ${chipName}`);
      socket.emit('adminMessage', `Chip "${chipName}" removed successfully!`);
    }
  });

  socket.on('submitVote', (data) => {
    const { username, chip, criterion, rating } = data;

    if (rating < 1 || rating > 5) {
      socket.emit('adminMessage', 'Invalid rating: Must be between 1 and 5');
      return;
    }

    if (!gameData.votes[username]) gameData.votes[username] = {};
    if (!gameData.votes[username][chip]) gameData.votes[username][chip] = {};

    gameData.votes[username][chip][criterion] = rating;
    io.emit('gameData', gameData);

    console.log(`${username} voted ${rating} for ${chip} (${criterion})`);
  });

  socket.on('toggleReveal', (newRevealMode) => {
    if (!adminSessions.has(socket.id)) {
      socket.emit('adminMessage', 'Unauthorized: Admin access required');
      return;
    }

    gameData.revealMode = newRevealMode;
    io.emit('revealModeUpdate', newRevealMode);
    io.emit('gameData', gameData);

    const action = newRevealMode ? 'revealed' : 'hid';
    console.log(`Admin ${action} chip names`);
    socket.emit('adminMessage', `Names ${action} successfully!`);
  });

  socket.on('adminReset', () => {
    if (!adminSessions.has(socket.id)) {
      socket.emit('adminMessage', 'Unauthorized: Admin access required');
      return;
    }

    gameData = {
      chips: ['Classic Paprika', 'Salt & Vinegar', 'Sour Cream & Onion'],
      votes: {},
      activeUsers: new Set(),
      revealMode: false
    };

    io.emit('gameData', gameData);
    io.emit('revealModeUpdate', false);
    io.emit('adminMessage', 'Game reset successfully!');

    console.log('Admin reset the game');
  });

  socket.on('disconnect', () => {
    adminSessions.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeUsers: gameData.activeUsers.size,
    chipCount: gameData.chips.length,
    totalVotes: Object.keys(gameData.votes).length
  });
});

// API endpoint to get current game state (for debugging)
app.get('/api/game-state', (req, res) => {
  const adminSecret = req.query.admin;

  if (adminSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    ...gameData,
    activeUsers: Array.from(gameData.activeUsers)
  });
});

server.listen(PORT, () => {
  console.log(`🥔 Chips Tasting Server running on port ${PORT}`);
  console.log(`Admin secret: ${ADMIN_SECRET}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});