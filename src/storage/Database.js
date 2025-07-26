const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const logger = require('../utils/Logger');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = config.database.path;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Connect to SQLite database
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Failed to connect to database', { error: err.message, path: this.dbPath });
                    throw err;
                }
                logger.info('Connected to SQLite database', { path: this.dbPath });
            });

            // Create tables
            await this.createTables();
            this.isInitialized = true;
            logger.info('Database initialized successfully');

        } catch (error) {
            logger.error('Database initialization failed', { error: error.message });
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
        -- Contracts table
        CREATE TABLE IF NOT EXISTS contracts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT UNIQUE NOT NULL,
          creator_address TEXT NOT NULL,
          transaction_hash TEXT NOT NULL,
          block_number INTEGER NOT NULL,
          block_hash TEXT NOT NULL,
          block_timestamp INTEGER NOT NULL,
          gas_used INTEGER,
          gas_price TEXT,
          contract_size INTEGER,
          bytecode_hash TEXT,
          network TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_contracts_address ON contracts(address);
        CREATE INDEX IF NOT EXISTS idx_contracts_creator ON contracts(creator_address);
        CREATE INDEX IF NOT EXISTS idx_contracts_block_number ON contracts(block_number);
        CREATE INDEX IF NOT EXISTS idx_contracts_network ON contracts(network);
        CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at);

        -- Contract analysis table (for bytecode analysis)
        CREATE TABLE IF NOT EXISTS contract_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract_address TEXT NOT NULL,
          bytecode_size INTEGER,
          is_proxy BOOLEAN DEFAULT FALSE,
          is_factory BOOLEAN DEFAULT FALSE,
          has_fallback BOOLEAN DEFAULT FALSE,
          has_receive BOOLEAN DEFAULT FALSE,
          function_count INTEGER DEFAULT 0,
          event_count INTEGER DEFAULT 0,
          analysis_version TEXT DEFAULT '1.0',
          analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contract_address) REFERENCES contracts(address)
        );

        CREATE INDEX IF NOT EXISTS idx_analysis_contract ON contract_analysis(contract_address);

        -- Scanning progress table (to track scanning state)
        CREATE TABLE IF NOT EXISTS scanning_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          network TEXT NOT NULL,
          last_scanned_block INTEGER NOT NULL,
          scan_mode TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_network ON scanning_progress(network);
      `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    logger.error('Failed to create database tables', { error: err.message });
                    reject(err);
                } else {
                    logger.dbOperation('CREATE_TABLES', null);
                    resolve();
                }
            });
        });
    }

    async saveContract(contractData) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const sql = `
        INSERT OR REPLACE INTO contracts (
          address, creator_address, transaction_hash, block_number, block_hash,
          block_timestamp, gas_used, gas_price, contract_size, bytecode_hash,
          network, chain_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

            const params = [
                contractData.address,
                contractData.creatorAddress,
                contractData.transactionHash,
                contractData.blockNumber,
                contractData.blockHash,
                contractData.blockTimestamp,
                contractData.gasUsed,
                contractData.gasPrice,
                contractData.contractSize,
                contractData.bytecodeHash,
                contractData.network,
                contractData.chainId
            ];

            this.db.run(sql, params, function (err) {
                const duration = Date.now() - startTime;

                if (err) {
                    logger.error('Failed to save contract', {
                        error: err.message,
                        contractAddress: contractData.address
                    });
                    reject(err);
                } else {
                    logger.dbOperation('INSERT_CONTRACT', 1, duration);
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async saveContractAnalysis(analysisData) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `
        INSERT OR REPLACE INTO contract_analysis (
          contract_address, bytecode_size, is_proxy, is_factory,
          has_fallback, has_receive, function_count, event_count,
          analysis_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const params = [
                analysisData.contractAddress,
                analysisData.bytecodeSize,
                analysisData.isProxy,
                analysisData.isFactory,
                analysisData.hasFallback,
                analysisData.hasReceive,
                analysisData.functionCount,
                analysisData.eventCount,
                analysisData.analysisVersion || '1.0'
            ];

            this.db.run(sql, params, function (err) {
                if (err) {
                    logger.error('Failed to save contract analysis', {
                        error: err.message,
                        contractAddress: analysisData.contractAddress
                    });
                    reject(err);
                } else {
                    logger.dbOperation('INSERT_ANALYSIS', 1);
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    async getContract(address) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `
        SELECT c.*, ca.* FROM contracts c
        LEFT JOIN contract_analysis ca ON c.address = ca.contract_address
        WHERE c.address = ?
      `;

            this.db.get(sql, [address], (err, row) => {
                if (err) {
                    logger.error('Failed to get contract', { error: err.message, address });
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getRecentContracts(limit = 100, network = null) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            let sql = `
        SELECT * FROM contracts
        ${network ? 'WHERE network = ?' : ''}
        ORDER BY created_at DESC
        LIMIT ?
      `;

            const params = network ? [network, limit] : [limit];

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Failed to get recent contracts', { error: err.message });
                    reject(err);
                } else {
                    logger.dbOperation('SELECT_RECENT', rows.length);
                    resolve(rows);
                }
            });
        });
    }

    async getContractsByCreator(creatorAddress, limit = 100) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM contracts
        WHERE creator_address = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

            this.db.all(sql, [creatorAddress, limit], (err, rows) => {
                if (err) {
                    logger.error('Failed to get contracts by creator', {
                        error: err.message,
                        creatorAddress
                    });
                    reject(err);
                } else {
                    logger.dbOperation('SELECT_BY_CREATOR', rows.length);
                    resolve(rows);
                }
            });
        });
    }

    async getContractStats(network = null) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `
        SELECT 
          COUNT(*) as total_contracts,
          COUNT(DISTINCT creator_address) as unique_creators,
          MIN(block_number) as first_block,
          MAX(block_number) as latest_block,
          network
        FROM contracts
        ${network ? 'WHERE network = ?' : ''}
        ${network ? '' : 'GROUP BY network'}
      `;

            const params = network ? [network] : [];

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Failed to get contract stats', { error: err.message });
                    reject(err);
                } else {
                    resolve(network ? rows[0] : rows);
                }
            });
        });
    }

    async updateScanningProgress(network, lastScannedBlock, scanMode) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `
        INSERT OR REPLACE INTO scanning_progress (network, last_scanned_block, scan_mode)
        VALUES (?, ?, ?)
      `;

            this.db.run(sql, [network, lastScannedBlock, scanMode], function (err) {
                if (err) {
                    logger.error('Failed to update scanning progress', { error: err.message });
                    reject(err);
                } else {
                    logger.dbOperation('UPDATE_PROGRESS', 1);
                    resolve();
                }
            });
        });
    }

    async getScanningProgress(network) {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM scanning_progress WHERE network = ?`;

            this.db.get(sql, [network], (err, row) => {
                if (err) {
                    logger.error('Failed to get scanning progress', { error: err.message });
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        logger.error('Error closing database', { error: err.message });
                    } else {
                        logger.info('Database connection closed');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = Database;