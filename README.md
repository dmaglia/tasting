# 🥔 Chips Tasting Party App

A real-time web application for hosting blind chip tasting parties with friends! Rate chip samples anonymously and reveal the ultimate champion in a dramatic finale.

## ✨ Features

- **🎭 Blind Tasting Mode**: Chips are shown as numbered samples to prevent bias
- **⭐ Star Rating System**: Rate each chip on taste, appearance, and mouthfeel (1-5 stars)
- **🔴 Real-time Updates**: All votes and changes sync instantly across devices using Socket.IO
- **📱 Mobile Optimized**: Works perfectly on smartphones - no app download needed
- **🔐 Admin Controls**: Password-protected admin panel for managing the party
- **🏆 Live Leaderboard**: Beautiful charts and rankings (hidden until reveal mode)
- **🎉 Reveal Mode**: Dramatic moment when chip names and results are unveiled
- **👥 Multi-user Support**: Everyone joins with their own device using a shared URL

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Git
- Heroku CLI

### Local Development
```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
ADMIN_SECRET=your-super-secret-admin-password
```

## 🌐 Deployment

### Deploy to Heroku (Recommended)

1. **Create a Heroku app:**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set ADMIN_SECRET=your-super-secret-password
   ```

3. **Deploy:**
   ```bash
   git push heroku main
   ```

4. **Your app will be available at:** `https://your-app-name.herokuapp.com`

## 🎮 How to Use

### For Party Hosts (Admins)

1. **Setup**: Deploy the app and share the URL with guests
2. **Admin Access**: Click the ⚙️ settings icon in the header
3. **Add Chips**: Use the admin panel to add chip samples before the party
4. **Start Tasting**: Guests join and rate chips in blind mode
5. **The Big Reveal**: Toggle "Reveal Mode" to show names and results! 🎉

### For Guests

1. **Join**: Open the shared URL on your phone
2. **Enter Name**: Type your name to join the tasting
3. **Rate Chips**: Tap stars to rate each numbered sample
4. **Wait for Reveal**: The leaderboard unlocks when admin enables reveal mode

## 🏗️ Technical Architecture

### Frontend
- **Vanilla JavaScript**: No framework dependencies for maximum compatibility
- **Real-time UI**: Instant updates when anyone votes or admin makes changes
- **Progressive Enhancement**: Works on any modern browser
- **Responsive Design**: Mobile-first approach with touch-optimized interactions

### Backend
- **Node.js + Express**: Lightweight web server
- **Socket.IO**: Real-time bidirectional communication
- **In-Memory Storage**: Game state stored in server memory (resets on restart)
- **Admin Authentication**: Simple password-based access control

### Data Flow
```
User Device ←→ Socket.IO ←→ Node.js Server ←→ In-Memory Game State
     ↓                                              ↓
Other Devices ←←←←←←← Real-time Broadcasts ←←←←←←←←←←
```

### Security Features
- **Input Validation**: All votes and chip names are validated
- **Admin Authentication**: Protected admin functions require password
- **Rate Limiting**: Built-in protection via Socket.IO
- **Sanitization**: User inputs are escaped to prevent XSS

## ⚠️ Limitations

### Data Persistence
- **No Database**: Game state is stored in memory only
- **Server Restart**: All data is lost when the server restarts
- **Single Instance**: Doesn't scale across multiple server instances

### Scalability
- **Concurrent Users**: Tested with ~20 users, should handle small-medium parties
- **Memory Usage**: Grows with number of users and votes
- **Single Server**: No horizontal scaling support

### Browser Compatibility
- **Modern Browsers Only**: Requires ES6+ support (Chrome 51+, Firefox 54+, Safari 10+)
- **JavaScript Required**: No fallback for disabled JavaScript
- **Socket.IO Dependency**: Requires WebSocket support

### Admin Controls
- **Single Admin**: Only one admin password, no role-based access
- **No User Management**: Can't kick users or moderate content
- **Limited Backup**: No export/import functionality for game data

## 🛠️ Development

### Project Structure
```
├── server.js              # Main server file with Socket.IO setup
├── public/
│   ├── index.html         # Main app interface
│   ├── styles.css         # All styling and animations
│   └── app.js             # Client-side JavaScript
├── package.json           # Dependencies and scripts
└── Procfile               # Heroku deployment config
```

### Available Scripts
```bash
npm start        # Production server
npm run dev      # Development with nodemon
```

### Adding Features

The codebase is designed to be easily extensible:

- **New Rating Criteria**: Add to the criteria array in `app.js`
- **Different Rating Scales**: Modify the star generation logic
- **Data Export**: Add endpoints in `server.js` for JSON export
- **Database Integration**: Replace in-memory storage with your preferred DB

## 🤝 Contributing

We welcome contributions! This project was built for fun and learning.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test locally
4. Submit a pull request with a clear description

### Code Style
- Use modern JavaScript (ES6+)
- Keep functions small and focused
- Comment complex logic
- Test on mobile devices

## 📜 License

MIT License - feel free to use this for your own parties!

## 🎉 Credits

100% Vibe coded with Claude Sonnet 4 ✨

---

*Perfect for office parties, birthday celebrations, or any gathering where you want to settle the age-old question: which chip reigns supreme?* 🏆