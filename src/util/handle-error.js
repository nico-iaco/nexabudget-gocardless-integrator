import {inspect} from 'util';
import {logError} from './logger.js';

export function handleError(func) {
  return (req, res) => {
    func(req, res).catch((err) => {
        const logger = req.logger || {error: logError};

        logger.error('Unhandled error in request handler', {
            url: req.originalUrl,
            method: req.method,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack,
                details: inspect(err, {depth: null}),
            },
        });

      res.send({
        status: 'ok',
        data: {
          error_code: 'INTERNAL_ERROR',
          error_type: err.message ? err.message : 'internal-error',
        },
      });
    });
  };
}
