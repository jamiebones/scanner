const dotenvPath = require('path').join(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { security, sanitizeForResponse } = require('../config/security');

// Import scanner components
const BlockScanner = require('../src/scanner/BlockScanner');
const Database = require('../src/storage/Database');
const config = require('../config/config');
const logger = require('../src/utils/Logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: security.cors
});

// Security middleware
app.use((req, res, next) => {
    // Set security headers
    Object.entries(security.headers).forEach(([header, value]) => {
        res.setHeader(header, value);
    });
    next();
});

// Middleware
app.use(cors(security.cors));
app.use(express.json({ limit: security.validation.maxRequestSize }));
// Only serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// Global scanner instance
let scanner = null;
let database = null;

// Initialize database
async function initializeDatabase() {
    try {
        database = new Database();
        await database.initialize();
        logger.info('Database initialized for API server');
    } catch (error) {
        logger.error('Failed to initialize database for API server', { error: error.message });
        throw error;
    }
}

// Scanner status tracking
let scannerStatus = {
    isRunning: false,
    isPaused: false,
    network: config.getActiveNetwork().name,
    scanMode: config.scanner.scanMode,
    stats: {
        blocksProcessed: 0,
        contractsFound: 0,
        runtime: 0,
        blocksPerSecond: 0,
        currentBlock: null,
        errors: 0
    }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info('Client connected to WebSocket', { socketId: socket.id });

    // Send current status to new client
    socket.emit('scanner_status', scannerStatus);

    // Handle ping for heartbeat
    socket.on('ping', () => {
        socket.emit('pong');
    });

    socket.on('disconnect', (reason) => {
        logger.info('Client disconnected from WebSocket', {
            socketId: socket.id,
            reason
        });
    });
});

// Broadcast scanner updates
function broadcastUpdate(event, data) {
    io.emit(event, data);
}

// API Routes

// Get scanner status
app.get('/api/scanner/status', (req, res) => {
    res.json(scannerStatus);
});

// Start scanner
app.post('/api/scanner/start', async (req, res) => {
    try {
        if (scanner && scannerStatus.isRunning) {
            return res.status(400).json({ message: 'Scanner is already running' });
        }

        const startConfig = req.body || {};

        // Update config if provided
        if (startConfig.network) {
            config.scanner.activeNetwork = startConfig.network;
        }
        if (startConfig.mode) {
            config.scanner.scanMode = startConfig.mode;
        }
        if (startConfig.startBlock) {
            config.scanner.startBlock = startConfig.startBlock;
        }
        if (startConfig.endBlock) {
            config.scanner.endBlock = startConfig.endBlock;
        }
        if (startConfig.batchSize) {
            config.scanner.batchSize = startConfig.batchSize;
        }
        if (startConfig.batchDelay) {
            config.scanner.batchDelay = startConfig.batchDelay;
        }
        if (startConfig.analyzeBytecode !== undefined) {
            config.scanner.analyzeBytecode = startConfig.analyzeBytecode;
        }

        // Create new scanner instance
        scanner = new BlockScanner();
        await scanner.initialize();

        // Set up event listeners for real-time updates
        const originalProcessBlock = scanner.processBlock.bind(scanner);
        scanner.processBlock = async function (block, logBlock = true) {
            const result = await originalProcessBlock(block, logBlock);

            // Update status
            const stats = scanner.getStats();
            scannerStatus.stats = stats;
            scannerStatus.isRunning = stats.isRunning;
            scannerStatus.isPaused = stats.isPaused;

            // Broadcast updates
            broadcastUpdate('scanner_stats', stats);

            return result;
        };

        // Override saveContracts to broadcast new contracts
        const originalSaveContracts = scanner.saveContracts.bind(scanner);
        scanner.saveContracts = async function (contracts) {
            const result = await originalSaveContracts(contracts);

            // Broadcast new contracts
            for (const contract of contracts) {
                broadcastUpdate('new_contract', contract);
            }

            return result;
        };

        // Start scanner
        scanner.start().catch(error => {
            logger.error('Scanner error', { error: error.message });
            scannerStatus.isRunning = false;
            broadcastUpdate('scanner_status', scannerStatus);
        });

        scannerStatus.isRunning = true;
        scannerStatus.isPaused = false;
        scannerStatus.network = config.getActiveNetwork().name;
        scannerStatus.scanMode = config.scanner.scanMode;

        broadcastUpdate('scanner_status', scannerStatus);

        res.json({ message: 'Scanner started successfully', status: scannerStatus });

    } catch (error) {
        logger.error('Failed to start scanner', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Stop scanner
app.post('/api/scanner/stop', async (req, res) => {
    try {
        if (!scanner || !scannerStatus.isRunning) {
            return res.status(400).json({ message: 'Scanner is not running' });
        }

        await scanner.stop();
        scanner = null;

        scannerStatus.isRunning = false;
        scannerStatus.isPaused = false;

        broadcastUpdate('scanner_status', scannerStatus);

        res.json({ message: 'Scanner stopped successfully', status: scannerStatus });

    } catch (error) {
        logger.error('Failed to stop scanner', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Pause scanner
app.post('/api/scanner/pause', async (req, res) => {
    try {
        if (!scanner || !scannerStatus.isRunning) {
            return res.status(400).json({ message: 'Scanner is not running' });
        }

        await scanner.pause();
        scannerStatus.isPaused = true;

        broadcastUpdate('scanner_status', scannerStatus);

        res.json({ message: 'Scanner paused successfully', status: scannerStatus });

    } catch (error) {
        logger.error('Failed to pause scanner', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Resume scanner
app.post('/api/scanner/resume', async (req, res) => {
    try {
        if (!scanner || !scannerStatus.isRunning || !scannerStatus.isPaused) {
            return res.status(400).json({ message: 'Scanner is not paused' });
        }

        await scanner.resume();
        scannerStatus.isPaused = false;

        broadcastUpdate('scanner_status', scannerStatus);

        res.json({ message: 'Scanner resumed successfully', status: scannerStatus });

    } catch (error) {
        logger.error('Failed to resume scanner', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Get scanner statistics
app.get('/api/scanner/stats', (req, res) => {
    if (scanner) {
        const stats = scanner.getStats();
        scannerStatus.stats = stats;
        res.json(stats);
    } else {
        res.json(scannerStatus.stats);
    }
});

// Get recent contracts
app.get('/api/contracts/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const network = req.query.network || null;

        const contracts = await database.getRecentContracts(limit, network);
        res.json(contracts);

    } catch (error) {
        logger.error('Failed to get recent contracts', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Get contracts by creator
app.get('/api/contracts/creator/:address', async (req, res) => {
    try {
        const creatorAddress = req.params.address;
        const limit = parseInt(req.query.limit) || 50;

        const contracts = await database.getContractsByCreator(creatorAddress, limit);
        res.json(contracts);

    } catch (error) {
        logger.error('Failed to get contracts by creator', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Get contract statistics
app.get('/api/contracts/stats', async (req, res) => {
    try {
        const network = req.query.network || null;
        const stats = await database.getContractStats(network);
        res.json(stats);

    } catch (error) {
        logger.error('Failed to get contract stats', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Get network information
app.get('/api/network/info', async (req, res) => {
    try {
        if (scanner && scanner.provider) {
            const networkInfo = await scanner.provider.getNetworkInfo();
            broadcastUpdate('network_info', networkInfo);
            res.json(networkInfo);
        } else {
            res.json({
                name: config.getActiveNetwork().name,
                chainId: config.getActiveNetwork().chainId,
                latestBlock: null,
                gasPrice: null
            });
        }
    } catch (error) {
        logger.error('Failed to get network info', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Update configuration
app.post('/api/config/update', (req, res) => {
    try {
        if (scanner && scannerStatus.isRunning) {
            return res.status(400).json({ message: 'Cannot update config while scanner is running' });
        }

        const newConfig = req.body;

        // Update configuration (in a real implementation, you'd persist this)
        // For now, we'll just acknowledge the request

        res.json({ message: 'Configuration updated successfully' });

    } catch (error) {
        logger.error('Failed to update config', { error: error.message });
        res.status(500).json({ message: error.message });
    }
});

// Handle favicon requests
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// API status endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'EVM Contract Scanner API Server',
        status: 'running',
        version: '1.0.0'
    });
});

// Serve React app for all other routes (only in production)
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('API error', { error: error.message, path: req.path });
    res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();

        // Start server
        server.listen(PORT, () => {
            logger.info(`EVM Contract Scanner API server running on port ${PORT}`);
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Frontend available at http://localhost:${PORT}`);
            console.log(`🔌 WebSocket server running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down server...');

    if (scanner) {
        await scanner.stop();
    }

    if (database) {
        await database.close();
    }

    server.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
    });
});

startServer();