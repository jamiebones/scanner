#!/usr/bin/env node

const BlockScanner = require('./scanner/BlockScanner');
const config = require('../config/config');
const logger = require('./utils/Logger');

class EVMContractScanner {
    constructor() {
        this.scanner = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Validate configuration
            config.validateConfig();

            // Create and initialize scanner
            this.scanner = new BlockScanner();
            await this.scanner.initialize();

            // Setup graceful shutdown
            this.scanner.setupGracefulShutdown();

            this.isInitialized = true;
            logger.info('EVM Contract Scanner initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize scanner', { error: error.message });
            process.exit(1);
        }
    }

    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Display startup information
            this.displayStartupInfo();

            // Start scanning
            await this.scanner.start();

        } catch (error) {
            logger.error('Scanner startup failed', { error: error.message });
            process.exit(1);
        }
    }

    displayStartupInfo() {
        const networkConfig = config.getActiveNetwork();
        const scannerConfig = config.scanner;

        console.log('\n' + '='.repeat(60));
        console.log('🔍 EVM CONTRACT SCANNER');
        console.log('='.repeat(60));
        console.log(`📡 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
        console.log(`🔄 Mode: ${scannerConfig.scanMode.toUpperCase()}`);
        console.log(`📦 Batch Size: ${scannerConfig.batchSize}`);
        console.log(`⏱️  Batch Delay: ${scannerConfig.batchDelay}ms`);
        console.log(`🔍 Bytecode Analysis: ${scannerConfig.analyzeBytecode ? 'ENABLED' : 'DISABLED'}`);
        console.log(`💾 Database: ${config.database.type} (${config.database.path})`);

        if (scannerConfig.scanMode === 'historical' || scannerConfig.scanMode === 'both') {
            console.log(`📊 Block Range: ${scannerConfig.startBlock} → ${scannerConfig.endBlock}`);
        }

        console.log('='.repeat(60));
        console.log('🚀 Starting scanner...\n');
    }

    async getStats() {
        if (!this.scanner) {
            return null;
        }
        return this.scanner.getStats();
    }

    async pause() {
        if (this.scanner) {
            await this.scanner.pause();
        }
    }

    async resume() {
        if (this.scanner) {
            await this.scanner.resume();
        }
    }

    async stop() {
        if (this.scanner) {
            await this.scanner.stop();
        }
    }
}

// CLI Interface
class CLI {
    constructor() {
        this.scanner = new EVMContractScanner();
    }

    parseArguments() {
        const args = process.argv.slice(2);
        const options = {};

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            switch (arg) {
                case '--network':
                case '-n':
                    options.network = args[++i];
                    break;
                case '--mode':
                case '-m':
                    options.mode = args[++i];
                    break;
                case '--start-block':
                case '-s':
                    options.startBlock = args[++i];
                    break;
                case '--end-block':
                case '-e':
                    options.endBlock = args[++i];
                    break;
                case '--batch-size':
                case '-b':
                    options.batchSize = parseInt(args[++i]);
                    break;
                case '--analyze':
                case '-a':
                    options.analyzeBytecode = true;
                    break;
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
                case '--version':
                case '-v':
                    this.showVersion();
                    process.exit(0);
                    break;
                case '--stats':
                    options.showStats = true;
                    break;
                default:
                    if (arg.startsWith('-')) {
                        console.error(`Unknown option: ${arg}`);
                        this.showHelp();
                        process.exit(1);
                    }
            }
        }

        return options;
    }

    applyOptions(options) {
        // Override config with CLI options
        if (options.network) {
            if (!config.networks[options.network]) {
                console.error(`Invalid network: ${options.network}`);
                console.error(`Available networks: ${Object.keys(config.networks).join(', ')}`);
                process.exit(1);
            }
            config.scanner.activeNetwork = options.network;
        }

        if (options.mode) {
            const validModes = ['realtime', 'historical', 'both'];
            if (!validModes.includes(options.mode)) {
                console.error(`Invalid mode: ${options.mode}`);
                console.error(`Valid modes: ${validModes.join(', ')}`);
                process.exit(1);
            }
            config.scanner.scanMode = options.mode;
        }

        if (options.startBlock) {
            config.scanner.startBlock = options.startBlock === 'latest' ? 'latest' : parseInt(options.startBlock);
        }

        if (options.endBlock) {
            config.scanner.endBlock = options.endBlock === 'latest' ? 'latest' : parseInt(options.endBlock);
        }

        if (options.batchSize) {
            config.scanner.batchSize = options.batchSize;
        }

        if (options.analyzeBytecode) {
            config.scanner.analyzeBytecode = true;
        }
    }

    showHelp() {
        console.log(`
🔍 EVM Contract Scanner - Help

USAGE:
  node src/index.js [OPTIONS]

OPTIONS:
  -n, --network <name>        Network to scan (ethereum, polygon, bsc)
  -m, --mode <mode>           Scanning mode (realtime, historical, both)
  -s, --start-block <block>   Start block number or 'latest'
  -e, --end-block <block>     End block number or 'latest'
  -b, --batch-size <size>     Batch size for historical scanning
  -a, --analyze               Enable bytecode analysis
      --stats                 Show current statistics
  -h, --help                  Show this help message
  -v, --version               Show version information

EXAMPLES:
  # Real-time scanning on Ethereum
  node src/index.js --network ethereum --mode realtime

  # Historical scan of specific block range
  node src/index.js --mode historical --start-block 18000000 --end-block 18001000

  # Combined mode with bytecode analysis
  node src/index.js --mode both --analyze --batch-size 50

  # Polygon network scanning
  node src/index.js --network polygon --mode realtime

ENVIRONMENT VARIABLES:
  See .env.example for all available environment variables.

NETWORKS:
  ethereum    - Ethereum Mainnet
  polygon     - Polygon Mainnet  
  bsc         - Binance Smart Chain

MODES:
  realtime    - Monitor new blocks as they're mined
  historical  - Scan a specific range of past blocks
  both        - Historical catch-up followed by real-time monitoring
`);
    }

    showVersion() {
        const packageJson = require('../package.json');
        console.log(`EVM Contract Scanner v${packageJson.version}`);
    }

    async showStats() {
        try {
            const stats = await this.scanner.getStats();
            if (!stats) {
                console.log('Scanner not running or no statistics available.');
                return;
            }

            console.log('\n' + '='.repeat(50));
            console.log('📊 SCANNER STATISTICS');
            console.log('='.repeat(50));
            console.log(`Status: ${stats.isRunning ? (stats.isPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED'}`);
            console.log(`Network: ${stats.networkConfig.name}`);
            console.log(`Mode: ${stats.scannerConfig.scanMode}`);
            console.log(`Runtime: ${(stats.runtime / 1000).toFixed(2)}s`);
            console.log(`Current Block: ${stats.currentBlock || 'N/A'}`);
            console.log(`Blocks Processed: ${stats.blocksProcessed}`);
            console.log(`Contracts Found: ${stats.contractsFound}`);
            console.log(`Processing Speed: ${stats.blocksPerSecond} blocks/sec`);
            console.log(`Errors: ${stats.errors}`);
            console.log('='.repeat(50) + '\n');

        } catch (error) {
            console.error('Failed to get statistics:', error.message);
        }
    }

    async run() {
        try {
            const options = this.parseArguments();

            // Handle special commands
            if (options.showStats) {
                await this.showStats();
                return;
            }

            // Apply CLI options to config
            this.applyOptions(options);

            // Start scanner
            await this.scanner.start();

        } catch (error) {
            logger.error('CLI execution failed', { error: error.message });
            process.exit(1);
        }
    }
}

// Interactive mode for development/testing
class InteractiveMode {
    constructor() {
        this.scanner = new EVMContractScanner();
        this.isRunning = false;
    }

    async start() {
        console.log('\n🔍 EVM Contract Scanner - Interactive Mode');
        console.log('Type "help" for available commands\n');

        // Initialize scanner
        await this.scanner.initialize();

        // Setup readline interface
        const readline = require('readline');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'scanner> '
        });

        this.rl.prompt();

        this.rl.on('line', async (input) => {
            await this.handleCommand(input.trim());
            this.rl.prompt();
        });

        this.rl.on('close', async () => {
            console.log('\nGoodbye!');
            await this.scanner.stop();
            process.exit(0);
        });
    }

    async handleCommand(command) {
        const [cmd, ...args] = command.split(' ');

        try {
            switch (cmd.toLowerCase()) {
                case 'start':
                    if (!this.isRunning) {
                        console.log('Starting scanner...');
                        await this.scanner.start();
                        this.isRunning = true;
                    } else {
                        console.log('Scanner is already running');
                    }
                    break;

                case 'stop':
                    if (this.isRunning) {
                        console.log('Stopping scanner...');
                        await this.scanner.stop();
                        this.isRunning = false;
                    } else {
                        console.log('Scanner is not running');
                    }
                    break;

                case 'pause':
                    await this.scanner.pause();
                    break;

                case 'resume':
                    await this.scanner.resume();
                    break;

                case 'stats':
                    const stats = await this.scanner.getStats();
                    console.log(JSON.stringify(stats, null, 2));
                    break;

                case 'help':
                    console.log(`
Available commands:
  start   - Start the scanner
  stop    - Stop the scanner
  pause   - Pause scanning
  resume  - Resume scanning
  stats   - Show current statistics
  help    - Show this help message
  exit    - Exit interactive mode
`);
                    break;

                case 'exit':
                case 'quit':
                    this.rl.close();
                    break;

                default:
                    if (command) {
                        console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
                    }
            }
        } catch (error) {
            console.error('Command failed:', error.message);
        }
    }
}

// Main execution
async function main() {
    // Check if running in interactive mode
    if (process.argv.includes('--interactive') || process.argv.includes('-i')) {
        const interactive = new InteractiveMode();
        await interactive.start();
    } else {
        // Run CLI mode
        const cli = new CLI();
        await cli.run();
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
});

// Export for programmatic use
module.exports = {
    EVMContractScanner,
    CLI,
    InteractiveMode
};

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Application startup failed', { error: error.message });
        process.exit(1);
    });
}