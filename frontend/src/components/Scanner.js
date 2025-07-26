import React, { useState, useEffect } from 'react';
import {
    PlayIcon,
    PauseIcon,
    StopIcon,
    CogIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useScanner } from '../context/ScannerContext';
import { useNotifications } from '../context/NotificationContext';

function Scanner() {
    const {
        isConnected,
        isRunning,
        isPaused,
        currentNetwork,
        scanMode,
        stats,
        loading,
        error,
        startScanner,
        stopScanner,
        pauseScanner,
        resumeScanner,
        getStats
    } = useScanner();

    const { showSuccess, showError } = useNotifications();

    const [config, setConfig] = useState({
        network: 'ethereum',
        mode: 'realtime',
        startBlock: 'latest',
        endBlock: 'latest',
        batchSize: 100,
        batchDelay: 1000,
        analyzeBytecode: false
    });

    useEffect(() => {
        // Update config with current scanner state
        setConfig(prev => ({
            ...prev,
            network: currentNetwork,
            mode: scanMode
        }));
    }, [currentNetwork, scanMode]);

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleStart = async () => {
        try {
            await startScanner(config);
            showSuccess('Scanner started successfully');
        } catch (error) {
            showError(`Failed to start scanner: ${error.message}`);
        }
    };

    const handleStop = async () => {
        try {
            await stopScanner();
            showSuccess('Scanner stopped successfully');
        } catch (error) {
            showError(`Failed to stop scanner: ${error.message}`);
        }
    };

    const handlePause = async () => {
        try {
            await pauseScanner();
            showSuccess('Scanner paused');
        } catch (error) {
            showError(`Failed to pause scanner: ${error.message}`);
        }
    };

    const handleResume = async () => {
        try {
            await resumeScanner();
            showSuccess('Scanner resumed');
        } catch (error) {
            showError(`Failed to resume scanner: ${error.message}`);
        }
    };

    const getStatusBadge = () => {
        if (!isConnected) {
            return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Disconnected</span>;
        }
        if (isRunning && !isPaused) {
            return <span className="px-2 py-1 text-xs font-medium bg-success-100 text-success-800 rounded-full">Running</span>;
        }
        if (isPaused) {
            return <span className="px-2 py-1 text-xs font-medium bg-warning-100 text-warning-800 rounded-full">Paused</span>;
        }
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Stopped</span>;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Scanner Control</h1>
                    <p className="text-gray-600">Configure and control the EVM contract scanner</p>
                </div>
                {getStatusBadge()}
            </div>

            {/* Connection Status */}
            {!isConnected && (
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 mr-2" />
                        <span className="text-warning-800">Not connected to scanner backend</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Panel */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <CogIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Network Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Network
                            </label>
                            <select
                                value={config.network}
                                onChange={(e) => handleConfigChange('network', e.target.value)}
                                disabled={isRunning}
                                className="select"
                            >
                                <option value="ethereum">Ethereum Mainnet</option>
                                <option value="polygon">Polygon Mainnet</option>
                                <option value="bsc">Binance Smart Chain</option>
                            </select>
                        </div>

                        {/* Scan Mode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Scan Mode
                            </label>
                            <select
                                value={config.mode}
                                onChange={(e) => handleConfigChange('mode', e.target.value)}
                                disabled={isRunning}
                                className="select"
                            >
                                <option value="realtime">Real-time</option>
                                <option value="historical">Historical</option>
                                <option value="both">Both</option>
                            </select>
                        </div>

                        {/* Block Range (for historical mode) */}
                        {(config.mode === 'historical' || config.mode === 'both') && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Start Block
                                        </label>
                                        <input
                                            type="text"
                                            value={config.startBlock}
                                            onChange={(e) => handleConfigChange('startBlock', e.target.value)}
                                            disabled={isRunning}
                                            placeholder="latest or block number"
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            End Block
                                        </label>
                                        <input
                                            type="text"
                                            value={config.endBlock}
                                            onChange={(e) => handleConfigChange('endBlock', e.target.value)}
                                            disabled={isRunning}
                                            placeholder="latest or block number"
                                            className="input"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Batch Size
                                        </label>
                                        <input
                                            type="number"
                                            value={config.batchSize}
                                            onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value))}
                                            disabled={isRunning}
                                            min="1"
                                            max="1000"
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Batch Delay (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={config.batchDelay}
                                            onChange={(e) => handleConfigChange('batchDelay', parseInt(e.target.value))}
                                            disabled={isRunning}
                                            min="0"
                                            max="10000"
                                            className="input"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Advanced Options */}
                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={config.analyzeBytecode}
                                    onChange={(e) => handleConfigChange('analyzeBytecode', e.target.checked)}
                                    disabled={isRunning}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Enable bytecode analysis</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Analyze contract bytecode for proxy detection and function counting
                            </p>
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="mt-6 flex space-x-3">
                        {!isRunning ? (
                            <button
                                onClick={handleStart}
                                disabled={loading}
                                className="btn-success flex items-center space-x-2 flex-1"
                            >
                                {loading ? (
                                    <div className="loading-spinner" />
                                ) : (
                                    <PlayIcon className="h-5 w-5" />
                                )}
                                <span>Start Scanner</span>
                            </button>
                        ) : (
                            <>
                                {isPaused ? (
                                    <button
                                        onClick={handleResume}
                                        disabled={loading}
                                        className="btn-success flex items-center space-x-2 flex-1"
                                    >
                                        <PlayIcon className="h-5 w-5" />
                                        <span>Resume</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handlePause}
                                        disabled={loading}
                                        className="btn-warning flex items-center space-x-2 flex-1"
                                    >
                                        <PauseIcon className="h-5 w-5" />
                                        <span>Pause</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleStop}
                                    disabled={loading}
                                    className="btn-danger flex items-center space-x-2 flex-1"
                                >
                                    <StopIcon className="h-5 w-5" />
                                    <span>Stop</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Status Panel */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <InformationCircleIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Status & Statistics</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Current Status */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Current Status</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Connection</span>
                                    <span className={`text-sm font-medium ${isConnected ? 'text-success-600' : 'text-danger-600'}`}>
                                        {isConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Scanner</span>
                                    <span className={`text-sm font-medium ${isRunning && !isPaused ? 'text-success-600' :
                                        isPaused ? 'text-warning-600' : 'text-gray-600'
                                        }`}>
                                        {isRunning && !isPaused ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Network</span>
                                    <span className="text-sm font-medium text-gray-900">{currentNetwork}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Mode</span>
                                    <span className="text-sm font-medium text-gray-900">{scanMode}</span>
                                </div>
                            </div>
                        </div>

                        {/* Statistics */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Statistics</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Contracts Found</span>
                                    <span className="text-sm font-medium text-gray-900">{stats.contractsFound.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Blocks Processed</span>
                                    <span className="text-sm font-medium text-gray-900">{stats.blocksProcessed.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Current Block</span>
                                    <span className="text-sm font-medium text-gray-900">{stats.currentBlock?.toLocaleString() || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Processing Speed</span>
                                    <span className="text-sm font-medium text-gray-900">{stats.blocksPerSecond} blocks/sec</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Errors</span>
                                    <span className={`text-sm font-medium ${stats.errors > 0 ? 'text-danger-600' : 'text-gray-900'}`}>
                                        {stats.errors}
                                    </span>
                                </div>
                                {stats.runtime > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Runtime</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {Math.floor(stats.runtime / 1000 / 60)}m {Math.floor((stats.runtime / 1000) % 60)}s
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-danger-800 mb-2">Error</h3>
                                <p className="text-sm text-danger-700">{error}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mode Information */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Scanning Modes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Real-time</h4>
                        <p className="text-sm text-gray-600">
                            Monitors new blocks as they're mined using WebSocket connections.
                            Ideal for live contract monitoring and immediate notifications.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Historical</h4>
                        <p className="text-sm text-gray-600">
                            Scans a specific range of past blocks in configurable batches.
                            Perfect for initial data collection and catching up on missed blocks.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Both</h4>
                        <p className="text-sm text-gray-600">
                            Combines historical catch-up with real-time monitoring.
                            First scans historical blocks, then switches to real-time mode.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Scanner;