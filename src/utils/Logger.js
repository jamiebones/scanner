const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

class Logger {
    constructor() {
        this.logLevel = config.logging.level;
        this.logToFile = config.logging.logToFile;
        this.logFilePath = config.logging.logFilePath;

        // Log levels with priority (higher number = higher priority)
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        // Initialize log file if needed
        if (this.logToFile) {
            this.initializeLogFile();
        }
    }

    initializeLogFile() {
        try {
            const logDir = path.dirname(this.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Create log file if it doesn't exist
            if (!fs.existsSync(this.logFilePath)) {
                fs.writeFileSync(this.logFilePath, '');
            }
        } catch (error) {
            console.error('Failed to initialize log file:', error.message);
            this.logToFile = false;
        }
    }

    shouldLog(level) {
        return this.levels[level] >= this.levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const levelUpper = level.toUpperCase().padEnd(5);

        let formattedMessage = `[${timestamp}] ${levelUpper} ${message}`;

        if (data) {
            if (typeof data === 'object') {
                formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` ${data}`;
            }
        }

        return formattedMessage;
    }

    writeToFile(formattedMessage) {
        if (this.logToFile) {
            try {
                fs.appendFileSync(this.logFilePath, formattedMessage + '\n');
            } catch (error) {
                console.error('Failed to write to log file:', error.message);
            }
        }
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, data);

        // Console output with colors
        switch (level) {
            case 'debug':
                console.log('\x1b[36m%s\x1b[0m', formattedMessage); // Cyan
                break;
            case 'info':
                console.log('\x1b[32m%s\x1b[0m', formattedMessage); // Green
                break;
            case 'warn':
                console.log('\x1b[33m%s\x1b[0m', formattedMessage); // Yellow
                break;
            case 'error':
                console.log('\x1b[31m%s\x1b[0m', formattedMessage); // Red
                break;
            default:
                console.log(formattedMessage);
        }

        // Write to file if enabled
        this.writeToFile(formattedMessage);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    // Special methods for scanner-specific logging
    scannerStart(network, mode) {
        this.info(`🚀 Scanner started`, {
            network: network.name,
            chainId: network.chainId,
            mode: mode,
            timestamp: new Date().toISOString()
        });
    }

    newBlock(blockNumber, contractsFound = 0) {
        this.info(`📦 New block processed: #${blockNumber}`, {
            contractsFound,
            blockNumber
        });
    }

    contractFound(contractAddress, creatorAddress, blockNumber, txHash) {
        this.info(`🎯 New contract detected: ${contractAddress}`, {
            contractAddress,
            creatorAddress,
            blockNumber,
            transactionHash: txHash,
            timestamp: new Date().toISOString()
        });
    }

    scannerError(error, context = {}) {
        this.error(`❌ Scanner error: ${error.message}`, {
            error: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }

    rpcError(method, error, retryCount = 0) {
        this.warn(`🔄 RPC error for ${method} (retry ${retryCount})`, {
            method,
            error: error.message,
            retryCount
        });
    }

    batchProgress(processed, total, startBlock, endBlock) {
        const percentage = ((processed / total) * 100).toFixed(1);
        this.info(`📊 Batch progress: ${percentage}% (${processed}/${total})`, {
            processed,
            total,
            percentage,
            currentRange: `${startBlock}-${endBlock}`
        });
    }

    // Performance logging
    performance(operation, duration, details = {}) {
        this.debug(`⏱️  Performance: ${operation} took ${duration}ms`, {
            operation,
            duration,
            ...details
        });
    }

    // Database operations
    dbOperation(operation, recordCount = null, duration = null) {
        const message = recordCount !== null
            ? `💾 DB ${operation}: ${recordCount} records`
            : `💾 DB ${operation}`;

        const data = { operation };
        if (recordCount !== null) data.recordCount = recordCount;
        if (duration !== null) data.duration = duration;

        this.debug(message, data);
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;