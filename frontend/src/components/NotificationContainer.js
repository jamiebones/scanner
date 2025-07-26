import React from 'react';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XCircleIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useNotifications } from '../context/NotificationContext';

function NotificationContainer() {
    const { notifications, removeNotification } = useNotifications();

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="h-5 w-5 text-success-600" />;
            case 'error':
                return <XCircleIcon className="h-5 w-5 text-danger-600" />;
            case 'warning':
                return <ExclamationTriangleIcon className="h-5 w-5 text-warning-600" />;
            case 'info':
            default:
                return <InformationCircleIcon className="h-5 w-5 text-primary-600" />;
        }
    };

    const getStyles = (type) => {
        switch (type) {
            case 'success':
                return 'bg-success-50 border-success-200 text-success-800';
            case 'error':
                return 'bg-danger-50 border-danger-200 text-danger-800';
            case 'warning':
                return 'bg-warning-50 border-warning-200 text-warning-800';
            case 'info':
            default:
                return 'bg-primary-50 border-primary-200 text-primary-800';
        }
    };

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`
            flex items-start p-4 rounded-lg border shadow-lg transition-all duration-300 ease-in-out
            ${getStyles(notification.type)} fade-in
          `}
                >
                    <div className="flex-shrink-0">
                        {getIcon(notification.type)}
                    </div>

                    <div className="ml-3 flex-1">
                        {notification.title && (
                            <h4 className="text-sm font-medium mb-1">
                                {notification.title}
                            </h4>
                        )}
                        <p className="text-sm">
                            {notification.message}
                        </p>
                    </div>

                    <button
                        onClick={() => removeNotification(notification.id)}
                        className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

export default NotificationContainer;