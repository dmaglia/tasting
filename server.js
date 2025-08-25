const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const fs = require('fs').promises
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const PORT = process.env.PORT || 3000
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'chips2025'
const DATA_FILE = path.join(__dirname, 'game-data.json')

app.use(helmet({
    contentSecurityPolicy: false
}))
app.use(compression())
app.use(cors())
app.use(express.json({limit: '10mb'}))
app.use(express.static('public'))

// Default game data
const defaultGameData = {
    chips: ['Classic Paprika', 'Salt & Vinegar', 'Sour Cream & Onion'],
    votes: {},
    activeUsers: [],
    revealMode: false,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
}

let gameData = {...defaultGameData}
const adminSessions = new Set()

// Data persistence functions
async function loadGameData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8')
        const parsed = JSON.parse(data)

        // Convert activeUsers array back to Set for in-memory operations
        gameData = {
            ...parsed,
            activeUsers: new Set(parsed.activeUsers || [])
        }

        console.log('✅ Game data loaded from file')
        console.log(`📊 ${gameData.chips.length} chips, ${Object.keys(gameData.votes).length} users with votes`)
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📝 No existing data file found, starting fresh')
            gameData = {...defaultGameData, activeUsers: new Set()}
            await saveGameData()
        } else {
            console.error('❌ Error loading game data:', error.message)
            gameData = {...defaultGameData, activeUsers: new Set()}
        }
    }
}

async function saveGameData() {
    try {
        // Convert Set to Array for JSON serialization
        const dataToSave = {
            ...gameData,
            activeUsers: Array.from(gameData.activeUsers),
            lastUpdated: new Date().toISOString()
        }

        await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2))
        console.log('💾 Game data saved to file')
    } catch (error) {
        console.error('❌ Error saving game data:', error.message)
    }
}

// Auto-save every 30 seconds (safety net)
setInterval(saveGameData, 30000)

// Graceful shutdown - save data before exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...')
    await saveGameData()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...')
    await saveGameData()
    process.exit(0)
})

io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    socket.emit('gameData', {
        ...gameData,
        activeUsers: Array.from(gameData.activeUsers)
    })
    socket.emit('revealModeUpdate', gameData.revealMode)

    socket.on('joinGame', async (username) => {
        gameData.activeUsers.add(username)
        io.emit('userUpdate', Array.from(gameData.activeUsers))
        console.log(`${username} joined the tasting`)

        // Save when users join (captures active participants)
        await saveGameData()
    })

    socket.on('adminLogin', (password, callback) => {
        const isValid = password === ADMIN_SECRET
        if (isValid) {
            adminSessions.add(socket.id)
            console.log('Admin logged in:', socket.id)
        }
        callback(isValid)
    })

    socket.on('addChip', async (chipName) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        if (chipName && !gameData.chips.includes(chipName)) {
            gameData.chips.push(chipName)
            await saveGameData()
            io.emit('gameData', {
                ...gameData,
                activeUsers: Array.from(gameData.activeUsers)
            })
            console.log(`Admin added chip: ${chipName}`)
        }
    })

    socket.on('removeChip', async (chipName) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        const chipIndex = gameData.chips.indexOf(chipName)
        if (chipIndex > -1) {
            gameData.chips.splice(chipIndex, 1)

            // Remove all votes for this chip
            Object.keys(gameData.votes).forEach(username => {
                if (gameData.votes[username][chipName]) {
                    delete gameData.votes[username][chipName]
                }
            })

            await saveGameData()
            io.emit('gameData', {
                ...gameData,
                activeUsers: Array.from(gameData.activeUsers)
            })
            console.log(`Admin removed chip: ${chipName}`)
            socket.emit('adminMessage', `Chip "${chipName}" removed successfully!`)
        }
    })

    socket.on('submitVote', async (data) => {
        const {username, chip, criterion, rating} = data

        if (rating < 1 || rating > 5) {
            socket.emit('adminMessage', 'Invalid rating: Must be between 1 and 5')
            return
        }

        if (!gameData.votes[username]) gameData.votes[username] = {}
        if (!gameData.votes[username][chip]) gameData.votes[username][chip] = {}

        gameData.votes[username][chip][criterion] = rating

        // Save immediately on vote (most important data)
        await saveGameData()

        io.emit('gameData', {
            ...gameData,
            activeUsers: Array.from(gameData.activeUsers)
        })

        console.log(`${username} voted ${rating} for ${chip} (${criterion})`)
    })

    socket.on('toggleReveal', async (newRevealMode) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        gameData.revealMode = newRevealMode
        await saveGameData()

        io.emit('revealModeUpdate', newRevealMode)
        io.emit('gameData', {
            ...gameData,
            activeUsers: Array.from(gameData.activeUsers)
        })

        const action = newRevealMode ? 'revealed' : 'hid'
        console.log(`Admin ${action} chip names`)
        socket.emit('adminMessage', `Names ${action} successfully!`)
    })

    socket.on('adminReset', async () => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        gameData = {
            chips: ['Classic Paprika', 'Salt & Vinegar', 'Sour Cream & Onion'],
            votes: {},
            activeUsers: new Set(),
            revealMode: false,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        }

        await saveGameData()

        io.emit('gameData', {
            ...gameData,
            activeUsers: Array.from(gameData.activeUsers)
        })
        io.emit('revealModeUpdate', false)
        io.emit('adminMessage', 'Game reset successfully!')

        console.log('Admin reset the game')
    })

    socket.on('disconnect', () => {
        adminSessions.delete(socket.id)
        console.log('User disconnected:', socket.id)
    })
})

// Health check endpoint with data info
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeUsers: gameData.activeUsers.size,
        chipCount: gameData.chips.length,
        totalVotes: Object.keys(gameData.votes).length,
        revealMode: gameData.revealMode,
        lastUpdated: gameData.lastUpdated || 'unknown'
    })
})

// API endpoint to get current game state (for debugging)
app.get('/api/game-state', (req, res) => {
    const adminSecret = req.query.admin

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({error: 'Unauthorized'})
    }

    res.json({
        ...gameData,
        activeUsers: Array.from(gameData.activeUsers)
    })
})

// Export/Backup endpoint for admins
app.get('/api/backup', (req, res) => {
    const adminSecret = req.query.admin

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({error: 'Unauthorized'})
    }

    const filename = `chips-tasting-backup-${new Date().toISOString().split('T')[0]}.json`
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.setHeader('Content-Type', 'application/json')

    res.json({
        ...gameData,
        activeUsers: Array.from(gameData.activeUsers),
        backupCreated: new Date().toISOString()
    })
})

// Import endpoint for admins
app.post('/api/import', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret']

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({error: 'Unauthorized'})
    }

    try {
        const importedData = req.body

        // Validate imported data structure
        if (!importedData.chips || !Array.isArray(importedData.chips)) {
            return res.status(400).json({error: 'Invalid data: chips array is required'})
        }

        if (!importedData.votes || typeof importedData.votes !== 'object') {
            return res.status(400).json({error: 'Invalid data: votes object is required'})
        }

        // Preserve current active users but import everything else
        const currentActiveUsers = gameData.activeUsers

        gameData = {
            chips: importedData.chips,
            votes: importedData.votes,
            activeUsers: currentActiveUsers, // Keep current active users
            revealMode: importedData.revealMode || false,
            createdAt: importedData.createdAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            importedAt: new Date().toISOString()
        }

        await saveGameData()

        // Broadcast updated data to all clients
        io.emit('gameData', {
            ...gameData,
            activeUsers: Array.from(gameData.activeUsers)
        })
        io.emit('revealModeUpdate', gameData.revealMode)

        console.log(`📥 Admin imported game data: ${gameData.chips.length} chips, ${Object.keys(gameData.votes).length} users with votes`)

        res.json({
            success: true,
            message: 'Game data imported successfully',
            stats: {
                chips: gameData.chips.length,
                users: Object.keys(gameData.votes).length,
                revealMode: gameData.revealMode
            }
        })

    } catch (error) {
        console.error('❌ Error importing game data:', error.message)
        res.status(500).json({error: 'Failed to import data: ' + error.message})
    }
})

// Initialize server
async function startServer() {
    await loadGameData()

    server.listen(PORT, () => {
        console.log(`🥔 Chips Tasting Server running on port ${PORT}`)
        console.log(`🔐 Admin secret: ${ADMIN_SECRET}`)
        console.log(`📊 Health check: http://localhost:${PORT}/health`)
        console.log(`💾 Data file: ${DATA_FILE}`)
        console.log(`🔗 Backup URL: http://localhost:${PORT}/api/backup?admin=${ADMIN_SECRET}`)
    })
}

startServer().catch(console.error)