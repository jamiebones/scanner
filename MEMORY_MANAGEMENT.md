# Memory Management & Leak Prevention

## Memory Leaks Fixed

### 1. **Uncleaned Intervals & Timeouts**

- ✅ Fixed `setInterval` in `BlockScanner.keepAlive()` - now properly cleared on stop
- ✅ Fixed `setTimeout` in `EthereumProvider.reconnectWebSocket()` - now tracked and cleared
- ✅ Fixed notification timeouts - now properly managed with IDs

### 2. **WebSocket Connection Leaks**

- ✅ Added proper cleanup in `EthereumProvider.disconnect()`
- ✅ Implemented reconnection timeout tracking
- ✅ Added heartbeat mechanism with cleanup

### 3. **Array Growth Prevention**

- ✅ `recentContracts` array limited to 50 items (`.slice(0, 49)`)
- ✅ Chart data limited to 20 data points (`.slice(-20)`)
- ✅ Batch processing prevents unbounded promise arrays

### 4. **Event Listener Cleanup**

- ✅ WebSocket event listeners properly removed on disconnect
- ✅ Process signal handlers properly implemented
- ✅ React useEffect cleanup functions implemented

## Memory Monitoring

### Automatic Monitoring

```javascript
// Memory monitoring starts automatically with scanner
memoryMonitor.startMonitoring(); // Checks every minute

// Manual memory check
const memStats = memoryMonitor.getMemoryStats();
console.log(memStats);
```

### Memory Thresholds

- **Warning Threshold**: 500MB heap usage
- **Automatic GC**: Triggered on high memory usage
- **Leak Detection**: RSS vs Heap ratio monitoring

### Memory Statistics Logged

- **RSS**: Resident Set Size (total memory)
- **Heap Total**: Total heap allocated
- **Heap Used**: Currently used heap
- **External**: External memory (buffers, etc.)
- **Array Buffers**: Memory used by array buffers

## Best Practices Implemented

### 1. **Interval & Timeout Management**

```javascript
// ✅ Good - Store reference and clear
this.heartbeatInterval = setInterval(() => {}, 60000);
clearInterval(this.heartbeatInterval);

// ❌ Bad - No cleanup
setInterval(() => {}, 60000);
```

### 2. **Array Size Limits**

```javascript
// ✅ Good - Limit array size
recentContracts: [action.payload, ...state.recentContracts.slice(0, 49)];

// ❌ Bad - Unbounded growth
recentContracts: [action.payload, ...state.recentContracts];
```

### 3. **Event Listener Cleanup**

```javascript
// ✅ Good - Cleanup in useEffect
useEffect(() => {
  const handler = () => {};
  socket.on("event", handler);
  return () => socket.off("event", handler);
}, []);
```

### 4. **Promise Management**

```javascript
// ✅ Good - Use Promise.allSettled for error handling
const results = await Promise.allSettled(promises);

// ✅ Good - Limit concurrent promises
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await Promise.all(batch.map(processItem));
}
```

## Production Monitoring

### Memory Alerts

Monitor these metrics in production:

- Heap usage > 80% of available memory
- RSS memory growing continuously
- High external memory usage
- Frequent garbage collection

### Recommended Tools

- **Node.js**: `--inspect` flag for debugging
- **PM2**: Built-in memory monitoring
- **New Relic/DataDog**: APM monitoring
- **Clinic.js**: Performance profiling

### Memory Optimization Commands

```bash
# Run with garbage collection logging
node --trace-gc src/index.js

# Run with memory inspection
node --inspect src/index.js

# Force garbage collection (development only)
node --expose-gc src/index.js
```

## Common Memory Leak Patterns to Avoid

### 1. **Uncleaned Timers**

```javascript
// ❌ Memory leak
setInterval(() => {
  // This will run forever
}, 1000);

// ✅ Proper cleanup
const interval = setInterval(() => {}, 1000);
// Later...
clearInterval(interval);
```

### 2. **Event Listener Accumulation**

```javascript
// ❌ Memory leak - listeners accumulate
socket.on("data", handler);

// ✅ Proper cleanup
socket.on("data", handler);
// Later...
socket.off("data", handler);
```

### 3. **Circular References**

```javascript
// ❌ Memory leak - circular reference
const obj1 = { ref: null };
const obj2 = { ref: obj1 };
obj1.ref = obj2;

// ✅ Break circular references
obj1.ref = null;
obj2.ref = null;
```

### 4. **Large Object Retention**

```javascript
// ❌ Memory leak - retains large objects
const cache = new Map();
cache.set(key, largeObject); // Never cleaned

// ✅ Implement cache limits
if (cache.size > 1000) {
  const firstKey = cache.keys().next().value;
  cache.delete(firstKey);
}
```

## Testing for Memory Leaks

### Load Testing

```bash
# Run scanner for extended period
npm start &
PID=$!

# Monitor memory usage
while kill -0 $PID 2>/dev/null; do
    ps -p $PID -o pid,vsz,rss,pcpu,pmem,time,comm
    sleep 60
done
```

### Memory Profiling

```javascript
// Add to development code
if (process.env.NODE_ENV === "development") {
  setInterval(() => {
    const usage = process.memoryUsage();
    console.log("Memory:", {
      rss: Math.round(usage.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + "MB",
    });
  }, 30000);
}
```

## Emergency Memory Management

### If Memory Usage is High

1. **Immediate**: Restart the scanner
2. **Short-term**: Reduce batch sizes
3. **Long-term**: Investigate with profiling tools

### Configuration Adjustments

```env
# Reduce memory usage
BATCH_SIZE=50          # Smaller batches
BATCH_DELAY=2000       # More delay between batches
ANALYZE_BYTECODE=false # Disable memory-intensive analysis
```

The application now has comprehensive memory leak prevention and monitoring! 🚀
