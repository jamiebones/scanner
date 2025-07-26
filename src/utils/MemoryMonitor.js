const logger = require('./Logger');

class MemoryMonitor {
    constructor() {
        this.monitoringInterval = null;
        this.memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
        this.isMonitoring = false;
    }

    startMonitoring(intervalMs = 60000) { // Default: check every minute
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        logger.info('Memory monitoring started');

        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, intervalMs);

        // Initial check
        this.checkMemoryUsage();
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger.info('Memory monitoring stopped');
    }

    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

        const memoryInfo = {
            rss: formatBytes(memUsage.rss), // Resident Set Size
            heapTotal: formatBytes(memUsage.heapTotal),
            heapUsed: formatBytes(memUsage.heapUsed),
            external: formatBytes(memUsage.external),
            arrayBuffers: formatBytes(memUsage.arrayBuffers || 0)
        };

        // Log memory usage
        logger.debug('Memory usage', memoryInfo);

        // Check for memory threshold breach
        if (memUsage.heapUsed > this.memoryThreshold) {
            logger.warn('High memory usage detected', {
                ...memoryInfo,
                threshold: formatBytes(this.memoryThreshold)
            });

            // Force garbage collection if available
            if (global.gc) {
                logger.info('Running garbage collection');
                global.gc();

                // Check memory after GC
                const afterGC = process.memoryUsage();
                logger.info('Memory after GC', {
                    heapUsed: formatBytes(afterGC.heapUsed),
                    freed: formatBytes(memUsage.heapUsed - afterGC.heapUsed)
                });
            }
        }

        return memoryInfo;
    }

    getMemoryStats() {
        return this.checkMemoryUsage();
    }

    // Check for potential memory leaks
    detectPotentialLeaks() {
        const memUsage = process.memoryUsage();
        const warnings = [];

        // Check heap usage vs total
        const heapUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
        if (heapUsageRatio > 0.9) {
            warnings.push('Heap usage is very high (>90%)');
        }

        // Check external memory
        if (memUsage.external > 100 * 1024 * 1024) { // 100MB
            warnings.push('High external memory usage detected');
        }

        // Check RSS vs heap
        const rssToHeapRatio = memUsage.rss / memUsage.heapTotal;
        if (rssToHeapRatio > 3) {
            warnings.push('RSS memory significantly higher than heap (potential leak)');
        }

        if (warnings.length > 0) {
            logger.warn('Potential memory issues detected', {
                warnings,
                memoryUsage: this.checkMemoryUsage()
            });
        }

        return warnings;
    }

    // Cleanup utility for arrays and objects
    static cleanupArray(arr, maxSize = 1000) {
        if (Array.isArray(arr) && arr.length > maxSize) {
            const removed = arr.splice(0, arr.length - maxSize);
            logger.debug(`Cleaned up array: removed ${removed.length} items, kept ${arr.length}`);
            return removed.length;
        }
        return 0;
    }

    static cleanupObject(obj, maxKeys = 1000) {
        if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            if (keys.length > maxKeys) {
                const keysToRemove = keys.slice(0, keys.length - maxKeys);
                keysToRemove.forEach(key => delete obj[key]);
                logger.debug(`Cleaned up object: removed ${keysToRemove.length} keys, kept ${Object.keys(obj).length}`);
                return keysToRemove.length;
            }
        }
        return 0;
    }
}

// Singleton instance
const memoryMonitor = new MemoryMonitor();

module.exports = {
    MemoryMonitor,
    memoryMonitor
};