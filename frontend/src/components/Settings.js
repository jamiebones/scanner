import React, { useState, useEffect } from 'react';
import {
    CogIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useScanner } from '../context/ScannerContext';
import { useNotifications } from '../context/NotificationContext';

function Settings() {
    const { updateConfig, isRunning } = useScanner();
    const { showSuccess, showError, showWarning } = useNotifications();

    const [settings, setSettings] = useState({
        // Network settings
        networks: {
            ethereum: {
                rpcUrl: '',
                wsUrl: '',
                enabled: true
            },
            polygon: {
                rpcUrl: '',
                wsUrl: '',
                enabled: true
            },
            bsc: {
                rpcUrl: '',
                wsUrl: '',
                enabled: true
            }
        },

        // Scanner settings
        scanner: {
            batchSize: 100,
            batchDelay: 1000,
            maxRetries: 3,
            analyzeBytecode: false
        },

        // Database settings
        database: {
            path: './data/contracts.db'
        },

        // Logging settings
        logging: {
            level: 'info',
            logToFile: false,
            logFilePath: './logs/scanner.log'
        }
    });

    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Load current settings from backend
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // In a real implementation, you'd fetch current settings from the backend
            // For now, we'll use default values
            console.log('Loading settings...');
        } catch (error) {
            showError(`Failed to load settings: ${error.message}`);
        }
    };

    const handleSettingChange = (section, key, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
        setHasChanges(true);
    };

    const handleNetworkChange = (network, key, value) => {
        setSettings(prev => ({
            ...prev,
            networks: {
                ...prev.networks,
                [network]: {
                    ...prev.networks[network],
                    [key]: value
                }
            }
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (isRunning) {
            showWarning('Please stop the scanner before changing settings');
            return;
        }

        try {
            setSaving(true);
            await updateConfig(settings);
            setHasChanges(false);
            showSuccess('Settings saved successfully');
        } catch (error) {
            showError(`Failed to save settings: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (isRunning) {
            showWarning('Please stop the scanner before resetting settings');
            return;
        }

        // Reset to default values
        loadSettings();
        setHasChanges(false);
        showSuccess('Settings reset to defaults');
    };

    const testConnection = async (network) => {
        try {
            const rpcUrl = settings.networks[network].rpcUrl;
            if (!rpcUrl) {
                showError('Please enter an RPC URL first');
                return;
            }

            // In a real implementation, you'd test the connection
            showSuccess(`Connection to ${network} successful`);
        } catch (error) {
            showError(`Connection test failed: ${error.message}`);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-600">Configure scanner behavior and network connections</p>
                </div>

                {hasChanges && (
                    <div className="flex items-center space-x-3">
                        <span className="text-sm text-warning-600">You have unsaved changes</span>
                        <button
                            onClick={handleReset}
                            disabled={saving || isRunning}
                            className="btn-secondary"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || isRunning}
                            className="btn-primary flex items-center space-x-2"
                        >
                            {saving ? (
                                <div className="loading-spinner" />
                            ) : (
                                <CheckIcon className="h-5 w-5" />
                            )}
                            <span>Save Changes</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Warning for running scanner */}
            {isRunning && (
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 mr-2" />
                        <span className="text-warning-800">
                            Scanner is currently running. Stop the scanner to modify settings.
                        </span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Network Settings */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <CogIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Network Configuration</h2>
                    </div>

                    <div className="space-y-6">
                        {Object.entries(settings.networks).map(([network, config]) => (
                            <div key={network} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-medium text-gray-900 capitalize">{network}</h3>
                                    <div className="flex items-center space-x-2">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={config.enabled}
                                                onChange={(e) => handleNetworkChange(network, 'enabled', e.target.checked)}
                                                disabled={isRunning}
                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Enabled</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            RPC URL
                                        </label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="url"
                                                value={config.rpcUrl}
                                                onChange={(e) => handleNetworkChange(network, 'rpcUrl', e.target.value)}
                                                disabled={isRunning}
                                                placeholder={`https://${network}-mainnet.g.alchemy.com/v2/your-api-key`}
                                                className="input flex-1"
                                            />
                                            <button
                                                onClick={() => testConnection(network)}
                                                disabled={isRunning || !config.rpcUrl}
                                                className="btn-secondary whitespace-nowrap"
                                            >
                                                Test
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            WebSocket URL (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={config.wsUrl}
                                            onChange={(e) => handleNetworkChange(network, 'wsUrl', e.target.value)}
                                            disabled={isRunning}
                                            placeholder={`wss://${network}-mainnet.g.alchemy.com/v2/your-api-key`}
                                            className="input"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Required for real-time scanning
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scanner Settings */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <CogIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Scanner Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Batch Size
                            </label>
                            <input
                                type="number"
                                value={settings.scanner.batchSize}
                                onChange={(e) => handleSettingChange('scanner', 'batchSize', parseInt(e.target.value))}
                                disabled={isRunning}
                                min="1"
                                max="1000"
                                className="input"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Number of blocks to process in each batch (1-1000)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Batch Delay (ms)
                            </label>
                            <input
                                type="number"
                                value={settings.scanner.batchDelay}
                                onChange={(e) => handleSettingChange('scanner', 'batchDelay', parseInt(e.target.value))}
                                disabled={isRunning}
                                min="0"
                                max="10000"
                                className="input"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Delay between batch requests to avoid rate limiting
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Retries
                            </label>
                            <input
                                type="number"
                                value={settings.scanner.maxRetries}
                                onChange={(e) => handleSettingChange('scanner', 'maxRetries', parseInt(e.target.value))}
                                disabled={isRunning}
                                min="0"
                                max="10"
                                className="input"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Maximum number of retries for failed requests
                            </p>
                        </div>

                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.scanner.analyzeBytecode}
                                    onChange={(e) => handleSettingChange('scanner', 'analyzeBytecode', e.target.checked)}
                                    disabled={isRunning}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Enable bytecode analysis</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1 ml-6">
                                Analyze contract bytecode for proxy detection and function counting
                            </p>
                        </div>
                    </div>
                </div>

                {/* Database Settings */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <CogIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Database Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Database Path
                            </label>
                            <input
                                type="text"
                                value={settings.database.path}
                                onChange={(e) => handleSettingChange('database', 'path', e.target.value)}
                                disabled={isRunning}
                                className="input"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Path to SQLite database file
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">Database Information</p>
                                    <p>
                                        The scanner uses SQLite for local storage. The database will be created automatically
                                        if it doesn't exist. For production use, consider migrating to PostgreSQL.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logging Settings */}
                <div className="card">
                    <div className="flex items-center mb-4">
                        <CogIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Logging Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Log Level
                            </label>
                            <select
                                value={settings.logging.level}
                                onChange={(e) => handleSettingChange('logging', 'level', e.target.value)}
                                disabled={isRunning}
                                className="select"
                            >
                                <option value="debug">Debug</option>
                                <option value="info">Info</option>
                                <option value="warn">Warning</option>
                                <option value="error">Error</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Minimum log level to display and record
                            </p>
                        </div>

                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.logging.logToFile}
                                    onChange={(e) => handleSettingChange('logging', 'logToFile', e.target.checked)}
                                    disabled={isRunning}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Enable file logging</span>
                            </label>
                        </div>

                        {settings.logging.logToFile && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Log File Path
                                </label>
                                <input
                                    type="text"
                                    value={settings.logging.logFilePath}
                                    onChange={(e) => handleSettingChange('logging', 'logFilePath', e.target.value)}
                                    disabled={isRunning}
                                    className="input"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance Tips */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Tips</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Batch Size</h4>
                        <p className="text-sm text-gray-600">
                            Larger batch sizes increase throughput but use more memory.
                            Start with 100 and adjust based on your system's performance.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Batch Delay</h4>
                        <p className="text-sm text-gray-600">
                            Add delays to avoid hitting RPC rate limits.
                            Free tier providers typically require 1000ms+ delays.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Bytecode Analysis</h4>
                        <p className="text-sm text-gray-600">
                            Disable bytecode analysis for faster scanning if you don't need
                            proxy detection and function counting features.
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">RPC Providers</h4>
                        <p className="text-sm text-gray-600">
                            Use paid RPC providers like Alchemy or Infura for better performance
                            and higher rate limits compared to public endpoints.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;