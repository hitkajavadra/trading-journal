/**
 * Ascend Charts Core - Live TradingView Charting & HUD Telemetry Engine
 * Dynamically loads and bootstraps the TradingView advanced real-time charting iframe widgets.
 * Supports hot-swapping symbols, timeframe synchronization, theme syncing.
 * Additionally orchestrates a lightweight real-time 2D Canvas HUD visualizer representing
 * Entry, Stop Loss (SL), Take Profit (TP), and Exit levels with ticking pip simulation.
 */

class LiveChartsEngine {
    constructor() {
        this.dashboardWidget = null;
        this.forexWidget = null;
        
        // Active states
        this.activeTickers = {
            dashboard: 'BTCUSD',
            forex: 'EURUSD'
        };
        
        this.activeIntervals = {
            dashboard: '60', // 1h in minutes
            forex: '60'
        };

        // Symbol translation mappings to fetch high-fidelity data feeds
        this.exchangeMappings = {
            'BTCUSD': 'BINANCE:BTCUSDT',
            'ETHUSD': 'BINANCE:ETHUSDT',
            'EURUSD': 'FX:EURUSD',
            'GBPUSD': 'FX:GBPUSD',
            'USDJPY': 'FX:USDJPY',
            'XAUUSD': 'OANDA:XAUUSD',
            'USOIL': 'OANDA:WTICOUSD'
        };

        this.scriptLoaded = false;
        
        // Telemetry HUD Interval
        this.hudInterval = null;

        this.init();
    }

    init() {
        // Dynamically bootstrap the TradingView library CDN script to guarantee instant server-independent execution
        if (!document.getElementById('tradingview-cdn-loader')) {
            const script = document.createElement('script');
            script.id = 'tradingview-cdn-loader';
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                this.scriptLoaded = true;
                console.log("TradingView Advanced Charts Library bootstrapped successfully!");
                this.loadActiveWidgets();
            };
            document.body.appendChild(script);
        } else {
            this.scriptLoaded = true;
            this.loadActiveWidgets();
        }

        document.addEventListener('DOMContentLoaded', () => {
            this.bindUIEvents();
            this.startHUDTelemetryLoop();
        });
    }

    cacheDOM() {
        // Ticker dropdowns
        this.dashTickerSelect = document.getElementById('dashboard-chart-ticker');
        this.forexTickerSelect = document.getElementById('forex-chart-ticker');

        // Loading spinner overlays
        this.dashLoader = document.getElementById('dashboard-chart-loader');
        this.forexLoader = document.getElementById('forex-chart-loader');
    }

    bindUIEvents() {
        this.cacheDOM();

        // Dashboard Ticker Select trigger
        if (this.dashTickerSelect) {
            this.dashTickerSelect.onchange = (e) => {
                const newTicker = e.target.value;
                this.changeTickerSymbol('dashboard', newTicker);
            };
        }

        // Forex Ticker Select trigger
        if (this.forexTickerSelect) {
            this.forexTickerSelect.onchange = (e) => {
                const newTicker = e.target.value;
                this.changeTickerSymbol('forex', newTicker);
            };
        }

        // Dashboard Timeframe shortcut buttons
        const tfGroup = document.getElementById('dashboard-chart-timeframes');
        if (tfGroup) {
            tfGroup.querySelectorAll('.live-chart-tf-btn').forEach(btn => {
                btn.onclick = () => {
                    tfGroup.querySelectorAll('.live-chart-tf-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const tfVal = btn.getAttribute('data-tf');
                    this.changeTimeframe('dashboard', tfVal);
                };
            });
        }

        // Widescreen Fullscreen Card toggle
        const fsBtn = document.getElementById('dashboard-chart-fullscreen');
        const chartCard = document.getElementById('dashboard-live-chart-card');
        
        if (fsBtn && chartCard) {
            fsBtn.onclick = () => {
                chartCard.classList.toggle('chart-terminal-maximized');
                fsBtn.classList.toggle('fullscreen-active');
                
                const isMax = chartCard.classList.contains('chart-terminal-maximized');
                fsBtn.title = isMax ? 'Exit Full Screen Mode' : 'Full Screen Cockpit Mode';
                fsBtn.innerHTML = isMax ? '🗗' : '⛶';
                
                // Play entry programmatic sound synthesis!
                if (window.signalTerminal && window.signalTerminal.playEntrySound) {
                    window.signalTerminal.playEntrySound();
                }
                
                // Instantly force HUD visualizer refresh
                this.updateTelemetryHUD();
            };
        }
    }

    async loadActiveWidgets() {
        if (!this.scriptLoaded || typeof TradingView === 'undefined') return;

        const currentSettings = window.db ? await window.db.getSettings() : { theme: 'dark' };
        const activeTheme = currentSettings.theme || 'dark';

        this.loadDashboardWidget(activeTheme);
        this.loadForexWidget(activeTheme);
    }

    loadDashboardWidget(theme = 'dark') {
        const container = document.getElementById('dashboard-tradingview-widget');
        if (!container || typeof TradingView === 'undefined') return;

        const tvSymbol = this.exchangeMappings[this.activeTickers.dashboard] || `FX:${this.activeTickers.dashboard}`;
        const interval = this.activeIntervals.dashboard;

        this.showLoader('dashboard');
        container.innerHTML = '';

        // Instantiate advanced widget
        this.dashboardWidget = new TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval: interval,
            timezone: "Etc/UTC",
            theme: theme,
            style: "1", // Candlesticks style
            locale: "en",
            enable_publishing: false,
            hide_side_toolbar: false, // Show standard drawing tools!
            allow_symbol_change: true,
            container_id: "dashboard-tradingview-widget",
            studies: [
                "RSI@tv-basicstudies",
                "MASimple@tv-basicstudies"
            ],
            loading_screen: {
                backgroundColor: "#080c14",
                foregroundColor: "#06b6d4"
            },
            onChartReady: () => {
                this.hideLoader('dashboard');
            }
        });

        // Safe fallback in case onChartReady does not fire (OANDA/Binance connections delay)
        setTimeout(() => this.hideLoader('dashboard'), 2000);
    }

    loadForexWidget(theme = 'dark') {
        const container = document.getElementById('forex-tradingview-widget');
        if (!container || typeof TradingView === 'undefined') return;

        const tvSymbol = this.exchangeMappings[this.activeTickers.forex] || `FX:${this.activeTickers.forex}`;
        const interval = this.activeIntervals.forex;

        this.showLoader('forex');
        container.innerHTML = '';

        this.forexWidget = new TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval: interval,
            timezone: "Etc/UTC",
            theme: theme,
            style: "1",
            locale: "en",
            enable_publishing: false,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            container_id: "forex-tradingview-widget",
            studies: [
                "RSI@tv-basicstudies",
                "MASimple@tv-basicstudies"
            ],
            loading_screen: {
                backgroundColor: "#080c14",
                foregroundColor: "#06b6d4"
            },
            onChartReady: () => {
                this.hideLoader('forex');
            }
        });

        setTimeout(() => this.hideLoader('forex'), 2000);
    }

    async changeTickerSymbol(view, newTicker) {
        if (!newTicker) return;

        const parsedTicker = newTicker.toUpperCase().replace('/', '').trim();
        this.activeTickers[view] = parsedTicker;

        // Synchronize dropdown selectors visually in the UI if present
        this.cacheDOM();
        if (view === 'dashboard' && this.dashTickerSelect) {
            this.dashTickerSelect.value = parsedTicker;
        } else if (view === 'forex' && this.forexTickerSelect) {
            this.forexTickerSelect.value = parsedTicker;
        }

        const settings = window.db ? await window.db.getSettings() : { theme: 'dark' };
        const activeTheme = settings.theme || 'dark';

        if (view === 'dashboard') {
            this.loadDashboardWidget(activeTheme);
        } else if (view === 'forex') {
            this.loadForexWidget(activeTheme);
        }
    }

    async changeTimeframe(view, timeframe) {
        this.activeIntervals[view] = timeframe;
        
        const settings = window.db ? await window.db.getSettings() : { theme: 'dark' };
        const activeTheme = settings.theme || 'dark';

        if (view === 'dashboard') {
            this.loadDashboardWidget(activeTheme);
        } else if (view === 'forex') {
            this.loadForexWidget(activeTheme);
        }
    }

    // Utility loading states handlers
    showLoader(view) {
        this.cacheDOM();
        if (view === 'dashboard' && this.dashLoader) {
            this.dashLoader.classList.add('active');
        } else if (view === 'forex' && this.forexLoader) {
            this.forexLoader.classList.add('active');
        }
    }

    hideLoader(view) {
        this.cacheDOM();
        if (view === 'dashboard' && this.dashLoader) {
            this.dashLoader.classList.remove('active');
        } else if (view === 'forex' && this.forexLoader) {
            this.forexLoader.classList.remove('active');
        }
    }

    // Re-renders theme adaptive parameters instantly when user toggles Dark/Light theme!
    syncTheme(theme) {
        if (this.scriptLoaded) {
            this.loadActiveWidgets();
        }
    }

    // ==========================================
    // 2D CANVAS TELEMETRY HUD SYNC & RENDER LOOP
    // ==========================================
    startHUDTelemetryLoop() {
        if (this.hudInterval) clearInterval(this.hudInterval);
        
        // Tick every 800ms for high responsiveness
        this.hudInterval = setInterval(() => {
            this.updateTelemetryHUD();
        }, 800);
    }

    updateTelemetryHUD() {
        const canvas = document.getElementById('live-chart-hud-canvas');
        if (!canvas) return;

        const statusEl = document.getElementById('live-hud-status-mode');
        const priceValEl = document.getElementById('live-hud-ticking-price');
        const pnlEl = document.getElementById('live-hud-floating-pnl');
        const tpEl = document.getElementById('hud-val-tp');
        const entEl = document.getElementById('hud-val-entry');
        const slEl = document.getElementById('hud-val-sl');
        const exitRow = document.getElementById('hud-level-row-exit');
        const exitValEl = document.getElementById('hud-val-exit');
        const infoTipsEl = document.getElementById('live-hud-info-tips');

        const activeSymbol = this.activeTickers.dashboard || 'BTCUSD';
        
        // Find if there is an active CLI trade running for this ticker symbol
        let activeTrade = null;
        if (window.signalTerminal && window.signalTerminal.activeTrades) {
            activeTrade = window.signalTerminal.activeTrades.find(t => t.symbol === activeSymbol && !t.isClosed);
        }

        // Find if there is a selected historical trade from the database logs
        const selectedTrade = window.selectedDashboardTrade;

        if (activeTrade) {
            // Mode: Active Engaged Position
            if (statusEl) {
                statusEl.textContent = 'ACTIVE';
                statusEl.className = 'live-hud-status hud-status-active';
            }

            const specs = window.db ? window.db.getForexSpecs(activeTrade.symbol) : null;
            const pipSize = specs ? specs.pipSize : 0.0001;
            const currentPrice = activeTrade.entryPrice + (activeTrade.direction === 'LONG' ? activeTrade.currentPips : -activeTrade.currentPips) * pipSize;
            
            const decimalDigits = activeTrade.symbol.includes('JPY') || activeTrade.symbol.includes('USD') && activeTrade.entryPrice > 100 ? 2 : 5;

            if (priceValEl) priceValEl.textContent = currentPrice.toFixed(decimalDigits);
            
            const pnlSign = activeTrade.currentPnL >= 0 ? '+' : '';
            const pnlVal = window.formatCurrency ? window.formatCurrency(activeTrade.currentPnL) : `$${activeTrade.currentPnL.toFixed(2)}`;
            if (pnlEl) {
                pnlEl.textContent = `${pnlSign}${pnlVal} (${activeTrade.currentPips >= 0 ? '+' : ''}${activeTrade.currentPips.toFixed(1)} pips)`;
                pnlEl.className = activeTrade.currentPnL >= 0.01 ? 'live-hud-price-pnl pnl-green' : (activeTrade.currentPnL < -0.01 ? 'live-hud-price-pnl pnl-red' : 'live-hud-price-pnl pnl-neutral');
            }

            if (tpEl) tpEl.textContent = activeTrade.takeProfit > 0 ? activeTrade.takeProfit.toFixed(decimalDigits) : 'None';
            if (entEl) entEl.textContent = activeTrade.entryPrice.toFixed(decimalDigits);
            if (slEl) slEl.textContent = activeTrade.stopLoss > 0 ? activeTrade.stopLoss.toFixed(decimalDigits) : 'None';
            if (exitRow) exitRow.style.display = 'none';

            if (infoTipsEl) infoTipsEl.innerHTML = `📡 Live price ticks fluctuating. Protective SL and Target TP boundaries monitored in real-time.`;

            this.renderTelemetryCanvas(canvas, activeTrade, 'active', currentPrice);

        } else if (selectedTrade && selectedTrade.symbol === activeSymbol) {
            // Mode: Historical Audit
            if (statusEl) {
                statusEl.textContent = 'AUDIT';
                statusEl.className = 'live-hud-status hud-status-history';
            }

            const entryPrice = parseFloat(selectedTrade.entryPrice);
            const exitPrice = parseFloat(selectedTrade.exitPrice || 0);
            const stopLoss = parseFloat(selectedTrade.stopLoss || 0);
            const takeProfit = parseFloat(selectedTrade.takeProfit || 0);
            const netPnL = parseFloat(selectedTrade.netPnL || 0);
            
            const decimalDigits = selectedTrade.symbol.includes('JPY') || selectedTrade.symbol.includes('USD') && entryPrice > 100 ? 2 : 5;

            if (priceValEl) priceValEl.textContent = exitPrice > 0 ? exitPrice.toFixed(decimalDigits) : 'N/A';
            
            const pnlSign = netPnL >= 0 ? '+' : '';
            const pnlVal = window.formatCurrency ? window.formatCurrency(netPnL) : `$${netPnL.toFixed(2)}`;
            if (pnlEl) {
                pnlEl.textContent = `${pnlSign}${pnlVal} (Closed)`;
                pnlEl.className = netPnL >= 0.01 ? 'live-hud-price-pnl pnl-green' : (netPnL < -0.01 ? 'live-hud-price-pnl pnl-red' : 'live-hud-price-pnl pnl-neutral');
            }

            if (tpEl) tpEl.textContent = takeProfit > 0 ? takeProfit.toFixed(decimalDigits) : 'None';
            if (entEl) entEl.textContent = entryPrice.toFixed(decimalDigits);
            if (slEl) slEl.textContent = stopLoss > 0 ? stopLoss.toFixed(decimalDigits) : 'None';
            
            if (exitRow) {
                exitRow.style.display = 'flex';
                if (exitValEl) exitValEl.textContent = exitPrice > 0 ? exitPrice.toFixed(decimalDigits) : 'None';
            }

            if (infoTipsEl) infoTipsEl.innerHTML = `🏁 Historical trade record analyzed. Direction: <strong>${selectedTrade.direction}</strong>. Strategy: <strong>${selectedTrade.strategy}</strong>.`;

            this.renderTelemetryCanvas(canvas, selectedTrade, 'historical', exitPrice);

        } else {
            // Mode: Standby
            if (statusEl) {
                statusEl.textContent = 'STANDBY';
                statusEl.className = 'live-hud-status hud-status-standby';
            }

            if (priceValEl) priceValEl.textContent = '---.--';
            if (pnlEl) {
                pnlEl.textContent = 'ENGAGE POSITION';
                pnlEl.className = 'live-hud-price-pnl pnl-neutral';
            }

            if (tpEl) tpEl.textContent = '---.--';
            if (entEl) entEl.textContent = '---.--';
            if (slEl) slEl.textContent = '---.--';
            if (exitRow) exitRow.style.display = 'none';

            if (infoTipsEl) infoTipsEl.innerHTML = `💡 Engage a live position via CLI \`/buy\` or \`/sell\` commands, or click any database row in the Recent Trades Table below.`;

            this.renderTelemetryCanvas(canvas, null, 'standby', 0);
        }
    }

    renderTelemetryCanvas(canvas, trade, mode, currentPrice) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Scale canvas drawing area programmatically to avoid blurriness
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // 1. Draw subtle grid background
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.04)';
        ctx.lineWidth = 1;
        const gridGap = 20;

        for (let y = 0; y < height; y += gridGap) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        for (let x = 0; x < width; x += gridGap) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        if (mode === 'standby') {
            // Draw stunning futuristic holographic radar scanner overlay
            const cx = width / 2;
            const cy = height / 2;

            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(6, 182, 212, 0.2)';

            // Outer ring
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 50, 0, Math.PI * 2);
            ctx.stroke();

            // Inner scanning rings
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
            ctx.beginPath();
            ctx.arc(cx, cy, 32, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, 16, 0, Math.PI * 2);
            ctx.stroke();

            // Reticle crosshair lines
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - 65, cy);
            ctx.lineTo(cx + 65, cy);
            ctx.moveTo(cx, cy - 65);
            ctx.lineTo(cx, cy + 65);
            ctx.stroke();

            // Sweep radar line animating programmatically using timestamps
            const now = Date.now();
            const angle = (now % 3000) / 3000 * Math.PI * 2;
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * 50, cy + Math.sin(angle) * 50);
            ctx.stroke();

            ctx.shadowBlur = 0; // Reset shadow

            // HUD standby texts
            ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SIGNAL TELEMETRY STANDBY', cx, cy + 72);
            
            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.35)';
            ctx.font = '8px Inter, sans-serif';
            ctx.fillText('Awaiting live cockpit logs...', cx, cy + 85);

        } else {
            // Mode is active or historical
            const entry = parseFloat(trade.entryPrice);
            const sl = parseFloat(trade.stopLoss || 0);
            const tp = parseFloat(trade.takeProfit || 0);
            const direction = trade.direction;

            // Determine bounds for Y coordinates mapping
            const prices = [entry, currentPrice];
            if (sl > 0) prices.push(sl);
            if (tp > 0) prices.push(tp);

            const pMax = Math.max(...prices);
            const pMin = Math.min(...prices);
            const pDiff = pMax - pMin === 0 ? 0.1 : (pMax - pMin);
            
            // Map prices to Y values on canvas with 18% top/bottom padding
            const padding = 30;
            const chartHeight = height - padding * 2;
            
            const getY = (p) => {
                return height - padding - ((p - pMin) / pDiff) * chartHeight;
            };

            const chartLeft = 10;
            const chartRight = width - 82;
            const chartWidth = chartRight - chartLeft;

            const entryY = getY(entry);
            const currentY = getY(currentPrice);

            // 2. Shade Risk & Reward zones
            // Reward zone (translucent green)
            if (tp > 0) {
                const tpY = getY(tp);
                const rY = Math.min(entryY, tpY);
                const rH = Math.abs(entryY - tpY);
                const grad = ctx.createLinearGradient(0, rY, 0, rY + rH);
                
                const isWinner = (direction === 'LONG' && tp > entry) || (direction === 'SHORT' && tp < entry);
                if (isWinner) {
                    grad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
                    grad.addColorStop(1, 'rgba(16, 185, 129, 0.005)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(chartLeft, rY, chartWidth, rH);
                }
            }

            // Risk zone (translucent red)
            if (sl > 0) {
                const slY = getY(sl);
                const rY = Math.min(entryY, slY);
                const rH = Math.abs(entryY - slY);
                const grad = ctx.createLinearGradient(0, rY, 0, rY + rH);
                
                const isRiskValid = (direction === 'LONG' && sl < entry) || (direction === 'SHORT' && sl > entry);
                if (isRiskValid) {
                    grad.addColorStop(0, 'rgba(244, 63, 94, 0.08)');
                    grad.addColorStop(1, 'rgba(244, 63, 94, 0.005)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(chartLeft, rY, chartWidth, rH);
                }
            }

            // 3. Draw horizontal level lines
            const drawLevel = (price, color, isDashed = false) => {
                const y = getY(price);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                if (isDashed) {
                    ctx.setLineDash([4, 3]);
                } else {
                    ctx.setLineDash([]);
                }
                ctx.beginPath();
                ctx.moveTo(chartLeft, y);
                ctx.lineTo(chartRight, y);
                ctx.stroke();
            };

            // Protective SL Line
            if (sl > 0) drawLevel(sl, 'rgba(244, 63, 94, 0.55)', false);
            // Target TP Line
            if (tp > 0) drawLevel(tp, 'rgba(16, 185, 129, 0.55)', false);
            // Entry Line
            drawLevel(entry, 'rgba(6, 182, 212, 0.55)', true);

            // 4. Draw levels pills on the right margin
            const drawPill = (price, label, bgColor, textColor = 'white') => {
                const y = getY(price);
                ctx.fillStyle = bgColor;
                ctx.setLineDash([]);

                const pW = 65;
                const pH = 14;
                const px = chartRight + 5;
                const py = y - pH / 2;

                // Tiny triangular arrow pointing to the line
                ctx.beginPath();
                ctx.moveTo(px, y);
                ctx.lineTo(px + 4, y - 3);
                ctx.lineTo(px + 4, y + 3);
                ctx.closePath();
                ctx.fill();

                // Pill container rounded rect
                ctx.beginPath();
                ctx.roundRect(px + 4, py, pW, pH, 3);
                ctx.fill();

                // Text
                ctx.fillStyle = textColor;
                ctx.font = 'bold 8.5px monospace';
                ctx.textAlign = 'left';
                const formattedPrice = price.toFixed(price > 100 ? 2 : 4);
                ctx.fillText(`${label}:${formattedPrice}`, px + 8, y + 3.5);
            };

            if (sl > 0) drawPill(sl, 'SL', 'rgba(244, 63, 94, 0.85)');
            if (tp > 0) drawPill(tp, 'TP', 'rgba(16, 185, 129, 0.85)');
            drawPill(entry, 'ENT', 'rgba(6, 182, 212, 0.85)');

            // 5. Draw ticking price cursor / exit cursor
            ctx.shadowBlur = 8;
            
            const isProfit = mode === 'active' ? trade.currentPnL >= 0.01 : (trade.netPnL || 0) >= 0.01;
            const curColor = mode === 'active' ? '#06b6d4' : (isProfit ? '#10b981' : '#f43f5e');
            
            ctx.shadowColor = mode === 'active' ? 'rgba(6, 182, 212, 0.5)' : (isProfit ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)');

            drawLevel(currentPrice, curColor, false);
            drawPill(currentPrice, mode === 'active' ? 'PRC' : 'EXT', curColor);

            ctx.shadowBlur = 0; // Reset shadow

            // 6. Draw glowing connection vector between Entry and Current/Exit
            ctx.strokeStyle = curColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(width / 3, entryY);
            ctx.lineTo(width / 3, currentY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw entry and price anchor points
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(width / 3, entryY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = curColor;
            ctx.beginPath();
            ctx.arc(width / 3, currentY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// Attach globally for dynamic CLI chat order feeds sync
window.LiveChartsEngine = LiveChartsEngine;
window.liveChartsEngine = new LiveChartsEngine();
