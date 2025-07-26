const { ethers } = require('ethers');
const crypto = require('crypto');
const config = require('../../config/config');
const logger = require('../utils/Logger');

class ContractDetector {
    constructor(provider) {
        this.provider = provider;
        this.networkConfig = config.getActiveNetwork();
        this.analyzeBytecode = config.scanner.analyzeBytecode;
    }

    async processBlock(block) {
        const startTime = Date.now();
        const contracts = [];

        try {
            if (!block || !block.transactions) {
                logger.warn('Invalid block data received', { blockNumber: block?.number });
                return contracts;
            }

            // Filter out invalid transactions
            const validTransactions = block.transactions.filter(tx => {
                if (!tx || !tx.hash) {
                    logger.debug('Skipping invalid transaction', {
                        blockNumber: block.number,
                        hasTransaction: !!tx,
                        hasHash: !!tx?.hash
                    });
                    return false;
                }
                return true;
            });

            logger.debug(`Processing block #${block.number} with ${validTransactions.length}/${block.transactions.length} valid transactions`);

            // Process transactions in parallel for better performance
            const contractPromises = validTransactions.map((tx, index) =>
                this.processTransaction(tx, block).catch(error => {
                    logger.error('Error processing transaction', {
                        txHash: tx?.hash || 'unknown',
                        txIndex: index,
                        blockNumber: block.number,
                        error: error.message
                    });
                    return null; // Return null for failed transactions
                })
            );

            const results = await Promise.all(contractPromises);

            // Filter out null results and flatten arrays
            for (const result of results) {
                if (result) {
                    if (Array.isArray(result)) {
                        contracts.push(...result);
                    } else {
                        contracts.push(result);
                    }
                }
            }

            const duration = Date.now() - startTime;
            logger.performance('PROCESS_BLOCK', duration, {
                blockNumber: block.number,
                transactionCount: block.transactions.length,
                contractsFound: contracts.length
            });

            if (contracts.length > 0) {
                logger.newBlock(block.number, contracts.length);
            }

            return contracts;

        } catch (error) {
            logger.error('Error processing block', {
                blockNumber: block?.number,
                error: error.message
            });
            return contracts;
        }
    }

    async processTransaction(transaction, block) {
        try {
            // Validate transaction object
            if (!transaction || !transaction.hash) {
                logger.debug('Invalid transaction object', {
                    hasTransaction: !!transaction,
                    hasHash: !!transaction?.hash,
                    blockNumber: block?.number
                });
                return null;
            }

            // Check if this is a contract creation transaction
            if (!this.provider.isContractCreation(transaction)) {
                return null;
            }

            // Get transaction receipt to find the contract address
            const receipt = await this.provider.getTransactionReceipt(transaction.hash);

            if (!receipt) {
                logger.warn('No receipt found for transaction', { txHash: transaction.hash });
                return null;
            }

            // Check if transaction was successful
            if (receipt.status !== 1) {
                logger.debug('Contract creation transaction failed', {
                    txHash: transaction.hash,
                    status: receipt.status
                });
                return null;
            }

            const contracts = [];

            // Primary contract creation
            if (receipt.contractAddress) {
                const contractData = await this.extractContractData(
                    transaction,
                    receipt,
                    block,
                    receipt.contractAddress
                );

                if (contractData) {
                    contracts.push(contractData);

                    logger.contractFound(
                        contractData.address,
                        contractData.creatorAddress,
                        contractData.blockNumber,
                        contractData.transactionHash
                    );
                }
            }

            // Check for additional contracts created via CREATE2 or factory patterns
            const additionalContracts = await this.detectFactoryContracts(receipt, transaction, block);
            contracts.push(...additionalContracts);

            return contracts;

        } catch (error) {
            logger.error('Error processing transaction', {
                txHash: transaction.hash,
                error: error.message
            });
            return null;
        }
    }

    async extractContractData(transaction, receipt, block, contractAddress) {
        try {
            // Get contract bytecode
            const bytecode = await this.provider.getCode(contractAddress);

            if (!bytecode || bytecode === '0x') {
                logger.debug('No bytecode found for contract', { address: contractAddress });
                return null;
            }

            // Calculate bytecode hash for deduplication
            const bytecodeHash = crypto.createHash('sha256').update(bytecode).digest('hex');

            const contractData = {
                address: contractAddress.toLowerCase(),
                creatorAddress: transaction.from.toLowerCase(),
                transactionHash: transaction.hash,
                blockNumber: block.number,
                blockHash: block.hash,
                blockTimestamp: block.timestamp,
                gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) : null,
                gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : null,
                contractSize: Math.floor((bytecode.length - 2) / 2), // Remove '0x' and convert to bytes
                bytecodeHash: bytecodeHash,
                network: this.networkConfig.name,
                chainId: this.networkConfig.chainId
            };

            // Add bytecode analysis if enabled
            if (this.analyzeBytecode) {
                contractData.analysis = await this.analyzeBytecode(bytecode, contractAddress);
            }

            return contractData;

        } catch (error) {
            logger.error('Error extracting contract data', {
                contractAddress,
                txHash: transaction.hash,
                error: error.message
            });
            return null;
        }
    }

    async detectFactoryContracts(receipt, transaction, block) {
        const contracts = [];

        try {
            // Look for contract creation events in logs
            for (const log of receipt.logs) {
                // Common factory contract event signatures
                const contractCreationTopics = [
                    '0x4db17dd5e4732fb6da34a148104a592783ca119a1e7bb8829eba6cbadef0b511', // ContractCreated
                    '0x27b8e3132afa95254770e1c1d214eafde52bc47d1b6e1f5dfcb2d2c3c8b9f8c1', // NewContract
                    '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0'  // OwnershipTransferred (often emitted on creation)
                ];

                if (contractCreationTopics.includes(log.topics[0])) {
                    const contractAddress = await this.extractAddressFromLog(log);

                    if (contractAddress && await this.provider.isContract(contractAddress)) {
                        const contractData = await this.extractContractData(
                            transaction,
                            receipt,
                            block,
                            contractAddress
                        );

                        if (contractData) {
                            contractData.creationType = 'factory';
                            contracts.push(contractData);

                            logger.contractFound(
                                contractData.address,
                                contractData.creatorAddress,
                                contractData.blockNumber,
                                contractData.transactionHash
                            );
                        }
                    }
                }
            }

            // Look for CREATE2 patterns in transaction data
            if (transaction.data && transaction.data.length > 10) {
                const create2Contracts = await this.detectCreate2Contracts(transaction, receipt, block);
                contracts.push(...create2Contracts);
            }

        } catch (error) {
            logger.error('Error detecting factory contracts', {
                txHash: transaction.hash,
                error: error.message
            });
        }

        return contracts;
    }

    async extractAddressFromLog(log) {
        try {
            // Try to extract address from different log positions
            if (log.topics.length > 1) {
                // Address might be in topics[1] (indexed parameter)
                const topic = log.topics[1];
                if (topic && topic.length === 66) { // 0x + 64 hex chars
                    return '0x' + topic.slice(-40); // Last 20 bytes
                }
            }

            // Address might be in log data
            if (log.data && log.data.length >= 66) {
                // Try to find address pattern in data
                const addressMatch = log.data.match(/0x[a-fA-F0-9]{40}/);
                if (addressMatch) {
                    return addressMatch[0];
                }
            }

            return null;
        } catch (error) {
            logger.debug('Error extracting address from log', { error: error.message });
            return null;
        }
    }

    async detectCreate2Contracts(transaction, receipt, block) {
        const contracts = [];

        try {
            // CREATE2 opcode signature: 0xf5 (CREATE2)
            if (transaction.data.includes('f5')) {
                // This is a simplified detection - in practice, you'd need more sophisticated bytecode analysis
                logger.debug('Potential CREATE2 transaction detected', { txHash: transaction.hash });

                // Look for new contract addresses in the receipt logs
                for (const log of receipt.logs) {
                    if (log.address && log.address !== transaction.to) {
                        if (await this.provider.isContract(log.address)) {
                            const contractData = await this.extractContractData(
                                transaction,
                                receipt,
                                block,
                                log.address
                            );

                            if (contractData) {
                                contractData.creationType = 'create2';
                                contracts.push(contractData);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.debug('Error detecting CREATE2 contracts', { error: error.message });
        }

        return contracts;
    }

    async analyzeContractBytecode(bytecode, contractAddress) {
        try {
            const analysis = {
                contractAddress: contractAddress.toLowerCase(),
                bytecodeSize: Math.floor((bytecode.length - 2) / 2),
                isProxy: false,
                isFactory: false,
                hasFallback: false,
                hasReceive: false,
                functionCount: 0,
                eventCount: 0,
                analysisVersion: '1.0'
            };

            // Detect proxy patterns
            analysis.isProxy = this.detectProxyPattern(bytecode);

            // Detect factory patterns
            analysis.isFactory = this.detectFactoryPattern(bytecode);

            // Detect fallback function (0x)
            analysis.hasFallback = bytecode.includes('6080604052') || bytecode.includes('6060604052');

            // Detect receive function
            analysis.hasReceive = bytecode.includes('80156100') || bytecode.includes('361561');

            // Estimate function count (simplified - count function selectors)
            const functionSelectors = bytecode.match(/63[a-fA-F0-9]{8}/g);
            analysis.functionCount = functionSelectors ? functionSelectors.length : 0;

            // Estimate event count (simplified - count event signatures)
            const eventSignatures = bytecode.match(/a[0-4][a-fA-F0-9]{62}/g);
            analysis.eventCount = eventSignatures ? eventSignatures.length : 0;

            return analysis;

        } catch (error) {
            logger.error('Error analyzing contract bytecode', {
                contractAddress,
                error: error.message
            });
            return null;
        }
    }

    detectProxyPattern(bytecode) {
        // Common proxy patterns
        const proxyPatterns = [
            '363d3d373d3d3d363d73', // Minimal proxy (EIP-1167)
            '3d602d80600a3d3981f3', // Another proxy pattern
            '36603057343d52307f',   // Delegatecall proxy
        ];

        return proxyPatterns.some(pattern => bytecode.includes(pattern));
    }

    detectFactoryPattern(bytecode) {
        // Factory patterns - look for CREATE or CREATE2 opcodes
        const factoryPatterns = [
            'f0', // CREATE opcode
            'f5', // CREATE2 opcode
        ];

        return factoryPatterns.some(pattern => bytecode.includes(pattern));
    }

    // Utility method to validate contract address
    isValidAddress(address) {
        try {
            return ethers.isAddress(address);
        } catch {
            return false;
        }
    }

    // Get detector statistics
    getStats() {
        return {
            networkConfig: this.networkConfig,
            analyzeBytecode: this.analyzeBytecode,
            detectorVersion: '1.0'
        };
    }
}

module.exports = ContractDetector;