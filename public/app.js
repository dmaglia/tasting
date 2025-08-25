class ChipsTastingApp {
    constructor() {
        this.socket = io()
        this.username = ''
        this.gameData = {chips: [], votes: {}}
        this.chart = null
        this.isAdmin = false
        this.revealMode = false

        this.loadUserSession()
        this.setupSocketListeners()
        this.setupEventListeners()
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true)
            if (this.username) {
                this.socket.emit('joinGame', this.username)
            }
        })

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false)
        })

        this.socket.on('gameData', (data) => {
            this.gameData = data
            this.renderChips()
            this.updateLeaderboard()
            this.updateAdminData()
        })

        this.socket.on('userUpdate', (users) => {
            document.getElementById('userCount').textContent = users.length
        })

        this.socket.on('adminMessage', (message) => {
            alert(message)
        })

        this.socket.on('revealModeUpdate', (revealMode) => {
            this.revealMode = revealMode
            this.updateRevealButton()
            this.updateLeaderboardAccess()
            this.renderChips()
            this.updateLeaderboard()
        })
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab))
        })

        // Enter key handlers
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame()
        })

        document.getElementById('adminPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.adminLogin()
        })

        document.getElementById('newChipInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addChip()
        })
    }

    loadUserSession() {
        const savedUser = localStorage.getItem('chips-tasting-user')
        if (savedUser) {
            this.username = savedUser
            document.getElementById('userSetup').style.display = 'none'
            document.getElementById('gameInterface').style.display = 'block'
            document.getElementById('currentUsername').textContent = this.username
        }

        // Initialize leaderboard access
        this.updateLeaderboardAccess()
    }

    saveUserSession() {
        localStorage.setItem('chips-tasting-user', this.username)
    }

    updateConnectionStatus(connected) {
        const dot = document.querySelector('.status-dot')
        const text = document.querySelector('.status-text')

        if (connected) {
            dot.classList.add('connected')
            dot.classList.remove('disconnected')
            text.textContent = 'Connected'
        } else {
            dot.classList.remove('connected')
            dot.classList.add('disconnected')
            text.textContent = 'Disconnected'
        }
    }

    joinGame() {
        const input = document.getElementById('usernameInput')
        const username = input.value.trim()

        if (username.length < 2) {
            alert('Please enter a name with at least 2 characters')
            return
        }

        this.username = username
        this.saveUserSession()
        this.socket.emit('joinGame', username)

        document.getElementById('userSetup').style.display = 'none'
        document.getElementById('gameInterface').style.display = 'block'
        document.getElementById('currentUsername').textContent = username
    }

    logout() {
        if (confirm('Are you sure you want to switch users? Your session will be cleared.')) {
            localStorage.removeItem('chips-tasting-user')
            this.username = ''
            this.isAdmin = false

            document.getElementById('userSetup').style.display = 'block'
            document.getElementById('gameInterface').style.display = 'none'
            document.getElementById('usernameInput').value = ''

            // Reset admin state
            document.getElementById('adminLogin').style.display = 'block'
            document.getElementById('adminPanelContent').style.display = 'none'
            document.getElementById('adminPassword').value = ''
        }
    }

    switchTab(tabName) {
        // Check if leaderboard is accessible
        if (tabName === 'leaderboard' && !this.revealMode) {
            // Show locked state but still switch tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))

            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
            document.getElementById(`${tabName}-tab`).classList.add('active')
            return
        }

        // Only handle voting and leaderboard tabs now
        if (tabName !== 'voting' && tabName !== 'leaderboard') return

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
        document.getElementById(`${tabName}-tab`).classList.add('active')

        if (tabName === 'leaderboard' && this.revealMode) {
            setTimeout(() => this.updateChart(), 100)
        }
    }

    updateLeaderboardAccess() {
        const leaderboardContent = document.getElementById('leaderboardContent')

        if (this.revealMode) {
            // Unlock leaderboard
            leaderboardTab.classList.remove('disabled')
            leaderboardLock.style.display = 'none'
            leaderboardLocked.style.display = 'none'
            leaderboardContent.style.display = 'block'
        } else {
            // Lock leaderboard
            leaderboardTab.classList.add('disabled')
            leaderboardLock.style.display = 'inline'
            leaderboardLocked.style.display = 'flex'
            leaderboardContent.style.display = 'none'
        }
    }

    toggleAdminPanel() {
        const panel = document.getElementById('admin-panel')
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'

        if (panel.style.display === 'flex') {
            this.renderChipsManagement()
        }
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

        // Send password to server for verification
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

        const input = document.getElementById('newChipInput')
        const chipName = input.value.trim()

        if (chipName.length < 2) {
            alert('Please enter a chip name with at least 2 characters')
            return
        }

        if (this.gameData.chips.includes(chipName)) {
            alert('This chip flavor already exists!')
            return
        }

        this.socket.emit('addChip', chipName)
        input.value = ''
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
        // If we're in admin panel and logged in as admin, always show real names
        if (this.isAdmin && document.querySelector('.admin-panel-content')?.style.display !== 'none') {
            return chip
        }
        // For regular users, follow reveal mode
        if (this.revealMode) {
            return chip
        }
        return `Sample #${index + 1}`
    }

    renderChips() {
        const container = document.getElementById('chipsGrid')

        if (this.gameData.chips.length === 0) {
            container.innerHTML = '<div class="no-data">No chip samples available yet. Admin will add them soon!</div>'
            return
        }

        container.innerHTML = this.gameData.chips.map((chip, index) => {
            const hasUserVoted = this.hasUserVotedForChip(chip)
            const cardClass = hasUserVoted ? 'chip-card completed' : 'chip-card'

            return `
                <div class="${cardClass}">
                    ${hasUserVoted ? '<div class="completion-indicator">✓</div>' : ''}
                    <div class="chip-name">🥔 ${this.getChipDisplayName(chip, index)}</div>
                    <div class="criteria-grid">
                        ${this.renderCriterion(chip, 'taste', '👅 Taste')}
                        ${this.renderCriterion(chip, 'appearance', '👀 Looks')}
                        ${this.renderCriterion(chip, 'mouthfeel', '🤤 Mouthfeel')}
                    </div>
                </div>
            `
        }).join('')

        this.setupStarClickHandlers()
        document.getElementById('chipCount').textContent = this.gameData.chips.length
    }

    hasUserVotedForChip(chip) {
        const userVotes = this.gameData.votes[this.username]?.[chip]
        return userVotes && userVotes.taste && userVotes.appearance && userVotes.mouthfeel
    }

    renderCriterion(chip, criterion, label) {
        const userVote = this.getUserVote(chip, criterion)
        const stars = Array.from({length: 5}, (_, i) => {
            const rating = i + 1
            let starClass = 'star'
            let starSymbol = '☆' // Empty star outline

            if (userVote > 0) {
                // User has voted
                if (rating <= userVote) {
                    starClass = 'star filled'
                    starSymbol = '★' // Filled star
                } else {
                    starClass = 'star outline'
                    starSymbol = '☆' // Outline star in gold color
                }
            }

            return `<span class="${starClass}" data-chip="${chip}" data-criterion="${criterion}" data-rating="${rating}">${starSymbol}</span>`
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

            // Simple hover effect - just scale, no color changes
            star.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'scale(1.1)'
            })

            star.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'scale(1)'
            })
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

        this.gameData.chips.forEach(chip => {
            const votes = Object.values(this.gameData.votes)
                .map(userVotes => userVotes[chip])
                .filter(vote => vote && vote.taste && vote.appearance && vote.mouthfeel)

            if (votes.length > 0) {
                averages[chip] = {
                    taste: votes.reduce((sum, v) => sum + v.taste, 0) / votes.length,
                    appearance: votes.reduce((sum, v) => sum + v.appearance, 0) / votes.length,
                    mouthfeel: votes.reduce((sum, v) => sum + v.mouthfeel, 0) / votes.length,
                    overall: votes.reduce((sum, v) => sum + v.taste + v.appearance + v.mouthfeel, 0) / (votes.length * 3),
                    count: votes.length
                }
            }
        })

        return averages
    }

    updateLeaderboard() {
        const averages = this.calculateAverages()
        const totalVotes = Object.values(averages).reduce((sum, chip) => sum + chip.count, 0)

        document.getElementById('voteCount').textContent = totalVotes

        this.updateRanking('overallRanking', averages, 'overall')
        this.updateRanking('tasteRanking', averages, 'taste')
        this.updateRanking('appearanceRanking', averages, 'appearance')
        this.updateRanking('mouthfeelRanking', averages, 'mouthfeel')
    }

    updateRanking(elementId, averages, criterion) {
        const sorted = Object.entries(averages)
            .sort(([, a], [, b]) => b[criterion] - a[criterion])

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

        const element = document.getElementById(elementId)
        element.innerHTML = html || '<div class="no-data">No votes yet</div>'
    }

    updateChart() {
        const averages = this.calculateAverages()
        const ctx = document.getElementById('leaderboardChart').getContext('2d')

        if (this.chart) {
            this.chart.destroy()
        }

        const data = Object.entries(averages).map(([chip, scores]) => {
            const chipIndex = this.gameData.chips.indexOf(chip)
            return {
                chip: this.getChipDisplayName(chip, chipIndex),
                overall: scores.overall
            }
        }).sort((a, b) => b.overall - a.overall)

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.chip),
                datasets: [{
                    label: 'Overall Rating',
                    data: data.map(d => d.overall),
                    backgroundColor: '#dc2626',
                    borderColor: '#b91c1c',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Overall Chip Rankings',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        })
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

        // Update chips management
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

        // Create download link
        const exportUrl = `/api/backup?admin=${encodeURIComponent(adminSecret)}`
        const link = document.createElement('a')
        link.href = exportUrl
        link.download = `chips-tasting-backup-${new Date().toISOString().split('T')[0]}.json`

        // Trigger download
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        console.log('📤 Game data export initiated')
    }

    async importGameData(file) {
        if (!this.isAdmin) {
            alert('Only admins can import game data')
            return
        }

        try {
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
                console.log('📥 Game data imported successfully:', result)
            } else {
                alert(`❌ Import failed: ${result.error}`)
                console.error('Import error:', result)
            }
        } catch (error) {
            alert(`❌ Import failed: ${error.message}`)
            console.error('Import error:', error)
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.onerror = (e) => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }
}

// Global functions for onclick handlers
function joinGame() {
    app.joinGame()
}

function logout() {
    app.logout()
}

function toggleAdminPanel() {
    app.toggleAdminPanel()
}

function closeAdminPanel() {
    app.closeAdminPanel()
}

function adminLogin() {
    app.adminLogin()
}

function adminLogout() {
    app.adminLogout()
}

function addChip() {
    app.addChip()
}

function removeChip(chipName) {
    app.removeChip(chipName)
}

function toggleReveal() {
    app.toggleReveal()
}

function resetGame() {
    app.resetGame()
}

function exportGameData() {
    app.exportGameData()
}

function handleFileImport(event) {
    const file = event.target.files[0]
    if (file && file.type === 'application/json') {
        app.importGameData(file)
    } else {
        alert('Please select a valid JSON file')
    }
    // Reset file input
    event.target.value = ''
}

// Initialize app when page loads
let app
document.addEventListener('DOMContentLoaded', () => {
    app = new ChipsTastingApp()
})