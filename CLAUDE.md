# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run production server (node src/app-gocardless.js)
npm run dev        # Run dev server with nodemon (auto-restart on changes)
npm test           # Run all tests with vitest
npx vitest run src/banks/tests/revolut_revolt21.spec.js  # Run a single test file
npm run build      # Compile TypeScript (outputs to dist/)
```

Environment variables required to run (copy `.env.example` to `.env`):
- `GOCARDLESS_SECRET_ID` and `GOCARDLESS_SECRET_KEY` — GoCardless API credentials
- `REDIRECT_PATH` — OAuth redirect URL (e.g. `https://yourdomain.com/callback`)
- `PORT` — defaults to 3000
- `NODE_ENV` — `development` (colorized logs) or `production` (JSON logs)
- `LOG_LEVEL` — `error | warn | info | debug`

## Architecture

This is an Express.js microservice (ESM, Node.js 22+) that wraps the GoCardless Bank Account Data API, normalizes transactions from 40+ European banks, and exposes a REST API consumed by NexaBudget.

**Request flow for `/transactions`:**
1. `app-gocardless.js` receives the request and calls `goCardlessService`
2. `goCardlessService` fetches raw data from GoCardless via the `nordigen-node` client (wrapped in the `client` object at the bottom of `gocardless-service.js` for testability)
3. `BankFactory(institutionId)` resolves to a bank-specific adapter (or `IntegrationBank` as fallback)
4. The adapter's `normalizeTransaction`, `sortTransactions`, and `calculateStartingBalance` methods transform raw data into the normalized format
5. IBANs in account responses are SHA-256 hashed before being returned

**Key modules:**

- `src/app-gocardless.js` — Express app entry point; all routes and error mapping live here
- `src/bank-factory.js` — Dynamically imports all `src/banks/*_*.js` files at startup; exports `BankFactory(institutionId)` and `isSpecialContinuousAccessBank(institutionId)`
- `src/banks/integration-bank.js` — Default/fallback bank adapter; all bank adapters spread this and override specific methods
- `src/banks/<name>_<BIC>.js` — Bank-specific adapters implementing `IBank` (see `src/banks/bank.interface.ts`)
- `src/services/gocardless-service.js` — All GoCardless API interactions; the `client` export is the thin wrapper used for mocking in tests
- `src/errors.js` — Custom error hierarchy (`GoCardlessClientError` subclasses for each HTTP status)
- `src/util/logger.js` — Winston logger; development uses colorized text, production uses JSON; `requestLogger` middleware attaches `req.logger` (child logger with requestId/method/path); `/status` is excluded from request logging
- `src/util/payee-name.js` — `formatPayeeName()` picks debtor/creditor name based on transaction amount sign
- `src/utils.js` — `amountToInteger`, `printIban`, `sortByBookingDateOrValueDate`, `escapeRegExp`

## Adding a new bank adapter

1. Create `src/banks/<bank_name>_<BIC_lower>.js` — the filename must contain `_` to be picked up by `BankFactory`
2. Export a default object that spreads `IntegrationBank` and overrides the methods that differ for that bank
3. Set `institutionIds` to the GoCardless institution ID(s) for the bank
4. Add a corresponding test in `src/banks/tests/<bank_name>_<BIC_lower>.spec.js`

The `IBank` interface in `src/banks/bank.interface.ts` documents the four required methods: `normalizeAccount`, `normalizeTransaction`, `sortTransactions`, `calculateStartingBalance`.

## Testing patterns

Tests use vitest with `describe`/`it` — no imports needed for those globals. Test files live alongside source in `src/banks/tests/` and `src/services/tests/`. The `client` export from `gocardless-service.js` is the seam used for mocking API calls in service tests; bank adapter tests call the adapter methods directly with fixture transactions.

## Project type notes

- The project is `"type": "module"` (ESM). All imports must use `.js` extensions, even when importing `.js` files from `.ts` source.
- `tsconfig.json` is present but the runtime runs `.js` files directly — TypeScript is used only for type definitions (`bank.interface.ts`, `gocardless.types.ts`, `gocardless-node.types.ts`) and is compiled separately with `npm run build`.
- The `client` object in `gocardless-service.js` (bottom of file) intentionally wraps all nordigen-node calls to make them mockable — keep new GoCardless API calls inside that object.
