// Security configuration for EVM Contract Scanner

const security = {
    // CORS settings
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: false
    },

    // Rate limiting (requests per minute)
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        max: process.env.RATE_LIMIT || 100, // limit each IP to 100 requests per windowMs
        message: "Too many requests from this IP, please try again later."
    },

    // API security headers
    headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    },

    // Sensitive data masking patterns
    maskPatterns: [
        /\/[a-zA-Z0-9_-]{32,}/g, // API keys in URLs
        /api[_-]?key[=:]\s*[a-zA-Z0-9_-]+/gi, // API key patterns
        /secret[=:]\s*[a-zA-Z0-9_-]+/gi, // Secret patterns
        /password[=:]\s*[a-zA-Z0-9_-]+/gi, // Password patterns
        /token[=:]\s*[a-zA-Z0-9_-]+/gi // Token patterns
    ],

    // Fields to exclude from API responses
    excludeFields: [
        'password',
        'secret',
        'apiKey',
        'privateKey',
        'token',
        'auth'
    ],

    // Validation rules
    validation: {
        maxRequestSize: '10mb',
        allowedFileTypes: ['.json', '.txt'],
        maxFilenameLength: 255
    }
};

// Function to mask sensitive data in logs
function maskSensitiveData(data) {
    if (typeof data !== 'string') {
        data = JSON.stringify(data);
    }

    security.maskPatterns.forEach(pattern => {
        data = data.replace(pattern, '[REDACTED]');
    });

    return data;
}

// Function to sanitize object for API response
function sanitizeForResponse(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const sanitized = { ...obj };

    security.excludeFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

module.exports = {
    security,
    maskSensitiveData,
    sanitizeForResponse
};