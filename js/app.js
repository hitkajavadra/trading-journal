window.API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';
/**
 * Trading Journal Application Controller
 * Handles visual routing, DOM binding, modal handling, validation logic, and event coordination.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Session Routing Setup
    async function initUserSession() {
        await window.db.initPromise;
        const activeUser = window.db.getActiveUser();
        const appContainer = document.querySelector('.app-container');
        const landingContainer = document.getElementById('landing-container');
        const authContainer = document.getElementById('auth-container');
        
        if (activeUser) {
            // Logged in!
            landingContainer.style.display = 'none';
            authContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            
            // Reload user configurations & details
            const settings = await window.db.getSettings();
            applyTheme(settings.theme || 'dark');
            await refreshHeaderMetrics();
            
            // Update Database State HUD pills
            if (typeof updateDatabaseStateUI === 'function') {
                updateDatabaseStateUI();
            }
            
            // Show admin link if user is hit
            const adminLink = document.getElementById('nav-admin');
            if (adminLink) {
                adminLink.style.display = (activeUser === 'hit') ? 'flex' : 'none';
            }
            
            // Go to dashboard
            await switchView('dashboard');
        } else {
            // Logged out!
            appContainer.style.display = 'none';
            authContainer.style.display = 'none';
            landingContainer.style.display = 'flex';
            
            // Reset theme of landing page to dark for premium feeling
            document.documentElement.setAttribute('data-theme', 'dark');
            
            // Boot landing animations
            initLandingEffects();
        }
        
        // Show legacy migration message if needed
        checkLegacyMigration();
    }

    function checkLegacyMigration() {
        const session = window.db.getActiveUser();
        if (session === 'Trader' && !localStorage.getItem('trading_journal_migration_toast_shown')) {
            setTimeout(() => {
                showToast("Legacy data successfully migrated to 'Trader' account! Default password: trader123", "info");
                localStorage.setItem('trading_journal_migration_toast_shown', 'true');
            }, 1000);
        }
    }

    let particlesInstance = null;
    let dashboardParticlesInstance = null;
    let autopilotActive = false;
    let hologramScene = null;
    let selectedDashboardTrade = null;
    let csmIntervalId = null;
    
    function initLandingEffects() {
        // Star canvas
        if (particlesInstance) {
            particlesInstance.stop();
        }
        particlesInstance = initParticles();
        
        // 3D dynamic card tilts for the long modern landing experience
        bind3DTilt(document.getElementById('hero-3d-shape-tilt'), 18);
        bind3DTilt(document.getElementById('mockup-frame-tilt'), 8);
        bind3DTilt(document.getElementById('mockup-chart-tilt'), 8);
        bind3DTilt(document.getElementById('contact-panel-tilt'), 10);
        
        // Bento tiles
        bind3DTilt(document.getElementById('bento-c-1'), 12);
        bind3DTilt(document.getElementById('bento-c-2'), 12);
        bind3DTilt(document.getElementById('bento-c-3'), 12);
        bind3DTilt(document.getElementById('bento-c-4'), 12);
        
        // Testimonial Reviews cards
        bind3DTilt(document.getElementById('rev-card-1'), 15);
        bind3DTilt(document.getElementById('rev-card-2'), 15);
        bind3DTilt(document.getElementById('rev-card-3'), 15);
    }

    function bind3DTilt(element, maxAngle = 15) {
        if (!element) return;
        element.addEventListener('mousemove', (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const percentX = (x - centerX) / centerX;
            const percentY = (centerY - y) / centerY;
            
            const rotateX = percentY * maxAngle;
            const rotateY = percentX * maxAngle;
            
            element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            element.style.transition = 'transform 0.5s ease';
        });
        
        element.addEventListener('mouseenter', () => {
            element.style.transition = 'none';
        });
    }

    function initParticles() {
        const canvas = document.getElementById('landing-particles');
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        const stars = [];
        const count = 75;
        
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.5 + 0.5,
                vy: (Math.random() * 0.15 + 0.05)
            });
        }
        
        let active = true;
        
        function draw() {
            if (!active) return;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
            
            for (let i = 0; i < count; i++) {
                const s = stars[i];
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
                
                s.y += s.vy;
                if (s.y > height) {
                    s.y = 0;
                    s.x = Math.random() * width;
                }
            }
            requestAnimationFrame(draw);
        }
        
        draw();
        
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        
        return {
            stop: () => { 
                active = false; 
                window.removeEventListener('resize', handleResize);
            }
        };
    }

    // Global Navigation functions
    window.showAuthPage = function(side = 'login') {
        const landingContainer = document.getElementById('landing-container');
        const authContainer = document.getElementById('auth-container');
        const flipCard = document.getElementById('auth-flip-card');
        
        landingContainer.style.display = 'none';
        authContainer.style.display = 'flex';
        
        // Reset inputs & alerts
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        document.getElementById('login-error-alert').style.display = 'none';
        document.getElementById('register-error-alert').style.display = 'none';
        
        if (side === 'login') {
            flipCard.classList.remove('flipped');
        } else {
            flipCard.classList.add('flipped');
        }
    };
    
    window.toggleAuthFlip = function() {
        const flipCard = document.getElementById('auth-flip-card');
        flipCard.classList.toggle('flipped');
        
        document.getElementById('login-error-alert').style.display = 'none';
        document.getElementById('register-error-alert').style.display = 'none';
    };
    
    window.showHeroPage = function() {
        const landingContainer = document.getElementById('landing-container');
        const authContainer = document.getElementById('auth-container');
        
        authContainer.style.display = 'none';
        landingContainer.style.display = 'flex';
    };

    // Wire landing/auth navigation clicks
    const navSignIn = document.getElementById('nav-signin-btn');
    if (navSignIn) navSignIn.onclick = () => showAuthPage('login');
    
    const navGetStarted = document.getElementById('nav-getstarted-btn');
    if (navGetStarted) navGetStarted.onclick = () => showAuthPage('register');
    
    const heroGetStarted = document.getElementById('hero-getstarted-btn');
    if (heroGetStarted) heroGetStarted.onclick = () => showAuthPage('register');
    
    const flipToReg = document.getElementById('flip-to-register-btn');
    if (flipToReg) flipToReg.onclick = () => toggleAuthFlip();
    
    const flipToLog = document.getElementById('flip-to-login-btn');
    if (flipToLog) flipToLog.onclick = () => toggleAuthFlip();
    
    const backToLanding1 = document.getElementById('back-to-landing-btn-1');
    if (backToLanding1) backToLanding1.onclick = () => showHeroPage();
    
    const backToLanding2 = document.getElementById('back-to-landing-btn-2');
    if (backToLanding2) backToLanding2.onclick = () => showHeroPage();

    // Form submits
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const emailVal = document.getElementById('login-email').value;
            const passwordVal = document.getElementById('login-password').value;
            const alertPanel = document.getElementById('login-error-alert');
            
            const res = await window.db.login(emailVal, passwordVal);
            if (res.success) {
                showToast(`Secure channel established: Welcome, ${res.username}!`);
                await initUserSession();
            } else {
                alertPanel.textContent = res.message;
                alertPanel.style.display = 'block';
            }
        };
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const usernameVal = document.getElementById('register-username').value;
            const emailVal = document.getElementById('register-email').value;
            const passwordVal = document.getElementById('register-password').value;
            const capitalVal = parseFloat(document.getElementById('register-capital').value) || 0;
            const currencyVal = document.getElementById('register-currency').value;
            const alertPanel = document.getElementById('register-error-alert');
            
            const res = await window.db.register(usernameVal, emailVal, passwordVal, capitalVal, currencyVal);
            if (res.success) {
                showToast(`Ledger initialized! Welcome commander ${res.username}.`);
                await initUserSession();
            } else {
                alertPanel.textContent = res.message;
                alertPanel.style.display = 'block';
            }
        };
    }

    // Sidebar Logout action
    const sidebarLogout = document.getElementById('sidebar-logout-btn');
    if (sidebarLogout) {
        sidebarLogout.onclick = async (e) => {
            e.preventDefault();
            const confirmed = confirm("Are you sure you want to secure the vault and log out?");
            if (confirmed) {
                window.db.logout();
                showToast("Vault secured. Safe travels, commander.");
                await initUserSession();
            }
        };
    }

    // Update the visual status pill for Database Connection mode
    window.updateDatabaseStateUI = function() {
        const statusPill = document.getElementById('db-status-pill');
        const settingsStatus = document.getElementById('settings-db-status');
        const settingsSyncBox = document.getElementById('settings-sync-box');
        
        if (!statusPill) return;
        
        if (window.db.dbMode === 'sqlite') {
            statusPill.textContent = '🟢 SQLite Local Server';
            statusPill.className = 'db-status-pill db-sqlite';
            statusPill.title = 'Connected to Node.js backend saving to database.sqlite';
            
            if (settingsStatus) {
                settingsStatus.innerHTML = '<span style="color: var(--success); font-weight: bold;">🟢 SQLite Local File Server Online</span>';
            }
            if (settingsSyncBox) {
                settingsSyncBox.style.display = 'block';
            }
        } else {
            statusPill.textContent = '🔵 IndexedDB Sandbox';
            statusPill.className = 'db-status-pill db-indexeddb';
            statusPill.title = 'Active browser-based transactional database';
            
            if (settingsStatus) {
                settingsStatus.innerHTML = '<span style="color: var(--cyan); font-weight: bold;">🔵 IndexedDB Browser Core Database Active</span>';
            }
            if (settingsSyncBox) {
                settingsSyncBox.style.display = 'none';
            }
        }
    };

    // Initialize core state elements
    window.db.initPromise.then(async () => {
        const settings = await window.db.getSettings();
        applyTheme(settings.theme || 'dark');
        await initUserSession();
    });
    
    // Core state
    let activeView = 'dashboard';
    window.activeView = activeView;
    let currentCalendarYear = new Date().getFullYear();
    let currentCalendarMonth = new Date().getMonth(); // 0-indexed

    // Currency Formatting helper
    function getCurrencySymbol() {
        const set = window.db.getSettings();
        switch (set.currency) {
            case 'INR': return '₹';
            case 'EUR': return '€';
            case 'GBP': return '£';
            case 'USD':
            default: return '$';
        }
    }

    function formatCurrency(value) {
        const symbol = getCurrencySymbol();
        const absolute = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (value < 0 ? '-' : '') + symbol + absolute;
    }
    window.formatCurrency = formatCurrency;

    // Apply light or dark theme
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.getElementById('theme-icon');
        
        if (theme === 'light') {
            icon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>';
        } else {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        }
    }

    // Swaps views (Pages) in the Single Page Application
    window.switchView = async function(viewName) {
        activeView = viewName;
        window.activeView = viewName;
        
        // Synchronize terminal active trades
        if (window.signalTerminal) {
            await window.signalTerminal.syncExistingActiveTrades();
        }
        
        // Update sidebar visual active indicators
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Hide all views and show target
        document.querySelectorAll('.view-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const targetPane = document.getElementById(`${viewName}-view`);
        if (targetPane) targetPane.classList.add('active');

        // Close sidebar on mobile
        document.getElementById('app-sidebar').classList.remove('mobile-open');

        // View-specific loading hooks
        await refreshHeaderMetrics();
        if (viewName === 'dashboard') {
            await loadDashboard();
            
            // Load and fit Live Charting Advanced Widget
            if (window.liveChartsEngine) {
                await window.liveChartsEngine.loadDashboardWidget();
            }
            
            // Sync dynamic 3D Hologram Scene database telemetry in real-time
            if (hologramScene && document.getElementById('hologram-toggle').classList.contains('active-hologram')) {
                const trades = await window.db.getTrades();
                const settings = await window.db.getSettings();
                const metrics = await window.db.getMetrics();
                hologramScene.rebuildScene(trades, settings, metrics);
                hologramScene.handleResize();
            }
            
            // Boot the workspace space dust background particles loop
            if (dashboardParticlesInstance) {
                dashboardParticlesInstance.stop();
            }
            dashboardParticlesInstance = initDashboardParticles();
            
            // Dynamic 3D tilts for the premium HUD cards and widgets
            document.querySelectorAll('#dashboard-view .kpi-card').forEach(card => bind3DTilt(card, 12));
            document.querySelectorAll('#dashboard-view .chart-card').forEach(card => bind3DTilt(card, 5));
            document.querySelectorAll('#dashboard-view .trades-table-card').forEach(card => bind3DTilt(card, 3));
        } else {
            // Stop dashboard particles if not on dashboard view
            if (dashboardParticlesInstance) {
                dashboardParticlesInstance.stop();
                dashboardParticlesInstance = null;
            }
        }
        
        if (viewName === 'calendar') {
            await loadCalendar();
        } else if (viewName === 'reports') {
            await loadReports();
        } else if (viewName === 'leaderboard') {
            await loadLeaderboard();
        } else if (viewName === 'settings') {
            await loadSettings();
        } else if (viewName === 'forex') {
            calculateForexSimulation();
            if (window.liveChartsEngine) {
                await window.liveChartsEngine.loadForexWidget();
            }
        } else if (viewName === 'csm') {
            initCurrencyStrengthMeter();
        } else if (viewName === 'admin') {
            window.loadAdminData();
        }
        
        if (viewName !== 'csm' && csmIntervalId) {
            clearInterval(csmIntervalId);
            csmIntervalId = null;
        }
        
        // Always sync DB mode UI state
        if (typeof updateDatabaseStateUI === 'function') {
            updateDatabaseStateUI();
        }
    };

    // Populates top-header dynamic elements
    async function refreshHeaderMetrics() {
        const metrics = await window.db.getMetrics();
        const settings = await window.db.getSettings();
        
        // Welcome and Date text
        document.getElementById('header-user-welcome').textContent = `Welcome back, ${settings.username || 'Trader'}`;
        
        const now = new Date();
        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
        document.getElementById('header-current-date').textContent = now.toLocaleDateString(undefined, dateOptions);

        // Account capital display
        const balanceVal = document.getElementById('header-capital-value');
        balanceVal.textContent = formatCurrency(metrics.currentBalance);
        
        // Style profit positive green or negative red
        if (metrics.currentBalance >= settings.initialCapital) {
            balanceVal.style.color = 'var(--success)';
        } else {
            balanceVal.style.color = 'var(--danger)';
        }
    }

    // Toast alerts module
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-message');
        toast.textContent = message;
        
        // Reset classes
        toast.className = 'toast-msg';
        if (type === 'error') toast.classList.add('toast-error');
        else if (type === 'info') toast.classList.add('toast-info');
        else toast.classList.add('toast-success');
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    window.showToast = showToast;

    // ==========================================
    // 1. DASHBOARD LOAD MODULE
    // ==========================================
    async function loadDashboard() {
        const metrics = await window.db.getMetrics();
        const settings = await window.db.getSettings();
        const currency = getCurrencySymbol();

        // 1. KPI cards update
        const netPnLEl = document.getElementById('kpi-net-pnl');
        const pnlTrendEl = document.getElementById('kpi-pnl-trend');
        const netPnLCard = document.getElementById('kpi-net-pnl-card');

        netPnLEl.textContent = formatCurrency(metrics.totalNetPnL);
        netPnLCard.className = 'glass-panel kpi-card';

        if (metrics.totalNetPnL > 0.01) {
            netPnLEl.className = 'kpi-value pnl-green';
            pnlTrendEl.className = 'kpi-trend trend-up';
            pnlTrendEl.innerHTML = `<span>▲</span> +${((metrics.totalNetPnL / settings.initialCapital) * 100).toFixed(1)}% Growth`;
            netPnLCard.classList.add('pnl-plus');
        } else if (metrics.totalNetPnL < -0.01) {
            netPnLEl.className = 'kpi-value pnl-red';
            pnlTrendEl.className = 'kpi-trend trend-down';
            pnlTrendEl.innerHTML = `<span>▼</span> -${(Math.abs(metrics.totalNetPnL / settings.initialCapital) * 100).toFixed(1)}% Drawdown`;
            netPnLCard.classList.add('pnl-minus');
        } else {
            netPnLEl.className = 'kpi-value pnl-neutral';
            pnlTrendEl.className = 'kpi-trend trend-neutral';
            pnlTrendEl.innerHTML = `Neutral starting base`;
            netPnLCard.classList.add('totaltrades');
        }

        // Win Rate
        document.getElementById('kpi-winrate').textContent = `${metrics.winRate}%`;
        document.getElementById('kpi-winrate-trend').textContent = `${metrics.winningTrades} wins / ${metrics.totalTrades} total`;

        // Profit Factor
        const pfVal = metrics.profitFactor === 99.99 ? '∞' : metrics.profitFactor.toFixed(2);
        document.getElementById('kpi-profitfactor').textContent = pfVal;
        
        // Total Trades
        document.getElementById('kpi-total-trades').textContent = metrics.totalTrades;

        // Side stats card
        document.getElementById('stat-avg-win').textContent = formatCurrency(metrics.avgWin);
        document.getElementById('stat-avg-loss').textContent = formatCurrency(metrics.avgLoss);
        document.getElementById('stat-winloss-ratio').textContent = metrics.avgWinLossRatio;
        document.getElementById('stat-largest-win').textContent = formatCurrency(metrics.maxWin);
        document.getElementById('stat-largest-loss').textContent = formatCurrency(metrics.maxLoss);

        document.getElementById('equity-starting-balance').textContent = `Starting: ${formatCurrency(settings.initialCapital)}`;

        // 2. Render curve chart
        window.charts.renderEquityCurve(metrics.equityCurve, currency);

        // 3. Render recent table
        const tbody = document.getElementById('recent-trades-body');
        const alertBox = document.getElementById('no-trades-alert');
        tbody.innerHTML = '';

        const allTrades = await window.db.getTrades();
        const recentTrades = allTrades.slice(0, 5); // Latest 5

        if (recentTrades.length === 0) {
            alertBox.style.display = 'block';
            document.getElementById('recent-trades-table').style.display = 'none';
        } else {
            alertBox.style.display = 'none';
            document.getElementById('recent-trades-table').style.display = 'table';
            
            recentTrades.forEach(trade => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                const dateStr = new Date(trade.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                const dirBadge = trade.direction === 'LONG' ? '<span class="badge badge-long">LONG</span>' : '<span class="badge badge-short">SHORT</span>';
                const pnlClass = trade.netPnL > 0.01 ? 'pnl-green' : (trade.netPnL < -0.01 ? 'pnl-red' : 'pnl-neutral');
                const pnlPrefix = trade.netPnL > 0.01 ? '+' : '';
                
                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td><strong>${trade.symbol}</strong></td>
                    <td>${dirBadge}</td>
                    <td>${trade.entryPrice}</td>
                    <td>${trade.exitPrice}</td>
                    <td>${trade.quantity}</td>
                    <td class="${pnlClass}">${pnlPrefix}${formatCurrency(trade.netPnL)}</td>
                    <td><span class="pill-item" style="padding: 4px 8px; font-size: 11px; cursor: default;">${trade.strategy}</span></td>
                    <td><span class="text-secondary">${trade.emotion}</span></td>
                    <td>
                        <div class="action-links">
                            <button class="action-btn edit-btn" onclick="openEditTradeModal('${trade.id}')" title="Edit Trade">✏️</button>
                            <button class="action-btn delete-btn" onclick="deleteTradeLog('${trade.id}')" title="Delete Trade">🗑️</button>
                        </div>
                    </td>
                `;

                tr.addEventListener('click', (e) => {
                    // Ignore clicks on action buttons
                    if (e.target.closest('.action-links') || e.target.closest('.action-btn')) {
                        return;
                    }
                    
                    // Remove selected styling from other rows
                    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected-trade-row'));
                    
                    // Add selected styling to this row
                    tr.classList.add('selected-trade-row');
                    
                    // Store reference to selected trade
                    selectedDashboardTrade = trade;
                    window.selectedDashboardTrade = trade;
                    
                    // Display visualizer panel card
                    const visualizerCard = document.getElementById('dashboard-trade-visualizer-card');
                    if (visualizerCard) {
                        visualizerCard.style.display = 'block';
                    }
                    
                    // Set visualizer symbol header
                    const symbolBadge = document.getElementById('dash-visualizer-symbol');
                    if (symbolBadge) {
                        symbolBadge.textContent = (trade.symbol || 'N/A').toUpperCase();
                    }
                    
                    // Draw interactive chart level line visualizer
                    const canvas = document.getElementById('dashboard-trade-visualizer-canvas');
                    if (canvas) {
                        window.charts.drawTradeVisualChart(canvas, trade);
                    }

                    // Hot-swap the massive Live Chart Ticker and force immediate HUD Telemetry update
                    if (window.liveChartsEngine) {
                        window.liveChartsEngine.changeTickerSymbol('dashboard', trade.symbol);
                        window.liveChartsEngine.updateTelemetryHUD();
                    }
                });

                tbody.appendChild(tr);
            });

            // Autoplay default: automatically select and draw first (latest) trade row
            if (recentTrades.length > 0) {
                const firstRow = tbody.querySelector('tr');
                if (firstRow) {
                    firstRow.click();
                }
            } else {
                const visualizerCard = document.getElementById('dashboard-trade-visualizer-card');
                if (visualizerCard) {
                    visualizerCard.style.display = 'none';
                }
            }
        }
    }

    // ==========================================
    // 2. CALENDAR RENDERING MODULE
    // ==========================================
    async function loadCalendar() {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('calendar-month-title').textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;

        const container = document.getElementById('calendar-days-container');
        container.innerHTML = '';

        // Calculate layout coordinates
        const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay(); // Day index of 1st day (0 = Sunday)
        const totalDaysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();

        // Get trades logged in this specific month
        const trades = await window.db.getTrades();
        const monthlyTrades = trades.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getFullYear() === currentCalendarYear && tDate.getMonth() === currentCalendarMonth;
        });

        // 1. Add pad cells for previous month remnants
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            container.appendChild(emptyCell);
        }

        // 2. Add day blocks
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            const dayNum = document.createElement('span');
            dayNum.className = 'day-number';
            dayNum.textContent = day;
            dayCell.appendChild(dayNum);

            // Filter trades taken on this specific date
            const daysTrades = monthlyTrades.filter(t => {
                const tDate = new Date(t.date);
                return tDate.getDate() === day;
            });

            if (daysTrades.length > 0) {
                // Sum Net PnL
                const sumPnL = daysTrades.reduce((acc, t) => acc + t.netPnL, 0);
                const pnlEl = document.createElement('span');
                pnlEl.className = 'day-pnl';
                
                const prefix = sumPnL > 0.01 ? '+' : '';
                pnlEl.textContent = prefix + formatCurrency(sumPnL);
                dayCell.appendChild(pnlEl);

                // Add visual profit/loss coloring classes
                if (sumPnL > 0.01) {
                    dayCell.classList.add('day-profit');
                } else if (sumPnL < -0.01) {
                    dayCell.classList.add('day-loss');
                }
                
                // Add click details handler
                dayCell.onclick = () => renderDayDetails(day, daysTrades);
            } else {
                dayCell.onclick = () => {
                    const selectDate = new Date(currentCalendarYear, currentCalendarMonth, day);
                    document.getElementById('calendar-details-panel').style.display = 'none';
                    // Prefill logger if clicked empty day
                    openNewTradeModal(selectDate);
                };
            }

            container.appendChild(dayCell);
        }
    }

    function renderDayDetails(day, dayTrades) {
        const panel = document.getElementById('calendar-details-panel');
        const title = document.getElementById('calendar-details-date');
        const tbody = document.getElementById('calendar-details-body');
        
        panel.style.display = 'block';
        title.innerHTML = `Logged Executions on <strong>${new Date(currentCalendarYear, currentCalendarMonth, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>`;
        
        tbody.innerHTML = '';
        dayTrades.forEach(trade => {
            const tr = document.createElement('tr');
            const dirBadge = trade.direction === 'LONG' ? '<span class="badge badge-long">LONG</span>' : '<span class="badge badge-short">SHORT</span>';
            const pnlClass = trade.netPnL > 0.01 ? 'pnl-green' : (trade.netPnL < -0.01 ? 'pnl-red' : 'pnl-neutral');
            const pnlPrefix = trade.netPnL > 0.01 ? '+' : '';
            
            tr.innerHTML = `
                <td><strong>${trade.symbol}</strong></td>
                <td>${dirBadge}</td>
                <td>${trade.entryPrice}</td>
                <td>${trade.exitPrice}</td>
                <td>${trade.quantity}</td>
                <td class="${pnlClass}">${pnlPrefix}${formatCurrency(trade.netPnL)}</td>
                <td><span class="pill-item" style="padding: 4px 8px; font-size: 11px; cursor: default;">${trade.strategy}</span></td>
                <td><span class="text-secondary">${trade.emotion}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Smooth scroll to details
        panel.scrollIntoView({ behavior: 'smooth' });
    }

    // Month toggles
    document.getElementById('prev-month-btn').onclick = () => {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
        }
        loadCalendar();
    };

    document.getElementById('next-month-btn').onclick = () => {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
        }
        loadCalendar();
    };

    // ==========================================
    // 3. REPORTS VISUAL MATH MODULE
    // ==========================================
    async function loadLeaderboard() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading Top Traders...</td></tr>';
        
        try {
            const leaderboard = await window.db.getLeaderboard();
            
            if (!leaderboard || leaderboard.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-secondary);">No traders found in the system yet.</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            leaderboard.forEach(trader => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                tr.style.transition = 'background-color 0.2s';
                tr.onmouseenter = () => tr.style.backgroundColor = 'rgba(255,255,255,0.05)';
                tr.onmouseleave = () => tr.style.backgroundColor = 'transparent';
                
                let rankVisual = trader.rank;
                if (trader.rank === 1) rankVisual = '🥇 1st';
                else if (trader.rank === 2) rankVisual = '🥈 2nd';
                else if (trader.rank === 3) rankVisual = '🥉 3rd';
                
                const pnlColor = trader.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)';
                const pipsColor = trader.totalPips >= 0 ? 'var(--success)' : 'var(--danger)';
                
                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: bold;">${rankVisual}</td>
                    <td style="padding: 12px 8px; color: var(--text-primary); font-weight: 500;">${trader.username}</td>
                    <td style="padding: 12px 8px; text-align: right; color: ${pnlColor}; font-weight: bold;">$${trader.totalProfit.toFixed(2)}</td>
                    <td style="padding: 12px 8px; text-align: right; color: ${pipsColor};">${trader.totalPips.toFixed(1)}</td>
                    <td style="padding: 12px 8px; text-align: center;">${trader.winRate.toFixed(1)}%</td>
                    <td style="padding: 12px 8px; text-align: right; color: var(--text-secondary);">${trader.totalTrades}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--danger);">Failed to load leaderboard data.</td></tr>';
        }
    }

    async function loadReports(timeframe = 'all') {
        // Sync Timeframe UI buttons visually
        const tfContainer = document.getElementById('reports-timeframe-selector');
        if (tfContainer) {
            tfContainer.querySelectorAll('.timeframe-btn').forEach(btn => {
                if (btn.getAttribute('data-timeframe') === timeframe) {
                    btn.classList.add('active');
                    btn.style.background = 'var(--primary)';
                    btn.style.color = 'white';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'transparent';
                    btn.style.color = 'var(--text-secondary)';
                }
            });
        }

        const metrics = await window.db.getMetrics(timeframe);
        const currency = getCurrencySymbol();

        // 1. Set streaks
        document.getElementById('report-max-win-streak').textContent = `${metrics.maxWinStreak} winning trades`;
        document.getElementById('report-max-loss-streak').textContent = `${metrics.maxLossStreak} losing trades`;

        // 2. Render strategy breakdown
        const strategyData = await window.db.getStrategyAnalytics(timeframe);
        const stratBody = document.getElementById('strategy-breakdown-body');
        stratBody.innerHTML = '';

        if (strategyData.length === 0) {
            stratBody.innerHTML = `<tr><td colspan="5" class="text-secondary" style="text-align:center; padding:20px;">No strategy breakdown available.</td></tr>`;
        } else {
            strategyData.forEach(s => {
                const tr = document.createElement('tr');
                const pnlClass = s.netPnL > 0.01 ? 'pnl-green' : (s.netPnL < -0.01 ? 'pnl-red' : 'pnl-neutral');
                const pnlPrefix = s.netPnL > 0.01 ? '+' : '';
                const pfVal = s.profitFactor === 99.99 ? '∞' : s.profitFactor.toFixed(2);
                
                tr.innerHTML = `
                    <td><strong>${s.name}</strong></td>
                    <td>${s.totalTrades}</td>
                    <td>${s.winRate}%</td>
                    <td>${pfVal}</td>
                    <td class="${pnlClass}">${pnlPrefix}${formatCurrency(s.netPnL)}</td>
                `;
                stratBody.appendChild(tr);
            });
        }

        // 3. Render mistake breakdown
        const mistakeData = await window.db.getMistakeAnalytics(timeframe);
        const mistakeBody = document.getElementById('mistake-breakdown-body');
        mistakeBody.innerHTML = '';

        if (mistakeData.length === 0) {
            mistakeBody.innerHTML = `<tr><td colspan="3" class="text-secondary" style="text-align:center; padding:20px;">Perfect execution! No mistakes flagged on losing trades.</td></tr>`;
        } else {
            mistakeData.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.name}</strong></td>
                    <td>${m.count}</td>
                    <td class="pnl-red">${formatCurrency(m.totalLoss)}</td>
                `;
                mistakeBody.appendChild(tr);
            });
        }

        // 4. Detailed Trade Report Population
        const trades = await window.db.getTrades(timeframe);
        
        const totalPips = trades.reduce((sum, t) => sum + (t.pips || 0), 0).toFixed(1);
        const elTotalTrades = document.getElementById('report-view-total-trades');
        const elWinRate = document.getElementById('report-view-win-rate');
        const elWinningTrades = document.getElementById('report-view-winning-trades');
        const elLosingTrades = document.getElementById('report-view-losing-trades');
        const elTotalProfit = document.getElementById('report-view-total-profit');
        const elTotalPips = document.getElementById('report-view-total-pips');
        
        if (elTotalTrades) elTotalTrades.textContent = metrics.totalTrades;
        if (elWinRate) elWinRate.textContent = `${metrics.winRate}%`;
        if (elWinningTrades) elWinningTrades.textContent = metrics.winningTrades;
        if (elLosingTrades) elLosingTrades.textContent = metrics.losingTrades;
        if (elTotalProfit) {
            const pnlPrefix = metrics.totalNetPnL > 0 ? '+' : '';
            elTotalProfit.textContent = `${pnlPrefix}${formatCurrency(metrics.totalNetPnL)}`;
            elTotalProfit.className = metrics.totalNetPnL > 0 ? 'streak-value text-success' : (metrics.totalNetPnL < 0 ? 'streak-value text-danger' : 'streak-value text-secondary');
        }
        if (elTotalPips) elTotalPips.textContent = totalPips;
        
        const detailedBody = document.getElementById('detailed-report-body');
        if (detailedBody) {
            detailedBody.innerHTML = '';
            
            if (trades.length === 0) {
                detailedBody.innerHTML = `<tr><td colspan="11" class="text-secondary" style="text-align:center; padding:20px;">No trades found for this timeframe.</td></tr>`;
            } else {
                trades.forEach(t => {
                    const tr = document.createElement('tr');
                    const pnlClass = t.netPnL > 0.01 ? 'pnl-green' : (t.netPnL < -0.01 ? 'pnl-red' : 'pnl-neutral');
                    const pnlPrefix = t.netPnL > 0.01 ? '+' : '';
                    const dateStr = new Date(t.date).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute:'2-digit'
                    });
                    
                    tr.innerHTML = `
                        <td style="white-space: nowrap;">${dateStr}</td>
                        <td><strong>${t.symbol}</strong></td>
                        <td><span class="badge ${t.direction === 'LONG' ? 'badge-primary' : 'badge-danger'}">${t.direction}</span></td>
                        <td>${t.entryPrice}</td>
                        <td>${t.exitPrice}</td>
                        <td>${t.quantity}</td>
                        <td>${t.fees}</td>
                        <td class="${pnlClass}"><strong>${pnlPrefix}${formatCurrency(t.netPnL)}</strong></td>
                        <td>${t.pips || 0}</td>
                        <td>${t.strategy || 'N/A'}</td>
                        <td>${t.emotion || 'N/A'}</td>
                    `;
                    detailedBody.appendChild(tr);
                });
            }
        }

        // 5. Update Charts
        window.charts.renderStrategyAnalytics(strategyData, currency);
        window.charts.renderMistakeAnalytics(mistakeData, currency);
    }

    // ==========================================
    // 4. SETTINGS FORM MODULE
    // ==========================================
    async function loadSettings() {
        const settings = await window.db.getSettings();
        
        document.getElementById('settings-username').value = settings.username || '';
        document.getElementById('settings-capital').value = settings.initialCapital || 10000;
        document.getElementById('settings-currency').value = settings.currency || 'USD';
        document.getElementById('settings-risk').value = settings.maxRiskPerTrade || 2.0;

        document.getElementById('risk-rule-percent-display').textContent = `${settings.maxRiskPerTrade || 2}%`;
    }

    document.getElementById('settings-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('settings-username').value.trim();
        const capital = parseFloat(document.getElementById('settings-capital').value) || 10000;
        const currency = document.getElementById('settings-currency').value;
        const risk = parseFloat(document.getElementById('settings-risk').value) || 2.0;

        await window.db.saveSettings({
            username,
            initialCapital: capital,
            currency,
            maxRiskPerTrade: risk
        });

        await refreshHeaderMetrics();
        showToast("Settings updated successfully!");
        document.getElementById('risk-rule-percent-display').textContent = `${risk}%`;
        
        // Redraw current view to apply new capital curve bounds or currency symbols
        await switchView('settings');
    };

    // Export database backup
    document.getElementById('export-json-btn').onclick = async () => {
        const json = await window.db.exportData();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(json);
        const downloadAnchor = document.createElement('a');
        
        const dateTag = new Date().toISOString().split('T')[0];
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `trading_journal_backup_${dateTag}.json`);
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("Database exported successfully!");
    };

    // Import database backup trigger
    document.getElementById('trigger-import-btn').onclick = () => {
        document.getElementById('import-json-file').click();
    };

    document.getElementById('import-json-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const imported = await window.db.importData(event.target.result);
            if (imported) {
                showToast("Database restored from backup!");
                await switchView(activeView); // Reload active view
            }
        };
        reader.readAsText(file);
    };

    // Clear whole DB
    document.getElementById('clear-database-btn').onclick = async () => {
        const confirmed = confirm("⚠️ CRITICAL WARNING!\n\nAre you absolutely sure you want to delete ALL trades in your database? This action is permanent and cannot be undone.");
        if (confirmed) {
            await window.db.clearAllTrades();
            showToast("Database cleared successfully.", "error");
            await switchView(activeView);
        }
    };

    // Delete Account
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = async () => {
            const confirmed = confirm("☠️ WARNING: This action is irreversible.\n\nAre you sure you want to permanently delete your account, settings, and all trade history?");
            if (confirmed) {
                const deleted = await window.db.deleteAccount();
                if (deleted) {
                    alert("Your account has been permanently deleted.");
                    window.location.reload();
                } else {
                    alert("Failed to delete account. Please try again.");
                }
            }
        };
    }

    // Manual Local SQLite database synchronizer
    const btnSyncDb = document.getElementById('settings-sync-btn');
    if (btnSyncDb) {
        btnSyncDb.onclick = async () => {
            btnSyncDb.disabled = true;
            btnSyncDb.textContent = 'Syncing...';
            try {
                // Ensure server is online
                const status = await window.db.checkServerStatus();
                if (!status) {
                    showToast("SQLite Server is offline. Please launch node server.js first.", "error");
                    btnSyncDb.disabled = false;
                    btnSyncDb.textContent = 'Sync local to Server';
                    return;
                }
                
                // Get local IndexedDB data
                const username = window.db.getActiveUser();
                const allTrades = await window.db.idb.getAll('trades');
                const userTrades = allTrades.filter(t => t.username === username);
                const userSettings = await window.db.idb.get('settings', username);
                
                // Send payload
                const res = await fetch(window.API_BASE + '/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-user': username },
                    body: JSON.stringify({ trades: userTrades, settings: userSettings })
                });
                
                if (res.ok) {
                    showToast("Database successfully synced to SQLite local server file!");
                    updateDatabaseStateUI();
                } else {
                    showToast("Sync failed. Server responded with error.", "error");
                }
            } catch(e) {
                console.error(e);
                showToast("Failed to connect to SQLite server during sync.", "error");
            }
            btnSyncDb.disabled = false;
            btnSyncDb.textContent = 'Sync local to Server';
        };
    }

    // ==========================================
    // 5. ADVANCED TRADE LOGGER & VALIDATORS
    // ==========================================
    const modal = document.getElementById('trade-modal');
    const tradeForm = document.getElementById('trade-form');

    // Button Triggers
    document.getElementById('sidebar-new-trade-btn').onclick = () => openNewTradeModal();
    document.getElementById('dash-log-trade-btn').onclick = () => openNewTradeModal();
    document.getElementById('cancel-form-btn').onclick = closeModal;
    document.getElementById('close-modal-btn').onclick = closeModal;

    window.refreshDatalists = async function() {
        const trades = await window.db.getTrades();
        
        // Populate Symbols
        const symbolsDatalist = document.getElementById('symbols-list');
        if (symbolsDatalist) {
            const uniqueSymbols = new Set();
            Array.from(symbolsDatalist.options).forEach(opt => {
                if (opt.value) uniqueSymbols.add(opt.value.toUpperCase());
            });
            trades.forEach(t => {
                if (t.symbol) uniqueSymbols.add(t.symbol.toUpperCase());
            });
            symbolsDatalist.innerHTML = '';
            uniqueSymbols.forEach(sym => {
                const opt = document.createElement('option');
                opt.value = sym;
                symbolsDatalist.appendChild(opt);
            });
        }

        // Populate Strategies
        const strategyDatalist = document.getElementById('strategy-list');
        if (strategyDatalist) {
            const uniqueStrats = new Set();
            Array.from(strategyDatalist.options).forEach(opt => {
                if (opt.value) uniqueStrats.add(opt.value);
            });
            trades.forEach(t => {
                if (t.strategy) uniqueStrats.add(t.strategy);
            });
            strategyDatalist.innerHTML = '';
            uniqueStrats.forEach(strat => {
                const opt = document.createElement('option');
                opt.value = strat;
                strategyDatalist.appendChild(opt);
            });
        }
    };

    async function openNewTradeModal(prefillDate = null) {
        await window.refreshDatalists();
        tradeForm.reset();
        document.getElementById('edit-trade-id').value = '';
        document.getElementById('modal-title-label').textContent = 'Log Advanced Trade';
        
        // Reset direction
        setDirection('LONG');
        
        // Set default execution time
        const dateInput = document.getElementById('trade-date');
        const targetDate = prefillDate || new Date();
        
        // Adjust date to timezone string matching datetime-local input (YYYY-MM-DDTHH:MM)
        const timezoneOffset = targetDate.getTimezoneOffset() * 60000; // in ms
        const localISOTime = new Date(targetDate - timezoneOffset).toISOString().slice(0, 16);
        dateInput.value = localISOTime;

        // Reset pills
        setActivePill('emotion', 'Disciplined');
        setActivePill('mistake', '');

        // Hide warning
        document.getElementById('risk-warning-form').style.display = 'none';

        // Reset screenshot upload container
        resetScreenshotContainer();

        onModalInputUpdate();

        modal.classList.add('active');
    }

    window.openEditTradeModal = async function(id) {
        await window.refreshDatalists();
        const trade = await window.db.getTradeById(id);
        if (!trade) return;

        document.getElementById('edit-trade-id').value = trade.id;
        document.getElementById('modal-title-label').textContent = `Edit Trade: ${trade.symbol}`;

        setDirection(trade.direction);
        document.getElementById('trade-symbol').value = trade.symbol;
        
        // Date mapping
        const tDate = new Date(trade.date);
        const timezoneOffset = tDate.getTimezoneOffset() * 60000;
        const localISOTime = new Date(tDate - timezoneOffset).toISOString().slice(0, 16);
        document.getElementById('trade-date').value = localISOTime;

        document.getElementById('trade-entry').value = trade.entryPrice;
        document.getElementById('trade-exit').value = trade.exitPrice;
        document.getElementById('trade-quantity').value = trade.quantity;
        document.getElementById('trade-fees').value = trade.fees;
        document.getElementById('trade-sl').value = trade.stopLoss || '';
        document.getElementById('trade-tp').value = trade.takeProfit || '';
        document.getElementById('trade-strategy').value = trade.strategy;
        
        setActivePill('emotion', trade.emotion);
        setActivePill('mistake', trade.mistake);
        
        document.getElementById('trade-notes').value = trade.notes;

        // Handle screenshot restore
        resetScreenshotContainer();
        if (trade.screenshot) {
            document.getElementById('trade-screenshot').value = trade.screenshot;
            document.getElementById('screenshot-preview-img').src = trade.screenshot;
            document.getElementById('screenshot-preview-box').style.display = 'block';
            document.getElementById('drop-zone').style.display = 'none';
        }

        // Trigger real-time risk warn & draw preview chart
        onModalInputUpdate();

        modal.classList.add('active');
    };

    function closeModal() {
        modal.classList.remove('active');
    }

    // Direction Toggle Highlights
    document.getElementById('direction-long-btn').onclick = () => setDirection('LONG');
    document.getElementById('direction-short-btn').onclick = () => setDirection('SHORT');

    function setDirection(dir) {
        document.getElementById('trade-direction').value = dir;
        const longBtn = document.getElementById('direction-long-btn');
        const shortBtn = document.getElementById('direction-short-btn');

        if (dir === 'LONG') {
            longBtn.classList.add('active');
            shortBtn.classList.remove('active');
        } else {
            shortBtn.classList.add('active');
            longBtn.classList.remove('active');
        }

        onModalInputUpdate();
    }

    // Pill Selector logic for emotions & mistakes
    function setActivePill(type, value) {
        const input = document.getElementById(`trade-${type}`);
        input.value = value;

        document.querySelectorAll(`#${type}-pill-container .pill-item`).forEach(pill => {
            if (pill.getAttribute('data-value') === value) {
                if (type === 'mistake' && value !== '') {
                    pill.className = 'pill-item active-danger'; // color code mistakes red!
                } else {
                    pill.className = 'pill-item active';
                }
            } else {
                pill.className = 'pill-item';
            }
        });
    }

    // Click listeners on emotion items
    document.querySelectorAll('#emotion-pill-container .pill-item').forEach(pill => {
        pill.onclick = () => setActivePill('emotion', pill.getAttribute('data-value'));
    });

    // Click listeners on mistake items
    document.querySelectorAll('#mistake-pill-container .pill-item').forEach(pill => {
        pill.onclick = () => setActivePill('mistake', pill.getAttribute('data-value'));
    });

    const symbolInput = document.getElementById('trade-symbol');
    const exitInput = document.getElementById('trade-exit');
    const entryInput = document.getElementById('trade-entry');
    const slInput = document.getElementById('trade-sl');
    const qtyInput = document.getElementById('trade-quantity');
    const tpInput = document.getElementById('trade-tp');
    const feesInput = document.getElementById('trade-fees');

    function onModalInputUpdate() {
        validatePositionRisk();
        updateModalForexTelemetry();

        // Draw visual chart preview if entry price is provided
        const symbol = (document.getElementById('trade-symbol').value || '').toUpperCase();
        const direction = document.getElementById('trade-direction').value;
        const entryPrice = parseFloat(document.getElementById('trade-entry').value) || 0;
        const exitPrice = parseFloat(document.getElementById('trade-exit').value) || 0;
        const stopLoss = parseFloat(document.getElementById('trade-sl').value) || 0;
        const takeProfit = parseFloat(document.getElementById('trade-tp').value) || 0;
        const quantity = parseFloat(document.getElementById('trade-quantity').value) || 0;
        const fees = parseFloat(document.getElementById('trade-fees').value) || 0;

        const previewGroup = document.getElementById('modal-chart-preview-group');
        if (previewGroup) {
            if (entryPrice > 0) {
                previewGroup.style.display = 'block';
                const currentTrade = {
                    symbol,
                    direction,
                    entryPrice,
                    exitPrice,
                    stopLoss,
                    takeProfit,
                    quantity,
                    fees,
                    id: document.getElementById('edit-trade-id').value || 'new_trade_preview'
                };
                const canvas = document.getElementById('modal-trade-preview-canvas');
                if (canvas) {
                    window.charts.drawTradeVisualChart(canvas, currentTrade);
                }
            } else {
                previewGroup.style.display = 'none';
            }
        }
    }

    if (symbolInput) symbolInput.oninput = onModalInputUpdate;
    if (entryInput) entryInput.oninput = onModalInputUpdate;
    if (exitInput) exitInput.oninput = onModalInputUpdate;
    if (qtyInput) qtyInput.oninput = onModalInputUpdate;
    if (slInput) slInput.oninput = onModalInputUpdate;
    if (tpInput) tpInput.oninput = onModalInputUpdate;
    if (feesInput) feesInput.oninput = onModalInputUpdate;

    async function validatePositionRisk() {
        const entry = parseFloat(entryInput.value) || 0;
        const sl = parseFloat(slInput.value) || 0;
        const qty = parseFloat(qtyInput.value) || 0;
        const direction = document.getElementById('trade-direction').value;

        const warningPanel = document.getElementById('risk-warning-form');
        const warningText = document.getElementById('risk-warning-form-text');

        if (entry <= 0 || sl <= 0 || qty <= 0) {
            warningPanel.style.display = 'none';
            return;
        }

        const symbol = document.getElementById('trade-symbol').value;
        const specs = window.db.getForexSpecs(symbol);

        // Calculate potential loss at stop-loss
        let riskValue = 0;
        if (specs) {
            const riskDiff = direction === 'LONG' ? (entry - sl) : (sl - entry);
            const riskPips = riskDiff / specs.pipSize;
            riskValue = riskPips * qty * specs.pipValuePerStandardLot;
        } else {
            if (direction === 'LONG') {
                riskValue = (entry - sl) * qty;
            } else if (direction === 'SHORT') {
                riskValue = (sl - entry) * qty;
            }
        }

        if (riskValue <= 0) {
            warningPanel.style.display = 'none'; // Invalid SL setup
            return;
        }

        const settings = await window.db.getSettings();
        const metrics = await window.db.getMetrics();
        const activeBalance = metrics.currentBalance; // Check against current balance
        
        const riskLimitPercent = parseFloat(settings.maxRiskPerTrade) || 2.0;
        const allowedLoss = activeBalance * (riskLimitPercent / 100);

        if (riskValue > allowedLoss) {
            const actualPercent = ((riskValue / activeBalance) * 100).toFixed(1);
            warningPanel.style.display = 'flex';
            warningText.innerHTML = `<strong>Over-Leveraged Risk Warning:</strong> Stop Loss represents an estimated loss of <strong>${formatCurrency(riskValue)}</strong> (${actualPercent}% of Capital balance), exceeding your configured Maximum Risk Rule limit (<strong>${riskLimitPercent}%</strong> = ${formatCurrency(allowedLoss)}).`;
        } else {
            warningPanel.style.display = 'none';
        }
    }

    // ==========================================
    // 6. SCREENSHOT TECHNICAL SETUP DRAG & DROP
    // ==========================================
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('chart-file-input');
    const screenshotStore = document.getElementById('trade-screenshot');

    dropZone.onclick = () => fileInput.click();

    // Hover transitions
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
        dropZone.style.background = 'var(--primary-glow)';
    };

    dropZone.ondragleave = () => {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.01)';
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.01)';
        
        const file = e.dataTransfer.files[0];
        processImageFile(file);
    };

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        processImageFile(file);
    };

    // Reads and processes uploaded screenshot files to Base64
    function processImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast("Invalid file type. Please upload a screenshot image.", "error");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showToast("Screenshot is too large. Max size allowed is 2MB.", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            screenshotStore.value = base64;
            
            // Set previews
            document.getElementById('screenshot-preview-img').src = base64;
            document.getElementById('screenshot-preview-box').style.display = 'block';
            dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('remove-screenshot-btn').onclick = (e) => {
        e.preventDefault();
        resetScreenshotContainer();
    };

    function resetScreenshotContainer() {
        screenshotStore.value = '';
        document.getElementById('screenshot-preview-img').src = '';
        document.getElementById('screenshot-preview-box').style.display = 'none';
        dropZone.style.display = 'block';
        fileInput.value = '';
    }

    // Submit logger form
    tradeForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const tradeId = document.getElementById('edit-trade-id').value;
        const tradeData = {
            symbol: document.getElementById('trade-symbol').value,
            direction: document.getElementById('trade-direction').value,
            date: new Date(document.getElementById('trade-date').value).toISOString(),
            entryPrice: parseFloat(entryInput.value) || 0,
            exitPrice: parseFloat(document.getElementById('trade-exit').value) || 0,
            quantity: parseFloat(qtyInput.value) || 0,
            fees: parseFloat(document.getElementById('trade-fees').value) || 0,
            stopLoss: parseFloat(slInput.value) || 0,
            takeProfit: parseFloat(document.getElementById('trade-tp').value) || 0,
            strategy: document.getElementById('trade-strategy').value,
            emotion: document.getElementById('trade-emotion').value,
            mistake: document.getElementById('trade-mistake').value,
            notes: document.getElementById('trade-notes').value,
            screenshot: screenshotStore.value
        };

        if (tradeId) {
            // Update
            const updated = await window.db.updateTrade(tradeId, tradeData);
            if (updated) {
                showToast("Trade log updated successfully.");
            } else {
                showToast("Failed to update trade log.", "error");
            }
        } else {
            // Add
            const added = await window.db.addTrade(tradeData);
            if (added) {
                showToast("New trade logged successfully!");
            } else {
                showToast("Failed to log trade.", "error");
            }
        }

        closeModal();
        switchView(activeView); // Refresh current visual context
    };

    // Action listener to delete logs
    window.deleteTradeLog = async function(id) {
        const confirmed = confirm("Are you sure you want to delete this trade log?");
        if (confirmed) {
            const deleted = await window.db.deleteTrade(id);
            if (deleted) {
                showToast("Trade log deleted.", "info");
                await switchView(activeView);
            } else {
                showToast("Failed to delete trade.", "error");
            }
        }
    };

    // ==========================================
    // 7. MULTI-THEME TOGGLING & RESPONSIVE DESIGN
    // ==========================================
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.onclick = async () => {
        const curSettings = await window.db.getSettings();
        const nextTheme = curSettings.theme === 'light' ? 'dark' : 'light';
        
        // Save & apply
        await window.db.saveSettings({ theme: nextTheme });
        applyTheme(nextTheme);
        await refreshHeaderMetrics();
        
        // Sync TradingView widgets theme
        if (window.liveChartsEngine) {
            window.liveChartsEngine.syncTheme(nextTheme);
        }
        
        // Redraw active views and charts to adapt to light/dark coordinate colors instantly!
        if (activeView === 'dashboard') {
            loadDashboard();
        } else if (activeView === 'reports') {
            loadReports();
        }
    };

    // Responsive Mobile Menu Drawer Toggle
    const menuBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');
    
    menuBtn.onclick = () => {
        sidebar.classList.toggle('mobile-open');
    };

    // Close when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && e.target !== menuBtn && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
        }
    });

    // ==========================================
    // 8. COCKPIT SPACE FIELD & AUTOPILOT CONTROL
    // ==========================================
    function initDashboardParticles() {
        const canvas = document.getElementById('dashboard-particles');
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
        let height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
        
        const stars = [];
        const count = 120;
        
        // Initialize projection-based warp stars radiating from center
        for (let i = 0; i < count; i++) {
            stars.push({
                x: (Math.random() - 0.5) * width * 2.5,
                y: (Math.random() - 0.5) * height * 2.5,
                z: Math.random() * width,
                r: Math.random() * 1.5 + 0.5
            });
        }
        
        let active = true;
        
        function draw() {
            if (!active) return;
            ctx.fillStyle = 'rgba(8, 12, 20, 0.45)';
            ctx.fillRect(0, 0, width, height);
            
            const centerX = width / 2;
            const centerY = height / 2;
            const speed = autopilotActive ? 10 : 1.8; // Fly at warp speeds during autopilot mode!
            
            ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
            ctx.lineWidth = 1.5;
            
            for (let i = 0; i < count; i++) {
                const s = stars[i];
                
                // Subtract depth to zoom stars closer
                s.z -= speed;
                
                if (s.z <= 0) {
                    s.z = width;
                    s.x = (Math.random() - 0.5) * width * 2.5;
                    s.y = (Math.random() - 0.5) * height * 2.5;
                }
                
                const k = 128.0 / s.z;
                const px = s.x * k + centerX;
                const py = s.y * k + centerY;
                
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const size = (1.5 - s.z / width) * 2;
                    ctx.beginPath();
                    ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw trails when flying warp autopilot speed
                    if (autopilotActive) {
                        const prevK = 128.0 / (s.z + speed * 1.5);
                        const ppx = s.x * prevK + centerX;
                        const ppy = s.y * prevK + centerY;
                        ctx.beginPath();
                        ctx.moveTo(ppx, ppy);
                        ctx.lineTo(px, py);
                        ctx.stroke();
                    }
                }
            }
            
            requestAnimationFrame(draw);
        }
        
        draw();
        
        const handleResize = () => {
            if (!canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
            height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        
        return {
            stop: () => {
                active = false;
                window.removeEventListener('resize', handleResize);
            }
        };
    }

    // cinematic 3D autopilot mode click listener
    const autopilotBtn = document.getElementById('autopilot-toggle');
    if (autopilotBtn) {
        autopilotBtn.onclick = (e) => {
            e.preventDefault();
            autopilotActive = !autopilotActive;
            
            const dashView = document.getElementById('dashboard-view');
            
            if (autopilotActive) {
                dashView.classList.add('cinematic-active');
                autopilotBtn.classList.add('active-autopilot');
                autopilotBtn.innerHTML = '<span>🛰️</span> <span>ACTIVE</span>';
                showToast("3D Autopilot activated! Warp particle speed engaged.", "info");
            } else {
                dashView.classList.remove('cinematic-active');
                autopilotBtn.classList.remove('active-autopilot');
                autopilotBtn.innerHTML = '<span>🛰️</span> <span>AUTOPILOT</span>';
                showToast("3D Autopilot deactivated. Manual telemetry restored.", "info");
            }
            
            // Sync with 3D WebGL scene if initialized
            if (hologramScene) {
                hologramScene.autopilot = autopilotActive;
            }
        };
    }

    // 3D Holographic Scene toggle listener
    const hologramBtn = document.getElementById('hologram-toggle');
    if (hologramBtn) {
        hologramBtn.onclick = async (e) => {
            e.preventDefault();
            hologramBtn.classList.toggle('active-hologram');
            const isActive = hologramBtn.classList.contains('active-hologram');
            
            const dash2DContent = document.getElementById('dashboard-2d-content');
            const dash3DViewport = document.getElementById('dashboard-3d-viewport');
            
            if (isActive) {
                if (dash2DContent) dash2DContent.style.display = 'none';
                if (dash3DViewport) dash3DViewport.style.display = 'block';
                
                // Initialize engine if not done already
                if (!hologramScene) {
                    hologramScene = new Holographic3DScene('dashboard-3d-viewport', 'hologram-canvas', 'hologram-tooltip');
                }
                
                // Set initial Autopilot value matching button state
                hologramScene.autopilot = autopilotActive;
                
                // Load database values and render
                const trades = await window.db.getTrades();
                const settings = await window.db.getSettings();
                const metrics = await window.db.getMetrics();
                hologramScene.rebuildScene(trades, settings, metrics);
                
                // Handle canvas layout fit
                hologramScene.handleResize();
                
                showToast("Tactical Holographic 3D Cockpit online!", "success");
            } else {
                if (dash3DViewport) dash3DViewport.style.display = 'none';
                if (dash2DContent) dash2DContent.style.display = 'block';
                showToast("Classic 2D cockpit restored.", "info");
            }
        };
    }

    // spaceport contact form subspace submission
    const contactForm = document.getElementById('homepage-contact-form');
    if (contactForm) {
        contactForm.onsubmit = (e) => {
            e.preventDefault();
            showToast("Subspace communication link established. Our crew will reply shortly!", "info");
            contactForm.reset();
        };
    }

    // ==========================================
    // FOREX MODAL TELEMETRY & STRATEGIC SIMULATOR COCKPIT
    // ==========================================
    function updateModalForexTelemetry() {
        const symbolEl = document.getElementById('trade-symbol');
        const entryEl = document.getElementById('trade-entry');
        const exitEl = document.getElementById('trade-exit');
        const quantityEl = document.getElementById('trade-quantity');
        const directionEl = document.getElementById('trade-direction');

        if (!symbolEl || !entryEl || !exitEl || !quantityEl || !directionEl) return;

        const symbol = symbolEl.value;
        const entry = parseFloat(entryEl.value) || 0;
        const exit = parseFloat(exitEl.value) || 0;
        const quantity = parseFloat(quantityEl.value) || 0;
        const direction = directionEl.value;

        const telemetryForm = document.getElementById('forex-telemetry-form');
        const telemetryType = document.getElementById('forex-telemetry-type');
        const telemetryPips = document.getElementById('forex-telemetry-pips');
        const telemetryPnL = document.getElementById('forex-telemetry-pnl');

        if (!telemetryForm) return;

        const specs = window.db.getForexSpecs(symbol);

        if (specs && specs.isForex) {
            telemetryForm.style.display = 'flex';
            if (telemetryType) telemetryType.textContent = specs.type;

            const diff = direction === 'LONG' ? (exit - entry) : (entry - exit);
            const pips = diff / specs.pipSize;
            const grossPnL = pips * quantity * specs.pipValuePerStandardLot;

            if (telemetryPips) {
                if (entry > 0 && exit > 0) {
                    telemetryPips.textContent = (pips >= 0 ? '+' : '') + pips.toFixed(1) + ' pips';
                    telemetryPips.style.color = pips >= 0 ? 'var(--success)' : 'var(--danger)';
                } else {
                    telemetryPips.textContent = '0.0 pips';
                    telemetryPips.style.color = 'var(--text-secondary)';
                }
            }

            if (telemetryPnL) {
                if (entry > 0 && exit > 0) {
                    telemetryPnL.textContent = (grossPnL >= 0 ? '+' : '') + formatCurrency(grossPnL);
                    telemetryPnL.className = grossPnL > 0.01 ? 'pnl-green' : (grossPnL < -0.01 ? 'pnl-red' : 'pnl-neutral');
                } else {
                    telemetryPnL.textContent = formatCurrency(0);
                    telemetryPnL.className = 'pnl-neutral';
                }
            }
        } else {
            telemetryForm.style.display = 'none';
        }
    }

    // Forex Guide Tab click handlers
    document.querySelectorAll('.forex-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.forex-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.forex-tab-content').forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        };
    });

    // Performance Reports Timeframe filter click handlers
    document.querySelectorAll('.reports-header-pane .timeframe-btn').forEach(btn => {
        btn.onclick = async () => {
            const timeframe = btn.getAttribute('data-timeframe');
            await loadReports(timeframe);
        };
    });

    // Excel Export button handler for reports
    const exportExcelBtn = document.getElementById('export-report-excel-btn');
    if (exportExcelBtn) {
        exportExcelBtn.onclick = async () => {
            if (typeof XLSX === 'undefined') {
                if (window.showToast) window.showToast("Excel library is still loading. Please try again in a moment.", "error");
                return;
            }

            const activeTfBtn = document.querySelector('.reports-header-pane .timeframe-btn.active');
            const timeframe = activeTfBtn ? activeTfBtn.getAttribute('data-timeframe') : 'all';
            
            // Fetch data for the selected timeframe
            const metrics = await window.db.getMetrics(timeframe);
            const trades = await window.db.getTrades(timeframe);
            
            const totalPips = trades.reduce((sum, t) => sum + (t.pips || 0), 0).toFixed(1);
            
            // Build Worksheet Data
            const wsData = [
                ["SUMMARY REPORT", ""],
                ["Timeframe", timeframe.toUpperCase()],
                ["Total Trades", metrics.totalTrades],
                ["Profitable Trades", metrics.winningTrades],
                ["Losing Trades", metrics.losingTrades],
                ["Win Rate", `${metrics.winRate}%`],
                ["Profit Factor", metrics.profitFactor === 99.99 ? 'Infinity' : metrics.profitFactor.toFixed(2)],
                ["Net PnL", metrics.totalNetPnL],
                ["Total Pips", totalPips],
                [],
                ["TRADE LOGS"],
                ["Date", "Symbol", "Direction", "Entry", "Exit", "Quantity", "Fees", "Net PnL", "Pips", "Strategy", "Emotion"]
            ];
            
            trades.forEach(t => {
                const dateStr = new Date(t.date).toLocaleString();
                wsData.push([
                    dateStr,
                    t.symbol,
                    t.direction,
                    t.entryPrice,
                    t.exitPrice,
                    t.quantity,
                    t.fees,
                    t.netPnL,
                    t.pips || 0,
                    t.strategy || 'N/A',
                    t.emotion || 'N/A'
                ]);
            });
            
            // Create workbook and worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Auto-size columns slightly for better visibility
            const colWidths = [
                {wch: 22}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 10},
                {wch: 10}, {wch: 10}, {wch: 12}, {wch: 10}, {wch: 20}, {wch: 15}
            ];
            ws['!cols'] = colWidths;
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Trading Report");
            
            // Trigger download
            XLSX.writeFile(wb, `trading_report_${timeframe}.xlsx`);
            
            if (window.showToast) {
                window.showToast(`Exported ${timeframe} report to Excel successfully!`);
            }
        };
    }

    // Forex Simulator Direction button handlers
    const simDirLong = document.getElementById('forex-dir-long');
    const simDirShort = document.getElementById('forex-dir-short');
    
    if (simDirLong && simDirShort) {
        simDirLong.onclick = () => {
            simDirLong.classList.add('active');
            simDirShort.classList.remove('active');
            
            simDirLong.style.background = 'var(--primary)';
            simDirLong.style.color = 'white';
            
            simDirShort.style.background = 'transparent';
            simDirShort.style.color = 'var(--text-secondary)';
            
            calculateForexSimulation();
        };
        
        simDirShort.onclick = () => {
            simDirShort.classList.add('active');
            simDirLong.classList.remove('active');
            
            simDirShort.style.background = 'var(--pink)';
            simDirShort.style.color = 'white';
            
            simDirLong.style.background = 'transparent';
            simDirLong.style.color = 'var(--text-secondary)';
            
            calculateForexSimulation();
        };
    }

    function calculateForexSimulation() {
        const catSelect = document.getElementById('forex-calc-category');
        const lotsInput = document.getElementById('forex-calc-lots');
        const entryInputSim = document.getElementById('forex-calc-entry');
        const exitInputSim = document.getElementById('forex-calc-exit');
        const slInputSim = document.getElementById('forex-calc-sl');
        const tpInputSim = document.getElementById('forex-calc-tp');

        if (!catSelect || !lotsInput || !entryInputSim || !exitInputSim) return;

        const category = catSelect.value;
        const lots = parseFloat(lotsInput.value) || 0;
        const entry = parseFloat(entryInputSim.value) || 0;
        const exit = parseFloat(exitInputSim.value) || 0;
        const sl = parseFloat(slInputSim.value) || 0;
        const tp = parseFloat(tpInputSim.value) || 0;

        let direction = 'LONG';
        if (simDirShort && simDirShort.classList.contains('active')) {
            direction = 'SHORT';
        }

        // Map category parameters
        let pipSize = 0.0001;
        let pipValuePerLot = 10.00;
        switch (category) {
            case 'A': pipSize = 0.0001; pipValuePerLot = 10.00; break;
            case 'B': pipSize = 0.01; pipValuePerLot = 6.70; break;
            case 'C': pipSize = 0.0001; pipValuePerLot = 11.10; break;
            case 'D': pipSize = 0.0001; pipValuePerLot = 7.30; break;
            case 'E': pipSize = 0.0001; pipValuePerLot = 12.50; break;
            case 'F': pipSize = 0.10; pipValuePerLot = 10.00; break;
            case 'G': pipSize = 0.01; pipValuePerLot = 10.00; break;
        }

        // Calculations
        const diff = direction === 'LONG' ? (exit - entry) : (entry - exit);
        const pips = diff / pipSize;
        const pnl = pips * lots * pipValuePerLot;

        let slPips = 0;
        let slRisk = 0;
        if (sl > 0) {
            const slDiff = direction === 'LONG' ? (entry - sl) : (sl - entry);
            slPips = slDiff / pipSize;
            slRisk = slPips * lots * pipValuePerLot;
        }

        let tpPips = 0;
        let tpReward = 0;
        if (tp > 0) {
            const tpDiff = direction === 'LONG' ? (tp - entry) : (entry - tp);
            tpPips = tpDiff / pipSize;
            tpReward = tpPips * lots * pipValuePerLot;
        }

        // Risk Reward
        let rrRatioStr = '1 : 0.00';
        let beWinRateStr = '0.0%';
        let riskPercent = 50;
        let rewardPercent = 50;

        if (slRisk > 0 && tpReward > 0) {
            const rrVal = tpReward / slRisk;
            rrRatioStr = `1 : ${rrVal.toFixed(2)}`;
            
            const beVal = (1 / (1 + rrVal)) * 100;
            beWinRateStr = `${beVal.toFixed(1)}%`;

            const total = slRisk + tpReward;
            riskPercent = (slRisk / total) * 100;
            rewardPercent = (tpReward / total) * 100;
        }

        // Update DOM Output fields
        const outPipsLabel = document.getElementById('forex-out-pips-label');
        const outPips = document.getElementById('forex-out-pips');
        const outPnL = document.getElementById('forex-out-pnl');
        const outSLPips = document.getElementById('forex-out-sl-pips');
        const outTPPips = document.getElementById('forex-out-tp-pips');
        const outRR = document.getElementById('forex-out-rr');
        const outBeWin = document.getElementById('forex-out-bewin');
        const rrVisualRisk = document.getElementById('forex-rr-visual-risk');
        const rrVisualReward = document.getElementById('forex-rr-visual-reward');

        if (outPipsLabel) {
            outPipsLabel.textContent = (pips >= 0 ? '+' : '') + pips.toFixed(1) + ' Pips';
            outPipsLabel.className = pips >= 0 ? 'trend-value pnl-green' : 'trend-value pnl-red';
        }
        if (outPips) {
            outPips.textContent = pips.toFixed(1) + ' Pips';
            outPips.className = pips >= 0 ? 'stat-number pnl-green' : 'stat-number pnl-red';
        }
        if (outPnL) {
            outPnL.textContent = (pnl >= 0 ? '+' : '-') + formatCurrency(Math.abs(pnl));
            outPnL.className = pnl >= 0 ? 'stat-number pnl-green' : 'stat-number pnl-red';
        }
        if (outSLPips) {
            outSLPips.textContent = `${slPips.toFixed(1)} Pips (${formatCurrency(slRisk)})`;
        }
        if (outTPPips) {
            outTPPips.textContent = `${tpPips.toFixed(1)} Pips (${formatCurrency(tpReward)})`;
        }
        if (outRR) {
            outRR.textContent = rrRatioStr;
        }
        if (outBeWin) {
            outBeWin.textContent = beWinRateStr;
        }
        if (rrVisualRisk) {
            rrVisualRisk.style.width = `${riskPercent}%`;
        }
        if (rrVisualReward) {
            rrVisualReward.style.width = `${rewardPercent}%`;
        }

        // Draw real-time Forex Simulator Candlestick Cockpit chart
        const simulatedTrade = {
            symbol: 'SIM_' + category,
            direction: direction,
            entryPrice: entry,
            exitPrice: exit,
            stopLoss: sl,
            takeProfit: tp,
            quantity: lots,
            fees: 0
        };
        const canvasSim = document.getElementById('forex-sim-canvas');
        if (canvasSim) {
            window.charts.drawTradeVisualChart(canvasSim, simulatedTrade, true);
        }
    }

    const catSelect = document.getElementById('forex-calc-category');
    const lotsInput = document.getElementById('forex-calc-lots');
    const entryInputSim = document.getElementById('forex-calc-entry');
    const exitInputSim = document.getElementById('forex-calc-exit');
    const slInputSim = document.getElementById('forex-calc-sl');
    const tpInputSim = document.getElementById('forex-calc-tp');

    if (catSelect) catSelect.onchange = calculateForexSimulation;
    if (lotsInput) lotsInput.oninput = calculateForexSimulation;
    if (entryInputSim) entryInputSim.oninput = calculateForexSimulation;
    if (exitInputSim) exitInputSim.oninput = calculateForexSimulation;
    if (slInputSim) slInputSim.oninput = calculateForexSimulation;
    if (tpInputSim) tpInputSim.oninput = calculateForexSimulation;

    // Global responsive window resize listener for drawing canvases sharply on the fly
    window.addEventListener('resize', () => {
        // Redraw active dashboard trade visualizer canvas if visible
        if (activeView === 'dashboard' && selectedDashboardTrade) {
            const canvas = document.getElementById('dashboard-trade-visualizer-canvas');
            if (canvas && document.getElementById('dashboard-trade-visualizer-card').style.display === 'block') {
                window.charts.drawTradeVisualChart(canvas, selectedDashboardTrade);
            }
        }
        
        // Redraw active modal preview canvas if visible
        if (modal.classList.contains('active')) {
            const previewGroup = document.getElementById('modal-chart-preview-group');
            if (previewGroup && previewGroup.style.display === 'block') {
                onModalInputUpdate();
            }
        }
        
        // Redraw forex simulator canvas if visible
        if (activeView === 'forex') {
            const canvas = document.getElementById('forex-sim-canvas');
            if (canvas) {
                calculateForexSimulation();
            }
        }
    });

    // ==========================================
    // CURRENCY STRENGTH METER SIMULATION
    // ==========================================
    function initCurrencyStrengthMeter() {
        const container = document.getElementById('currency-strength-bars');
        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
        
        if (container && container.children.length === 0) {
            currencies.forEach(cur => {
                const box = document.createElement('div');
                box.style.background = 'rgba(8,12,20,0.5)';
                box.style.border = '1px solid rgba(255,255,255,0.05)';
                box.style.borderRadius = '8px';
                box.style.padding = '16px';
                box.style.position = 'relative';
                
                box.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: bold; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary);" id="csm-dot-${cur}"></span> 
                            ${cur}
                        </span>
                        <span id="csm-val-${cur}" style="font-family: monospace; font-size: 14px; color: var(--text-secondary);">5.0</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; position: relative;">
                        <div id="csm-bar-${cur}" style="height: 100%; width: 50%; background: var(--text-secondary); transition: all 1s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 4px;"></div>
                    </div>
                `;
                container.appendChild(box);
            });
        }
        
        async function updateStrength() {
            try {
                // Get selected timeframes
                const timeframeSelect = document.getElementById('csm-timeframe');
                const barsTimeframe = timeframeSelect ? timeframeSelect.value : '1D';
                
                const dataTimeframeSelect = document.getElementById('csm-data-timeframe');
                const dataTimeframe = dataTimeframeSelect ? dataTimeframeSelect.value : '15M';
                
                // Fetch real market strength data from backend (in parallel)
                const fetchBars = fetch(`${window.API_BASE}/api/forex/strength?timeframe=${barsTimeframe}`).then(r => r.json());
                const fetchData = barsTimeframe === dataTimeframe ? fetchBars : fetch(`${window.API_BASE}/api/forex/strength?timeframe=${dataTimeframe}`).then(r => r.json());
                
                const [currentStrengths, tableStrengths] = await Promise.all([fetchBars, fetchData]);
                
                currencies.forEach(cur => {
                    const strength = currentStrengths[cur] || 5.0; // fallback to 5.0 neutral
                    
                    const bar = document.getElementById(`csm-bar-${cur}`);
                    const val = document.getElementById(`csm-val-${cur}`);
                    const dot = document.getElementById(`csm-dot-${cur}`);
                    
                    if (!bar || !val || !dot) return;
                    
                    val.textContent = parseFloat(strength).toFixed(1);
                    bar.style.width = `${strength * 10}%`;
                    
                    let color = 'var(--text-secondary)';
                    if (strength >= 7) {
                        color = '#10b981'; // Green
                    } else if (strength >= 4) {
                        color = '#fbbf24'; // Yellow
                    } else {
                        color = '#ef4444'; // Red
                    }
                    
                    bar.style.background = color;
                    dot.style.background = color;
                    dot.style.boxShadow = `0 0 8px ${color}`;
                    val.style.color = color;
                });
                
                // Populate the detailed Data Table using tableStrengths
                const tbody = document.getElementById('csm-data-table-body');
                if (tbody) {
                    const pairs = [
                        { base: 'EUR', quote: 'USD' },
                        { base: 'GBP', quote: 'JPY' },
                        { base: 'USD', quote: 'JPY' },
                        { base: 'AUD', quote: 'USD' },
                        { base: 'EUR', quote: 'GBP' }
                    ];
                    
                    let html = '';
                    pairs.forEach(pair => {
                        const bStr = parseFloat(tableStrengths[pair.base] || 5.0);
                        const qStr = parseFloat(tableStrengths[pair.quote] || 5.0);
                        const delta = (bStr - qStr).toFixed(1);
                        
                        let signal = 'NEUTRAL';
                        let signalColor = 'var(--text-secondary)';
                        
                        if (delta >= 4.0) {
                            signal = 'STRONG BUY 🚀';
                            signalColor = '#10b981';
                        } else if (delta <= -4.0) {
                            signal = 'STRONG SELL 🔻';
                            signalColor = '#ef4444';
                        } else if (delta >= 2.0) {
                            signal = 'BUY';
                            signalColor = '#34d399';
                        } else if (delta <= -2.0) {
                            signal = 'SELL';
                            signalColor = '#f87171';
                        }
                        
                        html += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                <td style="padding: 12px 8px; font-weight: bold; font-family: monospace;">${pair.base}/${pair.quote}</td>
                                <td style="padding: 12px 8px; color: ${bStr >= 7 ? '#10b981' : (bStr < 4 ? '#ef4444' : 'var(--text-primary)')};">${bStr.toFixed(1)}</td>
                                <td style="padding: 12px 8px; color: ${qStr >= 7 ? '#10b981' : (qStr < 4 ? '#ef4444' : 'var(--text-primary)')};">${qStr.toFixed(1)}</td>
                                <td style="padding: 12px 8px; font-family: monospace; font-weight: bold; color: ${delta > 0 ? '#10b981' : (delta < 0 ? '#ef4444' : 'var(--text-primary)')};">${delta > 0 ? '+' : ''}${delta}</td>
                                <td style="padding: 12px 8px; font-weight: bold; color: ${signalColor};">${signal}</td>
                            </tr>
                        `;
                    });
                    tbody.innerHTML = html;
                }
            } catch (err) {
                console.error("Error fetching live CSM data:", err);
            }
        }
        
        updateStrength();
        if (csmIntervalId) clearInterval(csmIntervalId);
        csmIntervalId = setInterval(updateStrength, 3500);
        
        // Bind timeframe selector to trigger instant update
        const timeframeSelector = document.getElementById('csm-timeframe');
        if (timeframeSelector && !timeframeSelector.hasAttribute('data-bound')) {
            timeframeSelector.setAttribute('data-bound', 'true');
            timeframeSelector.addEventListener('change', () => {
                const container = document.querySelector('.forex-csm-card');
                if (container) container.style.opacity = '0.5';
                setTimeout(() => {
                    updateStrength();
                    if (container) container.style.opacity = '1';
                }, 150);
                clearInterval(csmIntervalId);
                csmIntervalId = setInterval(updateStrength, 3500);
            });
        }
        
        // Bind data timeframe selector
        const dataTimeframeSelector = document.getElementById('csm-data-timeframe');
        if (dataTimeframeSelector && !dataTimeframeSelector.hasAttribute('data-bound')) {
            dataTimeframeSelector.setAttribute('data-bound', 'true');
            dataTimeframeSelector.addEventListener('change', () => {
                const tableContainer = document.getElementById('csm-data-table-body');
                if (tableContainer) tableContainer.style.opacity = '0.5';
                setTimeout(() => {
                    updateStrength().then(() => {
                        if (tableContainer) tableContainer.style.opacity = '1';
                    });
                }, 150);
                clearInterval(csmIntervalId);
                csmIntervalId = setInterval(updateStrength, 3500);
            });
        }
    }

    // ==========================================
    // 9. INITIALIZE APPLICATION DASHBOARD
    // ==========================================
    // Default boot navigation: Enforce user session or landing routing

    // ==========================================
    // STACKED CURRENCY STRENGTH METER (Live Data)
    // ==========================================
    function initStackedCurrencyStrengthMeter() {
        const container = document.getElementById('currency-strength-container');
        if (!container) return;
        
        const currencies = ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'];
        let csmInterval;

        // Build HTML
        container.innerHTML = '';
        currencies.forEach(cur => {
            const col = document.createElement('div');
            col.className = 'currency-column';
            col.innerHTML = `
                <div class="currency-label">${cur} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg></div>
                <div class="strength-bars-container" id="strength-bars-${cur}">
                    ${Array(10).fill('<div class="strength-bar"></div>').join('')}
                </div>
            `;
            container.appendChild(col);
        });

        async function updateMeter() {
            try {
                // Get selected timeframe from the dropdown in the CSM view header
                const timeframeSelect = document.getElementById('csm-timeframe');
                const timeframe = timeframeSelect ? timeframeSelect.value : '1D';
                
                const response = await fetch(`${window.API_BASE}/api/forex/strength?timeframe=${timeframe}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const strengths = await response.json();
                
                currencies.forEach(cur => {
                    let s = Math.round(parseFloat(strengths[cur] || 5.0));
                    if (s < 1) s = 1; // Min 1 bar always visible looks better
                    if (s > 10) s = 10;

                    const barsContainer = document.getElementById(`strength-bars-${cur}`);
                    if (barsContainer) {
                        const bars = barsContainer.children;
                        for (let i = 0; i < 10; i++) {
                            if (i < s) {
                                bars[i].classList.add('filled');
                            } else {
                                bars[i].classList.remove('filled');
                            }
                        }
                    }
                });
            } catch (error) {
                console.error("Failed to fetch real CSM data:", error);
            }
        }

        // Delay initial render slightly to allow DOM to settle
        setTimeout(() => {
            updateMeter();
            csmInterval = setInterval(updateMeter, 60000); // Fetch real data every 60 seconds
        }, 100);

        // Bind refresh button
        const refreshBtn = document.getElementById('refresh-strength-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Dim briefly to indicate refresh
                if (container) container.style.opacity = '0.5';
                clearInterval(csmInterval);
                updateMeter().then(() => {
                    if (container) container.style.opacity = '1';
                });
                csmInterval = setInterval(updateMeter, 60000);
            });
        }
        
        // Bind timeframe selector to trigger instant update
        const timeframeSelector = document.getElementById('csm-timeframe');
        if (timeframeSelector) {
            timeframeSelector.addEventListener('change', () => {
                if (container) container.style.opacity = '0.5';
                clearInterval(csmInterval);
                updateMeter().then(() => {
                    if (container) container.style.opacity = '1';
                });
                csmInterval = setInterval(updateMeter, 60000);
            });
        }
    }

    initStackedCurrencyStrengthMeter();

    initUserSession();
});
