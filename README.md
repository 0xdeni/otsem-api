# OTSEM API

Banking as a Service (BaaS) platform providing Pix payments, crypto wallet management, KYC verification, and affiliate tracking.

Built with **NestJS 11**, **TypeScript 5.7**, **Prisma 6**, and **PostgreSQL**.

## Features

**Banking & Payments**
- Pix instant payments (send, receive, key management)
- Internal BRL transfers between customers
- Boleto payment processing with admin approval workflow
- Multi-bank support (Inter Bank, FDBank) with runtime switching

**Crypto**
- BRL <-> USDT conversions via OKX exchange
- Multi-network wallet management (Solana, Tron, EVM chains)
- Automated sell flow with deposit polling and matching

**Identity & Compliance**
- Customer onboarding (PF/PJ — individuals and companies)
- Tiered KYC system (Level 1/2/3) with monthly transaction limits
- Didit KYC integration for identity verification
- Document upload and admin review workflow

**Platform**
- JWT authentication with refresh tokens
- Role-based access control (Admin / Customer)
- Affiliate program with commission tracking
- Admin dashboard with analytics
- Web push notifications
- Interactive API docs (Swagger UI + Scalar)

## Tech Stack

| Layer       | Technology                                    |
| ----------- | --------------------------------------------- |
| Runtime     | Node.js 20+                                   |
| Framework   | NestJS 11                                     |
| Language    | TypeScript 5.7                                |
| ORM         | Prisma 6.19                                   |
| Database    | PostgreSQL                                    |
| Auth        | JWT via passport-jwt                          |
| Validation  | class-validator + class-transformer           |
| API Docs    | Swagger UI + Scalar                           |
| Email       | Resend                                        |
| Blockchain  | @solana/web3.js, tronweb, ethers, alchemy-sdk |
| Exchange    | OKX API                                       |
| CI/CD       | GitHub Actions -> DigitalOcean (PM2)          |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Environment variables configured (see [Configuration](#configuration))

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npm run db:migrate:deploy

# Seed default admin user (optional)
npm run db:seed
```

### Development

```bash
npm run start:dev
```

The API starts on `http://localhost:5000` by default. Override with the `PORT` environment variable.

### Production

```bash
npm run build
npm run start:prod
```

## Configuration

Create a `.env` file in the project root. Required variables:

```env
# Core
DATABASE_URL=postgresql://user:password@localhost:5432/otsem_db
JWT_SECRET=your-secret-key
FRONTEND_BASE_URL=https://your-frontend.com
PORT=5000

# Inter Bank
INTER_CLIENT_ID=
INTER_CLIENT_SECRET=
INTER_CERT_PATH=
INTER_KEY_PATH=

# FDBank
FDBANK_API_URL=
FDBANK_API_KEY=

# OKX Exchange
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_PASSPHRASE=
OKX_TRON_DEPOSIT_ADDRESS=
OKX_SOLANA_DEPOSIT_ADDRESS=

# Resend (email)
RESEND_API_KEY=

# Didit KYC
DIDIT_CLIENT_ID=
DIDIT_CLIENT_SECRET=

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

## API Documentation

Once the server is running:

- **Swagger UI:** `/api/swagger`
- **Scalar API Reference:** `/api/docs`
- **OpenAPI spec:** auto-generated to `openapi.json`

## Project Structure

```
src/
├── auth/               # JWT authentication, guards, roles
├── customers/          # Customer profiles (PF/PJ), KYC, limits
├── accounts/           # Banking accounts, balances
├── payments/           # Outbound Pix payments
├── pix-keys/           # Pix key management
├── statements/         # Balance & statement queries
├── transactions/       # Transaction ledger
├── transfers/          # Internal BRL transfers
├── wallet/             # Multi-network crypto wallets
├── boleto-payments/    # Boleto payment workflow
├── affiliates/         # Affiliate program & commissions
├── inter/              # Inter Bank integration
├── fdbank/             # FDBank integration
├── okx/                # OKX exchange integration
├── solana/             # Solana blockchain operations
├── tron/               # Tron blockchain operations
├── banking/            # Bank provider abstraction layer
├── didit/              # Didit KYC verification
├── admin-dashboard/    # Admin analytics & management
├── users/              # User management
├── mail/               # Email service (Resend)
├── push-notifications/ # Web push notifications
├── system-settings/    # Runtime system configuration
├── prisma/             # Database module
├── common/             # Shared DTOs
├── config/             # Configuration schemas
└── @types/             # Custom type declarations

prisma/
├── schema.prisma       # Database schema (23 models, 19 enums)
└── migrations/         # Sequential migrations
```

## Scripts

| Command                    | Description                           |
| -------------------------- | ------------------------------------- |
| `npm run start:dev`        | Start development server (watch mode) |
| `npm run build`            | Build for production                  |
| `npm run start:prod`       | Start production server               |
| `npm run db:migrate:dev`   | Create new migration                  |
| `npm run db:migrate:deploy`| Apply pending migrations              |
| `npm run db:seed`          | Seed default admin user               |
| `npm run lint`             | Run ESLint with auto-fix              |
| `npm run format`           | Run Prettier                          |
| `npm test`                 | Run unit tests                        |
| `npm run test:cov`         | Run tests with coverage               |
| `npm run test:e2e`         | Run end-to-end tests                  |

## Deployment

The project deploys via GitHub Actions on push to `main`:

1. Build and package the application
2. SCP artifact to DigitalOcean droplet
3. Install production dependencies
4. Run Prisma migrations
5. Reload PM2 process

See `.github/workflows/deploy.yml` for the full pipeline.

## License

UNLICENSED — Private project.
