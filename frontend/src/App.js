import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Scanner from './components/Scanner';
import Contracts from './components/Contracts';
import Settings from './components/Settings';
import ConnectionStatus from './components/ConnectionStatus';
import { ScannerProvider } from './context/ScannerContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationContainer from './components/NotificationContainer';

function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <NotificationProvider>
            <ScannerProvider>
                <Router>
                    <div className="flex h-screen bg-gray-50">
                        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                        <div className="flex-1 flex flex-col overflow-hidden">
                            <header className="bg-white shadow-sm border-b border-gray-200">
                                <div className="flex items-center justify-between px-6 py-4">
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => setSidebarOpen(true)}
                                            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                                        >
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                            </svg>
                                        </button>
                                        <h1 className="ml-2 text-2xl font-bold text-gray-900">
                                            🔍 EVM Contract Scanner
                                        </h1>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="text-sm text-gray-500">
                                            Real-time blockchain contract detection
                                        </div>
                                    </div>
                                </div>
                            </header>

                            <main className="flex-1 overflow-auto">
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/scanner" element={<Scanner />} />
                                    <Route path="/contracts" element={<Contracts />} />
                                    <Route path="/settings" element={<Settings />} />
                                </Routes>
                            </main>
                        </div>
                    </div>

                    <ConnectionStatus />
                    <NotificationContainer />
                </Router>
            </ScannerProvider>
        </NotificationProvider>
    );
}

export default App;