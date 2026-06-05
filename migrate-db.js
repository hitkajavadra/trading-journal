const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const JSON_DB_PATH = path.join(__dirname, 'data', 'database.json');
const SQLITE_DB_PATH = path.join(__dirname, 'data', 'database.sqlite');

async function migrate() {
    console.log("Starting migration from JSON to SQLite...");

    if (!fs.existsSync(JSON_DB_PATH)) {
        console.log(`Could not find JSON database at ${JSON_DB_PATH}. Exiting.`);
        return;
    }

    // Read existing JSON data
    const rawData = fs.readFileSync(JSON_DB_PATH, 'utf8');
    const jsonData = JSON.parse(rawData);

    // Open SQLite connection
    const db = await open({
        filename: SQLITE_DB_PATH,
        driver: sqlite3.Database
    });

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

    // Clear existing data in SQLite (if re-running migration)
    await db.exec('DELETE FROM trades;');
    await db.exec('DELETE FROM settings;');
    await db.exec('DELETE FROM accounts;');

    // Migrate Accounts
    if (jsonData.accounts && jsonData.accounts.length > 0) {
        const stmtAccounts = await db.prepare('INSERT INTO accounts (username, email, password, initialCapital, currency) VALUES (?, ?, ?, ?, ?)');
        for (const account of jsonData.accounts) {
            await stmtAccounts.run(
                account.username || null,
                account.email || null,
                account.password || null,
                account.initialCapital || 0,
                account.currency || 'USD'
            );
        }
        await stmtAccounts.finalize();
        console.log(`Migrated ${jsonData.accounts.length} accounts.`);
    }

    // Migrate Settings
    if (jsonData.settings) {
        const stmtSettings = await db.prepare('INSERT INTO settings (username, initialCapital, currency, maxRiskPerTrade, theme) VALUES (?, ?, ?, ?, ?)');
        let settingsCount = 0;
        for (const [username, settings] of Object.entries(jsonData.settings)) {
            await stmtSettings.run(
                username,
                settings.initialCapital || 0,
                settings.currency || 'USD',
                settings.maxRiskPerTrade || 2.0,
                settings.theme || 'dark'
            );
            settingsCount++;
        }
        await stmtSettings.finalize();
        console.log(`Migrated ${settingsCount} settings.`);
    }

    // Migrate Trades
    if (jsonData.trades) {
        const stmtTrades = await db.prepare(`
            INSERT INTO trades (
                id, username, symbol, direction, entryPrice, exitPrice, quantity, fees, stopLoss, takeProfit,
                strategy, emotion, mistake, notes, screenshot, date, isForex, pips, grossPnL, netPnL, rrRatio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let tradesCount = 0;
        for (const [username, userTrades] of Object.entries(jsonData.trades)) {
            for (const trade of userTrades) {
                await stmtTrades.run(
                    trade.id,
                    username,
                    trade.symbol || '',
                    trade.direction || '',
                    trade.entryPrice || 0,
                    trade.exitPrice || 0,
                    trade.quantity || 0,
                    trade.fees || 0,
                    trade.stopLoss || 0,
                    trade.takeProfit || 0,
                    trade.strategy || '',
                    trade.emotion || '',
                    trade.mistake || '',
                    trade.notes || '',
                    trade.screenshot || '',
                    trade.date || new Date().toISOString(),
                    trade.isForex ? 1 : 0,
                    trade.pips || 0,
                    trade.grossPnL || 0,
                    trade.netPnL || 0,
                    trade.rrRatio || 0
                );
                tradesCount++;
            }
        }
        await stmtTrades.finalize();
        console.log(`Migrated ${tradesCount} trades.`);
    }

    await db.close();
    console.log("Migration completed successfully!");
}

migrate().catch(err => {
    console.error("Migration failed:", err);
});
