const EthereumProvider = require('../providers/EthereumProvider');
const ContractDetector = require('./ContractDetector');
const Database = require('../storage/Database');
const config = require('../../config/config');
const logger = require('../utils/Logger');

class BlockScanner {
    constructor() {
        this.networkConfig = config.getActiveNetwork();
        this.scannerConfig = config.scanner;
        this.provider = null;
        this.detector = null;
        this.database = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentBlock = null;
        this.stats = {
            blocksProcessed: 0,
            contractsFound: 0,
            startTime: null,
            lastBlockTime: null,
            errors: 0
        };
    }

    async initialize() {
        try {
            logger.info('Initializing BlockScanner...', {
                network: this.networkConfig.name,
                mode: this.scannerConfig.scanMode
            });

            // Initialize database
            this.database = new Database();
            await this.database.initialize();

            // Initialize Ethereum provider
            this.provider = new EthereumProvider(this.networkConfig);
            await this.provider.initialize();

            // Initialize WebSocket if needed for real-time scanning
            if (this.scannerConfig.scanMode === 'realtime' || this.scannerConfig.scanMode === 'both') {
                await this.provider.initializeWebSocket();
            }

            // Initialize contract detector
            this.detector = new ContractDetector(this.provider);

            // Get network info
            const networkInfo = await this.provider.getNetworkInfo();
            logger.info('Network connection established', networkInfo);

            logger.info('BlockScanner initialized successfully');
            return true;

        } catch (error) {
            logger.error('Failed to initialize BlockScanner', { error: error.message });
            throw error;
        }
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Scanner is already running');
            return;
        }

        try {
            this.isRunning = true;
            this.stats.startTime = Date.now();

            logger.scannerStart(this.networkConfig, this.scannerConfig.scanMode);

            // Start scanning based on mode
            switch (this.scannerConfig.scanMode) {
                case 'realtime':
                    await this.startRealtimeScanning();
                    break;
                case 'historical':
                    await this.startHistoricalScanning();
                    break;
                case 'both':
                    await this.startBothModes();
                    break;
                default:
                    throw new Error(`Invalid scan mode: ${this.scannerConfig.scanMode}`);
            }

        } catch (error) {
            logger.scannerError(error, { mode: this.scannerConfig.scanMode });
            this.isRunning = false;
            throw error;
        }
    }

    async startRealtimeScanning() {
        logger.info('Starting real-time scanning...');

        try {
            // Subscribe to new blocks
            this.provider.onNewBlock(async (block) => {
                if (!this.isRunning || this.isPaused) return;

                await this.processBlock(block);
            });

            // Keep the process alive
            this.keepAlive();

        } catch (error) {
            logger.error('Real-time scanning failed', { error: error.message });
            throw error;
        }
    }

    async startHistoricalScanning() {
        logger.info('Starting historical scanning...');

        try {
            const { startBlock, endBlock } = await this.determineBlockRange();

            logger.info('Historical scan range determined', { startBlock, endBlock });

            await this.scanBlockRange(startBlock, endBlock);

            logger.info('Historical scanning completed', {
                blocksProcessed: this.stats.blocksProcessed,
                contractsFound: this.stats.contractsFound
            });

        } catch (error) {
            logger.error('Historical scanning failed', { error: error.message });
            throw error;
        }
    }

    async startBothModes() {
        logger.info('Starting combined historical + real-time scanning...');

        try {
            // First, do historical scanning
            await this.startHistoricalScanning();

            // Then switch to real-time
            logger.info('Switching to real-time mode...');
            await this.startRealtimeScanning();

        } catch (error) {
            logger.error('Combined scanning failed', { error: error.message });
            throw error;
        }
    }

    async determineBlockRange() {
        const latestBlock = await this.provider.getLatestBlockNumber();

        let startBlock = this.scannerConfig.startBlock;
        let endBlock = this.scannerConfig.endBlock;

        // Handle 'latest' keyword
        if (startBlock === 'latest') {
            startBlock = latestBlock;
        }
        if (endBlock === 'latest') {
            endBlock = latestBlock;
        }

        // Check for saved progress
        const progress = await this.database.getScanningProgress(this.networkConfig.name);
        if (progress && progress.last_scanned_block) {
            startBlock = Math.max(startBlock, progress.last_scanned_block + 1);
            logger.info('Resuming from saved progress', {
                lastScannedBlock: progress.last_scanned_block,
                newStartBlock: startBlock
            });
        }

        // Validate range
        if (startBlock > endBlock) {
            throw new Error(`Invalid block range: start (${startBlock}) > end (${endBlock})`);
        }

        return { startBlock, endBlock };
    }

    async scanBlockRange(startBlock, endBlock) {
        const totalBlocks = endBlock - startBlock + 1;
        const batchSize = this.scannerConfig.batchSize;
        let processedBlocks = 0;

        logger.info('Starting block range scan', {
            startBlock,
            endBlock,
            totalBlocks,
            batchSize
        });

        for (let currentStart = startBlock; currentStart <= endBlock; currentStart += batchSize) {
            if (!this.isRunning || this.isPaused) {
                logger.info('Scanning paused or stopped');
                break;
            }

            const currentEnd = Math.min(currentStart + batchSize - 1, endBlock);

            try {
                await this.processBatch(currentStart, currentEnd);
                processedBlocks += (currentEnd - currentStart + 1);

                // Update progress
                await this.database.updateScanningProgress(
                    this.networkConfig.name,
                    currentEnd,
                    this.scannerConfig.scanMode
                );

                // Log progress
                logger.batchProgress(processedBlocks, totalBlocks, currentStart, currentEnd);

                // Delay between batches to avoid rate limiting
                if (this.scannerConfig.batchDelay > 0) {
                    await this.sleep(this.scannerConfig.batchDelay);
                }

            } catch (error) {
                logger.error('Batch processing failed', {
                    startBlock: currentStart,
                    endBlock: currentEnd,
                    error: error.message
                });

                this.stats.errors++;

                // Continue with next batch after error
                continue;
            }
        }
    }

    async processBatch(startBlock, endBlock) {
        const startTime = Date.now();

        try {
            // Fetch blocks in batch
            const blockResults = await this.provider.getBatchBlocks(startBlock, endBlock);

            // Process each block
            const contractPromises = blockResults.map(({ block }) =>
                this.processBlock(block, false) // Don't log individual blocks in batch mode
            );

            await Promise.all(contractPromises);

            const duration = Date.now() - startTime;
            logger.performance('PROCESS_BATCH', duration, {
                startBlock,
                endBlock,
                blockCount: blockResults.length
            });

        } catch (error) {
            logger.error('Batch processing error', {
                startBlock,
                endBlock,
                error: error.message
            });
            throw error;
        }
    }

    async processBlock(block, logBlock = true) {
        if (!block) {
            logger.warn('Received null block');
            return;
        }

        const startTime = Date.now();
        this.currentBlock = block.number;
        this.stats.lastBlockTime = Date.now();

        try {
            // Detect contracts in this block
            const contracts = await this.detector.processBlock(block);

            // Save contracts to database
            if (contracts.length > 0) {
                await this.saveContracts(contracts);
                this.stats.contractsFound += contracts.length;
            }

            this.stats.blocksProcessed++;

            if (logBlock) {
                logger.newBlock(block.number, contracts.length);
            }

            const duration = Date.now() - startTime;
            logger.performance('PROCESS_BLOCK_COMPLETE', duration, {
                blockNumber: block.number,
                contractsFound: contracts.length
            });

        } catch (error) {
            logger.error('Block processing failed', {
                blockNumber: block.number,
                error: error.message
            });

            this.stats.errors++;
            throw error;
        }
    }

    async saveContracts(contracts) {
        const startTime = Date.now();

        try {
            // Save contracts in parallel
            const savePromises = contracts.map(async (contract) => {
                try {
                    await this.database.saveContract(contract);

                    // Save bytecode analysis if available
                    if (contract.analysis) {
                        await this.database.saveContractAnalysis(contract.analysis);
                    }

                    return true;
                } catch (error) {
                    logger.error('Failed to save contract', {
                        contractAddress: contract.address,
                        error: error.message
                    });
                    return false;
                }
            });

            const results = await Promise.all(savePromises);
            const savedCount = results.filter(Boolean).length;

            const duration = Date.now() - startTime;
            logger.dbOperation('SAVE_CONTRACTS', savedCount, duration);

            if (savedCount !== contracts.length) {
                logger.warn('Some contracts failed to save', {
                    total: contracts.length,
                    saved: savedCount,
                    failed: contracts.length - savedCount
                });
            }

        } catch (error) {
            logger.error('Contract saving failed', { error: error.message });
            throw error;
        }
    }

    async pause() {
        if (!this.isRunning) {
            logger.warn('Scanner is not running');
            return;
        }

        this.isPaused = true;
        logger.info('Scanner paused');
    }

    async resume() {
        if (!this.isRunning) {
            logger.warn('Scanner is not running');
            return;
        }

        this.isPaused = false;
        logger.info('Scanner resumed');
    }

    async stop() {
        if (!this.isRunning) {
            logger.warn('Scanner is not running');
            return;
        }

        logger.info('Stopping scanner...');
        this.isRunning = false;
        this.isPaused = false;

        try {
            // Disconnect providers
            if (this.provider) {
                await this.provider.disconnect();
            }

            // Close database
            if (this.database) {
                await this.database.close();
            }

            // Log final stats
            this.logFinalStats();

            logger.info('Scanner stopped successfully');

        } catch (error) {
            logger.error('Error stopping scanner', { error: error.message });
        }
    }

    getStats() {
        const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        const blocksPerSecond = runtime > 0 ? (this.stats.blocksProcessed / (runtime / 1000)).toFixed(2) : 0;

        return {
            ...this.stats,
            runtime,
            blocksPerSecond: parseFloat(blocksPerSecond),
            currentBlock: this.currentBlock,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            networkConfig: this.networkConfig,
            scannerConfig: this.scannerConfig
        };
    }

    logFinalStats() {
        const stats = this.getStats();
        logger.info('Scanner final statistics', {
            runtime: `${(stats.runtime / 1000).toFixed(2)}s`,
            blocksProcessed: stats.blocksProcessed,
            contractsFound: stats.contractsFound,
            blocksPerSecond: stats.blocksPerSecond,
            errors: stats.errors,
            network: this.networkConfig.name
        });
    }

    keepAlive() {
        // Keep the process alive for real-time scanning
        setInterval(() => {
            if (this.isRunning && !this.isPaused) {
                logger.debug('Scanner heartbeat', this.getStats());
            }
        }, 60000); // Log stats every minute
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Graceful shutdown handler
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGQUIT', () => shutdown('SIGQUIT'));
    }
}

module.exports = BlockScanner;