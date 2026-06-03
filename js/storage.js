window.API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:3000' : '';
/**
 * Trading Journal Data & Math Engine
 * Handles local database storage, statistics calculation, and trade operations.
 * Upgraded to support dual-engine storage (IndexedDB browser core & local SQLite server).
 */

class IndexedDBWrapper {
    constructor() {
        this.dbName = 'AscendTradingJournal';
        this.dbVersion = 1;
        this.db = null;
    }

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("IndexedDB open error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('accounts')) {
                    db.createObjectStore('accounts', { keyPath: 'username' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'username' });
                }
                if (!db.objectStoreNames.contains('trades')) {
                    db.createObjectStore('trades', { keyPath: 'id' });
                }
            };
        });
    }

    getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    get(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    put(storeName, val) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(val);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    delete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error("Database not initialized"));
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}

class TradingJournalDB {
    constructor() {
        this.STORAGE_KEY_ACCOUNTS = 'trading_journal_accounts';
        this.STORAGE_KEY_SESSION = 'trading_journal_active_session';
        
        this.defaultSettings = {
            username: 'Trader',
            initialCapital: 10000,
            currency: 'USD',
            maxRiskPerTrade: 2, // 2% max risk limit
            theme: 'dark'
        };

        this.dbMode = 'indexeddb'; // Default mode
        this.idb = new IndexedDBWrapper();
        this.initPromise = this.init();
    }

    /**
     * Check if local server is online
     */
    async checkServerStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);
            
            const response = await fetch(window.API_BASE + '/api/status', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            
            if (data.status === 'online') {
                this.dbMode = 'sqlite';
                console.log("Ascend Core Database: Local SQLite Backend Server Connected.");
                return true;
            }
        } catch (e) {
            // Keep default IndexedDB mode
        }
        this.dbMode = 'indexeddb';
        console.log("Ascend Core Database: Browser-based IndexedDB Active.");
        return false;
    }

    /**
     * Initialize database. Load from IndexedDB and run localStorage migration if needed.
     */
    async init() {
        try {
            await this.idb.open();
        } catch (e) {
            console.error("IndexedDB Open failed. Falling back to basic initialization.", e);
        }
        
        await this.checkServerStatus();

        // IndexedDB Auto-migration from localStorage
        if (!localStorage.getItem('trading_journal_indexeddb_migrated')) {
            console.log("IndexedDB Migration: Legacy data migration triggered...");
            try {
                const existingAccountsRaw = localStorage.getItem(this.STORAGE_KEY_ACCOUNTS);
                let accountsList = [];
                if (existingAccountsRaw) {
                    accountsList = JSON.parse(existingAccountsRaw) || [];
                }

                // If empty localStorage but it is first boot, load fallback
                if (accountsList.length === 0) {
                    accountsList.push({
                        username: 'Trader',
                        password: 'trader123',
                        initialCapital: 10000,
                        currency: 'USD'
                    });
                    
                    const defaultSettings = {
                        username: 'Trader',
                        initialCapital: 10000,
                        currency: 'USD',
                        maxRiskPerTrade: 2.0,
                        theme: 'dark'
                    };
                    await this.idb.put('accounts', accountsList[0]);
                    await this.idb.put('settings', defaultSettings);
                } else {
                    // Copy existing user accounts, settings, and trades
                    for (const user of accountsList) {
                        await this.idb.put('accounts', user);
                        
                        const settingsRaw = localStorage.getItem(`trading_journal_settings_${user.username}`);
                        if (settingsRaw) {
                            const settingsObj = JSON.parse(settingsRaw);
                            await this.idb.put('settings', settingsObj);
                        }
                        
                        const tradesRaw = localStorage.getItem(`trading_journal_trades_${user.username}`);
                        if (tradesRaw) {
                            const tradesArr = JSON.parse(tradesRaw) || [];
                            for (const t of tradesArr) {
                                t.username = user.username; // Tag trade
                                await this.idb.put('trades', t);
                            }
                        }
                    }
                }
                
                // Legacy key cleanups are NOT run here to ensure a backup remains in localStorage,
                // but we flag that the migration has completed.
                localStorage.setItem('trading_journal_indexeddb_migrated', 'true');
                console.log("IndexedDB Migration: Migration completed successfully!");
            } catch (err) {
                console.error("Migration failed:", err);
            }
        }
    }

    /**
     * Get active user username or null (synchronous from sessionStorage/localStorage session key)
     */
    getActiveUser() {
        return localStorage.getItem(this.STORAGE_KEY_SESSION) || null;
    }

    /**
     * Register a new user.
     */
    async register(username, email, password, initialCapital, currency) {
        try {
            const uTrim = username.trim();
            const eTrim = email.trim().toLowerCase();
            if (!uTrim || !eTrim || !password) {
                return { success: false, message: 'Trader name, email, and password are required.' };
            }
            if (uTrim.length < 3) {
                return { success: false, message: 'Trader name must be at least 3 characters long.' };
            }

            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: uTrim, email: eTrim, password, initialCapital, currency })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        localStorage.setItem(this.STORAGE_KEY_SESSION, uTrim);
                        return { success: true, username: uTrim };
                    }
                    return { success: false, message: data.message || 'Registration failed.' };
                } catch (e) {
                    console.error("Server register error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB mode
            const allAccounts = await this.idb.getAll('accounts');
            if (allAccounts.some(a => a.username.toLowerCase() === uTrim.toLowerCase())) {
                return { success: false, message: `Trader name "${uTrim}" is already registered.` };
            }
            if (allAccounts.some(a => a.email && a.email.toLowerCase() === eTrim)) {
                return { success: false, message: `Email "${eTrim}" is already registered.` };
            }
            
            // Create account
            await this.idb.put('accounts', {
                username: uTrim,
                email: eTrim,
                password: password,
                initialCapital: parseFloat(initialCapital) || 0,
                currency: currency || 'USD'
            });
            
            // Set user settings & empty trades
            const userSettings = {
                username: uTrim,
                initialCapital: parseFloat(initialCapital) || 0,
                currency: currency || 'USD',
                maxRiskPerTrade: 2.0,
                theme: 'dark'
            };
            await this.idb.put('settings', userSettings);
            
            // Login user
            localStorage.setItem(this.STORAGE_KEY_SESSION, uTrim);
            return { success: true, username: uTrim };
        } catch(e) {
            console.error("Registration error", e);
            return { success: false, message: 'An unexpected error occurred during registration.' };
        }
    }

    /**
     * Login user.
     */
    async login(email, password) {
        try {
            const eTrim = email.trim().toLowerCase();
            
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: eTrim, password })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        localStorage.setItem(this.STORAGE_KEY_SESSION, data.username);
                        return { success: true, username: data.username };
                    }
                    return { success: false, message: data.message || 'Invalid email or password.' };
                } catch (e) {
                    console.error("Server login error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB fallback search by email
            const allAccounts = await this.idb.getAll('accounts');
            const user = allAccounts.find(a => a.email && a.email.toLowerCase() === eTrim);
            
            if (user && user.password === password) {
                localStorage.setItem(this.STORAGE_KEY_SESSION, user.username);
                return { success: true, username: user.username };
            }
            return { success: false, message: 'Invalid email or password.' };
        } catch(e) {
            console.error("Login error", e);
            return { success: false, message: 'An unexpected error occurred during login.' };
        }
    }

    /**
     * Logout user.
     */
    logout() {
        localStorage.removeItem(this.STORAGE_KEY_SESSION);
        return true;
    }

    /**
     * Permanently delete the current account and all its data.
     */
    async deleteAccount() {
        const username = this.getActiveUser();
        if (!username) return false;

        try {
            if (this.dbMode === 'sqlite') {
                const res = await fetch(window.API_BASE + '/api/auth/account', {
                    method: 'DELETE',
                    headers: { 'X-User': username }
                });
                if (!res.ok) {
                    console.error("Failed to delete account on server.");
                }
            }

            // Always clear from IndexedDB
            const accounts = await this.idb.getAll('accounts');
            const targetAcc = accounts.find(a => a.username === username);
            if (targetAcc) {
                await this.idb.delete('accounts', targetAcc.id);
            }
            await this.idb.delete('settings', username);
            
            const allTrades = await this.idb.getAll('trades');
            for (const t of allTrades) {
                if (t.username === username) {
                    await this.idb.delete('trades', t.id);
                }
            }
            
            this.logout();
            return true;
        } catch (e) {
            console.error("Error deleting account:", e);
            return false;
        }
    }

    /**
     * Get user settings.
     */
    async getSettings() {
        const username = this.getActiveUser();
        if (!username) return this.defaultSettings;

        try {
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/settings', {
                        headers: { 'x-user': username }
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch (e) {
                    console.error("Server getSettings error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB
            const settings = await this.idb.get('settings', username);
            if (settings) return settings;

            // Build default
            const userAcc = await this.idb.get('accounts', username);
            const initSettings = {
                username: username,
                initialCapital: userAcc ? userAcc.initialCapital : 10000,
                currency: userAcc ? userAcc.currency : 'USD',
                maxRiskPerTrade: 2,
                theme: 'dark'
            };
            await this.idb.put('settings', initSettings);
            return initSettings;
        } catch (e) {
            console.error("Error reading settings", e);
            return this.defaultSettings;
        }
    }

    /**
     * Save user settings.
     */
    async saveSettings(settings) {
        const username = this.getActiveUser();
        if (!username) return null;

        try {
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user': username },
                        body: JSON.stringify(settings)
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch (e) {
                    console.error("Server saveSettings error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB
            const current = await this.getSettings();
            const updated = { ...current, ...settings };
            await this.idb.put('settings', updated);
            return updated;
        } catch (e) {
            console.error("Error saving settings", e);
            return null;
        }
    }

    /**
     * Get all trades sorted by date descending.
     */
    async getTrades(timeframe = 'all') {
        const username = this.getActiveUser();
        if (!username) return [];

        try {
            let trades = [];
            
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/trades', {
                        headers: { 'x-user': username }
                    });
                    if (res.ok) {
                        trades = await res.json();
                    }
                } catch (e) {
                    console.error("Server getTrades error, fallback to IndexedDB:", e);
                }
            }
            
            if (this.dbMode === 'indexeddb' || trades.length === 0) {
                // IndexedDB filter by user
                const allTrades = await this.idb.getAll('trades');
                trades = allTrades.filter(t => t.username === username);
            }
            
            // Apply timeframe filtering dynamically
            const now = new Date();
            if (timeframe === 'daily') {
                trades = trades.filter(t => new Date(t.date).toDateString() === now.toDateString());
            } else if (timeframe === 'weekly') {
                const oneWeekAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
                trades = trades.filter(t => new Date(t.date).getTime() >= oneWeekAgo);
            } else if (timeframe === 'monthly') {
                const oneMonthAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
                trades = trades.filter(t => new Date(t.date).getTime() >= oneMonthAgo);
            } else if (timeframe === 'yearly') {
                const oneYearAgo = now.getTime() - (365 * 24 * 60 * 60 * 1000);
                trades = trades.filter(t => new Date(t.date).getTime() >= oneYearAgo);
            }
            
            // Sort by execution time/date descending (newest first)
            return trades.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            console.error("Error reading trades", e);
            return [];
        }
    }

    /**
     * Get a specific trade by ID.
     */
    async getTradeById(id) {
        try {
            if (this.dbMode === 'sqlite') {
                const trades = await this.getTrades();
                return trades.find(t => t.id === id) || null;
            }
            return await this.idb.get('trades', id);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    /**
     * Get Leaderboard Data
     */
    async getLeaderboard() {
        try {
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/leaderboard');
                    if (res.ok) {
                        return await res.json();
                    }
                } catch (e) {
                    console.error("Server leaderboard error, fallback to IndexedDB:", e);
                }
            }

            // IndexedDB fallback
            const allAccounts = await this.idb.getAll('accounts');
            const allTrades = await this.idb.getAll('trades');
            const leaderboard = [];

            allAccounts.forEach(acc => {
                const username = acc.username;
                const trades = allTrades.filter(t => t.username === username);
                
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

            leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
            leaderboard.forEach((trader, index) => { trader.rank = index + 1; });
            return leaderboard;
        } catch (e) {
            console.error("Error fetching leaderboard:", e);
            return [];
        }
    }

    /**
     * Helper to get pip size and pip standard value for a given symbol.
     * Returns specs if Forex, else null.
     */
    getForexSpecs(symbol) {
        if (!symbol) return null;
        
        const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Gold
        if (cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD')) {
            return {
                isForex: true,
                type: 'Gold (XAU/USD)',
                pipSize: 0.10,
                pipValuePerStandardLot: 10.00
            };
        }
        
        // Oil
        if (cleanSymbol.includes('USOIL') || cleanSymbol.includes('WTI') || cleanSymbol.includes('UKOIL')) {
            return {
                isForex: true,
                type: 'Oil (USOIL/WTI)',
                pipSize: 0.01,
                pipValuePerStandardLot: 10.00
            };
        }
        
        // JPY Pairs
        if (cleanSymbol.includes('JPY')) {
            return {
                isForex: true,
                type: 'JPY Pair',
                pipSize: 0.01,
                pipValuePerStandardLot: 6.70
            };
        }
        
        // CHF Pairs
        if (cleanSymbol.endsWith('CHF')) {
            return {
                isForex: true,
                type: 'CHF Cross Pair',
                pipSize: 0.0001,
                pipValuePerStandardLot: 11.10
            };
        }
        
        // CAD Pairs
        if (cleanSymbol.endsWith('CAD')) {
            return {
                isForex: true,
                type: 'CAD Cross Pair',
                pipSize: 0.0001,
                pipValuePerStandardLot: 7.30
            };
        }
        
        // EUR/GBP
        if (cleanSymbol === 'EURGBP') {
            return {
                isForex: true,
                type: 'Euro Cross (EUR/GBP)',
                pipSize: 0.0001,
                pipValuePerStandardLot: 12.50
            };
        }
        
        // Indices
        if (cleanSymbol.includes('US30') || cleanSymbol.includes('SPX') || cleanSymbol.includes('NAS') || cleanSymbol.includes('UK100') || cleanSymbol.includes('GER40')) {
            return {
                isForex: false,
                type: 'Index',
                pipSize: 1.0,
                pipValuePerStandardLot: 1.0
            };
        }
        
        // Crypto
        const cryptoKeywords = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB', 'LTC', 'DOT'];
        if (cryptoKeywords.some(kw => cleanSymbol.includes(kw))) {
            return {
                isForex: false,
                type: 'Cryptocurrency',
                pipSize: 1.0,
                pipValuePerStandardLot: 1.0
            };
        }

        // Major Pairs (USD behind)
        if (cleanSymbol.endsWith('USD') || ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'].includes(cleanSymbol)) {
            return {
                isForex: true,
                type: 'Major USD Pair',
                pipSize: 0.0001,
                pipValuePerStandardLot: 10.00
            };
        }
        
        // Generic Forex patterns (typically 6-letter string)
        if (cleanSymbol.length === 6) {
            return {
                isForex: true,
                type: 'Forex Pair',
                pipSize: 0.0001,
                pipValuePerStandardLot: 10.00
            };
        }
        
        return null;
    }

    /**
     * Helper to auto-calculate PnL and risk parameters of a trade.
     */
    calculateTradePnL(trade) {
        const entry = parseFloat(trade.entryPrice) || 0;
        const exit = parseFloat(trade.exitPrice) || 0;
        const quantity = parseFloat(trade.quantity) || 0;
        const fees = parseFloat(trade.fees) || 0;
        const direction = trade.direction; // 'LONG' or 'SHORT'

        const forexSpecs = this.getForexSpecs(trade.symbol);
        let grossPnL = 0;
        let isForex = false;
        let pips = 0;

        if (forexSpecs && forexSpecs.isForex && entry > 0 && exit > 0) {
            isForex = true;
            const diff = direction === 'LONG' ? (exit - entry) : (entry - exit);
            pips = diff / forexSpecs.pipSize;
            grossPnL = pips * quantity * forexSpecs.pipValuePerStandardLot;
        } else {
            if (direction === 'LONG') {
                grossPnL = (exit - entry) * quantity;
            } else if (direction === 'SHORT') {
                grossPnL = (entry - exit) * quantity;
            }
        }

        const netPnL = grossPnL - fees;

        // Calculate Risk/Reward ratio if SL and TP are specified
        let rrRatio = 0;
        const sl = parseFloat(trade.stopLoss) || 0;
        const tp = parseFloat(trade.takeProfit) || 0;

        if (sl > 0 && entry > 0) {
            const risk = direction === 'LONG' ? (entry - sl) : (sl - entry);
            const reward = tp > 0 ? (direction === 'LONG' ? (tp - entry) : (entry - tp)) : 0;
            if (risk > 0 && reward > 0) {
                rrRatio = parseFloat((reward / risk).toFixed(2));
            }
        }

        return {
            ...trade,
            isForex,
            pips: isForex ? parseFloat(pips.toFixed(1)) : 0,
            grossPnL: parseFloat(grossPnL.toFixed(2)),
            netPnL: parseFloat(netPnL.toFixed(2)),
            rrRatio: rrRatio
        };
    }

    /**
     * Insert a new trade.
     */
    async addTrade(tradeData) {
        const username = this.getActiveUser();
        if (!username) return null;

        try {
            // Construct a complete trade record
            let newTrade = {
                id: 'trade_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
                username: username,
                symbol: (tradeData.symbol || 'UNKNOWN').toUpperCase().trim(),
                direction: tradeData.direction || 'LONG',
                entryPrice: parseFloat(tradeData.entryPrice) || 0,
                exitPrice: parseFloat(tradeData.exitPrice) || 0,
                quantity: parseFloat(tradeData.quantity) || 0,
                fees: parseFloat(tradeData.fees) || 0,
                stopLoss: parseFloat(tradeData.stopLoss) || 0,
                takeProfit: parseFloat(tradeData.takeProfit) || 0,
                strategy: (tradeData.strategy || 'Uncategorized').trim(),
                emotion: (tradeData.emotion || 'Neutral').trim(),
                mistake: (tradeData.mistake || '').trim(),
                notes: tradeData.notes || '',
                screenshot: tradeData.screenshot || '',
                date: tradeData.date || new Date().toISOString()
            };

            newTrade = this.calculateTradePnL(newTrade);

            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/trades', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user': username },
                        body: JSON.stringify(newTrade)
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch (e) {
                    console.error("Server addTrade error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB
            await this.idb.put('trades', newTrade);
            return newTrade;
        } catch (e) {
            console.error("Error adding trade", e);
            return null;
        }
    }

    /**
     * Update an existing trade.
     */
    async updateTrade(id, updatedData) {
        const username = this.getActiveUser();
        if (!username) return null;

        try {
            const current = await this.getTradeById(id);
            if (!current) return null;

            let updatedTrade = {
                ...current,
                ...updatedData,
                id: id, // Ensure ID doesn't change
                username: username
            };

            // Force recalculation of float inputs
            updatedTrade.entryPrice = parseFloat(updatedTrade.entryPrice) || 0;
            updatedTrade.exitPrice = parseFloat(updatedTrade.exitPrice) || 0;
            updatedTrade.quantity = parseFloat(updatedTrade.quantity) || 0;
            updatedTrade.fees = parseFloat(updatedTrade.fees) || 0;
            updatedTrade.stopLoss = parseFloat(updatedTrade.stopLoss) || 0;
            updatedTrade.takeProfit = parseFloat(updatedTrade.takeProfit) || 0;
            updatedTrade.symbol = (updatedTrade.symbol || '').toUpperCase().trim();

            updatedTrade = this.calculateTradePnL(updatedTrade);

            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(`\${window.API_BASE}/api/trades/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'x-user': username },
                        body: JSON.stringify(updatedTrade)
                    });
                    if (res.ok) {
                        return await res.json();
                    }
                } catch (e) {
                    console.error("Server updateTrade error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB
            await this.idb.put('trades', updatedTrade);
            return updatedTrade;
        } catch (e) {
            console.error("Error updating trade", e);
            return null;
        }
    }

    /**
     * Delete a trade.
     */
    async deleteTrade(id) {
        const username = this.getActiveUser();
        if (!username) return false;

        try {
            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(`\${window.API_BASE}/api/trades/${id}`, {
                        method: 'DELETE',
                        headers: { 'x-user': username }
                    });
                    if (res.ok) {
                        return true;
                    }
                } catch (e) {
                    console.error("Server deleteTrade error, fallback to IndexedDB:", e);
                }
            }
            
            // IndexedDB
            await this.idb.delete('trades', id);
            return true;
        } catch (e) {
            console.error("Error deleting trade", e);
            return false;
        }
    }

    /**
     * Reset / clear all trades (keeping settings).
     */
    async clearAllTrades() {
        const username = this.getActiveUser();
        if (!username) return;

        try {
            if (this.dbMode === 'sqlite') {
                const trades = await this.getTrades();
                for (const t of trades) {
                    await this.deleteTrade(t.id);
                }
            } else {
                const allTrades = await this.idb.getAll('trades');
                const userTrades = allTrades.filter(t => t.username === username);
                for (const t of userTrades) {
                    await this.idb.delete('trades', t.id);
                }
            }
        } catch (e) {
            console.error("Error clearing trades:", e);
        }
    }

    /**
     * Compute comprehensive analytical KPIs and portfolios.
     */
    async getMetrics(timeframe = 'all') {
        const rawTrades = await this.getTrades(timeframe);
        const trades = rawTrades.sort((a, b) => new Date(a.date) - new Date(b.date)); // Oldest first for curve
        const settings = await this.getSettings();
        const startCapital = parseFloat(settings.initialCapital) || 0;

        let totalTrades = trades.length;
        let winningTrades = 0;
        let losingTrades = 0;
        let breakevenTrades = 0;

        let totalNetPnL = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        let maxWin = 0;
        let maxLoss = 0;

        let currentStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        let streakType = null; // 'win' or 'loss'

        // Calculate streaks & metrics
        let cumulativePnL = 0;
        const equityCurveData = [{
            date: 'Starting Capital',
            balance: startCapital,
            pnl: 0
        }];

        trades.forEach((trade, index) => {
            const pnl = trade.netPnL;
            totalNetPnL += pnl;
            cumulativePnL += pnl;

            // Log equity point
            equityCurveData.push({
                date: new Date(trade.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
                balance: parseFloat((startCapital + cumulativePnL).toFixed(2)),
                pnl: pnl
            });

            // Win / Loss / Breakeven classification
            if (pnl > 0.01) {
                winningTrades++;
                grossProfit += pnl;
                if (pnl > maxWin) maxWin = pnl;

                // Win streak calculations
                if (streakType === 'win') {
                    currentStreak++;
                } else {
                    streakType = 'win';
                    currentStreak = 1;
                }
                if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;

            } else if (pnl < -0.01) {
                losingTrades++;
                grossLoss += Math.abs(pnl);
                if (Math.abs(pnl) > maxLoss) maxLoss = Math.abs(pnl);

                // Loss streak calculations
                if (streakType === 'loss') {
                    currentStreak++;
                } else {
                    streakType = 'loss';
                    currentStreak = 1;
                }
                if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;

            } else {
                breakevenTrades++;
                // Neutral trade resets streak
                currentStreak = 0;
                streakType = null;
            }
        });

        // Win Rate
        const winRate = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

        // Profit Factor
        const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.99 : 0);

        // Averages
        const avgWin = winningTrades > 0 ? parseFloat((grossProfit / winningTrades).toFixed(2)) : 0;
        const avgLoss = losingTrades > 0 ? parseFloat((grossLoss / losingTrades).toFixed(2)) : 0;
        const avgWinLossRatio = avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            breakevenTrades,
            winRate,
            totalNetPnL: parseFloat(totalNetPnL.toFixed(2)),
            currentBalance: parseFloat((startCapital + totalNetPnL).toFixed(2)),
            grossProfit: parseFloat(grossProfit.toFixed(2)),
            grossLoss: parseFloat(grossLoss.toFixed(2)),
            profitFactor,
            avgWin,
            avgLoss,
            avgWinLossRatio,
            maxWin: parseFloat(maxWin.toFixed(2)),
            maxLoss: parseFloat(maxLoss.toFixed(2)),
            maxWinStreak,
            maxLossStreak,
            equityCurve: equityCurveData
        };
    }

    /**
     * Get strategy-specific analytics.
     */
    async getStrategyAnalytics(timeframe = 'all') {
        const trades = await this.getTrades(timeframe);
        const strategies = {};

        trades.forEach(trade => {
            const strat = trade.strategy || 'Uncategorized';
            if (!strategies[strat]) {
                strategies[strat] = {
                    name: strat,
                    totalTrades: 0,
                    wins: 0,
                    losses: 0,
                    netPnL: 0,
                    grossProfit: 0,
                    grossLoss: 0
                };
            }

            const s = strategies[strat];
            s.totalTrades++;
            s.netPnL += trade.netPnL;

            if (trade.netPnL > 0.01) {
                s.wins++;
                s.grossProfit += trade.netPnL;
            } else if (trade.netPnL < -0.01) {
                s.losses++;
                s.grossLoss += Math.abs(trade.netPnL);
            }
        });

        // Compute metrics for each strategy
        return Object.values(strategies).map(s => {
            const winRate = s.totalTrades > 0 ? parseFloat(((s.wins / s.totalTrades) * 100).toFixed(1)) : 0;
            const profitFactor = s.grossLoss > 0 ? parseFloat((s.grossProfit / s.grossLoss).toFixed(2)) : (s.grossProfit > 0 ? 99.99 : 0);
            return {
                ...s,
                netPnL: parseFloat(s.netPnL.toFixed(2)),
                winRate,
                profitFactor
            };
        }).sort((a, b) => b.netPnL - a.netPnL); // Best setups first
    }

    /**
     * Get emotional & execution mistake tracker analytics.
     */
    async getMistakeAnalytics(timeframe = 'all') {
        const trades = await this.getTrades(timeframe);
        const mistakes = {};

        trades.forEach(trade => {
            const mistake = trade.mistake || '';
            if (!mistake) return; // Skip trades where no mistake was flagged

            if (!mistakes[mistake]) {
                mistakes[mistake] = {
                    name: mistake,
                    count: 0,
                    totalLoss: 0
                };
            }

            const m = mistakes[mistake];
            m.count++;
            // Aggregate all negative impacts
            m.totalLoss += trade.netPnL;
        });

        return Object.values(mistakes).map(m => {
            return {
                ...m,
                totalLoss: parseFloat(m.totalLoss.toFixed(2))
            };
        }).sort((a, b) => a.totalLoss - b.totalLoss); // Biggest losses first (most negative)
    }

    /**
     * Export all data to a clean JSON string backup.
     */
    async exportData() {
        const data = {
            trades: await this.getTrades(),
            settings: await this.getSettings(),
            version: '1.0.0',
            exportedAt: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import database backup from standard JSON.
     */
    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data || !Array.isArray(data.trades) || typeof data.settings !== 'object') {
                throw new Error("Invalid file schema. Missing 'trades' or 'settings'.");
            }

            const username = this.getActiveUser();
            if (!username) return false;

            if (this.dbMode === 'sqlite') {
                try {
                    const res = await fetch(window.API_BASE + '/api/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-user': username },
                        body: JSON.stringify({ trades: data.trades, settings: data.settings })
                    });
                    if (res.ok) {
                        return true;
                    }
                } catch (e) {
                    console.error("Server sync import fail, importing locally:", e);
                }
            }

            // Restore locally to IndexedDB
            const settings = { ...data.settings, username: username };
            await this.idb.put('settings', settings);
            
            // Clean user trades
            await this.clearAllTrades();

            // Import each trade tagged to user
            for (const t of data.trades) {
                t.username = username;
                await this.idb.put('trades', t);
            }
            return true;
        } catch (e) {
            console.error("Failed to import data:", e);
            alert("Failed to import database file: " + e.message);
            return false;
        }
    }
}

// Attach to window for global access
window.db = new TradingJournalDB();
