const { ethers } = require('ethers');
const config = require('../../config/config');
const logger = require('../utils/Logger');
const { maskSensitiveData } = require('../../config/security');

class EthereumProvider {
    constructor(networkConfig) {
        this.networkConfig = networkConfig;
        this.provider = null;
        this.wsProvider = null;
        this.isConnected = false;
        this.maxRetries = config.scanner.maxRetries;
        this.retryDelay = 1000; // Start with 1 second
        this.maxRetryDelay = 30000; // Max 30 seconds
    }

    async initialize() {
        try {
            // Initialize HTTP provider for regular RPC calls
            this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);

            // Test connection
            await this.testConnection();

            logger.info('Ethereum provider initialized', {
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId,
                rpcUrl: this.maskUrl(this.networkConfig.rpcUrl)
            });

            this.isConnected = true;
            return true;

        } catch (error) {
            logger.error('Failed to initialize Ethereum provider', {
                error: error.message,
                network: this.networkConfig.name
            });
            throw error;
        }
    }

    async initializeWebSocket() {
        try {
            if (!this.networkConfig.wsUrl) {
                logger.warn('WebSocket URL not configured, real-time monitoring disabled');
                return false;
            }

            this.wsProvider = new ethers.WebSocketProvider(this.networkConfig.wsUrl);

            // Test WebSocket connection
            await this.wsProvider.getNetwork();

            // Set up connection event handlers
            this.setupWebSocketHandlers();

            logger.info('WebSocket provider initialized', {
                network: this.networkConfig.name,
                wsUrl: this.maskUrl(this.networkConfig.wsUrl)
            });

            return true;

        } catch (error) {
            logger.error('Failed to initialize WebSocket provider', {
                error: error.message,
                network: this.networkConfig.name
            });
            return false;
        }
    }

    setupWebSocketHandlers() {
        if (!this.wsProvider) return;

        this.wsProvider.websocket.on('open', () => {
            logger.info('WebSocket connection opened');
        });

        this.wsProvider.websocket.on('close', (code, reason) => {
            logger.warn('WebSocket connection closed', { code, reason });
            this.reconnectWebSocket();
        });

        this.wsProvider.websocket.on('error', (error) => {
            logger.error('WebSocket error', { error: error.message });
        });
    }

    async reconnectWebSocket() {
        logger.info('Attempting to reconnect WebSocket...');
        try {
            await this.initializeWebSocket();
        } catch (error) {
            logger.error('WebSocket reconnection failed', { error: error.message });
            // Retry after delay
            setTimeout(() => this.reconnectWebSocket(), 5000);
        }
    }

    async testConnection() {
        const network = await this.provider.getNetwork();
        const blockNumber = await this.provider.getBlockNumber();

        if (Number(network.chainId) !== this.networkConfig.chainId) {
            throw new Error(`Chain ID mismatch: expected ${this.networkConfig.chainId}, got ${network.chainId}`);
        }

        logger.debug('Connection test successful', {
            chainId: Number(network.chainId),
            latestBlock: blockNumber
        });

        return { chainId: Number(network.chainId), blockNumber };
    }

    async withRetry(operation, context = {}) {
        let lastError;
        let delay = this.retryDelay;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const startTime = Date.now();
                const result = await operation();
                const duration = Date.now() - startTime;

                if (attempt > 0) {
                    logger.info(`Operation succeeded after ${attempt} retries`, context);
                }

                logger.performance(context.operation || 'RPC_CALL', duration, context);
                return result;

            } catch (error) {
                lastError = error;

                if (attempt < this.maxRetries) {
                    logger.rpcError(context.operation || 'RPC_CALL', error, attempt + 1);
                    await this.sleep(delay);
                    delay = Math.min(delay * 2, this.maxRetryDelay); // Exponential backoff
                }
            }
        }

        logger.error(`Operation failed after ${this.maxRetries} retries`, {
            ...context,
            error: lastError.message
        });
        throw lastError;
    }

    async getLatestBlockNumber() {
        return this.withRetry(
            () => this.provider.getBlockNumber(),
            { operation: 'getBlockNumber' }
        );
    }

    async getBlock(blockNumber, includeTransactions = true) {
        return this.withRetry(
            () => this.provider.getBlock(blockNumber, includeTransactions),
            { operation: 'getBlock', blockNumber }
        );
    }

    async getTransaction(txHash) {
        return this.withRetry(
            () => this.provider.getTransaction(txHash),
            { operation: 'getTransaction', txHash }
        );
    }

    async getTransactionReceipt(txHash) {
        if (!txHash || txHash === null || txHash === undefined) {
            throw new Error(`Invalid transaction hash: ${txHash}`);
        }

        return this.withRetry(
            () => this.provider.getTransactionReceipt(txHash),
            { operation: 'getTransactionReceipt', txHash }
        );
    }

    async getCode(address, blockTag = 'latest') {
        return this.withRetry(
            () => this.provider.getCode(address, blockTag),
            { operation: 'getCode', address, blockTag }
        );
    }

    async getBatchBlocks(startBlock, endBlock) {
        const blocks = [];
        const promises = [];

        for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
            promises.push(
                this.getBlock(blockNumber, true).then(block => ({
                    blockNumber,
                    block
                }))
            );
        }

        try {
            const results = await Promise.allSettled(promises);

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    blocks.push(result.value);
                } else {
                    logger.error('Failed to fetch block in batch', {
                        error: result.reason.message
                    });
                }
            }

            return blocks.sort((a, b) => a.blockNumber - b.blockNumber);

        } catch (error) {
            logger.error('Batch block fetch failed', {
                error: error.message,
                startBlock,
                endBlock
            });
            throw error;
        }
    }

    // WebSocket methods for real-time monitoring
    onNewBlock(callback) {
        if (!this.wsProvider) {
            throw new Error('WebSocket provider not initialized');
        }

        this.wsProvider.on('block', async (blockNumber) => {
            try {
                const block = await this.getBlock(blockNumber, true);
                callback(block);
            } catch (error) {
                logger.error('Error processing new block', {
                    blockNumber,
                    error: error.message
                });
            }
        });

        logger.info('Subscribed to new blocks');
    }

    onNewPendingTransaction(callback) {
        if (!this.wsProvider) {
            throw new Error('WebSocket provider not initialized');
        }

        this.wsProvider.on('pending', (txHash) => {
            callback(txHash);
        });

        logger.info('Subscribed to pending transactions');
    }

    // Utility methods
    isContractCreation(transaction) {
        return transaction.to === null || transaction.to === undefined;
    }

    async isContract(address) {
        try {
            const code = await this.getCode(address);
            return code !== '0x';
        } catch (error) {
            logger.error('Failed to check if address is contract', {
                address,
                error: error.message
            });
            return false;
        }
    }

    calculateContractAddress(creatorAddress, nonce) {
        return ethers.getCreateAddress({
            from: creatorAddress,
            nonce: nonce
        });
    }

    calculateCreate2Address(creatorAddress, salt, bytecodeHash) {
        return ethers.getCreate2Address(creatorAddress, salt, bytecodeHash);
    }

    maskUrl(url) {
        // Use centralized security masking
        return maskSensitiveData(url);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getNetworkInfo() {
        try {
            const network = await this.provider.getNetwork();
            const blockNumber = await this.getLatestBlockNumber();
            const gasPrice = await this.provider.getFeeData();

            return {
                name: network.name,
                chainId: Number(network.chainId),
                latestBlock: blockNumber,
                gasPrice: gasPrice.gasPrice?.toString(),
                maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
            };
        } catch (error) {
            logger.error('Failed to get network info', { error: error.message });
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.wsProvider) {
                await this.wsProvider.destroy();
                this.wsProvider = null;
                logger.info('WebSocket provider disconnected');
            }

            if (this.provider) {
                // HTTP provider doesn't need explicit disconnection
                this.provider = null;
                logger.info('HTTP provider disconnected');
            }

            this.isConnected = false;
        } catch (error) {
            logger.error('Error during provider disconnection', { error: error.message });
        }
    }
}

module.exports = EthereumProvider;