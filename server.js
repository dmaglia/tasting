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
    cors: {origin: "*", methods: ["GET", "POST"]}
})

const PORT = process.env.PORT || 3000
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'chips2025'
const CONFIG_FILE = process.env.CONFIG_FILE || 'config.json'
const DATA_FILE = path.join(__dirname, 'game-data.json')

let config = {}
let gameData = {}
const adminSessions = new Set()

// Middleware
app.use(helmet({contentSecurityPolicy: false}))
app.use(compression())
app.use(cors())
app.use(express.json({limit: '10mb'}))
app.use(express.static('public'))

async function loadConfig() {
    try {
        const configData = await fs.readFile(path.join(__dirname, CONFIG_FILE), 'utf8')
        config = JSON.parse(configData)
        console.log(`✅ Configuration loaded from ${CONFIG_FILE}`)
    } catch (error) {
        console.log('📝 Using default chips configuration')
        config = {
            event: {
                title: "Tasting Party",
                subtitle: "Blind Tasting Event",
                description: "Welcome to our tasting experience!",
                callToAction: "Rate each sample and help us find the winner!"
            },
            product: {
                name: "sample",
                namePlural: "samples",
                emoji: "🧪",
                sampleName: "sample",
                sampleNamePlural: "samples",
                unit: "Sample"
            },
            defaultSamples: ["Sample A", "Sample B", "Sample C"]
        }
    }
}

function getDefaultGameData() {
    return {
        chips: [...(config.defaultSamples || ['Sample A', 'Sample B', 'Sample C'])],
        votes: {},
        activeUsers: [],
        revealMode: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    }
}

async function loadGameData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8')
        const parsed = JSON.parse(data)
        gameData = {...parsed, activeUsers: new Set(parsed.activeUsers || [])}
        console.log('✅ Game data loaded from file')
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📝 No existing data file found, starting fresh')
        } else {
            console.error('❌ Error loading game data:', error.message)
        }
        gameData = {...getDefaultGameData(), activeUsers: new Set()}
        await saveGameData()
    }
}

async function saveGameData() {
    try {
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

// Auto-save and graceful shutdown
setInterval(saveGameData, 30000)
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...')
    await saveGameData()
    process.exit(0)
})
process.on('SIGTERM', async () => {
    await saveGameData()
    process.exit(0)
})

// Socket handlers
const socketHandlers = {
    joinGame: async (socket, username) => {
        gameData.activeUsers.add(username)
        io.emit('userUpdate', Array.from(gameData.activeUsers))
        console.log(`${username} joined the tasting`)
        await saveGameData()
    },

    adminLogin: (socket, password, callback) => {
        const isValid = password === ADMIN_SECRET
        if (isValid) {
            adminSessions.add(socket.id)
            console.log('Admin logged in:', socket.id)
        }
        callback(isValid)
    },

    addChip: async (socket, chipName) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        if (chipName && !gameData.chips.includes(chipName)) {
            gameData.chips.push(chipName)
            await saveGameData()
            io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
            console.log(`Admin added chip: ${chipName}`)
        }
    },

    removeChip: async (socket, chipName) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        const chipIndex = gameData.chips.indexOf(chipName)
        if (chipIndex > -1) {
            gameData.chips.splice(chipIndex, 1)
            Object.keys(gameData.votes).forEach(username => {
                if (gameData.votes[username][chipName]) {
                    delete gameData.votes[username][chipName]
                }
            })
            await saveGameData()
            io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
            console.log(`Admin removed chip: ${chipName}`)
        }
    },

    submitVote: async (socket, data) => {
        const {username, chip, criterion, rating} = data

        if (rating < 1 || rating > 5) {
            socket.emit('adminMessage', 'Invalid rating: Must be between 1 and 5')
            return
        }

        if (!gameData.votes[username]) gameData.votes[username] = {}
        if (!gameData.votes[username][chip]) gameData.votes[username][chip] = {}

        gameData.votes[username][chip][criterion] = rating
        await saveGameData()
        io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
        console.log(`${username} voted ${rating} for ${chip} (${criterion})`)
    },

    toggleReveal: async (socket, newRevealMode) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        gameData.revealMode = newRevealMode
        await saveGameData()
        io.emit('revealModeUpdate', newRevealMode)
        io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
        console.log(`Admin ${newRevealMode ? 'revealed' : 'hid'} chip names`)
    },

    adminReset: async (socket) => {
        if (!adminSessions.has(socket.id)) {
            socket.emit('adminMessage', 'Unauthorized: Admin access required')
            return
        }

        gameData = {...getDefaultGameData(), activeUsers: new Set()}
        await saveGameData()
        io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
        io.emit('revealModeUpdate', false)
        console.log('Admin reset the game')
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    socket.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
    socket.emit('revealModeUpdate', gameData.revealMode)
    socket.emit('config', config)

    Object.entries(socketHandlers).forEach(([event, handler]) => {
        socket.on(event, (...args) => handler(socket, ...args))
    })

    socket.on('disconnect', () => {
        adminSessions.delete(socket.id)
        console.log('User disconnected:', socket.id)
    })
})

// API endpoints
const apiRoutes = {
    '/api/config': (req, res) => res.json(config),

    '/health': (req, res) => res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeUsers: gameData.activeUsers.size,
        chipCount: gameData.chips.length,
        totalVotes: Object.keys(gameData.votes).length,
        revealMode: gameData.revealMode,
        lastUpdated: gameData.lastUpdated || 'unknown'
    }),

    '/api/game-state': (req, res) => {
        if (req.query.admin !== ADMIN_SECRET) {
            return res.status(401).json({error: 'Unauthorized'})
        }
        res.json({...gameData, activeUsers: Array.from(gameData.activeUsers)})
    },

    '/api/backup': (req, res) => {
        if (req.query.admin !== ADMIN_SECRET) {
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
    }
}

Object.entries(apiRoutes).forEach(([path, handler]) => {
    app.get(path, handler)
})

app.post('/api/import', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret']
    if (adminSecret !== ADMIN_SECRET) {
        return res.status(401).json({error: 'Unauthorized'})
    }

    try {
        const importedData = req.body

        if (!importedData.chips || !Array.isArray(importedData.chips)) {
            return res.status(400).json({error: 'Invalid data: chips array is required'})
        }

        if (!importedData.votes || typeof importedData.votes !== 'object') {
            return res.status(400).json({error: 'Invalid data: votes object is required'})
        }

        const currentActiveUsers = gameData.activeUsers
        gameData = {
            chips: importedData.chips,
            votes: importedData.votes,
            activeUsers: currentActiveUsers,
            revealMode: importedData.revealMode || false,
            createdAt: importedData.createdAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            importedAt: new Date().toISOString()
        }

        await saveGameData()
        io.emit('gameData', {...gameData, activeUsers: Array.from(gameData.activeUsers)})
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

async function startServer() {
    await loadConfig()
    await loadGameData()

    server.listen(PORT, () => {
        console.log(`${config.product?.emoji || '🧪'} ${config.event?.title || 'Tasting'} Server running on port ${PORT}`)
        console.log(`🔐 Admin secret: ${ADMIN_SECRET}`)
        console.log(`📊 Health check: http://localhost:${PORT}/health`)
        console.log(`💾 Data file: ${DATA_FILE}`)
        console.log(`⚙️  Config file: ${CONFIG_FILE}`)
    })
}

startServer().catch(console.error)