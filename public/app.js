class ChipsTastingApp {
    constructor() {
        this.socket = io()
        this.username = ''
        this.gameData = {chips: [], votes: {}}
        this.config = {} // Store configuration
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
            if (this.username) {
                this.socket.emit('joinGame', this.username)
            }
        })

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false)
        })

        this.socket.on('gameData', (data) => {
            this.gameData = data

            if (typeof data.revealMode === 'boolean') {
                this.revealMode = data.revealMode
                this.updateRevealButton()
                this.updateLeaderboardAccess()
            }

            this.renderChips()
            this.updateLeaderboard()
            this.updatePersonalRankings()
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

        this.socket.on('config', (config) => {
            this.config = config
            this.updateUIFromConfig()
            this.updatePersonalRankingsGrid()
            this.updateLeaderboardRankingsGrid()
            this.renderChips()
            this.updateLeaderboard()
            this.updatePersonalRankings()
        })
    }

    updateUIFromConfig() {
        if (!this.config.event) return

        // Update page title
        const pageTitle = document.getElementById('pageTitle')
        if (pageTitle) {
            pageTitle.textContent = `${this.config.event.title} ${this.config.event.subtitle}`
        }

        // Update header elements
        const eventTitle = document.getElementById('eventTitle')
        const eventSubtitle = document.getElementById('eventSubtitle')
        const eventDescription = document.getElementById('eventDescription')
        const eventCallToAction = document.getElementById('eventCallToAction')

        if (eventTitle) {
            eventTitle.textContent = `${this.config.product?.emoji || '🧪'} Welcome to ${this.config.event.title} ${this.config.product?.emoji || '🧪'}`
        }
        if (eventSubtitle) eventSubtitle.textContent = this.config.event.subtitle
        if (eventDescription) eventDescription.textContent = this.config.event.description
        if (eventCallToAction) eventCallToAction.textContent = this.config.event.callToAction

        // Update join instructions and button
        const joinInstructions = document.getElementById('joinInstructions')
        const joinButton = document.getElementById('joinButton')

        if (joinInstructions && this.config.product?.sampleNamePlural) {
            joinInstructions.textContent = `Enter your name to start rating our mystery ${this.config.product.sampleNamePlural}!`
        }
        if (joinButton && this.config.ui?.joinButtonText) {
            joinButton.textContent = this.config.ui.joinButtonText
        }

        // Update tab labels
        const votingTab = document.getElementById('votingTab')
        if (votingTab && this.config.product?.namePlural) {
            votingTab.textContent = `Rate ${this.config.product.namePlural.charAt(0).toUpperCase() + this.config.product.namePlural.slice(1)}`
        }

        // Update instructions
        const instructionsTitle = document.getElementById('instructionsTitle')
        const instructionsText = document.getElementById('instructionsText')

        if (instructionsTitle && this.config.ui?.instructionsTitle) {
            instructionsTitle.textContent = `${this.config.product?.emoji || '🧪'} ${this.config.ui.instructionsTitle}`
        }
        if (instructionsText && this.config.ui?.instructionsText) {
            instructionsText.textContent = this.config.ui.instructionsText
        }

        // Update personal rankings header
        const personalTitle = document.getElementById('personalTitle')
        const personalSubtitle = document.getElementById('personalSubtitle')

        if (personalTitle && this.config.ui?.personalRankingsTitle) {
            personalTitle.textContent = `📊 ${this.config.ui.personalRankingsTitle}`
        }
        if (personalSubtitle && this.config.ui?.personalRankingsSubtitle) {
            personalSubtitle.textContent = this.config.ui.personalRankingsSubtitle
        }

        // Update locked message
        const lockedMessage = document.getElementById('lockedMessage')
        const waitingText = document.getElementById('waitingText')

        if (lockedMessage && this.config.ui?.lockedMessage) {
            lockedMessage.textContent = this.config.ui.lockedMessage
        }
        if (waitingText && this.config.ui?.waitingMessage) {
            waitingText.textContent = this.config.ui.waitingMessage
        }

        // Update stats label
        const samplesLabel = document.getElementById('samplesLabel')
        if (samplesLabel && this.config.product?.unit) {
            samplesLabel.textContent = `${this.config.product.unit}s`
        }

        // Update admin section
        const manageSamplesTitle = document.getElementById('manageSamplesTitle')
        const manageSamplesDescription = document.getElementById('manageSamplesDescription')
        const newChipInput = document.getElementById('newChipInput')

        if (manageSamplesTitle && this.config.product) {
            manageSamplesTitle.textContent = `${this.config.product.emoji} Manage ${this.config.product.unit}s`
        }
        if (manageSamplesDescription && this.config.product?.sampleNamePlural) {
            manageSamplesDescription.textContent = `Add new ${this.config.product.sampleNamePlural} or remove existing ones`
        }
        if (newChipInput && this.config.product?.sampleName) {
            newChipInput.placeholder = `${this.config.product.sampleName} name...`
        }

        // Update ranking titles
        this.updateRankingTitles()
    }

    updateRankingTitles() {
        if (!this.config.rankings) return

        // Update leaderboard ranking titles
        Object.keys(this.config.rankings).forEach(key => {
            const element = document.getElementById(`${key}Title`)
            if (element && this.config.rankings[key]) {
                element.textContent = `${this.config.rankings[key].emoji} ${this.config.rankings[key].name}`
            }
        })

        // Update personal ranking titles with dynamic criteria
        if (this.config.criteria) {
            this.config.criteria.forEach(criterion => {
                const personalElement = document.getElementById(`personal${criterion.key.charAt(0).toUpperCase() + criterion.key.slice(1)}Title`)
                if (personalElement) {
                    personalElement.textContent = `${criterion.emoji} Your ${criterion.name} Picks`
                }
            })
        }

        // Update personal overall title
        const personalOverallTitle = document.getElementById('personalOverallTitle')
        if (personalOverallTitle) {
            personalOverallTitle.textContent = `🏆 Your Favorites`
        }
    }

    updatePersonalRankingsGrid() {
        if (!this.config.criteria) return

        const grid = document.getElementById('personalRankingsGrid')
        if (!grid) return

        // Create ranking cards based on config criteria
        const cards = ['overall', ...this.config.criteria.map(c => c.key)]

        grid.innerHTML = cards.map(key => {
            let title, emoji
            if (key === 'overall') {
                title = 'Your Favorites'
                emoji = '🏆'
            } else {
                const criterion = this.config.criteria.find(c => c.key === key)
                title = `Your ${criterion.name} Picks`
                emoji = criterion.emoji
            }

            return `
                <div class="ranking-card">
                    <h3 id="personal${key.charAt(0).toUpperCase() + key.slice(1)}Title">${emoji} ${title}</h3>
                    <div id="personal${key.charAt(0).toUpperCase() + key.slice(1)}Ranking"></div>
                </div>
            `
        }).join('')
    }

    updateLeaderboardRankingsGrid() {
        if (!this.config.criteria) return

        const grid = document.getElementById('leaderboardRankingsGrid')
        if (!grid) return

        // Create ranking cards based on config criteria
        const cards = ['overall', ...this.config.criteria.map(c => c.key)]

        grid.innerHTML = cards.map(key => {
            let title, emoji
            if (key === 'overall') {
                title = this.config.rankings?.overall?.name || 'Overall Champion'
                emoji = this.config.rankings?.overall?.emoji || '🏆'
            } else {
                const criterion = this.config.criteria.find(c => c.key === key)
                const ranking = this.config.rankings?.[key]
                title = ranking?.name || `Best ${criterion.name}`
                emoji = ranking?.emoji || criterion.emoji
            }

            return `
                <div class="ranking-card">
                    <h3 id="${key}Title">${emoji} ${title}</h3>
                    <div id="${key}Ranking"></div>
                </div>
            `
        }).join('')
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

        // Handle all valid tabs
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
            this.updatePersonalRankings()
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
            container.innerHTML = `<div class="no-data">${this.config.ui?.noSamplesMessage || 'No samples available yet. Admin will add them soon!'}</div>`
            return
        }

        container.innerHTML = this.gameData.chips.map((chip, index) => {
            const hasUserVoted = this.hasUserVotedForChip(chip)
            const cardClass = hasUserVoted ? 'chip-card completed' : 'chip-card'

            return `
                <div class="${cardClass}">
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
        if (!this.config.criteria) {
            // Fallback to default criteria
            return `
                ${this.renderCriterion(chip, 'taste', '👅 Taste')}
                ${this.renderCriterion(chip, 'appearance', '👀 Looks')}
                ${this.renderCriterion(chip, 'mouthfeel', '🤤 Mouthfeel')}
            `
        }

        return this.config.criteria.map(criterion =>
            this.renderCriterion(chip, criterion.key, `${criterion.emoji} ${criterion.name}`)
        ).join('')
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

        criteriaKeys.forEach(key => {
            this.updateRanking(`${key}Ranking`, averages, key)
        })
    }

    updateRanking(elementId, averages, criterion) {
        const element = document.getElementById(elementId)
        if (!element) return

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

        if (this.personalChart) {
            this.personalChart.destroy()
        }

        const data = Object.entries(personalScores).map(([chip, scores]) => {
            const chipIndex = this.gameData.chips.indexOf(chip)
            return {
                chip: this.getChipDisplayName(chip, chipIndex),
                overall: scores.overall
            }
        }).sort((a, b) => b.overall - a.overall)

        this.personalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.chip),
                datasets: [{
                    label: 'Your Rating',
                    data: data.map(d => d.overall),
                    backgroundColor: '#7c3aed',
                    borderColor: '#6d28d9',
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
                        text: 'Your Personal Rankings',
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

        const sorted = Object.entries(personalScores)
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

        const adminSecret = prompt('Enter admin password to export data:')
        if (!adminSecret) return

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