import {isAxiosError} from 'axios';
import express from 'express';

import {goCardlessService} from './services/gocardless-service.js';
import {
    AccountNotLinkedToRequisition,
    GenericGoCardlessError,
    RateLimitError,
    RequisitionNotLinked,
} from './errors.js';
import {handleError} from './util/handle-error.js';
import {sha256String} from './util/hash.js';
import logger, {requestLogger} from './util/logger.js';

const app = express();

app.use(express.json({limit: '5mb'}));
app.disable('x-powered-by');

// Aggiungi il middleware di logging per tracciare tutte le richieste
app.use(requestLogger);

app.get('/status', async (req, res) => {
    res.send({
        status: 'ok',
        data: {
            configured: goCardlessService.isConfigured(),
        },
    });
});

app.post(
    '/create-web-token',
    handleError(async (req, res) => {
        const {institutionId, localAccountId} = req.body;

        req.logger.info(`Creating web token for account ${localAccountId}`);

        const {link, requisitionId} = await goCardlessService.createRequisition({
            institutionId,
            localAccountId,
        });

        req.logger.info(`Web token created successfully for account ${localAccountId}`);

        res.send({
            status: 'ok',
            data: {
                link,
                requisitionId,
            },
        });
    }),
);

app.post(
    '/get-accounts',
    handleError(async (req, res) => {
        const {requisitionId} = req.body;

        req.logger.info(`Fetching accounts for requisition ${requisitionId}`);

        try {
            const {requisition, accounts} =
                await goCardlessService.getRequisitionWithAccounts(requisitionId);

            req.logger.info(`${accounts.length} Accounts fetched successfully for requisition ${requisitionId}`);

            res.send({
                status: 'ok',
                data: {
                    ...requisition,
                    accounts: await Promise.all(
                        accounts.map(async (account) =>
                            account?.iban
                                ? {...account, iban: await sha256String(account.iban)}
                                : account,
                        ),
                    ),
                },
            });
        } catch (error) {
            if (error instanceof RequisitionNotLinked) {
                req.logger.warn('Requisition not linked', {
                    requisitionId,
                    requisitionStatus: error.details.requisitionStatus
                });

                res.send({
                    status: 'ok',
                    requisitionStatus: error.details.requisitionStatus,
                });
            } else {
                throw error;
            }
        }
    }),
);

app.post(
    '/get-banks',
    handleError(async (req, res) => {
        let {country, showDemo = false} = req.body;

        req.logger.info(`Fetching banks for country ${country} ${showDemo ? '(showing demo banks)' : ''}`);

        await goCardlessService.setToken();
        const data = await goCardlessService.getInstitutions(country);

        req.logger.debug('Banks fetched', {country, count: data.length});

        res.send({
            status: 'ok',
            data: showDemo
                ? [
                    {
                        id: 'SANDBOXFINANCE_SFIN0000',
                        name: 'DEMO bank (used for testing bank-sync)',
                    },
                    ...data,
                ]
                : data,
        });
    }),
);

app.post(
    '/remove-account',
    handleError(async (req, res) => {
        let {requisitionId} = req.body;

        req.logger.info(`Removing account with requisition ID ${requisitionId}`);

        const data = await goCardlessService.deleteRequisition(requisitionId);
        if (data.summary === 'Requisition deleted') {
            req.logger.info(`Account removed successfully for requisition ${requisitionId}`);
            res.send({
                status: 'ok',
                data,
            });
        } else {
            req.logger.warn('Failed to remove account', {requisitionId, data});
            res.send({
                status: 'error',
                data: {
                    data,
                    reason: 'Can not delete requisition',
                },
            });
        }
    }),
);

app.post(
    '/transactions',
    handleError(async (req, res) => {
        const {
            requisitionId,
            startDate,
            endDate,
            accountId,
            includeBalance = true,
        } = req.body;

        req.logger.info(`Fetching transactions for account ${accountId} under requisition ${requisitionId} from ${startDate} to ${endDate} (includeBalance: ${includeBalance})`);

        try {
            if (includeBalance) {
                const {
                    balances,
                    institutionId,
                    startingBalance,
                    transactions: {booked, pending, all},
                } = await goCardlessService.getTransactionsWithBalance(
                    requisitionId,
                    accountId,
                    startDate,
                    endDate,
                );

                req.logger.info(`Transactions and balance fetched successfully for account ${accountId} under requisition ${requisitionId} from ${startDate} to ${endDate} (includeBalance: ${includeBalance})`);

                res.send({
                    status: 'ok',
                    data: {
                        balances,
                        institutionId,
                        startingBalance,
                        transactions: {
                            booked,
                            pending,
                            all,
                        },
                    },
                });
            } else {
                const {
                    institutionId,
                    transactions: {booked, pending, all},
                } = await goCardlessService.getNormalizedTransactions(
                    requisitionId,
                    accountId,
                    startDate,
                    endDate,
                );

                req.logger.info(`Transactions fetched successfully for account ${accountId} under requisition ${requisitionId} from ${startDate} to ${endDate} (includeBalance: ${includeBalance})`);

                res.send({
                    status: 'ok',
                    data: {
                        institutionId,
                        transactions: {
                            booked,
                            pending,
                            all,
                        },
                    },
                });
            }
        } catch (error) {
            const headers = error.details?.response?.headers ?? {};

            const rateLimitHeaders = Object.fromEntries(
                Object.entries(headers).filter(([key]) =>
                    key.startsWith('http_x_ratelimit'),
                ),
            );

            const sendErrorResponse = (data) => {
                req.logger.error('Transaction fetch failed', {
                    requisitionId,
                    accountId,
                    error_type: data.error_type,
                    error_code: data.error_code,
                    reason: data.reason,
                    rateLimitHeaders,
                });

                res.send({
                    status: 'ok',
                    data: {...data, details: error.details, rateLimitHeaders},
                });
            };

            switch (true) {
                case error instanceof RequisitionNotLinked:
                    sendErrorResponse({
                        error_type: 'ITEM_ERROR',
                        error_code: 'ITEM_LOGIN_REQUIRED',
                        status: 'expired',
                        reason:
                            'Access to account has expired as set in End User Agreement',
                    });
                    break;
                case error instanceof AccountNotLinkedToRequisition:
                    sendErrorResponse({
                        error_type: 'INVALID_INPUT',
                        error_code: 'INVALID_ACCESS_TOKEN',
                        status: 'rejected',
                        reason: 'Account not linked with this requisition',
                    });
                    break;
                case error instanceof RateLimitError:
                    sendErrorResponse({
                        error_type: 'RATE_LIMIT_EXCEEDED',
                        error_code: 'NORDIGEN_ERROR',
                        status: 'rejected',
                        reason: 'Rate limit exceeded',
                    });
                    break;
                case error instanceof GenericGoCardlessError:
                    req.logger.error('GoCardless Error', {
                        message: error.message || 'Unknown error',
                        details: error.details,
                    });
                    sendErrorResponse({
                        error_type: 'SYNC_ERROR',
                        error_code: 'NORDIGEN_ERROR',
                    });
                    break;
                case isAxiosError(error):
                    req.logger.error('Axios Error', {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        message: error.message,
                    });
                    sendErrorResponse({
                        error_type: 'SYNC_ERROR',
                        error_code: 'NORDIGEN_ERROR',
                    });
                    break;
                default:
                    req.logger.error('Unknown Error', {
                        message: error.message || 'Something went wrong',
                        stack: error.stack,
                    });
                    sendErrorResponse({
                        error_type: 'UNKNOWN',
                        error_code: 'UNKNOWN',
                        reason: 'Something went wrong',
                    });
                    break;
            }
        }
    }),
);

app.listen(process.env.PORT || 3000, () => {
    const port = process.env.PORT || 3000;
    const env = process.env.NODE_ENV || 'development';

    logger.info('Server started', {
        port,
        environment: env,
        nodeVersion: process.version,
        message: `Nexabudget gocardless integrator listening on port ${port}`,
    });
});