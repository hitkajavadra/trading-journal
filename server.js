const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const yahooFinanceLib = require('yahoo-finance2').default;
const yahooFinance = new yahooFinanceLib({ suppressNotices: ['yahooSurvey'] });

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large screenshots

// Serve static frontend files for hosting
app.use(express.static(__dirname));

// Ensure data folder and database.json exist
function initDb() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({
            accounts: [
                { username: 'Trader', password: 'trader123', initialCapital: 10000, currency: 'USD' }
            ],
            settings: {
                'Trader': { username: 'Trader', initialCapital: 10000, currency: 'USD', maxRiskPerTrade: 2, theme: 'dark' }
            },
            trades: {
                'Trader': []
            }
        }, null, 2));
    }
}

// Read DB from disk
function readDb() {
    initDb();
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to read database, resetting to default.", e);
        return { accounts: [], settings: {}, trades: {} };
    }
}

// Write DB to disk atomically
function writeDb(data) {
    initDb();
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
}

// REST API Endpoints

// 1. Server Status check
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', database: 'Local File Vault' });
});

// 2. Authentication: Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required.' });
    }
    
    const db = readDb();
    const eTrim = email.trim().toLowerCase();
    const account = db.accounts.find(a => a.email && a.email.toLowerCase() === eTrim && a.password === password);
    
    if (account) {
        res.json({ success: true, username: account.username });
    } else {
        res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
});

// 3. Authentication: Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, initialCapital, currency } = req.body;
    const uTrim = (username || '').trim();
    const eTrim = (email || '').trim().toLowerCase();
    
    if (!uTrim || !eTrim || !password) {
        return res.status(400).json({ success: false, message: 'Trader name, email, and password are required.' });
    }
    if (uTrim.length < 3) {
        return res.status(400).json({ success: false, message: 'Trader Name must be at least 3 characters long.' });
    }
    
    const db = readDb();
    if (db.accounts.some(a => a.username.toLowerCase() === uTrim.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Trader Name "${uTrim}" is already registered.` });
    }
    if (db.accounts.some(a => a.email && a.email.toLowerCase() === eTrim)) {
        return res.status(400).json({ success: false, message: `Email "${eTrim}" is already registered.` });
    }
    
    // Create new account
    const newAcc = {
        username: uTrim,
        email: eTrim,
        password: password,
        initialCapital: parseFloat(initialCapital) || 0,
        currency: currency || 'USD'
    };
    db.accounts.push(newAcc);
    
    // Set default settings & empty trades list
    db.settings[uTrim] = {
        username: uTrim,
        initialCapital: parseFloat(initialCapital) || 0,
        currency: currency || 'USD',
        maxRiskPerTrade: 2.0,
        theme: 'dark'
    };
    db.trades[uTrim] = [];
    
    writeDb(db);
    res.json({ success: true, username: uTrim });
});

// Account Deletion
app.delete('/api/auth/account', (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    const db = readDb();
    
    // Remove from accounts
    db.accounts = db.accounts.filter(a => a.username !== username);
    
    // Remove settings and trades
    delete db.settings[username];
    delete db.trades[username];
    
    writeDb(db);
    res.json({ success: true, message: 'Account permanently deleted.' });
});

// 4. Settings: Get
app.get('/api/settings', (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    const settings = db.settings[username] || {
        username,
        initialCapital: 10000,
        currency: 'USD',
        maxRiskPerTrade: 2,
        theme: 'dark'
    };
    res.json(settings);
});

// 5. Settings: Save
app.post('/api/settings', (req, res) => {
    const username = req.headers['x-user'];
    const settingsData = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    db.settings[username] = { ...db.settings[username], ...settingsData };
    writeDb(db);
    res.json(db.settings[username]);
});

// 6. Trades: Get All
app.get('/api/trades', (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    const userTrades = db.trades[username] || [];
    res.json(userTrades);
});

// 7. Trades: Add new
app.post('/api/trades', (req, res) => {
    const username = req.headers['x-user'];
    const tradeData = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    if (!db.trades[username]) {
        db.trades[username] = [];
    }
    
    const newTrade = {
        ...tradeData,
        id: 'trade_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    };
    
    db.trades[username].push(newTrade);
    writeDb(db);
    res.json(newTrade);
});

// 8. Trades: Update existing
app.put('/api/trades/:id', (req, res) => {
    const username = req.headers['x-user'];
    const tradeId = req.params.id;
    const updatedData = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    const trades = db.trades[username] || [];
    const index = trades.findIndex(t => t.id === tradeId);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Trade not found.' });
    }
    
    trades[index] = { ...trades[index], ...updatedData, id: tradeId };
    db.trades[username] = trades;
    writeDb(db);
    res.json(trades[index]);
});

// 9. Trades: Delete
app.delete('/api/trades/:id', (req, res) => {
    const username = req.headers['x-user'];
    const tradeId = req.params.id;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    const trades = db.trades[username] || [];
    const initialLength = trades.length;
    const filteredTrades = trades.filter(t => t.id !== tradeId);
    
    if (filteredTrades.length === initialLength) {
        return res.status(404).json({ error: 'Trade not found.' });
    }
    
    db.trades[username] = filteredTrades;
    writeDb(db);
    res.json({ success: true, message: 'Trade deleted.' });
});

// 10. Leaderboard: Get Top Traders
app.get('/api/leaderboard', (req, res) => {
    const db = readDb();
    const leaderboard = [];

    // Loop through all accounts
    db.accounts.forEach(acc => {
        const username = acc.username;
        const trades = db.trades[username] || [];
        
        let totalPips = 0;
        let totalProfit = 0;
        let wins = 0;
        
        trades.forEach(t => {
            totalPips += (t.pips || 0);
            totalProfit += (t.netPnL || 0);
            if (t.netPnL > 0) wins++;
        });
        
        const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
        
        leaderboard.push({
            username: username,
            totalPips: totalPips,
            totalProfit: totalProfit,
            winRate: winRate,
            totalTrades: trades.length
        });
    });

    // Sort by Total Profit descending
    leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
    
    // Assign ranks
    leaderboard.forEach((trader, index) => {
        trader.rank = index + 1;
    });

    res.json(leaderboard);
});

// 11. Sync: Remote upload of all offline trades/settings
app.post('/api/sync', (req, res) => {
    const username = req.headers['x-user'];
    const { trades, settings } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    const db = readDb();
    if (trades) db.trades[username] = trades;
    if (settings) db.settings[username] = { ...db.settings[username], ...settings };
    writeDb(db);
    res.json({ success: true });
});

// 11. Forex: Live Currency Strength
app.get('/api/forex/strength', async (req, res) => {
    try {
        const { timeframe = '1D' } = req.query;
        
        // Map UI timeframe to Yahoo Finance interval and lookback ms
        const tfMap = {
            '1M': { interval: '1m', ms: 60 * 1000 * 5 }, // fetch last 5 mins of 1m to ensure we get a candle
            '5M': { interval: '1m', ms: 5 * 60 * 1000 * 2 },
            '15M': { interval: '5m', ms: 15 * 60 * 1000 * 2 },
            '1H': { interval: '15m', ms: 60 * 60 * 1000 * 2 },
            '4H': { interval: '60m', ms: 4 * 60 * 60 * 1000 * 2 },
            '1D': { interval: '1d', ms: 24 * 60 * 60 * 1000 * 2 }
        };
        
        const tf = tfMap[timeframe] || tfMap['1D'];
        // Using period1 to fetch recent data
        const period1 = new Date(Date.now() - tf.ms);
        
        const symbols = ['EURUSD=X', 'GBPUSD=X', 'JPY=X', 'AUDUSD=X', 'CAD=X', 'CHF=X', 'NZDUSD=X'];
        
        let strengths = { USD: 5.0 };
        
        // Fetch all charts in parallel
        await Promise.all(symbols.map(async sym => {
            try {
                const result = await yahooFinance.chart(sym, { period1: period1, interval: tf.interval });
                let pct = 0;
                
                if (result && result.quotes && result.quotes.length > 0) {
                    const quotes = result.quotes.filter(q => q.open && q.close);
                    if (quotes.length > 0) {
                        const first = quotes[0];
                        const last = quotes[quotes.length - 1];
                        pct = ((last.close - first.open) / first.open) * 100;
                    }
                }
                
                // For shorter timeframes, percentage change is much smaller. Scale it up so UI still moves visually
                let multiplier = 3.0;
                if (timeframe === '1M') multiplier = 100.0;
                else if (timeframe === '5M') multiplier = 50.0;
                else if (timeframe === '15M') multiplier = 25.0;
                else if (timeframe === '1H') multiplier = 10.0;
                else if (timeframe === '4H') multiplier = 5.0;
                
                let strength = 5.0 + (pct * multiplier);
                
                if (sym === 'EURUSD=X') strengths.EUR = strength;
                if (sym === 'GBPUSD=X') strengths.GBP = strength;
                if (sym === 'AUDUSD=X') strengths.AUD = strength;
                if (sym === 'NZDUSD=X') strengths.NZD = strength;
                
                // Inverse quote currencies against USD
                if (sym === 'JPY=X') strengths.JPY = 5.0 - (pct * multiplier);
                if (sym === 'CAD=X') strengths.CAD = 5.0 - (pct * multiplier);
                if (sym === 'CHF=X') strengths.CHF = 5.0 - (pct * multiplier);
            } catch(e) {
                console.error("Error fetching chart for", sym, e.message);
            }
        }));
        
        // Normalize values to 0-10 bounds strictly
        for (let key in strengths) {
            strengths[key] = Math.max(0, Math.min(10, strengths[key] || 5.0)).toFixed(1);
        }
        
        res.json(strengths);
    } catch (e) {
        console.error("Forex API Error:", e);
        res.status(500).json({ error: "Failed to fetch real market data" });
    }
});

// Init DB & Start Server
initDb();
app.listen(PORT, () => {
    console.log(`Ascend Core Database Server running at http://localhost:${PORT}`);
});
