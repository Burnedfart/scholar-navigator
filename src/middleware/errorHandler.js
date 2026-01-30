class AppError extends Error {
    constructor(message, statusCode, errorCode, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}
class InvalidUrlError extends AppError {
    constructor(url) {
        super(
            'The provided URL is not valid or is not allowed',
            400,
            'INVALID_URL',
            {
                url: url,
                explanation: 'URLs must start with http:// or https:// and point to a public website',
                suggestions: [
                    'Make sure the URL includes the protocol (http:// or https://)',
                    'Check for typos in the domain name',
                    'Verify the website is publicly accessible'
                ]
            }
        );
    }
}
class NetworkError extends AppError {
    constructor(originalError, targetUrl) {
        const errorInfo = NetworkError.analyzeError(originalError);

        super(
            errorInfo.message,
            502, // Bad Gateway - appropriate for proxy errors
            errorInfo.code,
            {
                targetUrl: targetUrl,
                explanation: errorInfo.explanation,
                technicalDetails: originalError.message,
                suggestions: errorInfo.suggestions
            }
        );
    }

    static analyzeError(error) {
        const errorCode = error.code || error.message;

        const errorMappings = {
            'ENOTFOUND': {
                message: 'The website could not be found',
                code: 'DNS_LOOKUP_FAILED',
                explanation: 'The domain name could not be resolved to an IP address. This usually means the website does not exist or there is a DNS configuration issue.',
                suggestions: [
                    'Check that the domain name is spelled correctly',
                    'Try accessing the website directly in your browser',
                    'The website might be temporarily unavailable'
                ]
            },
            'ECONNREFUSED': {
                message: 'Connection was refused by the server',
                code: 'CONNECTION_REFUSED',
                explanation: 'The server exists but actively refused the connection. This could mean the web server is not running or is blocking connections.',
                suggestions: [
                    'The website might be down for maintenance',
                    'Try again later',
                    'The server might be blocking proxy requests'
                ]
            },
            'ETIMEDOUT': {
                message: 'Connection timed out',
                code: 'CONNECTION_TIMEOUT',
                explanation: 'The server took too long to respond. This could be due to slow network conditions or an overloaded server.',
                suggestions: [
                    'Check your internet connection',
                    'The website might be experiencing high traffic',
                    'Try again in a few moments'
                ]
            },
            'ECONNRESET': {
                message: 'Connection was reset',
                code: 'CONNECTION_RESET',
                explanation: 'The connection was unexpectedly closed by the server. This can happen due to network issues or server configuration.',
                suggestions: [
                    'Try the request again',
                    'Check if the website is accessible directly'
                ]
            },
            'CERT_HAS_EXPIRED': {
                message: 'SSL certificate has expired',
                code: 'SSL_CERT_EXPIRED',
                explanation: 'The website\'s security certificate has expired. This is a configuration issue on the target website.',
                suggestions: [
                    'Contact the website administrator',
                    'Try a different website'
                ]
            }
        };

        const mapping = errorMappings[errorCode] || {
            message: 'Unable to connect to the website',
            code: 'NETWORK_ERROR',
            explanation: `A network error occurred while trying to fetch the content: ${error.message}`,
            suggestions: [
                'Check your internet connection',
                'Verify the URL is correct',
                'Try again later'
            ]
        };

        return mapping;
    }
}

class ContentError extends AppError {
    constructor(contentType, reason) {
        super(
            'Cannot process this type of content',
            415,
            'UNSUPPORTED_CONTENT',
            {
                contentType: contentType,
                explanation: reason,
                suggestions: [
                    'Try fetching a regular web page (HTML content)',
                    'Some file types cannot be displayed through the proxy'
                ]
            }
        );
    }
}

class RateLimitError extends AppError {
    constructor(retryAfter) {
        super(
            'Too many requests - please slow down',
            429,
            'RATE_LIMITED',
            {
                retryAfter: retryAfter,
                explanation: 'You have made too many requests in a short period. This limit protects the server and ensures fair usage.',
                suggestions: [
                    `Wait ${retryAfter} seconds before trying again`,
                    'Reduce the frequency of your requests'
                ]
            }
        );
    }
}


function middleware(err, req, res, next) {
    let statusCode = err.statusCode || 500;
    let errorCode = err.errorCode || 'INTERNAL_ERROR';
    let message = err.message || 'An unexpected error occurred';
    let details = err.details || null;

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`[Error] ${new Date().toISOString()}`);
    console.error(`Code: ${errorCode}`);
    console.error(`Message: ${message}`);
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`Session: ${req.sessionId}`);

    if (!err.isOperational) {
        console.error('Stack:', err.stack);
    }

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorResponse = {
        success: false,
        error: {
            code: errorCode,
            message: message,
            timestamp: new Date().toISOString()
        }
    };

    if (details) {
        errorResponse.error.details = details;
    }
    if (process.env.NODE_ENV === 'development' && err.stack) {
        errorResponse.error.stack = err.stack.split('\n');
    }

    if (res.headersSent) {
        return next(err);
    }

    res.status(statusCode).json(errorResponse);
}

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    middleware,
    asyncHandler,
    AppError,
    InvalidUrlError,
    NetworkError,
    ContentError,
    RateLimitError
};
