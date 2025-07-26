import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HomeIcon,
    PlayIcon,
    DocumentTextIcon,
    CogIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useScanner } from '../context/ScannerContext';

const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Scanner', href: '/scanner', icon: PlayIcon },
    { name: 'Contracts', href: '/contracts', icon: DocumentTextIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
];

function Sidebar({ isOpen, onClose }) {
    const location = useLocation();
    const { isConnected, isRunning, isPaused, currentNetwork, stats } = useScanner();

    const getStatusColor = () => {
        if (!isConnected) return 'bg-gray-400';
        if (isRunning && !isPaused) return 'bg-success-500';
        if (isPaused) return 'bg-warning-500';
        return 'bg-gray-400';
    };

    const getStatusText = () => {
        if (!isConnected) return 'Disconnected';
        if (isRunning && !isPaused) return 'Running';
        if (isPaused) return 'Paused';
        return 'Stopped';
    };

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <div className="flex items-center">
                            <div className="text-xl font-bold text-gray-900">Scanner</div>
                        </div>
                        <button
                            onClick={onClose}
                            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Status */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isRunning && !isPaused ? 'animate-pulse' : ''}`} />
                            <div>
                                <div className="text-sm font-medium text-gray-900">{getStatusText()}</div>
                                <div className="text-xs text-gray-500">{currentNetwork}</div>
                            </div>
                        </div>

                        {isConnected && (
                            <div className="mt-3 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Contracts Found</span>
                                    <span className="font-medium text-gray-900">{stats.contractsFound.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Blocks Processed</span>
                                    <span className="font-medium text-gray-900">{stats.blocksProcessed.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Speed</span>
                                    <span className="font-medium text-gray-900">{stats.blocksPerSecond} b/s</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-2">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => onClose()}
                                    className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                                            ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                        }
                  `}
                                >
                                    <item.icon className="mr-3 h-5 w-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200">
                        <div className="text-xs text-gray-500 text-center">
                            EVM Contract Scanner v1.0
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Sidebar;