import React, { useEffect, useState } from 'react';
import {
    PlayIcon,
    PauseIcon,
    StopIcon,
    ChartBarIcon,
    CubeIcon,
    ClockIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useScanner } from '../context/ScannerContext';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

function Dashboard() {
    const {
        isConnected,
        isRunning,
        isPaused,
        stats,
        recentContracts,
        networkInfo,
        loading,
        error,
        startScanner,
        stopScanner,
        pauseScanner,
        resumeScanner,
        getStats,
        getRecentContracts,
        getNetworkInfo
    } = useScanner();

    const { showSuccess, showError } = useNotifications();
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        // Initial data load
        if (isConnected) {
            getStats();
            getRecentContracts();
            getNetworkInfo();
        }
    }, [isConnected, getStats, getRecentContracts, getNetworkInfo]);

    useEffect(() => {
        // Update chart data when stats change
        if (stats.blocksProcessed > 0) {
            setChartData(prev => {
                const newData = [...prev, {
                    time: new Date().toLocaleTimeString(),
                    contracts: stats.contractsFound,
                    blocks: stats.blocksProcessed,
                    speed: stats.blocksPerSecond
                }].slice(-20); // Keep last 20 data points
                return newData;
            });
        }
    }, [stats]);

    const handleStart = async () => {
        try {
            await startScanner();
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

    const formatRuntime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600">Monitor your EVM contract scanner in real-time</p>
                </div>

                {/* Control Buttons */}
                <div className="flex space-x-3">
                    {!isRunning ? (
                        <button
                            onClick={handleStart}
                            disabled={loading || !isConnected}
                            className="btn-success flex items-center space-x-2"
                        >
                            <PlayIcon className="h-5 w-5" />
                            <span>Start Scanner</span>
                        </button>
                    ) : (
                        <>
                            {isPaused ? (
                                <button
                                    onClick={handleResume}
                                    disabled={loading}
                                    className="btn-success flex items-center space-x-2"
                                >
                                    <PlayIcon className="h-5 w-5" />
                                    <span>Resume</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handlePause}
                                    disabled={loading}
                                    className="btn-warning flex items-center space-x-2"
                                >
                                    <PauseIcon className="h-5 w-5" />
                                    <span>Pause</span>
                                </button>
                            )}

                            <button
                                onClick={handleStop}
                                disabled={loading}
                                className="btn-danger flex items-center space-x-2"
                            >
                                <StopIcon className="h-5 w-5" />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-primary-100 rounded-lg">
                            <CubeIcon className="h-6 w-6 text-primary-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Contracts Found</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.contractsFound.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-success-100 rounded-lg">
                            <ChartBarIcon className="h-6 w-6 text-success-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Blocks Processed</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.blocksProcessed.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-warning-100 rounded-lg">
                            <ClockIcon className="h-6 w-6 text-warning-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Processing Speed</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.blocksPerSecond} b/s</p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center">
                        <div className="p-2 bg-danger-100 rounded-lg">
                            <ExclamationTriangleIcon className="h-6 w-6 text-danger-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Errors</p>
                            <p className="text-2xl font-bold text-gray-900">{stats.errors}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contracts Chart */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Contracts Discovery Rate</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Area
                                    type="monotone"
                                    dataKey="contracts"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.1}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Processing Speed Chart */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Speed</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="speed"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Contracts and Network Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Contracts */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Contracts</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                        {recentContracts.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No contracts found yet</p>
                        ) : (
                            recentContracts.slice(0, 10).map((contract, index) => (
                                <div key={contract.address || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {contract.address}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Block #{contract.block_number} • {contract.network}
                                        </p>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {contract.created_at && formatDistanceToNow(new Date(contract.created_at), { addSuffix: true })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Network Info */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Information</h3>
                    {networkInfo ? (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Network</span>
                                <span className="font-medium">{networkInfo.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Chain ID</span>
                                <span className="font-medium">{networkInfo.chainId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Latest Block</span>
                                <span className="font-medium">{networkInfo.latestBlock?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Current Block</span>
                                <span className="font-medium">{stats.currentBlock?.toLocaleString() || 'N/A'}</span>
                            </div>
                            {stats.runtime > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Runtime</span>
                                    <span className="font-medium">{formatRuntime(stats.runtime)}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">Network information not available</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;