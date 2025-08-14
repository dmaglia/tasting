class ChipsTastingApp {
    constructor() {
        this.socket = io()
        this.username = ''
        this.gameData = {chips: [], votes: {}}
        this.chart = null
        this.setupSocketListeners()
        this.setupEventListeners()
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true)
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

        document.getElementById('newChipInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addChip()
        })

        document.getElementById('adminSecret').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.resetGame()
        })
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
        this.socket.emit('joinGame', username)

        document.getElementById('userSetup').style.display = 'none'
        document.getElementById('gameInterface').style.display = 'block'
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active')
        document.getElementById(`${tabName}-tab`).classList.add('active')

        if (tabName === 'leaderboard') {
            setTimeout(() => this.updateChart(), 100)
        }
    }

    addChip() {
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

    renderChips() {
        const container = document.getElementById('chipsGrid')

        if (this.gameData.chips.length === 0) {
            container.innerHTML = '<div class="no-data">No chips added yet. Be the first to add one!</div>'
            return
        }

        container.innerHTML = this.gameData.chips.map(chip => `
            <div class="chip-card">
                <div class="chip-name">${chip}</div>
                <div class="criteria-grid">
                    ${this.renderCriterion(chip, 'taste', '👅 Taste')}
                    ${this.renderCriterion(chip, 'appearance', '👀 Looks')}
                    ${this.renderCriterion(chip, 'mouthfeel', '🤤 Feel')}
                </div>
            </div>
        `).join('')

        this.setupStarClickHandlers()
        document.getElementById('chipCount').textContent = this.gameData.chips.length
    }

    renderCriterion(chip, criterion, label) {
        const userVote = this.getUserVote(chip, criterion)
        const stars = Array.from({length: 5}, (_, i) => {
            const filled = i < userVote ? 'filled' : ''
            return `<span class="star ${filled}" data-chip="${chip}" data-criterion="${criterion}" data-rating="${i + 1}">⭐</span>`
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
            const stars = '⭐'.repeat(Math.round(scores[criterion]))
            return `
                <div class="rank-item">
                    <span class="rank-position">${index + 1}.</span>
                    <span class="rank-name">${chip}</span>
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

        const data = Object.entries(averages).map(([chip, scores]) => ({
            chip,
            overall: scores.overall
        })).sort((a, b) => b.overall - a.overall)

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
        const display = document.getElementById('adminDataDisplay')
        display.textContent = JSON.stringify(this.gameData, null, 2)
    }

    resetGame() {
        const secret = document.getElementById('adminSecret').value
        if (!secret) {
            alert('Please enter the admin password')
            return
        }

        if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
            this.socket.emit('adminReset', secret)
            document.getElementById('adminSecret').value = ''
        }
    }
}

// Global functions for onclick handlers
function joinGame() {
    app.joinGame()
}

function addChip() {
    app.addChip()
}

function resetGame() {
    app.resetGame()
}

// Initialize app when page loads
let app
document.addEventListener('DOMContentLoaded', () => {
    app = new ChipsTastingApp()
})