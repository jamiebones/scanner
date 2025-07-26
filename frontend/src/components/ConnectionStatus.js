import React from 'react';
import {
    WifiIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useScanner } from '../context/ScannerContext';

function ConnectionStatus() {
    const {
        isConnected,
        reconnectAttempts,
        maxReconnectAttempts,
        reconnectManually,
        error
    } = useScanner();

    // Don't show anything if connected and no errors
    if (isConnected && !error) {
        return null;
    }

    const isReconnecting = reconnectAttempts > 0 && reconnectAttempts < maxReconnectAttempts;
    const hasFailedReconnection = reconnectAttempts >= maxReconnectAttempts;

    return (
        <div className="fixed top-16 right-4 z-50 max-w-sm">
            {!isConnected && (
                <div className={`
          flex items-center p-3 rounded-lg shadow-lg border
          ${isReconnecting
                        ? 'bg-warning-50 border-warning-200 text-warning-800'
                        : hasFailedReconnection
                            ? 'bg-danger-50 border-danger-200 text-danger-800'
                            : 'bg-gray-50 border-gray-200 text-gray-800'
                    }
        `}>
                    <div className="flex-shrink-0 mr-3">
                        {isReconnecting ? (
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : hasFailedReconnection ? (
                            <ExclamationTriangleIcon className="h-5 w-5" />
                        ) : (
                            <WifiIcon className="h-5 w-5" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                            {isReconnecting
                                ? `Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`
                                : hasFailedReconnection
                                    ? 'Connection Lost'
                                    : 'Disconnected'
                            }
                        </p>
                        <p className="text-xs mt-1">
                            {isReconnecting
                                ? 'Attempting to restore connection'
                                : hasFailedReconnection
                                    ? 'Unable to connect to server'
                                    : 'Not connected to scanner backend'
                            }
                        </p>
                    </div>

                    {hasFailedReconnection && (
                        <button
                            onClick={reconnectManually}
                            className="ml-3 px-3 py-1 text-xs bg-danger-600 text-white rounded hover:bg-danger-700 transition-colors"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {error && isConnected && (
                <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-lg shadow-lg mt-2">
                    <div className="flex items-start">
                        <ExclamationTriangleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Error</p>
                            <p className="text-xs mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ConnectionStatus;