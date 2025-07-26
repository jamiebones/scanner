# EVM Contract Scanner

A powerful JavaScript tool for scanning EVM-compatible blockchains to detect newly created smart contracts in real-time or historically.

## Features

### Core Scanner Features

- 🔍 **Multi-Network Support**: Ethereum, Polygon, BSC, and other EVM chains
- ⚡ **Real-time Monitoring**: Live detection of new contracts as blocks are mined
- 📊 **Historical Scanning**: Scan past blocks with resumable progress
- 🏭 **Factory Contract Detection**: Identifies contracts created by factory patterns
- � **Bytetcode Analysis**: Optional deep analysis of contract bytecode
- � **SQLhite Database**: Persistent storage with easy querying
- � **\*High Performance**: Parallel processing and batch optimization
- � **Probgress Tracking**: Resumable scans with checkpoint system
- 🛡️ **Robust Error Handling**: Continues operation despite individual failures

### React Frontend Features

- 📊 **Interactive Dashboard**: Real-time statistics, charts, and network information
- 🎛️ **Scanner Control**: Start, stop, pause, and configure scanning with a modern UI
- 📋 **Contract Explorer**: Browse, search, and filter discovered contracts
- 🔍 **Advanced Search**: Search by contract address, creator, or transaction hash
- 📈 **Live Charts**: Real-time visualization of contract discovery rates
- ⚙️ **Settings Management**: Configure networks, scanning parameters, and logging
- 🔔 **Real-time Notifications**: Instant feedback on scanner operations
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🌐 **WebSocket Integration**: Live updates without page refreshes

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd evm-contract-scanner

# Install core dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install server dependencies
cd ../server
npm install

# Return to root directory
cd ..

# Copy environment template
cp .env.example .env

# Edit .env with your RPC endpoints
nano .env
```

## Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Network Configuration
ACTIVE_NETWORK=ethereum
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
ETHEREUM_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/your-api-key

# Scanner Settings
SCAN_MODE=realtime
START_BLOCK=latest
END_BLOCK=latest
BATCH_SIZE=100
BATCH_DELAY=1000
ANALYZE_BYTECODE=false

# Database Settings
DB_PATH=./data/contracts.db

# Logging Settings
LOG_LEVEL=info
```

### Supported Networks

- **ethereum**: Ethereum Mainnet
- **polygon**: Polygon Mainnet
- **bsc**: Binance Smart Chain

## Usage

### React Frontend (Recommended)

The scanner now includes a modern React frontend for easy management:

```bash
# Install frontend dependencies
cd frontend
npm install

# Install server dependencies
cd ../server
npm install

# Start the backend API server
npm start

# In a new terminal, start the React frontend
cd ../frontend
npm start
```

The frontend will be available at `http://localhost:3000` and includes:

- 📊 **Real-time Dashboard** with live statistics and charts
- 🎛️ **Scanner Control Panel** with configuration options
- 📋 **Contract Browser** with search and filtering
- ⚙️ **Settings Management** for network and scanner configuration
- 🔔 **Real-time Notifications** for scanner events

### Command Line Interface

You can still use the CLI for automated deployments:

```bash
# Real-time scanning on Ethereum
node src/index.js --network ethereum --mode realtime

# Historical scan of specific block range
node src/index.js --mode historical --start-block 18000000 --end-block 18001000

# Combined mode with bytecode analysis
node src/index.js --mode both --analyze --batch-size 50

# Polygon network scanning
node src/index.js --network polygon --mode realtime
```

### CLI Options

```
-n, --network <name>        Network to scan (ethereum, polygon, bsc)
-m, --mode <mode>           Scanning mode (realtime, historical, both)
-s, --start-block <block>   Start block number or 'latest'
-e, --end-block <block>     End block number or 'latest'
-b, --batch-size <size>     Batch size for historical scanning
-a, --analyze               Enable bytecode analysis
    --stats                 Show current statistics
-h, --help                  Show help message
-v, --version               Show version information
```

### Interactive Mode

```bash
# Start interactive mode
node src/index.js --interactive

# Available commands in interactive mode:
scanner> start    # Start scanning
scanner> stop     # Stop scanning
scanner> pause    # Pause scanning
scanner> resume   # Resume scanning
scanner> stats    # Show statistics
scanner> help     # Show help
scanner> exit     # Exit
```

### Programmatic Usage

```javascript
const { EVMContractScanner } = require("./src/index.js");

async function main() {
  const scanner = new EVMContractScanner();

  // Initialize and start
  await scanner.initialize();
  await scanner.start();

  // Get statistics
  const stats = await scanner.getStats();
  console.log("Contracts found:", stats.contractsFound);

  // Control scanning
  await scanner.pause();
  await scanner.resume();
  await scanner.stop();
}

main().catch(console.error);
```

## Scanning Modes

### Real-time Mode

- Monitors new blocks as they're mined
- Uses WebSocket connections for instant notifications
- Ideal for live contract monitoring

### Historical Mode

- Scans a specific range of past blocks
- Processes blocks in configurable batches
- Resumable with automatic progress tracking
- Perfect for initial data collection

### Both Mode

- Combines historical catch-up with real-time monitoring
- First scans historical blocks, then switches to real-time
- Best for comprehensive coverage

## Database Schema

### Contracts Table

```sql
- address: Contract address (unique)
- creator_address: Address that created the contract
- transaction_hash: Creation transaction hash
- block_number: Block where contract was created
- block_timestamp: Block timestamp
- gas_used: Gas consumed for creation
- contract_size: Bytecode size in bytes
- bytecode_hash: SHA256 hash of bytecode
- network: Network name
- chain_id: Network chain ID
```

### Contract Analysis Table (Optional)

```sql
- contract_address: Reference to contract
- is_proxy: Whether contract is a proxy
- is_factory: Whether contract is a factory
- function_count: Estimated number of functions
- event_count: Estimated number of events
```

## Performance Tuning

### Batch Size

- **Small batches (10-50)**: Lower memory usage, more API calls
- **Large batches (100-500)**: Higher throughput, more memory usage
- **Recommended**: 100 for most use cases

### Batch Delay

- **No delay (0ms)**: Maximum speed, may hit rate limits
- **Short delay (500-1000ms)**: Good balance
- **Long delay (2000ms+)**: Conservative, avoids rate limits

### Network Considerations

- **Ethereum**: Slower block times (12s), can use larger batches
- **Polygon**: Faster blocks (2s), may need smaller batches
- **BSC**: Medium speed (3s), moderate batch sizes

## Monitoring & Logging

### Log Levels

- **debug**: Detailed operation logs
- **info**: General information and progress
- **warn**: Warnings and recoverable errors
- **error**: Critical errors

### Statistics

```javascript
{
  blocksProcessed: 1250,
  contractsFound: 45,
  runtime: 300000,
  blocksPerSecond: 4.17,
  currentBlock: 18500000,
  errors: 2,
  isRunning: true,
  isPaused: false
}
```

## Error Handling

The scanner includes robust error handling:

- **Network errors**: Automatic retry with exponential backoff
- **Rate limiting**: Configurable delays between requests
- **Block processing errors**: Continues with next block
- **Database errors**: Logs errors but continues operation
- **WebSocket disconnections**: Automatic reconnection

## API Rate Limits

### Recommended RPC Providers

- **Alchemy**: 300 requests/second (paid plans)
- **Infura**: 100,000 requests/day (free tier)
- **QuickNode**: Varies by plan
- **Public RPCs**: Often rate limited, use with caution

### Rate Limit Strategies

1. Use multiple RPC endpoints with load balancing
2. Implement request queuing
3. Add delays between batch requests
4. Monitor response times and adjust batch sizes

## Troubleshooting

### Common Issues

**"Chain ID mismatch" error**

- Verify RPC URL matches the configured network
- Check if RPC endpoint is responding correctly

**"Rate limit exceeded" errors**

- Increase `BATCH_DELAY` in configuration
- Reduce `BATCH_SIZE`
- Upgrade to paid RPC provider

**WebSocket connection failures**

- Verify WebSocket URL is correct
- Some providers require different endpoints for WS
- Check firewall settings

**Database locked errors**

- Ensure only one scanner instance is running
- Check file permissions on database directory

### Performance Issues

**Slow scanning speed**

- Increase batch size (if not hitting rate limits)
- Use faster RPC provider
- Enable parallel processing
- Check network latency to RPC provider

**High memory usage**

- Reduce batch size
- Disable bytecode analysis if not needed
- Monitor for memory leaks in long-running scans

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

## Roadmap

- [ ] PostgreSQL database support
- [ ] Web dashboard for monitoring
- [ ] Contract verification integration
- [ ] Advanced bytecode analysis
- [ ] Multi-chain scanning in parallel
- [ ] GraphQL API for querying contracts
- [ ] Docker containerization
- [ ] Kubernetes deployment manifests
