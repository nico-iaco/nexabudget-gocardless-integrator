import winston from 'winston';

const {combine, timestamp, printf, colorize, json, errors} = winston.format;

// Determina l'ambiente (default: development)
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

// Formato per sviluppo locale (leggibile)
const developmentFormat = combine(
    colorize(),
    timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    errors({stack: true}),
    printf(({timestamp, level, message, service, ...metadata}) => {
        let msg = `${timestamp} [${level}]`;

        if (service) {
            msg += ` [${service}]`;
        }

        msg += `: ${message}`;

        // Aggiungi metadata se presente
        const metadataKeys = Object.keys(metadata);
        if (metadataKeys.length > 0) {
            // Filtra campi interni di Winston
            const cleanMetadata = Object.fromEntries(
                Object.entries(metadata).filter(([key]) =>
                    !['timestamp', 'level', 'message', 'service'].includes(key)
                )
            );

            if (Object.keys(cleanMetadata).length > 0) {
                msg += `\n${JSON.stringify(cleanMetadata, null, 2)}`;
            }
        }

        return msg;
    })
);

// Formato per produzione (JSON strutturato per Kubernetes/log aggregators)
const productionFormat = combine(
    timestamp(),
    errors({stack: true}),
    json()
);

// Crea il logger con configurazione basata sull'ambiente
const logger = winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: {
        service: 'nexabudget-gocardless-integrator',
        environment: NODE_ENV
    },
    format: NODE_ENV === 'production' ? productionFormat : developmentFormat,
    transports: [
        new winston.transports.Console(),
    ],
    // Non uscire su errori non gestiti
    exitOnError: false,
});

/**
 * Logger middleware per Express che aggiunge context a ogni richiesta
 */
export const requestLogger = (req, res, next) => {
    const requestId = req.headers['x-request-id'] ||
        req.headers['x-correlation-id'] ||
        `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Aggiungi il requestId alla richiesta per usarlo nei log successivi
    req.requestId = requestId;

    // Crea un child logger con il contesto della richiesta
    req.logger = logger.child({
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
    });

    const startTime = Date.now();

    // Log della richiesta in ingresso
    req.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        query: req.query,
        userAgent: req.headers['user-agent'],
    });

    // Log della risposta quando termina
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';

        req.logger[logLevel]('Request completed', {
            statusCode: res.statusCode,
            duration: `${duration}ms`,
        });
    });

    next();
};

/**
 * Crea un logger con contesto specifico
 * @param {string} context - Nome del contesto (es: 'GoCardlessService', 'BankFactory')
 * @returns {winston.Logger}
 */
export const createContextLogger = (context) => {
    return logger.child({context});
};

/**
 * Log degli errori con stack trace completo
 * @param {Error} error
 * @param {Object} metadata
 */
export const logError = (error, metadata = {}) => {
    logger.error(error.message, {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...error.details,
        },
        ...metadata,
    });
};

/**
 * Log delle performance di operazioni
 * @param {string} operation
 * @param {number} duration
 * @param {Object} metadata
 */
export const logPerformance = (operation, duration, metadata = {}) => {
    const logLevel = duration > 5000 ? 'warn' : 'debug';
    logger[logLevel](`Performance: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...metadata,
    });
};

/**
 * Wrapper per misurare le performance di funzioni async
 * @param {string} operationName
 * @param {Function} fn
 * @param {Object} metadata
 */
export const withPerformanceLogging = async (operationName, fn, metadata = {}) => {
    const startTime = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        logPerformance(operationName, duration, metadata);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logError(error, {
            operation: operationName,
            duration: `${duration}ms`,
            ...metadata,
        });
        throw error;
    }
};

export default logger;

