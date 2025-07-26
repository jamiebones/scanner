#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting EVM Contract Scanner...\n');

// Start the backend server
console.log('📡 Starting backend API server...');
const backend = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit',
    shell: true
});

// Wait a moment for backend to start
setTimeout(() => {
    console.log('🎨 Starting React frontend...');
    const frontend = spawn('npm', ['start'], {
        cwd: path.join(__dirname, 'frontend'),
        stdio: 'inherit',
        shell: true
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        backend.kill('SIGINT');
        frontend.kill('SIGINT');
        process.exit(0);
    });

    frontend.on('close', (code) => {
        console.log(`Frontend process exited with code ${code}`);
        backend.kill('SIGINT');
        process.exit(code);
    });

}, 2000);

backend.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    process.exit(code);
});