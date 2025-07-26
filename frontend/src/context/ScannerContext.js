import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const ScannerContext = createContext();

const initialState = {
    isConnected: false,
    isRunning: false,
    isPaused: false,
    currentNetwork: 'ethereum',
    scanMode: 'realtime',
    stats: {
        blocksProcessed: 0,
        contractsFound: 0,
        runtime: 0,
        blocksPerSecond: 0,
        currentBlock: null,
        errors: 0
    },
    recentContracts: [],
    networkInfo: null,
    loading: false,
    error: null
};

function scannerReducer(state, action) {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload, loading: false };

        case 'SET_CONNECTED':
            return { ...state, isConnected: action.payload };

        case 'UPDATE_STATUS':
            return {
                ...state,
                isRunning: action.payload.isRunning,
                isPaused: action.payload.isPaused,
                currentNetwork: action.payload.network || state.currentNetwork,
                scanMode: action.payload.scanMode || state.scanMode
            };

        case 'UPDATE_STATS':
            return { ...state, stats: { ...state.stats, ...action.payload } };

        case 'SET_RECENT_CONTRACTS':
            return { ...state, recentContracts: action.payload };

        case 'ADD_CONTRACT':
            return {
                ...state,
                recentContracts: [action.payload, ...state.recentContracts.slice(0, 49)],
                stats: {
                    ...state.stats,
                    contractsFound: state.stats.contractsFound + 1
                }
            };

        case 'SET_NETWORK_INFO':
            return { ...state, networkInfo: action.payload };

        case 'CLEAR_ERROR':
            return { ...state, error: null };

        default:
            return state;
    }
}

export function ScannerProvider({ children }) {
    const [state, dispatch] = useReducer(scannerReducer, initialState);
    const [socket, setSocket] = React.useState(null);
    const [reconnectAttempts, setReconnectAttempts] = React.useState(0);
    const maxReconnectAttempts = 5;
    const reconnectInterval = React.useRef(null);

    const connectSocket = React.useCallback(() => {
        console.log('Attempting to connect to WebSocket...');

        const newSocket = io('http://localhost:3001', {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            maxReconnectionAttempts: maxReconnectAttempts
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected successfully');
            dispatch({ type: 'SET_CONNECTED', payload: true });
            dispatch({ type: 'CLEAR_ERROR' });
            setReconnectAttempts(0);

            // Clear any existing reconnection interval
            if (reconnectInterval.current) {
                clearInterval(reconnectInterval.current);
                reconnectInterval.current = null;
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            dispatch({ type: 'SET_CONNECTED', payload: false });

            // Only attempt manual reconnection for certain disconnect reasons
            if (reason === 'io server disconnect' || reason === 'transport close') {
                attemptReconnection();
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            dispatch({ type: 'SET_ERROR', payload: 'Connection to server failed' });
            attemptReconnection();
        });

        newSocket.on('reconnect', (attemptNumber) => {
            console.log('WebSocket reconnected after', attemptNumber, 'attempts');
            dispatch({ type: 'SET_CONNECTED', payload: true });
            dispatch({ type: 'CLEAR_ERROR' });
            setReconnectAttempts(0);
        });

        newSocket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', error);
        });

        newSocket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed after maximum attempts');
            dispatch({ type: 'SET_ERROR', payload: 'Failed to reconnect to server' });
        });

        // Scanner event listeners
        newSocket.on('scanner_status', (data) => {
            dispatch({ type: 'UPDATE_STATUS', payload: data });
        });

        newSocket.on('scanner_stats', (data) => {
            dispatch({ type: 'UPDATE_STATS', payload: data });
        });

        newSocket.on('new_contract', (contract) => {
            dispatch({ type: 'ADD_CONTRACT', payload: contract });
        });

        newSocket.on('network_info', (info) => {
            dispatch({ type: 'SET_NETWORK_INFO', payload: info });
        });

        setSocket(newSocket);
        return newSocket;
    }, []);

    const attemptReconnection = React.useCallback(() => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            dispatch({ type: 'SET_ERROR', payload: 'Connection lost. Please refresh the page.' });
            return;
        }

        if (reconnectInterval.current) {
            return; // Already attempting reconnection
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
        console.log(`Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

        reconnectInterval.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);

            if (socket) {
                socket.disconnect();
            }

            connectSocket();
            reconnectInterval.current = null;
        }, delay);
    }, [reconnectAttempts, socket, connectSocket]);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = connectSocket();

        return () => {
            if (reconnectInterval.current) {
                clearTimeout(reconnectInterval.current);
            }
            if (newSocket) {
                newSocket.close();
            }
        };
    }, [connectSocket]);

    // Heartbeat mechanism to detect connection issues
    useEffect(() => {
        if (!socket || !state.isConnected) return;

        const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping');
            } else {
                console.warn('Socket appears disconnected, attempting reconnection');
                dispatch({ type: 'SET_CONNECTED', payload: false });
                attemptReconnection();
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(heartbeatInterval);
    }, [socket, state.isConnected, attemptReconnection]);

    // API functions
    const api = {
        async startScanner(config = {}) {
            try {
                dispatch({ type: 'SET_LOADING', payload: true });
                const response = await axios.post('/api/scanner/start', config);
                dispatch({ type: 'CLEAR_ERROR' });
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        },

        async stopScanner() {
            try {
                dispatch({ type: 'SET_LOADING', payload: true });
                const response = await axios.post('/api/scanner/stop');
                dispatch({ type: 'CLEAR_ERROR' });
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        },

        async pauseScanner() {
            try {
                const response = await axios.post('/api/scanner/pause');
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async resumeScanner() {
            try {
                const response = await axios.post('/api/scanner/resume');
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async getStats() {
            try {
                const response = await axios.get('/api/scanner/stats', {
                    timeout: 10000 // 10 second timeout
                });
                dispatch({ type: 'UPDATE_STATS', payload: response.data });
                dispatch({ type: 'CLEAR_ERROR' }); // Clear any previous errors on success
                return response.data;
            } catch (error) {
                console.error('API Error in getStats:', error);

                // Don't show error for network issues if WebSocket is connected
                if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
                    console.warn('API call failed, but WebSocket may still be connected');
                    return null;
                }

                const errorMessage = error.response?.data?.message || error.message || 'Failed to get scanner stats';
                dispatch({ type: 'SET_ERROR', payload: errorMessage });
                throw error;
            }
        },

        async getRecentContracts(limit = 50) {
            try {
                const response = await axios.get(`/api/contracts/recent?limit=${limit}`);
                dispatch({ type: 'SET_RECENT_CONTRACTS', payload: response.data });
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async getContractsByCreator(creatorAddress, limit = 50) {
            try {
                const response = await axios.get(`/api/contracts/creator/${creatorAddress}?limit=${limit}`);
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async getContractStats(network = null) {
            try {
                const url = network ? `/api/contracts/stats?network=${network}` : '/api/contracts/stats';
                const response = await axios.get(url);
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async getNetworkInfo() {
            try {
                const response = await axios.get('/api/network/info');
                dispatch({ type: 'SET_NETWORK_INFO', payload: response.data });
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        },

        async updateConfig(config) {
            try {
                const response = await axios.post('/api/config/update', config);
                return response.data;
            } catch (error) {
                dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || error.message });
                throw error;
            }
        }
    };

    // Manual reconnection function
    const reconnectManually = React.useCallback(() => {
        console.log('Manual reconnection requested');
        setReconnectAttempts(0);
        dispatch({ type: 'CLEAR_ERROR' });

        if (socket) {
            socket.disconnect();
        }

        connectSocket();
    }, [socket, connectSocket]);

    const value = {
        ...state,
        ...api,
        reconnectAttempts,
        maxReconnectAttempts,
        reconnectManually,
        clearError: () => dispatch({ type: 'CLEAR_ERROR' })
    };

    return (
        <ScannerContext.Provider value={value}>
            {children}
        </ScannerContext.Provider>
    );
}

export function useScanner() {
    const context = useContext(ScannerContext);
    if (!context) {
        throw new Error('useScanner must be used within a ScannerProvider');
    }
    return context;
}