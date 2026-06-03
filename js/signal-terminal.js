/**
 * Ascend Terminal - Live Chat & Active Trade Signal Logging Engine
 * Supports Regex CLI command parsing, simulated price feeds, live pips tracker,
 * Web Audio programmatic sound synthesis, and real-time dashboard updates.
 */

class SignalTerminal {
    constructor() {
        // Chat states & logs
        this.activeMode = 'community'; // 'community', 'ai', 'support'
        this.messages = {
            community: [
                { id: 1, sender: 'Commander Sarah K.', text: 'Welcome to Ascend Subspace Comm Channel! Here pilots share live telemetry signals.', timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'community' },
                { id: 2, sender: 'Pilot James L.', text: 'Markets are looking extremely volatile today. Keeping my risk low at 1% per trade.', timestamp: new Date(Date.now() - 1800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'community' }
            ],
            ai: [
                { id: 1, sender: 'AI Buddy', text: 'Cockpit Assistant online. Feed me active CLI commands to securely log trades.\n\n💡 Try commands:\n`/buy EURUSD entry 1.0850 sl 1.0810 tp 1.0950 lot 0.2`\n`/close EURUSD exit 1.0910`\n`/metrics` to view current statistics.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'bot' }
            ],
            support: [
                { id: 1, sender: 'Support Officer', text: 'Orbital support coordinates online. How can we assist you with your database or cockpit telemetry today?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'bot' }
            ]
        };

        // Active trades tracked with live price ticks
        this.activeTrades = []; // Holds active signal objects: { id, tradeId, symbol, direction, entryPrice, stopLoss, takeProfit, lot, currentPips, currentPnL }

        // Interval timers
        this.pipsInterval = null;
        this.communityInterval = null;

        // UI references
        this.triggerBtn = null;
        this.panel = null;
        this.closeBtn = null;
        this.modesContainer = null;
        this.messagesContainer = null;
        this.form = null;
        this.input = null;
        this.badge = null;
        this.flashOverlay = null;

        // Unread messages counter
        this.unreadCount = 0;

        // Web Audio context for synthesizer
        this.audioCtx = null;

        // Names for simulated community room chatter
        this.otherPilots = ['Commander Sarah K.', 'Pilot James L.', 'Commander Dave R.', 'Quant Officer Rex', 'Telemetry Bot 9'];
        this.communityPairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'XAUUSD'];

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.cacheDOM();
            this.bindEvents();
            this.renderMessages();
            this.startLivePipsFeed();
            this.startCommunityChatter();
            this.syncExistingActiveTrades();
        });
    }

    cacheDOM() {
        this.triggerBtn = document.getElementById('terminal-trigger-btn');
        this.panel = document.getElementById('terminal-panel');
        this.closeBtn = document.getElementById('terminal-close-btn');
        this.maxBtn = document.getElementById('terminal-max-btn');
        this.messagesContainer = document.getElementById('terminal-messages-container');
        this.form = document.getElementById('terminal-form');
        this.input = document.getElementById('terminal-input');
        this.badge = document.getElementById('terminal-badge');
        this.flashOverlay = document.getElementById('terminal-flash-overlay');

        // Cache mode buttons
        this.modesContainer = document.querySelector('.terminal-modes');
    }

    bindEvents() {
        if (this.triggerBtn) {
            this.triggerBtn.onclick = () => {
                this.panel.classList.add('active');
                this.triggerBtn.style.display = 'none';
                this.unreadCount = 0;
                this.updateBadge();
                this.scrollChatToBottom();
            };
        }

        if (this.closeBtn) {
            this.closeBtn.onclick = () => {
                this.panel.classList.remove('active');
                this.panel.classList.remove('terminal-maximized');
                if (this.maxBtn) {
                    this.maxBtn.classList.remove('maximized-active');
                    this.maxBtn.textContent = '⛶';
                    this.maxBtn.title = 'Maximize Terminal';
                }
                this.triggerBtn.style.display = 'flex';
            };
        }

        // Maximization Toggle
        if (this.maxBtn) {
            this.maxBtn.onclick = () => {
                this.panel.classList.toggle('terminal-maximized');
                this.maxBtn.classList.toggle('maximized-active');
                
                const isMax = this.panel.classList.contains('terminal-maximized');
                this.maxBtn.title = isMax ? 'Minimize Terminal' : 'Maximize Terminal';
                this.maxBtn.textContent = isMax ? '🗗' : '⛶';
                
                this.playEntrySound();
                this.scrollChatToBottom();
            };
        }

        // Mode toggles
        if (this.modesContainer) {
            this.modesContainer.querySelectorAll('.terminal-mode-btn').forEach(btn => {
                btn.onclick = (e) => {
                    this.modesContainer.querySelectorAll('.terminal-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.activeMode = btn.getAttribute('data-mode');
                    this.renderMessages();
                };
            });
        }

        // CLI submission form
        if (this.form) {
            this.form.onsubmit = async (e) => {
                e.preventDefault();
                const text = this.input.value.trim();
                if (!text) return;

                await this.handleUserSendMessage(text);
                this.input.value = '';
            };
        }
    }

    // Programmatic Web Audio Synthesizer for high-tech micro-sounds
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playEntrySound() {
        try {
            this.initAudio();
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            // Quantum entry ramp frequency
            osc.frequency.setValueAtTime(140, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(580, this.audioCtx.currentTime + 0.25);

            // Filter for premium synth tone
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);

            gainNode.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        } catch (e) {
            console.error('Audio synthesis failed', e);
        }
    }

    playExitSound(isProfit) {
        try {
            this.initAudio();
            if (isProfit) {
                // Synthesize elegant multi-tone cash register chime
                const now = this.audioCtx.currentTime;
                const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord

                chords.forEach((freq, idx) => {
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

                    gain.gain.setValueAtTime(0.04, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.4);

                    osc.connect(gain);
                    gain.connect(this.audioCtx.destination);

                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.45);
                });

                // Add small white noise burst for metallic register sound
                const bufferSize = this.audioCtx.sampleRate * 0.12;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.audioCtx.createBufferSource();
                noise.buffer = buffer;

                const noiseFilter = this.audioCtx.createBiquadFilter();
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.setValueAtTime(2000, now);

                const noiseGain = this.audioCtx.createGain();
                noiseGain.gain.setValueAtTime(0.015, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.audioCtx.destination);
                noise.start(now);
                noise.stop(now + 0.12);

            } else {
                // Sad decaying low synth sweep
                const now = this.audioCtx.currentTime;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.4);

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.4);
            }
        } catch (e) {
            console.error('Audio synthesis failed', e);
        }
    }

    // Trigger full screen visual flash glow overlays
    triggerScreenFlash(isProfit) {
        if (!this.flashOverlay) return;
        this.flashOverlay.className = isProfit ? 'flash-profit' : 'flash-loss';
        setTimeout(() => {
            this.flashOverlay.className = '';
        }, 1000);
    }

    // Sync any open trades currently inside database storage
    async syncExistingActiveTrades() {
        await window.db.initPromise;
        const dbTrades = await window.db.getTrades();
        // Active trades are trades with no exit price (value === 0)
        const openDbTrades = dbTrades.filter(t => parseFloat(t.exitPrice) === 0);

        openDbTrades.forEach(trade => {
            if (!this.activeTrades.some(t => t.tradeId === trade.id)) {
                this.activeTrades.push({
                    id: 'active_' + Math.random().toString(36).substr(2, 9),
                    tradeId: trade.id,
                    symbol: trade.symbol,
                    direction: trade.direction,
                    entryPrice: trade.entryPrice,
                    stopLoss: trade.stopLoss,
                    takeProfit: trade.takeProfit,
                    lot: trade.quantity || 0.10,
                    currentPips: 0,
                    currentPnL: 0,
                    isClosed: false
                });
            }
        });
    }

    // Main user messaging routing
    async handleUserSendMessage(text) {
        this.addMessage(this.activeMode, 'You', text, 'user');
        this.scrollChatToBottom();

        // Check if string is a CLI Command
        if (text.startsWith('/')) {
            await this.parseCLICommand(text);
        } else {
            // Treat as conversational query
            setTimeout(async () => {
                await this.respondConversational(text);
            }, 800);
        }
    }

    // natural CLI command parsing
    async parseCLICommand(commandText) {
        const buyRegex = /^\/buy\s+([A-Za-z0-9\/]+)\s+entry\s+([0-9.]+)\s+sl\s+([0-9.]+)\s+tp\s+([0-9.]+)(?:\s+lot\s+([0-9.]+))?/i;
        const sellRegex = /^\/sell\s+([A-Za-z0-9\/]+)\s+entry\s+([0-9.]+)\s+sl\s+([0-9.]+)\s+tp\s+([0-9.]+)(?:\s+lot\s+([0-9.]+))?/i;
        const closeRegex = /^\/close\s+([A-Za-z0-9\/]+)\s+exit\s+([0-9.]+)/i;
        const supportRegex = /^\/support\s+(.*)/i;
        const metricsRegex = /^\/metrics/i;

        let buyMatch = commandText.match(buyRegex);
        let sellMatch = commandText.match(sellRegex);
        let closeMatch = commandText.match(closeRegex);
        let supportMatch = commandText.match(supportRegex);
        let metricsMatch = commandText.match(metricsRegex);

        if (buyMatch) {
            await this.handleCLIOpenTrade('LONG', buyMatch[1], buyMatch[2], buyMatch[3], buyMatch[4], buyMatch[5]);
        } else if (sellMatch) {
            await this.handleCLIOpenTrade('SHORT', sellMatch[1], sellMatch[2], sellMatch[3], sellMatch[4], sellMatch[5]);
        } else if (closeMatch) {
            await this.handleCLICloseTrade(closeMatch[1], closeMatch[2]);
        } else if (supportMatch) {
            this.handleCLISupportMessage(supportMatch[1]);
        } else if (metricsMatch) {
            await this.handleCLIMetricsQuery();
        } else {
            // Invalid CLI syntax
            const syntaxMsg = `❌ CLI Command Error. Correct Syntax Templates:\n\n` +
                              `• 📈 Buy: \`/buy EURUSD entry 1.0850 sl 1.0810 tp 1.0950 lot 0.2\`\n` +
                              `• 📉 Sell: \`/sell EURUSD entry 1.0850 sl 1.0890 tp 1.0750 lot 0.2\`\n` +
                              `• 🔒 Close: \`/close EURUSD exit 1.0910\`\n` +
                              `• 📡 Support: \`/support My dashboard stats are locked.\`\n` +
                              `• 📊 Stats: \`/metrics\``;
            
            this.addMessage(this.activeMode, 'CLI Parser', syntaxMsg, 'bot');
            this.playExitSound(false);
        }
    }

    async handleCLIOpenTrade(direction, symbol, entry, sl, tp, lotRaw) {
        symbol = symbol.toUpperCase().replace('/', '');
        const entryPrice = parseFloat(entry);
        const stopLoss = parseFloat(sl);
        const takeProfit = parseFloat(tp);
        const lot = parseFloat(lotRaw) || 0.10;

        // Perform validations
        if (isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit) || entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Invalid trade numbers. Entry, SL, and TP must be positive numbers.`, 'bot');
            this.playExitSound(false);
            return;
        }

        // Validate SL bounds
        if (direction === 'LONG' && stopLoss >= entryPrice) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Invalid Long parameters. Stop Loss must be less than Entry Price.`, 'bot');
            this.playExitSound(false);
            return;
        }
        if (direction === 'SHORT' && stopLoss <= entryPrice) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Invalid Short parameters. Stop Loss must be greater than Entry Price.`, 'bot');
            this.playExitSound(false);
            return;
        }

        // Save trade to window.db (exitPrice = 0 represents active trade)
        const tradeData = {
            symbol,
            direction,
            entryPrice,
            exitPrice: 0,
            quantity: lot,
            stopLoss,
            takeProfit,
            strategy: 'CLI Terminal entry',
            emotion: 'Disciplined',
            notes: `Logged via space-age active CLI Terminal. Direction: ${direction}, Lot size: ${lot}.`
        };

        const addedTrade = await window.db.addTrade(tradeData);

        if (addedTrade) {
            // Add to live tracked list
            const signalId = 'active_' + Math.random().toString(36).substr(2, 9);
            const newActive = {
                id: signalId,
                tradeId: addedTrade.id,
                symbol,
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
                lot,
                currentPips: 0,
                currentPnL: 0,
                isClosed: false
            };

            this.activeTrades.push(newActive);

            // Add Signal Card to chat thread
            this.addSignalCard(this.activeMode, newActive);

            // Play synth entry sound
            this.playEntrySound();

            const botReply = `🔒 **Trade logged successfully into local database!**\n` +
                             `• Direction: **${direction}**\n` +
                             `• Symbol: **${symbol}**\n` +
                             `• Starting entry telemetry registered at **${entryPrice.toFixed(5)}**\n` +
                             `• Real-time pips tracking engaged. Good luck, Pilot!`;
            this.addMessage(this.activeMode, 'AI Buddy', botReply, 'bot');

            // Force refresh dashboard views/charts
            this.triggerDashboardReload();
            
            // Sync live charting feeds instantly
            if (window.liveChartsEngine) {
                window.liveChartsEngine.changeTickerSymbol('dashboard', symbol);
                window.liveChartsEngine.changeTickerSymbol('forex', symbol);
            }
            
            // Community Room reacts
            if (this.activeMode === 'community') {
                setTimeout(() => {
                    const reactor = this.otherPilots[Math.floor(Math.random() * this.otherPilots.length)];
                    const comments = [
                        `Nice coordinates on ${symbol}! Followed.`,
                        `Risking ${lot} lots? Nice trade structure.`,
                        `Interesting entry on ${symbol}. Watching my metrics closely.`,
                        `Bullseye on ${symbol} entry, let's ride the trend!`
                    ];
                    this.addMessage('community', reactor, comments[Math.floor(Math.random() * comments.length)], 'community');
                    this.incrementUnread();
                }, 1800);
            }
        } else {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Failed to log trade in local database storage.`, 'bot');
            this.playExitSound(false);
        }
    }

    async handleCLICloseTrade(symbol, exitRaw) {
        symbol = symbol.toUpperCase().replace('/', '');
        const exitPrice = parseFloat(exitRaw);

        if (isNaN(exitPrice) || exitPrice <= 0) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Invalid exit price. Exit price must be a positive number.`, 'bot');
            this.playExitSound(false);
            return;
        }

        // Find active trade matching symbol
        const targetIdx = this.activeTrades.findIndex(t => t.symbol === symbol && !t.isClosed);

        if (targetIdx === -1) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ No active logged trades found for symbol: **${symbol}**.`, 'bot');
            this.playExitSound(false);
            return;
        }

        const activeTrade = this.activeTrades[targetIdx];
        
        // Update trade inside window.db
        const dbTrade = await window.db.getTradeById(activeTrade.tradeId);
        if (!dbTrade) {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Error synchronizing with database. Trade log missing.`, 'bot');
            return;
        }

        const updatedData = {
            exitPrice: exitPrice,
            notes: dbTrade.notes + ` Closed via CLI Terminal at ${exitPrice.toFixed(5)}.`
        };

        const finalizedTrade = await window.db.updateTrade(activeTrade.tradeId, updatedData);

        if (finalizedTrade) {
            const netPnL = finalizedTrade.netPnL;
            const isProfit = netPnL >= 0.01;

            // Remove from active tracking ticks and flag as closed
            activeTrade.isClosed = true;
            this.activeTrades.splice(targetIdx, 1);

            // Update signal card element in UI to show closed state
            this.updateSignalCardUIClosed(activeTrade.id, finalizedTrade.pips, netPnL);

            // Audio synth & visual flashes
            this.playExitSound(isProfit);
            this.triggerScreenFlash(isProfit);

            const coinSign = netPnL >= 0 ? '+' : '';
            const botReply = `🏁 **Position closed successfully!**\n` +
                             `• Asset: **${symbol}**\n` +
                             `• Final exit price: **${exitPrice.toFixed(5)}**\n` +
                             `• Telemetry result: **${finalizedTrade.pips > 0 ? '+' : ''}${finalizedTrade.pips.toFixed(1)} Pips**\n` +
                             `• Performance Profit: **${coinSign}${window.formatCurrency(netPnL)}**\n\n` +
                             `📈 Cockpit statistics and local 3D holographic telemetry charts updated instantly.`;
            
            this.addMessage(this.activeMode, 'AI Buddy', botReply, 'bot');

            // Force reload dashboard
            this.triggerDashboardReload();

            // Sync live charting feeds instantly
            if (window.liveChartsEngine) {
                window.liveChartsEngine.changeTickerSymbol('dashboard', symbol);
                window.liveChartsEngine.changeTickerSymbol('forex', symbol);
            }

            // Community chatter feedback
            if (this.activeMode === 'community') {
                setTimeout(() => {
                    const reactor = this.otherPilots[Math.floor(Math.random() * this.otherPilots.length)];
                    const comments = isProfit ? 
                        [`Spectacular trade on ${symbol}! Cash chime sounded.`, `Superb execution Commander! +${finalizedTrade.pips.toFixed(0)} pips in the bag!`, `Impressive win! High alpha!`] :
                        [`Ouch, stopped out on ${symbol}. Standard risk drawdown, onto the next signal.`, `Risk management saved you there. Keep your head high.`, `Drawdowns happen. Discipline is everything.`];
                    this.addMessage('community', reactor, comments[Math.floor(Math.random() * comments.length)], 'community');
                    this.incrementUnread();
                }, 1500);
            }

        } else {
            this.addMessage(this.activeMode, 'CLI Parser', `❌ Failed to finalize closed trade in database.`, 'bot');
            this.playExitSound(false);
        }
    }

    // Handles Support channel routing
    handleCLISupportMessage(query) {
        let response = '';
        const q = query.toLowerCase();

        if (q.includes('sync') || q.includes('dashboard') || q.includes('load')) {
            response = `📡 **Support Telemetry Sync Help:**\n\n` +
                       `If your dashboard is not updating, open the **Settings** view and check if your starting capital is initialized. ` +
                       `You can also export your ledger backup JSON file, click 'Clear Database', and reload the JSON. ` +
                       `All database operations are sandbox client-side. Zero server latency.`;
        } else if (q.includes('3d') || q.includes('hologram') || q.includes('autopilot')) {
            response = `🔮 **Holographic HUD Core Help:**\n\n` +
                       `To view 3D holographic metrics, click the cyan **3D HOLOGRAM** button in the header cockpit. ` +
                       `You can pan, orbit and zoom. Click **AUTOPILOT** to engage cinematic flight warp speed around your equity curve blocks!`;
        } else if (q.includes('import') || q.includes('csv') || q.includes('export')) {
            response = `📁 **Ledger Data Portability Help:**\n\n` +
                       `To backing up or restoring your ledger, go to the **Settings** section. ` +
                       `You can backup your trades as encrypted local JSON files or restore from backup anytime.`;
        } else {
            response = `📡 **Orbital Crew Coordinates synced:**\n\n` +
                       `Received support payload: *"${query}"*\n\n` +
                       `Officer response: "We are currently running diagnostics on your terminal sector. Ensure your browser database state is secure. All channels synced."`;
        }

        this.addMessage('support', 'Support Desk Officer', response, 'bot');
        this.playEntrySound();
    }

    // Handles conversational messages
    async respondConversational(text) {
        const textClean = text.toLowerCase();
        let response = '';

        if (this.activeMode === 'ai') {
            if (textClean.includes('hello') || textClean.includes('hi') || textClean.includes('hey')) {
                response = "Hey Commander! Ready to audit some trades? Log active setups using `/buy` or `/sell` commands. I will compute and parse parameters automatically!";
            } else if (textClean.includes('profit') || textClean.includes('balance') || textClean.includes('winrate')) {
                const metrics = await window.db.getMetrics();
                response = `📊 **Cockpit Ledger Overview:**\n\n` +
                           `• Net Balance: **${window.formatCurrency(metrics.currentBalance)}**\n` +
                           `• Net Performance PnL: **${metrics.totalNetPnL >= 0 ? '+' : ''}${window.formatCurrency(metrics.totalNetPnL)}**\n` +
                           `• Trade Win Rate: **${metrics.winRate}%** (${metrics.winningTrades} wins / ${metrics.totalTrades} total)\n` +
                           `• Profit Factor Index: **${metrics.profitFactor}**`;
            } else if (textClean.includes('clear')) {
                response = "To clear your database logs, please navigate to the **Settings** view and execute the critical red wipe command manually to ensure safety bounds.";
            } else {
                response = "I am trained to audit active CLI signals. To log a buy trade, type: `/buy EURUSD entry 1.0850 sl 1.0810 tp 1.0950`. To calculate your stats, write `/metrics`.";
            }
            this.addMessage('ai', 'AI Buddy', response, 'bot');

        } else if (this.activeMode === 'support') {
            this.handleCLISupportMessage(text);

        } else if (this.activeMode === 'community') {
            // Other traders reply to user's plain message
            const responder = this.otherPilots[Math.floor(Math.random() * this.otherPilots.length)];
            const banterReplies = [
                "That's high-fidelity trading logic, mate.",
                "Agreed! I am holding my long targets on GBPUSD.",
                "Is anyone trading gold (XAUUSD) breakout today? High spread.",
                "Discipline beats emotions every single session.",
                "Nice cockpit setup you got there."
            ];
            this.addMessage('community', responder, banterReplies[Math.floor(Math.random() * banterReplies.length)], 'community');
            this.incrementUnread();
        }
    }

    // Handles /metrics commands conversational details
    async handleCLIMetricsQuery() {
        const metrics = await window.db.getMetrics();
        const coinSign = metrics.totalNetPnL >= 0 ? '+' : '';
        const pfColor = metrics.profitFactor >= 2 ? '🟢 Optimal' : (metrics.profitFactor >= 1 ? '🟡 Average' : '🔴 Unprofitable');

        const metricsMsg = `📊 **Active Cockpit Telemetry Audit:**\n\n` +
                           `• Current Balance Capital: **${window.formatCurrency(metrics.currentBalance)}**\n` +
                           `• Net Ledger Performance: **${coinSign}${window.formatCurrency(metrics.totalNetPnL)}**\n` +
                           `• Accuracy Win Rate: **${metrics.winRate}%**\n` +
                           `• Win / Loss Ratio: **${metrics.avgWinLossRatio}**\n` +
                           `• Profit Factor index: **${metrics.profitFactor}** (${pfColor})\n` +
                           `• Winning Streak: **${metrics.maxWinStreak} trades** | Drawdown Streak: **${metrics.maxLossStreak} trades**`;

        this.addMessage(this.activeMode, 'AI Buddy', metricsMsg, 'bot');
        this.playEntrySound();
    }

    // Dynamic Live Ticking Price/Pip simulator feed
    startLivePipsFeed() {
        this.pipsInterval = setInterval(() => {
            if (this.activeTrades.length === 0) return;

            this.activeTrades.forEach(trade => {
                const specs = window.db.getForexSpecs(trade.symbol);
                const pipSize = specs ? specs.pipSize : 0.01;
                const pipValLot = specs ? specs.pipValuePerStandardLot : 10.00;

                // Simulate random minor fluctuation (random walk between -1.5 and +1.5 pips)
                const pipShift = (Math.random() * 3.0 - 1.5);
                trade.currentPips = parseFloat((trade.currentPips + pipShift).toFixed(1));

                // Calculate gross PnL fluctuation
                trade.currentPnL = parseFloat((trade.currentPips * trade.lot * pipValLot).toFixed(2));

                // Update Signal Card DOM elements instantly
                this.updateSignalCardUI(trade);
            });
        }, 1500);
    }

    // Simulate passive Community channel chatter from other commanders
    startCommunityChatter() {
        this.communityInterval = setInterval(() => {
            // Only trigger chatter occasionally (25% chance every 18 seconds)
            if (Math.random() > 0.25) return;

            const pilot = this.otherPilots[Math.floor(Math.random() * this.otherPilots.length)];
            
            // Randomly drop signals or general chat banter
            if (Math.random() > 0.5) {
                // Drop simulated signals
                const pair = this.communityPairs[Math.floor(Math.random() * this.communityPairs.length)];
                const dir = Math.random() > 0.5 ? 'BUY' : 'SELL';
                const p1 = 1.0 + Math.random() * 0.5;
                const lot = (Math.random() * 0.4 + 0.1).toFixed(2);
                
                const signalText = `🚨 **Simulated Signal Alert** 🚨\n` +
                                   `Commander ${pilot} initialized a new trade:\n` +
                                   `• Action: **${dir} ${pair}**\n` +
                                   `• Entry level coordinates: **${p1.toFixed(4)}**\n` +
                                   `• Lot size: **${lot}**\n` +
                                   `*"Risk parameters managed, let's watch this flight sector!"*`;

                this.addMessage('community', pilot, signalText, 'community');
                this.playEntrySound();
            } else {
                // General banter
                const chatters = [
                    "Just cleared a beautiful +40 pips gain on EURUSD breakout! Profit factor indexing up.",
                    "Psychology note of the day: Stop revenge trading. Closed my screen early today.",
                    "Is anyone else holding GBPUSD long? Telemetry looks stable.",
                    "Remember to check your Max Risk limits in the settings! Capital preservation is key.",
                    "Fascinating 3D visual curve in my cockpit window today. Upwards trend engaged."
                ];
                this.addMessage('community', pilot, chatters[Math.floor(Math.random() * chatters.length)], 'community');
            }

            this.incrementUnread();
        }, 18000);
    }

    incrementUnread() {
        if (!this.panel.classList.contains('active')) {
            this.unreadCount++;
            this.updateBadge();
        }
    }

    updateBadge() {
        if (this.badge) {
            if (this.unreadCount > 0) {
                this.badge.textContent = this.unreadCount;
                this.badge.style.display = 'inline-block';
            } else {
                this.badge.style.display = 'none';
            }
        }
    }

    // Helper functions to append message elements to chat list
    addMessage(mode, sender, text, type) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMsg = {
            id: Date.now(),
            sender,
            text,
            timestamp,
            type
        };

        this.messages[mode].push(newMsg);

        // If active, render immediately
        if (this.activeMode === mode) {
            this.renderMessageElement(newMsg);
            this.scrollChatToBottom();
        }
    }

    // Helper to inject glowing neon Signal Cards
    addSignalCard(mode, activeTrade) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newMsg = {
            id: Date.now(),
            sender: activeTrade.direction === 'LONG' ? 'BUY ORDER TERMINAL' : 'SELL ORDER TERMINAL',
            text: '',
            timestamp,
            type: 'bot',
            signalCard: activeTrade
        };

        this.messages[mode].push(newMsg);

        if (this.activeMode === mode) {
            this.renderMessageElement(newMsg);
            this.scrollChatToBottom();
        }
    }

    renderMessages() {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';
        this.messages[this.activeMode].forEach(msg => {
            this.renderMessageElement(msg);
        });
        this.scrollChatToBottom();
    }

    renderMessageElement(msg) {
        if (!this.messagesContainer) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `terminal-msg msg-${msg.type}`;
        msgDiv.setAttribute('data-id', msg.id);

        if (msg.signalCard) {
            // Render glowing neon signal card
            const trade = msg.signalCard;
            const signText = trade.direction === 'LONG' ? 'LONG / BUY' : 'SHORT / SELL';
            const slText = trade.stopLoss > 0 ? trade.stopLoss.toFixed(4) : 'None';
            const tpText = trade.takeProfit > 0 ? trade.takeProfit.toFixed(4) : 'None';

            msgDiv.className = `signal-card direction-${trade.direction.toLowerCase()}`;
            msgDiv.id = `card-${trade.id}`;
            msgDiv.innerHTML = `
                <div class="signal-card-header">
                    <span class="signal-type-badge">${signText}</span>
                    <span class="signal-symbol">${trade.symbol}</span>
                </div>
                <div class="signal-card-body">
                    <div class="signal-metric">
                        <span class="signal-metric-lbl">Entry</span>
                        <span class="signal-metric-val">${trade.entryPrice.toFixed(4)}</span>
                    </div>
                    <div class="signal-metric">
                        <span class="signal-metric-lbl">Stop Loss</span>
                        <span class="signal-metric-val">${slText}</span>
                    </div>
                    <div class="signal-metric">
                        <span class="signal-metric-lbl">Target TP</span>
                        <span class="signal-metric-val">${tpText}</span>
                    </div>
                </div>
                <div class="signal-pips-tracker">
                    <div class="signal-pips-live">
                        <span class="live-indicator"></span>
                        <span class="pips-ticker-val" id="pips-${trade.id}">+0.0 Pips</span>
                    </div>
                    <div class="signal-pnl-live pnl-neutral" id="pnl-${trade.id}">$0.00</div>
                </div>
            `;
        } else {
            // Render normal text message bubble
            msgDiv.innerHTML = `
                <span class="msg-sender">${msg.sender}</span>
                <div class="msg-text-content">${this.formatMessageText(msg.text)}</div>
                <span class="msg-timestamp">${msg.timestamp}</span>
            `;
        }

        this.messagesContainer.appendChild(msgDiv);
    }

    // Live update pips elements inside DOM
    updateSignalCardUI(trade) {
        const pipsEl = document.getElementById(`pips-${trade.id}`);
        const pnlEl = document.getElementById(`pnl-${trade.id}`);

        if (pipsEl && pnlEl) {
            const pipSign = trade.currentPips >= 0 ? '+' : '';
            pipsEl.textContent = `${pipSign}${trade.currentPips.toFixed(1)} Pips`;
            pipsEl.style.color = trade.currentPips >= 0 ? 'var(--primary)' : 'var(--pink)';

            const coinSign = trade.currentPnL >= 0 ? '+' : '';
            pnlEl.textContent = `${coinSign}${window.formatCurrency(trade.currentPnL)}`;
            pnlEl.className = trade.currentPnL >= 0.01 ? 'signal-pnl-live pnl-green' : (trade.currentPnL < -0.01 ? 'signal-pnl-live pnl-red' : 'signal-pnl-live pnl-neutral');
        }
    }

    // Finalize closed elements inside card UI
    updateSignalCardUIClosed(tradeSignalId, finalPips, finalPnL) {
        const cardEl = document.getElementById(`card-${tradeSignalId}`);
        if (!cardEl) return;

        cardEl.classList.add('closed-status');
        
        const pipsEl = cardEl.querySelector('.pips-ticker-val');
        const pnlEl = cardEl.querySelector('.signal-pnl-live');
        const badgeEl = cardEl.querySelector('.signal-type-badge');

        if (badgeEl) badgeEl.textContent = 'CLOSED';

        if (pipsEl && pnlEl) {
            const pipSign = finalPips >= 0 ? '+' : '';
            pipsEl.textContent = `${pipSign}${finalPips.toFixed(1)} Pips (Closed)`;
            pipsEl.style.color = 'var(--text-secondary)';

            const coinSign = finalPnL >= 0 ? '+' : '';
            pnlEl.textContent = `${coinSign}${window.formatCurrency(finalPnL)}`;
            pnlEl.className = finalPnL >= 0.01 ? 'signal-pnl-live pnl-green' : (finalPnL < -0.01 ? 'signal-pnl-live pnl-red' : 'signal-pnl-live pnl-neutral');
        }
    }

    formatMessageText(text) {
        // Simple markdown parser for chat text
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:4px;font-family:monospace;">$1</code>');
    }

    scrollChatToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    triggerDashboardReload() {
        // Forces current active views to sync immediately
        if (window.switchView && window.activeView) {
            window.switchView(window.activeView);
        }
    }
}

// Attach globally
window.SignalTerminal = SignalTerminal;
window.signalTerminal = new SignalTerminal();
