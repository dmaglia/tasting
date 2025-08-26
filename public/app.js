class ChipsTastingApp {
    constructor() {
        this.socket = io()
        this.username = ''
        this.gameData = {chips: [], votes: {}}
        this.config = {}
        this.chart = null
        this.personalChart = null
        this.isAdmin = false
        this.revealMode = false

        this.loadUserSession()
        this.setupSocketListeners()
        this.setupEventListeners()
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true)
            if (this.username) this.socket.emit('joinGame', this.username)
        })

        this.socket.on('disconnect', () => this.updateConnectionStatus(false))

        this.socket.on('gameData', (data) => {
            this.gameData = data
            this.revealMode = data.revealMode || false
            this.renderAll()
        })

        this.socket.on('userUpdate', (users) => {
            document.getElementById('userCount').textContent = users.length
        })

        this.socket.on('adminMessage', (message) => alert(message))

        this.socket.on('revealModeUpdate', (revealMode) => {
            this.revealMode = revealMode
            this.updateLeaderboardAccess()
            this.renderAll()
        })

        this.socket.on('config', (config) => {
            this.config = config
            this.updateUIFromConfig()
            this.renderAll()
        })
    }

    renderAll() {
        this.renderChips()
        this.updateLeaderboard()
        this.updatePersonalRankings()
        this.updateAdminData()
        this.updateRevealButton()
        this.updateLeaderboardAccess()
    }

    updateUIFromConfig() {
        if (!this.config.event) return

        const updates = {
            'pageTitle': `${this.config.event.title} ${this.config.event.subtitle}`,
            'eventTitle': `${this.config.product?.emoji || '🧪'} Welcome to ${this.config.event.title} ${this.config.product?.emoji || '🧪'}`,
            'eventSubtitle': this.config.event.subtitle,
            'eventDescription': this.config.event.description,
            'eventCallToAction': this.config.event.callToAction,
            'joinInstructions': this.config.product?.sampleNamePlural ? `Enter your name to start rating our mystery ${this.config.product.sampleNamePlural}!` : null,
            'joinButton': this.config.ui?.joinButtonText,
            'votingTab': this.config.product?.namePlural ? `Rate ${this.config.product.namePlural.charAt(0).toUpperCase() + this.config.product.namePlural.slice(1)}` : null,
            'instructionsTitle': this.config.ui?.instructionsTitle ? `${this.config.product?.emoji || '🧪'} ${this.config.ui.instructionsTitle}` : null,
            'instructionsText': this.config.ui?.instructionsText,
            'personalTitle': this.config.ui?.personalRankingsTitle ? `📊 ${this.config.ui.personalRankingsTitle}` : null,
            'personalSubtitle': this.config.ui?.personalRankingsSubtitle,
            'lockedMessage': this.config.ui?.lockedMessage,
            'waitingText': this.config.ui?.waitingMessage,
            'samplesLabel': this.config.product?.unit ? `${this.config.product.unit}s` : null,
            'manageSamplesTitle': this.config.product ? `${this.config.product.emoji} Manage ${this.config.product.unit}s` : null,
            'manageSamplesDescription': this.config.product?.sampleNamePlural ? `Add new ${this.config.product.sampleNamePlural} or remove existing ones` : null
        }

        Object.entries(updates).forEach(([id, text]) => {
            if (text) {
                const element = document.getElementById(id)
                if (element) {
                    if (id === 'joinButton') element.textContent = text
                    else if (id === 'newChipInput') element.placeholder = text
                    else element.textContent = text
                }
            }
        })

        this.updateRankingGrids()
        this.updateRankingTitles()
    }

    updateRankingGrids() {
        if (!this.config.criteria) return

        const cards = ['overall', ...this.config.criteria.map(c => c.key)]
        const createCard = (key, isPersonal = false) => {
            const prefix = isPersonal ? 'personal' : ''
            const capitalKey = key.charAt(0).toUpperCase() + key.slice(1)

            let title, emoji
            if (key === 'overall') {
                title = isPersonal ? 'Your Favorites' : this.config.rankings?.overall?.name || 'Overall Champion'
                emoji = isPersonal ? '🏆' : this.config.rankings?.overall?.emoji || '🏆'
            } else {
                const criterion = this.config.criteria.find(c => c.key === key)
                const ranking = this.config.rankings?.[key]
                title = isPersonal ? `Your ${criterion.name} Picks` : ranking?.name || `Best ${criterion.name}`
                emoji = isPersonal ? criterion.emoji : ranking?.emoji || criterion.emoji
            }

            return `
                <div class="ranking-card">
                    <h3 id="${prefix}${capitalKey}Title">${emoji} ${title}</h3>
                    <div id="${prefix}${capitalKey}Ranking"></div>
                </div>
            `
        }

        document.getElementById('personalRankingsGrid').innerHTML = cards.map(key => createCard(key, true)).join('')
        document.getElementById('leaderboardRankingsGrid').innerHTML = cards.map(key => createCard(key)).join('')
    }

    updateRankingTitles() {
        if (!this.config.rankings) return

        Object.entries(this.config.rankings).forEach(([key, config]) => {
            const element = document.getElementById(`${key}Title`)
            if (element) element.textContent = `${config.emoji} ${config.name}`
        })
    }

    setupEventListeners() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab))
        })

        const enterHandlers = {
            'usernameInput': () => this.joinGame(),
            'adminPassword': () => this.adminLogin(),
            'newChipInput': () => this.addChip()
        }

        Object.entries(enterHandlers).forEach(([id, handler]) => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handler()
            })
        })
    }

    loadUserSession() {
        const savedUser = localStorage.getItem('chips-tasting-user')
        if (savedUser) {
            this.username = savedUser
            this.showGameInterface()
        }
        this.updateLeaderboardAccess()
    }

    showGameInterface() {
        document.getElementById('userSetup').style.display = 'none'
        document.getElementById('gameInterface').style.display = 'block'
        document.getElementById('currentUsername').textContent = this.username
    }

    updateConnectionStatus(connected) {
        const dot = document.querySelector('.status-dot')
        const text = document.querySelector('.status-text')

        dot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`
        text.textContent = connected ? 'Connected' : 'Disconnected'
    }

    joinGame() {
        const username = document.getElementById('usernameInput').value.trim()

        if (username.length < 2) {
            alert('Please enter a name with at least 2 characters')
            return
        }

        this.username = username
        localStorage.setItem('chips-tasting-user', username)
        this.socket.emit('joinGame', username)
        this.showGameInterface()
    }

    logout() {
        if (confirm('Are you sure you want to switch users? Your session will be cleared.')) {
            localStorage.removeItem('chips-tasting-user')
            this.username = ''
            this.isAdmin = false

            document.getElementById('userSetup').style.display = 'block'
            document.getElementById('gameInterface').style.display = 'none'
            document.getElementById('usernameInput').value = ''
            this.adminLogout()
        }
    }

    switchTab(tabName) {
        if (!['voting', 'leaderboard', 'personal'].includes(tabName)) return

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
        document.getElementById(`${tabName}-tab`).classList.add('active')

        if (tabName === 'leaderboard' && this.revealMode) {
            setTimeout(() => this.updateChart(), 100)
        }

        if (tabName === 'personal') {
            setTimeout(() => this.updatePersonalChart(), 100)
        }
    }

    updateLeaderboardAccess() {
        const leaderboardTab = document.getElementById('leaderboardTab')
        const leaderboardLock = document.getElementById('leaderboardLock')
        const leaderboardLocked = document.getElementById('leaderboardLocked')
        const leaderboardContent = document.getElementById('leaderboardContent')

        if (this.revealMode) {
            leaderboardTab.classList.remove('disabled')
            leaderboardLock.style.display = 'none'
            leaderboardLocked.style.display = 'none'
            leaderboardContent.style.display = 'block'
        } else {
            leaderboardTab.classList.add('disabled')
            leaderboardLock.style.display = 'inline'
            leaderboardLocked.style.display = 'flex'
            leaderboardContent.style.display = 'none'
        }
    }

    toggleAdminPanel() {
        const panel = document.getElementById('admin-panel')
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'
        if (panel.style.display === 'flex') this.renderChipsManagement()
    }

    closeAdminPanel() {
        document.getElementById('admin-panel').style.display = 'none'
        this.adminLogout()
    }

    adminLogin() {
        const password = document.getElementById('adminPassword').value
        if (!password) {
            alert('Please enter the admin password')
            return
        }

        this.socket.emit('adminLogin', password, (success) => {
            if (success) {
                this.isAdmin = true
                document.getElementById('adminLogin').style.display = 'none'
                document.getElementById('adminPanelContent').style.display = 'block'
                this.updateAdminData()
                this.updateRevealButton()
                this.renderChipsManagement()
            } else {
                alert('Invalid admin password')
                document.getElementById('adminPassword').value = ''
            }
        })
    }

    adminLogout() {
        this.isAdmin = false
        document.getElementById('adminLogin').style.display = 'block'
        document.getElementById('adminPanelContent').style.display = 'none'
        document.getElementById('adminPassword').value = ''
    }

    addChip() {
        if (!this.isAdmin) {
            alert('Only admins can add new chip samples')
            return
        }

        const chipName = document.getElementById('newChipInput').value.trim()
        if (chipName.length < 2) {
            alert('Please enter a chip name with at least 2 characters')
            return
        }

        if (this.gameData.chips.includes(chipName)) {
            alert('This chip flavor already exists!')
            return
        }

        this.socket.emit('addChip', chipName)
        document.getElementById('newChipInput').value = ''
    }

    removeChip(chipName) {
        if (!this.isAdmin) {
            alert('Only admins can remove chip samples')
            return
        }

        if (confirm(`Are you sure you want to remove "${chipName}"? This will also delete all votes for this chip.`)) {
            this.socket.emit('removeChip', chipName)
        }
    }

    toggleReveal() {
        if (!this.isAdmin) return
        this.socket.emit('toggleReveal', !this.revealMode)
    }

    updateRevealButton() {
        const button = document.getElementById('revealToggle')
        const text = document.getElementById('revealText')
        const status = document.getElementById('revealStatus')

        if (!button || !text || !status) return

        if (this.revealMode) {
            button.classList.add('active')
            text.textContent = '🎭 Hide Names'
            status.textContent = 'Currently: Names Revealed'
        } else {
            button.classList.remove('active')
            text.textContent = '🎭 Reveal Names'
            status.textContent = 'Currently: Blind Mode'
        }
    }

    renderChipsManagement() {
        if (!this.isAdmin) return

        const container = document.getElementById('chipsManagement')
        if (!container) return

        if (this.gameData.chips.length === 0) {
            container.innerHTML = '<p class="no-data">No chips added yet</p>'
            return
        }

        container.innerHTML = `
            <h5>Current Chips:</h5>
            ${this.gameData.chips.map(chip => `
                <div class="chip-item">
                    <span class="chip-item-name">${chip}</span>
                    <button class="remove-chip-btn" onclick="removeChip('${chip}')">Remove</button>
                </div>
            `).join('')}
        `
    }

    getChipDisplayName(chip, index) {
        if (this.isAdmin && document.querySelector('.admin-panel-content')?.style.display !== 'none') {
            return chip
        }
        return this.revealMode ? chip : `Sample #${index + 1}`
    }

    renderChips() {
        const container = document.getElementById('chipsGrid')

        if (this.gameData.chips.length === 0) {
            container.innerHTML = `<div class="no-data">${this.config.ui?.noSamplesMessage || 'No samples available yet. Admin will add them soon!'}</div>`
            return
        }

        container.innerHTML = this.gameData.chips.map((chip, index) => {
            const hasUserVoted = this.hasUserVotedForChip(chip)
            return `
                <div class="${hasUserVoted ? 'chip-card completed' : 'chip-card'}">
                    ${hasUserVoted ? '<div class="completion-indicator">✓</div>' : ''}
                    <div class="chip-name">${this.getChipDisplayName(chip, index)}</div>
                    <div class="criteria-grid">
                        ${this.renderCriteria(chip)}
                    </div>
                </div>
            `
        }).join('')

        this.setupStarClickHandlers()
        document.getElementById('chipCount').textContent = this.gameData.chips.length
    }

    hasUserVotedForChip(chip) {
        const userVotes = this.gameData.votes[this.username]?.[chip]
        if (!userVotes) return false

        const criteria = this.config.criteria || [{key: 'taste'}, {key: 'appearance'}, {key: 'mouthfeel'}]
        return criteria.every(c => userVotes[c.key])
    }

    renderCriteria(chip) {
        const criteria = this.config.criteria || [
            {key: 'taste', emoji: '👅', name: 'Taste'},
            {key: 'appearance', emoji: '👀', name: 'Looks'},
            {key: 'mouthfeel', emoji: '🤤', name: 'Mouthfeel'}
        ]

        return criteria.map(criterion =>
            this.renderCriterion(chip, criterion.key, `${criterion.emoji} ${criterion.name}`)
        ).join('')
    }

    renderCriterion(chip, criterion, label) {
        const userVote = this.getUserVote(chip, criterion)
        const stars = Array.from({length: 5}, (_, i) => {
            const rating = i + 1
            const isFilled = userVote > 0 && rating <= userVote
            const symbol = isFilled ? '★' : '☆'
            const className = userVote > 0 ? (isFilled ? 'star filled' : 'star outline') : 'star'

            return `<span class="${className}" data-chip="${chip}" data-criterion="${criterion}" data-rating="${rating}">${symbol}</span>`
        }).join('')

        return `
            <div class="criterion">
                <span class="criterion-label">${label}</span>
                <div class="star-rating">${stars}</div>
            </div>
        `
    }

    setupStarClickHandlers() {
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', (e) => {
                const {chip, criterion, rating} = e.target.dataset
                this.submitVote(chip, criterion, parseInt(rating))
            })

            star.addEventListener('mouseenter', (e) => e.target.style.transform = 'scale(1.1)')
            star.addEventListener('mouseleave', (e) => e.target.style.transform = 'scale(1)')
        })
    }

    getUserVote(chip, criterion) {
        return this.gameData.votes[this.username]?.[chip]?.[criterion] || 0
    }

    submitVote(chip, criterion, rating) {
        this.socket.emit('submitVote', {
            username: this.username,
            chip,
            criterion,
            rating
        })
    }

    calculateAverages() {
        const averages = {}
        const criteria = this.config.criteria || [
            {key: 'taste'},
            {key: 'appearance'},
            {key: 'mouthfeel'}
        ]

        this.gameData.chips.forEach(chip => {
            const votes = Object.values(this.gameData.votes)
                .map(userVotes => userVotes[chip])
                .filter(vote => vote && criteria.every(c => vote[c.key]))

            if (votes.length > 0) {
                const chipAverages = {count: votes.length, overall: 0}
                let total = 0

                criteria.forEach(c => {
                    const sum = votes.reduce((s, v) => s + v[c.key], 0)
                    chipAverages[c.key] = sum / votes.length
                    total += chipAverages[c.key]
                })

                chipAverages.overall = total / criteria.length
                averages[chip] = chipAverages
            }
        })

        return averages
    }

    updateLeaderboard() {
        const averages = this.calculateAverages()
        const totalVotes = Object.values(averages).reduce((sum, chip) => sum + chip.count, 0)
        document.getElementById('voteCount').textContent = totalVotes

        const criteriaKeys = ['overall', ...(this.config.criteria || [{key: 'taste'}, {key: 'appearance'}, {key: 'mouthfeel'}]).map(c => c.key)]
        criteriaKeys.forEach(key => this.updateRanking(`${key}Ranking`, averages, key))
    }

    updateRanking(elementId, averages, criterion) {
        const element = document.getElementById(elementId)
        if (!element) return

        const sorted = Object.entries(averages).sort(([, a], [, b]) => b[criterion] - a[criterion])
        const html = sorted.map(([chip, scores], index) => {
            const chipIndex = this.gameData.chips.indexOf(chip)
            const displayName = this.getChipDisplayName(chip, chipIndex)
            const stars = '⭐'.repeat(Math.round(scores[criterion]))

            return `
                <div class="rank-item">
                    <span class="rank-position">${index + 1}.</span>
                    <span class="rank-name">${displayName}</span>
                    <span class="rank-score">${stars} ${scores[criterion].toFixed(1)}</span>
                </div>
            `
        }).join('')

        element.innerHTML = html || '<div class="no-data">No votes yet</div>'
    }

    updateChart() {
        const averages = this.calculateAverages()
        const ctx = document.getElementById('leaderboardChart').getContext('2d')

        if (this.chart) this.chart.destroy()

        const data = Object.entries(averages)
            .map(([chip, scores]) => ({
                chip: this.getChipDisplayName(chip, this.gameData.chips.indexOf(chip)),
                overall: scores.overall
            }))
            .sort((a, b) => b.overall - a.overall)

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.chip),
                datasets: [{
                    label: 'Overall Rating',
                    data: data.map(d => d.overall),
                    backgroundColor: '#fbbf24',
                    borderColor: '#fbbf24',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {display: false},
                    title: {
                        display: true,
                        text: 'Overall Chip Rankings',
                        font: {size: 16, weight: 'bold'}
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {stepSize: 1}
                    }
                }
            }
        })
    }

    calculatePersonalScores() {
        const personalScores = {}
        const userVotes = this.gameData.votes[this.username] || {}
        const criteria = this.config.criteria || [
            {key: 'taste'},
            {key: 'appearance'},
            {key: 'mouthfeel'}
        ]

        this.gameData.chips.forEach(chip => {
            const votes = userVotes[chip]
            const hasAllVotes = criteria.every(c => votes && votes[c.key])

            if (hasAllVotes) {
                const scores = {overall: 0}
                let total = 0

                criteria.forEach(c => {
                    scores[c.key] = votes[c.key]
                    total += votes[c.key]
                })

                scores.overall = total / criteria.length
                personalScores[chip] = scores
            }
        })

        return personalScores
    }

    updatePersonalChart() {
        const personalScores = this.calculatePersonalScores()
        const ctx = document.getElementById('personalChart').getContext('2d')

        if (this.personalChart) this.personalChart.destroy()

        const data = Object.entries(personalScores)
            .map(([chip, scores]) => ({
                chip: this.getChipDisplayName(chip, this.gameData.chips.indexOf(chip)),
                overall: scores.overall
            }))
            .sort((a, b) => b.overall - a.overall)

        this.personalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.chip),
                datasets: [{
                    label: 'Your Rating',
                    data: data.map(d => d.overall),
                    backgroundColor: '#fbbf24',
                    borderColor: '#fbbf24',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {display: false},
                    title: {
                        display: true,
                        text: 'Your Personal Rankings',
                        font: {size: 16, weight: 'bold'}
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {stepSize: 1}
                    }
                }
            }
        })
    }

    updatePersonalRankings() {
        const personalScores = this.calculatePersonalScores()
        const criteriaKeys = ['overall', ...(this.config.criteria || [{key: 'taste'}, {key: 'appearance'}, {key: 'mouthfeel'}]).map(c => c.key)]

        criteriaKeys.forEach(key => {
            const elementId = `personal${key.charAt(0).toUpperCase() + key.slice(1)}Ranking`
            this.updatePersonalRanking(elementId, personalScores, key)
        })
    }

    updatePersonalRanking(elementId, personalScores, criterion) {
        const element = document.getElementById(elementId)
        if (!element) return

        const sorted = Object.entries(personalScores).sort(([, a], [, b]) => b[criterion] - a[criterion])
        const html = sorted.map(([chip, scores], index) => {
            const chipIndex = this.gameData.chips.indexOf(chip)
            const displayName = this.getChipDisplayName(chip, chipIndex)
            const stars = '⭐'.repeat(Math.round(scores[criterion]))

            return `
                <div class="rank-item">
                    <span class="rank-position">${index + 1}.</span>
                    <span class="rank-name">${displayName}</span>
                    <span class="rank-score">${stars} ${scores[criterion].toFixed(1)}</span>
                </div>
            `
        }).join('')

        element.innerHTML = html || '<div class="no-data">No personal votes yet - start rating!</div>'
    }

    updateAdminData() {
        if (!this.isAdmin) return

        const display = document.getElementById('adminDataDisplay')
        if (!display) return

        const formattedData = {
            chips: this.gameData.chips,
            totalVotes: Object.keys(this.gameData.votes).length,
            revealMode: this.revealMode,
            votes: this.gameData.votes
        }
        display.textContent = JSON.stringify(formattedData, null, 2)
        this.renderChipsManagement()
    }

    resetGame() {
        if (!this.isAdmin) {
            alert('Only admins can reset the game')
            return
        }

        if (confirm('Are you sure you want to reset all data? This will clear all votes and chip samples. This cannot be undone!')) {
            this.socket.emit('adminReset')
        }
    }

    exportGameData() {
        if (!this.isAdmin) {
            alert('Only admins can export game data')
            return
        }

        const adminSecret = prompt('Enter admin password to export data:')
        if (!adminSecret) return

        const link = document.createElement('a')
        link.href = `/api/backup?admin=${encodeURIComponent(adminSecret)}`
        link.download = `chips-tasting-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    async importGameData(file) {
        if (!this.isAdmin) {
            alert('Only admins can import game data')
            return
        }

        try {
            const adminSecret = prompt('Enter admin password to import data:')
            if (!adminSecret) return

            const fileContent = await this.readFileAsText(file)
            const gameData = JSON.parse(fileContent)

            const response = await fetch('/api/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Secret': adminSecret
                },
                body: JSON.stringify(gameData)
            })

            const result = await response.json()

            if (response.ok) {
                alert(`✅ Import successful!\n\nImported:\n• ${result.stats.chips} chip samples\n• ${result.stats.users} users with votes\n• Reveal mode: ${result.stats.revealMode ? 'ON' : 'OFF'}`)
            } else {
                alert(`❌ Import failed: ${result.error}`)
            }
        } catch (error) {
            alert(`❌ Import failed: ${error.message}`)
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }
}

// Global functions for onclick handlers
const globalHandlers = {
    joinGame: () => app.joinGame(),
    logout: () => app.logout(),
    toggleAdminPanel: () => app.toggleAdminPanel(),
    closeAdminPanel: () => app.closeAdminPanel(),
    adminLogin: () => app.adminLogin(),
    adminLogout: () => app.adminLogout(),
    addChip: () => app.addChip(),
    removeChip: (chipName) => app.removeChip(chipName),
    toggleReveal: () => app.toggleReveal(),
    resetGame: () => app.resetGame(),
    exportGameData: () => app.exportGameData(),
    handleFileImport: (event) => {
        const file = event.target.files[0]
        if (file && file.type === 'application/json') {
            app.importGameData(file)
        } else {
            alert('Please select a valid JSON file')
        }
        event.target.value = ''
    }
}

Object.assign(window, globalHandlers)

let app
document.addEventListener('DOMContentLoaded', () => {
    app = new ChipsTastingApp()
})