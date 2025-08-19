// middleware/errorHandler.js

class ErrorHandler {
  static handle(error, req, res, next) {
    console.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method,
      timestamp: new Date().toISOString()
    });

    // Determine error type and response
    let statusCode = 500;
    let message = 'Внутрішня помилка сервера';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Некоректні дані';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'Неавторизований доступ';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Ресурс не знайдено';
    } else if (error.code === 'TELEGRAM_API_ERROR') {
      statusCode = 502;
      message = 'Помилка Telegram API';
    } else if (error.code === 'AIRTABLE_API_ERROR') {
      statusCode = 502;
      message = 'Помилка бази даних';
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
      message = 'Щось пішло не так. Спробуйте пізніше.';
    }

    res.status(statusCode).json({
      error: {
        message,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown'
      }
    });
  }

  static handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  static logError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    };

    if (process.env.NODE_ENV === 'production') {
      // In production, you might want to send to external logging service
      console.error('PRODUCTION ERROR:', JSON.stringify(errorInfo, null, 2));
    } else {
      console.error('ERROR:', errorInfo);
    }
  }

  static createError(message, code = 'GENERIC_ERROR', statusCode = 500) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

export default ErrorHandler.handle;