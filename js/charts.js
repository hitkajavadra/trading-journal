/**
 * Trading Journal Charting Engine
 * Interfaces with Chart.js to render highly premium, interactive dashboard graphics.
 */

class TradingJournalCharts {
    constructor() {
        this.equityChartInstance = null;
        this.strategyChartInstance = null;
        this.mistakeChartInstance = null;
    }

    /**
     * Helper to read current design system colors from CSS Variables.
     */
    getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        return {
            primary: isDark ? '#10b981' : '#059669',
            secondary: isDark ? '#fbbf24' : '#d97706',
            success: '#10b981',
            danger: '#f43f5e',
            gridLine: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)',
            text: isDark ? '#94a3b8' : '#475569',
            tooltipBg: isDark ? '#0f172a' : '#ffffff',
            tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
            tooltipText: isDark ? '#f8fafc' : '#0f172a'
        };
    }

    /**
     * Render the Equity Curve Line Chart.
     */
    renderEquityCurve(equityData, currencySymbol = '$') {
        const ctx = document.getElementById('equityCurveChart');
        if (!ctx) return;

        // Destroy previous instance if it exists to prevent overlapping tooltips
        if (this.equityChartInstance) {
            this.equityChartInstance.destroy();
        }

        const colors = this.getThemeColors();

        const labels = equityData.map(d => d.date);
        const balances = equityData.map(d => d.balance);

        // Create background gradient for the curve
        const canvasCtx = ctx.getContext('2d');
        const gradient = canvasCtx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
        gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.08)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        this.equityChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Account Balance',
                    data: balances,
                    borderColor: colors.primary,
                    borderWidth: 3,
                    pointBackgroundColor: colors.primary,
                    pointBorderColor: colors.tooltipBg,
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true,
                    backgroundColor: gradient
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        displayColors: false,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += currencySymbol + context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 });
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: colors.gridLine,
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        grid: {
                            color: colors.gridLine,
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            callback: function(value) {
                                return currencySymbol + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render the Strategy Performance Horizontal Bar Chart.
     */
    renderStrategyAnalytics(strategyData, currencySymbol = '$') {
        const ctx = document.getElementById('strategyAnalyticsChart');
        if (!ctx) return;

        if (this.strategyChartInstance) {
            this.strategyChartInstance.destroy();
        }

        const colors = this.getThemeColors();

        // Sort strategies by Net PnL descending
        const sortedData = [...strategyData].sort((a, b) => b.netPnL - a.netPnL);
        const labels = sortedData.map(s => s.name);
        const netPnLs = sortedData.map(s => s.netPnL);

        // Dynamically color bar green/red depending on profits/losses
        const backgroundColors = netPnLs.map(val => val >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)');
        const borderColors = netPnLs.map(val => val >= 0 ? colors.success : colors.danger);

        this.strategyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Net Returns',
                    data: netPnLs,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Makes it horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        displayColors: false,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.x;
                                const prefix = val >= 0 ? '+' : '';
                                return 'Net PnL: ' + prefix + currencySymbol + val.toLocaleString(undefined, { minimumFractionDigits: 2 });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: colors.gridLine,
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            callback: function(value) {
                                const sign = value >= 0 ? '' : '-';
                                return sign + currencySymbol + Math.abs(value).toLocaleString();
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false,
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: 500
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render the Psychological Mistake Breakdown Doughnut Chart.
     */
    renderMistakeAnalytics(mistakeData, currencySymbol = '$') {
        const ctx = document.getElementById('mistakeAnalyticsChart');
        if (!ctx) return;

        if (this.mistakeChartInstance) {
            this.mistakeChartInstance.destroy();
        }

        const colors = this.getThemeColors();

        // Standardize positive values of mistake-induced drawdowns for rendering on the circular chart
        const labels = mistakeData.map(m => m.name);
        const absLosses = mistakeData.map(m => Math.abs(m.totalLoss)); // Absolute value of negative impact

        const palette = [
            '#f43f5e', // Rose
            '#f59e0b', // Amber
            '#8b5cf6', // Violet
            '#06b6d4', // Cyan
            '#ec4899', // Pink
            '#ef4444', // Red
            '#3b82f6'  // Blue
        ];

        this.mistakeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: absLosses,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: colors.tooltipBg
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: colors.text,
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            padding: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed;
                                return ' Capital Drain: -' + currencySymbol + val.toLocaleString(undefined, { minimumFractionDigits: 2 });
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Draw a gorgeous, high-fidelity real-time trade level and execution chart.
     * Plots simulated candlesticks, Entry, Exit, SL, TP, risk/reward shaded bands, and a premium HUD stats panel.
     */
    drawTradeVisualChart(canvas, trade, isLiveSimulator = false) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Get container dimensions and scale for high DPI (Retina)
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 400;
        const height = rect.height || 220;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const colors = this.getThemeColors();
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // Extract and sanitize trade variables
        const symbol = (trade.symbol || 'SIM').toUpperCase();
        const direction = trade.direction || 'LONG';
        const entry = parseFloat(trade.entryPrice) || 0;
        const exit = parseFloat(trade.exitPrice) || 0;
        const sl = parseFloat(trade.stopLoss) || 0;
        const tp = parseFloat(trade.takeProfit) || 0;
        const quantity = parseFloat(trade.quantity) || 0;
        const fees = parseFloat(trade.fees) || 0;

        // Clear background with rich space-age glassmorphism look
        ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        if (entry <= 0) {
            // Draw empty state message
            ctx.fillStyle = colors.text;
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for Entry Price to plot levels...', width / 2, height / 2);
            return;
        }

        // Determine price limits for chart scaling
        let activeExit = exit > 0 ? exit : entry;
        const levels = [entry, activeExit];
        if (sl > 0) levels.push(sl);
        if (tp > 0) levels.push(tp);

        let pMax = Math.max(...levels);
        let pMin = Math.min(...levels);

        // Add padding to range
        let pDiff = pMax - pMin;
        if (pDiff === 0) {
            pMax = entry * 1.05;
            pMin = entry * 0.95;
            pDiff = pMax - pMin;
        } else {
            pMax += pDiff * 0.15;
            pMin -= pDiff * 0.15;
            pDiff = pMax - pMin;
        }

        // Mapping function from price to Y-coordinate
        const chartTop = 25;
        const chartBottom = height - 25;
        const chartHeight = chartBottom - chartTop;
        const getY = (val) => {
            if (pDiff === 0) return height / 2;
            const pct = (val - pMin) / pDiff;
            return chartBottom - (pct * chartHeight);
        };

        // Mapping function for X-coordinate (16 candles across width)
        const candleCount = 16;
        const chartLeft = 50;
        const chartRight = width - 85;
        const chartWidth = chartRight - chartLeft;
        const getX = (index) => {
            return chartLeft + (index * (chartWidth / (candleCount - 1)));
        };

        // 2. Draw vertical and horizontal grid lines
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(15, 23, 42, 0.035)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        // Draw horizontal grid lines
        const gridLines = 5;
        for (let i = 0; i < gridLines; i++) {
            const yVal = pMin + (i * (pDiff / (gridLines - 1)));
            const y = getY(yVal);
            ctx.beginPath();
            ctx.moveTo(chartLeft - 10, y);
            ctx.lineTo(chartRight + 10, y);
            ctx.stroke();
        }

        // Draw vertical grid lines
        for (let i = 0; i < candleCount; i += 3) {
            const x = getX(i);
            ctx.beginPath();
            ctx.moveTo(x, chartTop - 5);
            ctx.lineTo(x, chartBottom + 5);
            ctx.stroke();
        }
        ctx.setLineDash([]); // Reset line dash

        // 3. Shade Risk and Reward regions
        const entryY = getY(entry);
        
        // Reward Zone (Green)
        if (tp > 0) {
            const tpY = getY(tp);
            const rY = Math.min(entryY, tpY);
            const rH = Math.abs(entryY - tpY);
            const grad = ctx.createLinearGradient(0, rY, 0, rY + rH);
            if (direction === 'LONG' && tp > entry || direction === 'SHORT' && tp < entry) {
                // Winning setup
                grad.addColorStop(0, 'rgba(16, 185, 129, 0.06)');
                grad.addColorStop(1, 'rgba(16, 185, 129, 0.005)');
                ctx.fillStyle = grad;
                ctx.fillRect(chartLeft, rY, chartWidth, rH);
            }
        }

        // Risk Zone (Pink)
        if (sl > 0) {
            const slY = getY(sl);
            const rY = Math.min(entryY, slY);
            const rH = Math.abs(entryY - slY);
            const grad = ctx.createLinearGradient(0, rY, 0, rY + rH);
            if (direction === 'LONG' && sl < entry || direction === 'SHORT' && sl > entry) {
                grad.addColorStop(0, 'rgba(244, 63, 94, 0.06)');
                grad.addColorStop(1, 'rgba(244, 63, 94, 0.005)');
                ctx.fillStyle = grad;
                ctx.fillRect(chartLeft, rY, chartWidth, rH);
            }
        }

        // 4. Generate & Draw simulated candles (Seeded deterministic random)
        const seedStr = trade.id || (symbol + '_' + entry + '_' + direction);
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const seededRandom = () => {
            const x = Math.sin(hash++) * 10000;
            return x - Math.floor(x);
        };

        const entryIdx = 4;
        const exitIdx = 12;

        const candles = [];
        for (let i = 0; i < candleCount; i++) {
            let basePrice = entry;
            if (i < entryIdx) {
                // Fluctuate before entry
                basePrice = entry + (seededRandom() - 0.5) * (pDiff * 0.05);
            } else if (i >= entryIdx && i <= exitIdx) {
                // Trend from entry to exit
                const progress = (i - entryIdx) / (exitIdx - entryIdx);
                basePrice = entry + (activeExit - entry) * progress + (seededRandom() - 0.5) * (pDiff * 0.02);
            } else {
                // Fluctuate after exit
                basePrice = activeExit + (seededRandom() - 0.5) * (pDiff * 0.05);
            }

            const scaleRange = pDiff * 0.04;
            const open = basePrice + (seededRandom() - 0.5) * scaleRange;
            const close = basePrice + (seededRandom() - 0.5) * scaleRange;
            const high = Math.max(open, close) + seededRandom() * scaleRange * 0.8;
            const low = Math.min(open, close) - seededRandom() * scaleRange * 0.8;

            candles.push({ open, close, high, low });
        }

        // Adjust specific candles at Entry and Exit to align exactly with level coordinates
        candles[entryIdx].open = entry * 1.0005;
        candles[entryIdx].close = entry;
        candles[exitIdx].open = activeExit;
        candles[exitIdx].close = activeExit * 0.9995;

        // Draw Candlesticks
        const candleWidth = Math.max(2, (chartWidth / candleCount) * 0.45);
        for (let i = 0; i < candleCount; i++) {
            const c = candles[i];
            const x = getX(i);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);
            const yHigh = getY(c.high);
            const yLow = getY(c.low);

            const isBullish = c.close >= c.open;
            const color = isBullish ? '#10b981' : '#f43f5e';
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            
            // Draw wick
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            // Draw body
            ctx.fillStyle = color;
            const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
            ctx.fillRect(x - candleWidth / 2, Math.min(yOpen, yClose), candleWidth, bodyHeight);
        }

        // 5. Draw dashed glowing transaction connector path
        ctx.strokeStyle = direction === 'LONG' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(getX(entryIdx), getY(entry));
        ctx.lineTo(getX(exitIdx), getY(activeExit));
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // 6. Plot Level Lines
        const drawLevelLine = (price, strokeColor, isDashed = false) => {
            const y = getY(price);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            if (isDashed) {
                ctx.setLineDash([4, 3]);
            }
            ctx.beginPath();
            ctx.moveTo(chartLeft - 10, y);
            ctx.lineTo(chartRight + 10, y);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        // Draw Stop Loss Line
        if (sl > 0) {
            drawLevelLine(sl, '#f43f5e', false);
        }

        // Draw Take Profit Line
        if (tp > 0) {
            drawLevelLine(tp, '#10b981', false);
        }

        // Draw Entry Line
        drawLevelLine(entry, '#06b6d4', true);

        // Draw Exit Line (if exit is set) or Live Indicator
        if (exit > 0) {
            drawLevelLine(exit, '#fbbf24', true);
        }

        // 7. Render price level tags on the right side
        const drawLevelTag = (price, label, bgColor, textColor = 'white') => {
            const y = getY(price);
            ctx.fillStyle = bgColor;
            
            // Draw pill container
            const pW = 75;
            const pH = 16;
            const px = chartRight + 12;
            const py = y - pH / 2;
            
            // Draw tiny arrow pointing left to the level line
            ctx.beginPath();
            ctx.moveTo(px, y);
            ctx.lineTo(px + 4, y - 4);
            ctx.lineTo(px + 4, y + 4);
            ctx.closePath();
            ctx.fill();
            
            // Draw rounded pill rect
            ctx.beginPath();
            ctx.roundRect(px + 4, py, pW, pH, 3);
            ctx.fill();
            
            // Draw text
            ctx.fillStyle = textColor;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            
            // Truncate price decimal cleanly
            let cleanVal = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });
            ctx.fillText(`${label}:${cleanVal}`, px + 8, y + 3);
        };

        if (sl > 0) drawLevelTag(sl, 'SL', 'rgba(244, 63, 94, 0.85)');
        if (tp > 0) drawLevelTag(tp, 'TP', 'rgba(16, 185, 129, 0.85)');
        drawLevelTag(entry, 'ENT', 'rgba(6, 182, 212, 0.85)');
        if (exit > 0) {
            drawLevelTag(exit, 'EXT', 'rgba(251, 191, 36, 0.85)', '#0f172a');
        }

        // 8. Draw Execution arrow annotations at candle points
        const drawMarker = (cIdx, price, text, isUp, markerColor) => {
            const x = getX(cIdx);
            const y = getY(price);
            const offset = isUp ? -18 : 18;
            
            // Glowing connector line
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + offset);
            ctx.stroke();

            // Label Bubble
            ctx.fillStyle = markerColor;
            const txtWidth = ctx.measureText(text).width + 8;
            const bW = Math.max(35, txtWidth);
            const bH = 14;
            const bx = x - bW / 2;
            const by = y + offset - (isUp ? bH : 0);

            ctx.beginPath();
            ctx.roundRect(bx, by, bW, bH, 3);
            ctx.fill();

            // Text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 8px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(text, x, by + 9.5);
        };

        const entLabel = direction === 'LONG' ? '▲ BUY' : '▼ SELL';
        const entColor = direction === 'LONG' ? '#10b981' : '#f43f5e';
        drawMarker(entryIdx, entry, entLabel, direction === 'LONG', entColor);

        if (exit > 0) {
            const extLabel = direction === 'LONG' ? '▼ EXIT' : '▲ EXIT';
            const extColor = direction === 'LONG' ? '#f43f5e' : '#10b981';
            drawMarker(exitIdx, exit, extLabel, direction === 'SHORT', extColor);
        }

        // 9. Draw Space-Age Floating HUD Glass Box
        const hudX = 14;
        const hudY = 14;
        const hudW = 125;
        const hudH = 75;

        // Box glow
        ctx.shadowColor = direction === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
        ctx.shadowBlur = 10;

        // Glass background
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudW, hudH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow

        // Symbol header
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(symbol, hudX + 10, hudY + 16);

        // Direction badge
        const dirText = direction === 'LONG' ? 'BUY / LONG' : 'SELL / SHORT';
        const dirColor = direction === 'LONG' ? '#10b981' : '#f43f5e';
        ctx.fillStyle = dirColor;
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.fillText(dirText, hudX + 10, hudY + 28);

        // PnL & Pips calculation (Read or simulate)
        let calcPnL = 0;
        let calcPips = 0;
        const specs = window.db.getForexSpecs(symbol);

        if (entry > 0 && activeExit > 0) {
            if (specs) {
                const diff = direction === 'LONG' ? (activeExit - entry) : (entry - activeExit);
                calcPips = diff / specs.pipSize;
                calcPnL = calcPips * (quantity || 1) * specs.pipValuePerStandardLot - fees;
            } else {
                if (direction === 'LONG') {
                    calcPnL = (activeExit - entry) * (quantity || 1) - fees;
                } else {
                    calcPnL = (entry - activeExit) * (quantity || 1) - fees;
                }
            }
        }

        // Display Net Return
        const pnlPrefix = calcPnL > 0.01 ? '+' : '';
        const pnlColor = calcPnL > 0.01 ? '#10b981' : (calcPnL < -0.01 ? '#f43f5e' : '#94a3b8');
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText('Net Return:', hudX + 10, hudY + 44);

        ctx.fillStyle = pnlColor;
        ctx.font = 'bold 10px monospace';
        const formattedPnL = (calcPnL < 0 ? '-' : '') + '$' + Math.abs(calcPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        ctx.fillText(`${pnlPrefix}${formattedPnL}`, hudX + 10, hudY + 54);

        // Display Pips
        if (specs) {
            ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
            ctx.font = '8px monospace';
            const pipPrefix = calcPips > 0.01 ? '+' : '';
            ctx.fillText(`${pipPrefix}${calcPips.toFixed(1)} Pips`, hudX + 10, hudY + 66);
        } else {
            // Risk/Reward ratio in HUD
            let rr = 0;
            if (sl > 0 && entry > 0) {
                const risk = direction === 'LONG' ? (entry - sl) : (sl - entry);
                const reward = tp > 0 ? (direction === 'LONG' ? (tp - entry) : (entry - tp)) : 0;
                if (risk > 0 && reward > 0) rr = (reward / risk).toFixed(2);
            }
            ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
            ctx.font = '8px Inter, sans-serif';
            ctx.fillText(rr > 0 ? `R:R Ratio: 1:${rr}` : 'R:R Ratio: N/A', hudX + 10, hudY + 66);
        }

        // Live Simulated watermark tag
        if (isLiveSimulator) {
            ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.beginPath();
            ctx.roundRect(width - 80, 10, 70, 12, 3);
            ctx.fill();
            
            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 7px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SIMULATION', width - 45, 18);
        }
    }
}

// Attach to window for global access
window.charts = new TradingJournalCharts();
