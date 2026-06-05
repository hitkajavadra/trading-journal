const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const yahooFinanceLib = require('yahoo-finance2').default;
const yahooFinance = new yahooFinanceLib({ suppressNotices: ['yahooSurvey'] });

const app = express();
const PORT = process.env.PORT || 3000;
const SQLITE_DB_PATH = path.join(__dirname, 'data', 'database.sqlite');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large screenshots

// Serve static frontend files for hosting
app.use(express.static(__dirname));

let dbPromise;
function getDb() {
    if (!dbPromise) {
        // Ensure data folder exists
        const dir = path.dirname(SQLITE_DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        dbPromise = open({
            filename: SQLITE_DB_PATH,
            driver: sqlite3.Database
        }).then(async (db) => {
            // Enable foreign keys
            await db.exec('PRAGMA foreign_keys = ON;');
            
            // Create tables
            await db.exec(`
                CREATE TABLE IF NOT EXISTS accounts (
                    username TEXT PRIMARY KEY,
                    email TEXT UNIQUE,
                    password TEXT,
                    initialCapital REAL,
                    currency TEXT
                );
                
                CREATE TABLE IF NOT EXISTS settings (
                    username TEXT PRIMARY KEY,
                    initialCapital REAL,
                    currency TEXT,
                    maxRiskPerTrade REAL,
                    theme TEXT,
                    FOREIGN KEY(username) REFERENCES accounts(username) ON DELETE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    username TEXT,
                    symbol TEXT,
                    direction TEXT,
                    entryPrice REAL,
                    exitPrice REAL,
                    quantity REAL,
                    fees REAL,
                    stopLoss REAL,
                    takeProfit REAL,
                    strategy TEXT,
                    emotion TEXT,
                    mistake TEXT,
                    notes TEXT,
                    screenshot TEXT,
                    date TEXT,
                    isForex INTEGER,
                    pips REAL,
                    grossPnL REAL,
                    netPnL REAL,
                    rrRatio REAL,
                    FOREIGN KEY(username) REFERENCES accounts(username) ON DELETE CASCADE
                );
            `);
            
            // Auto-create default Master/Trader accounts if table is empty
            const accountCount = await db.get('SELECT COUNT(*) as cnt FROM accounts');
            if (accountCount.cnt === 0) {
                await db.run('INSERT INTO accounts (username, password, initialCapital, currency) VALUES (?, ?, ?, ?)', ['Trader', 'trader123', 10000, 'USD']);
                await db.run('INSERT INTO settings (username, initialCapital, currency, maxRiskPerTrade, theme) VALUES (?, ?, ?, ?, ?)', ['Trader', 10000, 'USD', 2.0, 'dark']);
            }
            
            return db;
        });
    }
    return dbPromise;
}

// REST API Endpoints

// 1. Server Status check
app.get('/api/status', async (req, res) => {
    try {
        await getDb(); // ensure DB is connected
        res.json({ status: 'online', database: 'SQLite Vault' });
    } catch (e) {
        res.status(500).json({ status: 'offline', error: e.message });
    }
});

// 2. Authentication: Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required.' });
    }
    
    try {
        const db = await getDb();
        const eTrim = email.trim().toLowerCase();
        
        const account = await db.get(
            'SELECT * FROM accounts WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND password = ?',
            [eTrim, eTrim, password]
        );
        
        if (account) {
            res.json({ success: true, username: account.username });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 3. Authentication: Register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, initialCapital, currency } = req.body;
    const uTrim = (username || '').trim();
    const eTrim = (email || '').trim().toLowerCase();
    
    if (!uTrim || !eTrim || !password) {
        return res.status(400).json({ success: false, message: 'Trader name, email, and password are required.' });
    }
    if (uTrim.length < 3) {
        return res.status(400).json({ success: false, message: 'Trader Name must be at least 3 characters long.' });
    }
    
    try {
        const db = await getDb();
        const existingAcc = await db.get(
            'SELECT * FROM accounts WHERE LOWER(username) = ? OR LOWER(email) = ?',
            [uTrim.toLowerCase(), eTrim.toLowerCase()]
        );
        
        if (existingAcc) {
            if (existingAcc.username.toLowerCase() === uTrim.toLowerCase()) {
                return res.status(400).json({ success: false, message: `Trader Name "${uTrim}" is already registered.` });
            }
            if (existingAcc.email && existingAcc.email.toLowerCase() === eTrim.toLowerCase()) {
                return res.status(400).json({ success: false, message: `Email "${eTrim}" is already registered.` });
            }
        }
        
        const cap = parseFloat(initialCapital) || 0;
        const curr = currency || 'USD';
        
        await db.run(
            'INSERT INTO accounts (username, email, password, initialCapital, currency) VALUES (?, ?, ?, ?, ?)',
            [uTrim, eTrim, password, cap, curr]
        );
        
        await db.run(
            'INSERT INTO settings (username, initialCapital, currency, maxRiskPerTrade, theme) VALUES (?, ?, ?, ?, ?)',
            [uTrim, cap, curr, 2.0, 'dark']
        );
        
        res.json({ success: true, username: uTrim });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Account Deletion
app.delete('/api/auth/account', async (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        // CASCADE will delete from settings and trades automatically
        await db.run('DELETE FROM accounts WHERE username = ?', [username]);
        res.json({ success: true, message: 'Account permanently deleted.' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Settings: Get
app.get('/api/settings', async (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        const settings = await db.get('SELECT * FROM settings WHERE username = ?', [username]);
        
        if (settings) {
            res.json(settings);
        } else {
            res.json({
                username,
                initialCapital: 10000,
                currency: 'USD',
                maxRiskPerTrade: 2,
                theme: 'dark'
            });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. Settings: Save
app.post('/api/settings', async (req, res) => {
    const username = req.headers['x-user'];
    const s = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        // Upsert syntax
        await db.run(`
            INSERT INTO settings (username, initialCapital, currency, maxRiskPerTrade, theme)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                initialCapital=excluded.initialCapital,
                currency=excluded.currency,
                maxRiskPerTrade=excluded.maxRiskPerTrade,
                theme=excluded.theme
        `, [
            username, 
            s.initialCapital !== undefined ? s.initialCapital : 10000,
            s.currency || 'USD',
            s.maxRiskPerTrade !== undefined ? s.maxRiskPerTrade : 2.0,
            s.theme || 'dark'
        ]);
        
        const updated = await db.get('SELECT * FROM settings WHERE username = ?', [username]);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 6. Trades: Get All
app.get('/api/trades', async (req, res) => {
    const username = req.headers['x-user'];
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        const trades = await db.all('SELECT * FROM trades WHERE username = ?', [username]);
        // Convert isForex from 0/1 back to boolean for frontend compatibility
        trades.forEach(t => t.isForex = !!t.isForex);
        res.json(trades);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. Trades: Add new
app.post('/api/trades', async (req, res) => {
    const username = req.headers['x-user'];
    const t = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        const tradeId = 'trade_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        
        await db.run(`
            INSERT INTO trades (
                id, username, symbol, direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit,
                strategy, emotion, mistake, notes, screenshot, date, isForex, pips, grossPnL, netPnL, rrRatio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tradeId,
            username,
            t.symbol || '',
            t.direction || '',
            t.entryPrice || 0,
            t.exitPrice || 0,
            t.quantity || 0,
            t.fees || 0,
            t.stopLoss || 0,
            t.takeProfit || 0,
            t.strategy || '',
            t.emotion || '',
            t.mistake || '',
            t.notes || '',
            t.screenshot || '',
            t.date || new Date().toISOString(),
            t.isForex ? 1 : 0,
            t.pips || 0,
            t.grossPnL || 0,
            t.netPnL || 0,
            t.rrRatio || 0
        ]);
        
        const newTrade = await db.get('SELECT * FROM trades WHERE id = ?', [tradeId]);
        newTrade.isForex = !!newTrade.isForex;
        res.json(newTrade);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. Trades: Update existing
app.put('/api/trades/:id', async (req, res) => {
    const username = req.headers['x-user'];
    const tradeId = req.params.id;
    const t = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        const existing = await db.get('SELECT id FROM trades WHERE id = ? AND username = ?', [tradeId, username]);
        if (!existing) {
            return res.status(404).json({ error: 'Trade not found.' });
        }
        
        await db.run(`
            UPDATE trades SET
                symbol = ?, direction = ?, entryPrice = ?, exitPrice = ?, quantity = ?, fees = ?, stopLoss = ?, takeProfit = ?,
                strategy = ?, emotion = ?, mistake = ?, notes = ?, screenshot = ?, date = ?, isForex = ?, pips = ?, grossPnL = ?, netPnL = ?, rrRatio = ?
            WHERE id = ? AND username = ?
        `, [
            t.symbol !== undefined ? t.symbol : '',
            t.direction !== undefined ? t.direction : '',
            t.entryPrice !== undefined ? t.entryPrice : 0,
            t.exitPrice !== undefined ? t.exitPrice : 0,
            t.quantity !== undefined ? t.quantity : 0,
            t.fees !== undefined ? t.fees : 0,
            t.stopLoss !== undefined ? t.stopLoss : 0,
            t.takeProfit !== undefined ? t.takeProfit : 0,
            t.strategy !== undefined ? t.strategy : '',
            t.emotion !== undefined ? t.emotion : '',
            t.mistake !== undefined ? t.mistake : '',
            t.notes !== undefined ? t.notes : '',
            t.screenshot !== undefined ? t.screenshot : '',
            t.date !== undefined ? t.date : '',
            t.isForex ? 1 : 0,
            t.pips !== undefined ? t.pips : 0,
            t.grossPnL !== undefined ? t.grossPnL : 0,
            t.netPnL !== undefined ? t.netPnL : 0,
            t.rrRatio !== undefined ? t.rrRatio : 0,
            tradeId,
            username
        ]);
        
        const updatedTrade = await db.get('SELECT * FROM trades WHERE id = ?', [tradeId]);
        updatedTrade.isForex = !!updatedTrade.isForex;
        res.json(updatedTrade);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 9. Trades: Delete
app.delete('/api/trades/:id', async (req, res) => {
    const username = req.headers['x-user'];
    const tradeId = req.params.id;
    if (!username) {
        return res.status(400).json({ error: 'Header X-User is required.' });
    }
    
    try {
        const db = await getDb();
        const result = await db.run('DELETE FROM trades WHERE id = ? AND username = ?', [tradeId, username]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Trade not found.' });
        }
        res.json({ success: true, message: 'Trade deleted.' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Admin: Get all users
app.get('/api/admin/users', async (req, res) => {
    const adminUser = req.headers['x-user'];
    if (adminUser !== 'hit') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    
    try {
        const db = await getDb();
        const accounts = await db.all('SELECT username, email, initialCapital, currency FROM accounts');
        res.json(accounts);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Delete user
app.delete('/api/admin/users/:username', async (req, res) => {
    const adminUser = req.headers['x-user'];
    if (adminUser !== 'hit') {
        return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    
    const targetUser = req.params.username;
    if (targetUser === 'hit') {
        return res.status(400).json({ error: 'Cannot delete the master admin account.' });
    }
    
    try {
        const db = await getDb();
        await db.run('DELETE FROM accounts WHERE username = ?', [targetUser]);
        res.json({ success: true, message: `User ${targetUser} has been deleted.` });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. Leaderboard: Get Top Traders
app.get('/api/leaderboard', async (req, res) => {
    try {
        const db = await getDb();
        
        const leaderboardData = await db.all(`
            SELECT 
                a.username, 
                COALESCE(SUM(t.pips), 0) as totalPips,
                COALESCE(SUM(t.netPnL), 0) as totalProfit,
                COUNT(t.id) as totalTrades,
                SUM(CASE WHEN t.netPnL > 0 THEN 1 ELSE 0 END) as wins
            FROM accounts a
            LEFT JOIN trades t ON a.username = t.username
            GROUP BY a.username
            ORDER BY totalProfit DESC
        `);
        
        const leaderboard = leaderboardData.map((row, index) => {
            const winRate = row.totalTrades > 0 ? (row.wins / row.totalTrades) * 100 : 0;
            return {
                rank: index + 1,
                username: row.username,
                totalPips: row.totalPips,
                totalProfit: row.totalProfit,
                winRate: winRate,
                totalTrades: row.totalTrades
            };
        });
        
        res.json(leaderboard);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 11. Sync: Remote upload of all offline trades/settings
app.post('/api/sync', async (req, res) => {
    const { accounts, trades, settings } = req.body;
    
    try {
        const db = await getDb();
        
        if (accounts && Array.isArray(accounts)) {
            const stmt = await db.prepare(`
                INSERT INTO accounts (username, email, password, initialCapital, currency)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    email=excluded.email,
                    password=excluded.password,
                    initialCapital=excluded.initialCapital,
                    currency=excluded.currency
            `);
            for (const acc of accounts) {
                await stmt.run([
                    acc.username,
                    acc.email ? acc.email.trim().toLowerCase() : '',
                    acc.password || '',
                    acc.initialCapital || 0,
                    acc.currency || 'USD'
                ]);
            }
            await stmt.finalize();
        }
        
        if (settings && Array.isArray(settings)) {
            const stmt = await db.prepare(`
                INSERT INTO settings (username, initialCapital, currency, maxRiskPerTrade, theme)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    initialCapital=excluded.initialCapital,
                    currency=excluded.currency,
                    maxRiskPerTrade=excluded.maxRiskPerTrade,
                    theme=excluded.theme
            `);
            for (const s of settings) {
                await stmt.run([
                    s.username, 
                    s.initialCapital !== undefined ? s.initialCapital : 10000,
                    s.currency || 'USD',
                    s.maxRiskPerTrade !== undefined ? s.maxRiskPerTrade : 2.0,
                    s.theme || 'dark'
                ]);
            }
            await stmt.finalize();
        }
        
        if (trades && Array.isArray(trades)) {
            const stmt = await db.prepare(`
                INSERT INTO trades (
                    id, username, symbol, direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit,
                    strategy, emotion, mistake, notes, screenshot, date, isForex, pips, grossPnL, netPnL, rrRatio
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    symbol=excluded.symbol, direction=excluded.direction, entryPrice=excluded.entryPrice, 
                    exitPrice=excluded.exitPrice, quantity=excluded.quantity, fees=excluded.fees, 
                    stopLoss=excluded.stopLoss, takeProfit=excluded.takeProfit, strategy=excluded.strategy, 
                    emotion=excluded.emotion, mistake=excluded.mistake, notes=excluded.notes, 
                    screenshot=excluded.screenshot, date=excluded.date, isForex=excluded.isForex, 
                    pips=excluded.pips, grossPnL=excluded.grossPnL, netPnL=excluded.netPnL, rrRatio=excluded.rrRatio
            `);
            
            for (const t of trades) {
                // Ignore trades that don't belong to this user
                if (t.username !== username) continue;
                
                await stmt.run([
                    t.id, username, t.symbol || '', t.direction || '', t.entryPrice || 0, t.exitPrice || 0,
                    t.quantity || 0, t.fees || 0, t.stopLoss || 0, t.takeProfit || 0, t.strategy || '',
                    t.emotion || '', t.mistake || '', t.notes || '', t.screenshot || '', t.date || new Date().toISOString(),
                    t.isForex ? 1 : 0, t.pips || 0, t.grossPnL || 0, t.netPnL || 0, t.rrRatio || 0
                ]);
            }
            await stmt.finalize();
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error during sync.' });
    }
});

// 12. Forex: Live Currency Strength
app.get('/api/forex/strength', async (req, res) => {
    try {
        const { timeframe = '1D' } = req.query;
        
        // Map UI timeframe to Yahoo Finance interval and lookback ms
        const tfMap = {
            '1M': { interval: '1m', ms: 60 * 1000 * 5 },
            '5M': { interval: '1m', ms: 5 * 60 * 1000 * 2 },
            '15M': { interval: '5m', ms: 15 * 60 * 1000 * 2 },
            '1H': { interval: '15m', ms: 60 * 60 * 1000 * 2 },
            '4H': { interval: '60m', ms: 4 * 60 * 60 * 1000 * 2 },
            '1D': { interval: '1d', ms: 24 * 60 * 60 * 1000 * 2 }
        };
        
        const tf = tfMap[timeframe] || tfMap['1D'];
        const period1 = new Date(Date.now() - tf.ms);
        
        const symbols = ['EURUSD=X', 'GBPUSD=X', 'JPY=X', 'AUDUSD=X', 'CAD=X', 'CHF=X', 'NZDUSD=X'];
        
        let strengths = { USD: 5.0 };
        
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
                
                if (sym === 'JPY=X') strengths.JPY = 5.0 - (pct * multiplier);
                if (sym === 'CAD=X') strengths.CAD = 5.0 - (pct * multiplier);
                if (sym === 'CHF=X') strengths.CHF = 5.0 - (pct * multiplier);
            } catch(e) {
                console.error("Error fetching chart for", sym, e.message);
            }
        }));
        
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
getDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Ascend Core Database Server running at http://localhost:${PORT}`);
    });
}).catch(e => {
    console.error("Failed to initialize database:", e);
});
