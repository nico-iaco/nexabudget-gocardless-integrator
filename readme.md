# NexaBudget GoCardless Integrator

A Node.js service that integrates with GoCardless Bank Account Data API to fetch and normalize banking transactions from multiple European banks.

## Acknowledgments

This project is based on the excellent work done by the [Actual Budget](https://github.com/actualbudget/actual) team. Their GoCardless integration code served as the foundation for this service. I'm grateful for their open-source contributions to the personal finance software community.

## Overview

NexaBudget GoCardless Integrator is a microservice that acts as a bridge between GoCardless's Bank Account Data API and financial management applications. It provides:

- **Bank-specific transaction normalization**: Handles quirks and differences across 40+ supported banks
- **RESTful API**: Exposes endpoints for bank operations and transaction retrieval
- **Transaction enrichment**: Cleans and normalizes payee names, amounts, and dates
- **Multi-bank support**: Preconfigured integrations for major European banks

## Features

- 🏦 **40+ Bank Integrations**: Pre-configured support for banks across Europe
- 🔄 **Transaction Normalization**: Standardizes transaction data from different banks
- 🔐 **Secure OAuth Flow**: Handles GoCardless authentication and authorization
- 📊 **Transaction Deduplication**: Built-in hash-based deduplication
- 🏷️ **Payee Name Cleaning**: Removes unnecessary information from transaction descriptions
- 🐳 **Docker Support**: Ready-to-deploy containerized application
- ✅ **Comprehensive Testing**: Unit tests for bank-specific logic

## Supported Banks

The service supports banks from multiple countries including:

- **Spain**: ABANCA, Banco Sabadell, Bankinter
- **Netherlands**: ABN AMRO, ING
- **Belgium**: Belfius, BNP Paribas, CBC, KBC
- **Germany**: Commerzbank, Berliner Sparkasse, various Sparkassen
- **UK**: Bank of Ireland, Nationwide, Virgin Money
- **Italy**: Hype, ISP (Intesa Sanpaolo)
- **Poland**: ING, mBank
- **Nordics**: Danske Bank, SEB, Swedbank, Sparebank 1
- **Others**: Revolut, American Express, and more

## Architecture

The service is built with:

- **Node.js**: Runtime environment
- **Express.js**: Web framework for RESTful API
- **GoCardless API**: Bank account data provider
- **Bank-specific adapters**: Custom logic for each bank's transaction format

### Key Components

1. **Bank Factory** (`bank-factory.js`): Dynamically loads and manages bank-specific implementations
2. **Bank Adapters** (`banks/`): Individual modules for each bank with custom normalization logic
3. **GoCardless Service** (`services/gocardless-service.js`): Handles API communication with GoCardless
4. **Utils** (`utils.js`, `util/`): Helper functions for transaction normalization and data cleaning

## API Endpoints

### Health Check
`GET /status`

Returns service health status.

### Get Bank List
`POST /get-banks Body: { country: string }`

Retrieves a list of supported banks for a given country.

### Create Bank Link
`POST /create-web-token Body: { institutionId: string }`

Initiates the OAuth flow to connect a bank account.

### List Accounts
`POST /get-accounts Body { requisitionId: string }`

Retrieves all accounts for a given requisition.

### Fetch Transactions
`POST /transactions Body: { requisitionId: string, accountId: string, startDate: string, endDate: string }`

Fetches and normalizes transactions for a specific account.

## Logging

This service includes a professional logging system built with Winston, optimized for both local development and
production (Kubernetes) environments.

### Features

- 🎨 **Colorized output** in development for easy reading
- 📝 **JSON structured logs** in production for log aggregators
- 🔍 **Request tracking** with automatic request IDs
- ⚡ **Performance monitoring** with automatic duration tracking
- 🐛 **Detailed error logging** with stack traces

### Configuration

Configure logging via environment variables:

```bash
NODE_ENV=production    # development | production | test
LOG_LEVEL=info        # error | warn | info | debug
```

### Quick Start

View logs in Kubernetes:

```bash
# Real-time logs
kubectl logs -f deployment/nexabudget-gocardless-integrator

# Filter errors only (with jq)
kubectl logs deployment/nexabudget-gocardless-integrator | jq 'select(.level=="error")'
```

## Installation

### Prerequisites

- Node.js 22.x or higher
- npm or yarn
- Docker (optional, for containerized deployment)
- GoCardless API credentials

### Local Development

1. Clone the repository:
    ```bash
    git clone <repository-url>
    cd nexabudget-gocardless-integrator
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create a `.env` file.
   ```bash
   touch .env
   ```
4. Configure environment variables:
    ```bash
    GOCARDLESS_CLIENT_ID=<client-id>
    GOCARDLESS_CLIENT_SECRET=<client-secret>
    REDIRECT_PATH=<redirect-uri>
    LOG_LEVEL=info
   ```
5. Start the server:
    ```bash
    npm start
    ```
   
### Docker Deployment
1. Build the Docker image:
    ```bash
    docker build -t nexabudget-gocardless-integrator .
    ```
2. Run with docker-compose:
   ```bash
   docker-compose up -d
   ```
   The service will be available at `http://localhost:3000`.

## Configuration

### Environment Variables
| Variable                | Description                          | Default      |
|-------------------------|--------------------------------------|--------------|
| `PORT`                  | Server port                          | `3000`       |
| `NODE_ENV`              | Environment (development/production) | `production` |
| `GOCARDLESS_SECRET_ID`  | GoCardless API Secret ID             | Required     |
| `GOCARDLESS_SECRET_KEY` | GoCardless API Secret Key            | Required     |
| `REDIRECT_PATH`         | OAuth redirect URL                   | Required     |
| `LOG_LEVEL`             | Logging level (info/debug/error)     | `info`       |

## Project structure
```
nexabudget-gocardless-integrator/
├── src/
│   ├── app-gocardless.js          # Main application entry point
│   ├── bank-factory.js            # Bank adapter factory
│   ├── banks/                     # Bank-specific adapters
│   │   ├── bank.interface.ts      # TypeScript interface for banks
│   │   ├── integration-bank.js    # Base bank implementation
│   │   ├── revolut_revolt21.js    # Example bank adapter
│   │   └── tests/                 # Bank adapter tests
│   ├── services/
│   │   └── gocardless-service.js  # GoCardless API client
│   ├── util/                      # Utility functions
│   │   ├── payee-name.js          # Payee name cleaning
│   │   ├── hash.js                # Transaction hashing
│   │   └── handle-error.js        # Error handling
│   └── utils.js                   # General utilities
├── Dockerfile                      # Docker configuration
├── docker-compose.yml             # Docker Compose setup
├── package.json                   # NPM dependencies
└── tsconfig.json                  # TypeScript configuration
```

## Error Handling
The service includes comprehensive error handling:
- **GoCardless API errors**: Automatically retried with exponential backoff
- **Bank-specific error**s: Custom error messages for common issues
- **Validation errors**: Input validation with descriptive error messages
- **Network errors**: Timeout and retry logic

## Security
- **Non-root user**: Docker container runs as non-privileged user
- **Environment variables**: Sensitive credentials stored outside codebase
- **Input validation**: All API inputs are validated
- **HTTPS**: Production deployment should use HTTPS

## Performance
- **Transaction caching**: Reduces redundant API calls
- **Batch processing**: Efficiently handles large transaction sets
- **Multi-stage Docker build**: Optimized image size (~150MB)

## Contributing
Contributions are welcome! Please:
- Fork the repository
- Create a feature branch
- Add tests for new functionality
- Ensure all tests pass
- Submit a pull request

## Support
If you have any questions or feedback, please [open an issue](https://github.com/nico-iaco/nexabudget-gocardless-integrator/issues/new).

Built with ❤️ for the open-source financial management community.