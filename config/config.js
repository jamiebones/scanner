require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Debug logging removed for security

const config = {
    // Network configurations
    networks: {
        ethereum: {
            name: 'Ethereum Mainnet',
            rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
            wsUrl: process.env.ETHEREUM_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/your-api-key',
            chainId: 1,
            blockTime: 12000 // 12 seconds average
        },
        polygon: {
            name: 'Polygon Mainnet',
            rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
            wsUrl: process.env.POLYGON_WS_URL || 'wss://polygon-mainnet.g.alchemy.com/v2/your-api-key',
            chainId: 137,
            blockTime: 2000 // 2 seconds average
        },
        bsc: {
            name: 'Binance Smart Chain',
            rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            wsUrl: process.env.BSC_WS_URL || 'wss://bsc-ws-node.nariox.org:443',
            chainId: 56,
            blockTime: 3000 // 3 seconds average
        }
    },

    // Scanner settings
    scanner: {
        // Which network to scan (default: ethereum)
        activeNetwork: process.env.ACTIVE_NETWORK || 'ethereum',

        // Scanning mode: 'realtime', 'historical', or 'both'
        scanMode: process.env.SCAN_MODE || 'realtime',

        // For historical scanning
        startBlock: parseInt(process.env.START_BLOCK) || 'latest',
        endBlock: parseInt(process.env.END_BLOCK) || 'latest',

        // Batch size for historical scanning
        batchSize: parseInt(process.env.BATCH_SIZE) || 100,

        // Delay between batch requests (ms)
        batchDelay: parseInt(process.env.BATCH_DELAY) || 1000,

        // Maximum retries for failed requests
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,

        // Enable contract bytecode analysis
        analyzeBytecode: process.env.ANALYZE_BYTECODE === 'true' || false
    },

    // Database settings
    database: {
        type: process.env.DB_TYPE || 'sqlite',
        path: process.env.DB_PATH || './data/contracts.db',
        // For future PostgreSQL support
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    },

    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
        logToFile: process.env.LOG_TO_FILE === 'true' || false,
        logFilePath: process.env.LOG_FILE_PATH || './logs/scanner.log'
    }
};

// Validate configuration
function validateConfig() {
    const activeNetwork = config.networks[config.scanner.activeNetwork];
    if (!activeNetwork) {
        throw new Error(`Invalid active network: ${config.scanner.activeNetwork}`);
    }

    if (!activeNetwork.rpcUrl || activeNetwork.rpcUrl.includes('your-api-key')) {
        console.warn(`Warning: Using default RPC URL for ${activeNetwork.name}. Consider setting a custom RPC endpoint.`);
    }

    return true;
}

module.exports = {
    ...config,
    validateConfig,
    getActiveNetwork: () => config.networks[config.scanner.activeNetwork]
};