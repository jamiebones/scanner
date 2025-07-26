import React, { createContext, useContext, useReducer } from 'react';

const NotificationContext = createContext();

const initialState = {
    notifications: []
};

function notificationReducer(state, action) {
    switch (action.type) {
        case 'ADD_NOTIFICATION':
            return {
                ...state,
                notifications: [...state.notifications, { ...action.payload, id: Date.now() }]
            };

        case 'REMOVE_NOTIFICATION':
            return {
                ...state,
                notifications: state.notifications.filter(n => n.id !== action.payload)
            };

        case 'CLEAR_NOTIFICATIONS':
            return {
                ...state,
                notifications: []
            };

        default:
            return state;
    }
}

export function NotificationProvider({ children }) {
    const [state, dispatch] = useReducer(notificationReducer, initialState);

    const addNotification = (notification) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

        // Auto-remove after 5 seconds for non-persistent notifications
        if (!notification.persistent) {
            setTimeout(() => {
                dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id || Date.now() });
            }, notification.duration || 5000);
        }
    };

    const removeNotification = (id) => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    };

    const clearNotifications = () => {
        dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    };

    // Convenience methods for different notification types
    const showSuccess = (message, options = {}) => {
        addNotification({
            type: 'success',
            message,
            ...options
        });
    };

    const showError = (message, options = {}) => {
        addNotification({
            type: 'error',
            message,
            persistent: true, // Errors should be manually dismissed
            ...options
        });
    };

    const showWarning = (message, options = {}) => {
        addNotification({
            type: 'warning',
            message,
            ...options
        });
    };

    const showInfo = (message, options = {}) => {
        addNotification({
            type: 'info',
            message,
            ...options
        });
    };

    const value = {
        notifications: state.notifications,
        addNotification,
        removeNotification,
        clearNotifications,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}