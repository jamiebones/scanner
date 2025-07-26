#!/bin/bash

echo "🔧 Setting up EVM Contract Scanner..."

# Install root dependencies
echo "📦 Installing core dependencies..."
npm install

# Install frontend dependencies
echo "🎨 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install server dependencies
echo "📡 Installing server dependencies..."
cd server
npm install
cd ..

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your RPC endpoints before running the scanner"
fi

# Create data directory
mkdir -p data
mkdir -p logs

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your RPC endpoints"
echo "2. Run 'npm run frontend' to start the React frontend"
echo "3. Or run 'npm start' for CLI mode"
echo ""
echo "Frontend will be available at: http://localhost:3000"