# CLAUDE.md — AI Assistant Guide for OTSEM API

## Project Overview

OTSEM API is a Banking-as-a-Service (BaaS) platform built with NestJS. It integrates PIX payments (via Banco Inter and FDBank), cryptocurrency conversions (BRL ↔ USDT via OKX), multi-network wallets, KYC verification (via Didit), and an affiliate commission system. The API serves a financial services frontend for Brazilian customers (PF/PJ).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript 5.7) |
| Runtime | Node.js 20+ |
| Database | PostgreSQL |
| ORM | Prisma 6.19 |
| Auth | JWT (Passport.js), argon2/bcrypt for hashing |
| Validation | class-validator + class-transformer |
| API Docs | Swagger UI + Scalar API Reference |
| Blockchain | @solana/web3.js, tronweb, ethers.js |
| Exchange | OKX API (trading + withdrawals) |
| Email | Resend |
| Push | web-push |
| Process Mgr | PM2 (production) |
| CI/CD | GitHub Actions → DigitalOcean Droplet |

## Project Structure

```
otsem-api/
├── src/
│   ├── main.ts                    # Bootstrap, CORS, Swagger, Scalar, ValidationPipe
│   ├── app.module.ts              # Root module — imports all feature modules
│   ├── app.controller.ts          # Health check (GET /health)
│   ├── app.service.ts
│   ├── @types/                    # Custom TypeScript type augmentations
│   ├── prisma/                    # PrismaService (extends PrismaClient)
│   ├── auth/                      # JWT auth, login, register, password reset
│   ├── users/                     # User CRUD, profile, spread management
│   ├── customers/                 # Customer PF/PJ, KYC, balance, limits
│   ├── accounts/                  # Account management
│   ├── transactions/              # Transaction history and queries
│   ├── statements/                # Account statements, PIX transaction views
│   ├── payments/                  # Payment processing
│   ├── pix-keys/                  # PIX key management
│   ├── banking/                   # BankingGatewayService (abstracts Inter/FDBank)
│   ├── system-settings/           # Global config (active bank provider switching)
│   ├── inter/                     # Banco Inter: auth, PIX, keys, webhooks, polling
│   ├── fdbank/                    # FDBank: customer, PIX, transfers, webhooks
│   ├── okx/                       # OKX exchange: trading, withdrawals, auth
│   ├── wallet/                    # Crypto wallets, BUY/SELL USDT conversions
│   ├── solana/                    # Solana USDT transfers and balance checks
│   ├── tron/                      # Tron USDT-TRC20 transfers
│   ├── didit/                     # KYC verification via Didit API
│   ├── affiliates/                # Affiliate system and commission tracking
│   ├── admin-dashboard/           # Admin analytics (users, wallets, conversions)
│   ├── mail/                      # Email service (Resend) with templates
│   ├── push-notifications/        # Web push notifications
│   ├── common/                    # Shared DTOs (address, PIX limits, etc.)
│   └── config/                    # Environment validation utilities
├── prisma/
│   ├── schema.prisma              # Database schema (all models, enums, relations)
│   ├── migrations/                # Auto-generated Prisma migrations
│   ├── seed.ts                    # Database seed script
│   └── erase-customers.ts        # Admin utility: wipe customer data
├── scripts/
│   ├── test-inter-auth.ts         # Test Banco Inter authentication
│   ├── setup-webhooks.ts          # Configure bank webhooks
│   └── migrate-conversions.ts     # Data migration utility
├── test/
│   └── jest-e2e.json              # E2E test configuration
├── inter-keys/                    # Banco Inter certificates (gitignored)
├── docs/                          # Additional documentation
├── .github/workflows/deploy.yml   # CI/CD pipeline
├── ecosystem.config.js            # PM2 production config
├── tsconfig.json                  # TypeScript configuration
├── eslint.config.mjs              # ESLint flat config
└── package.json                   # Dependencies and scripts
```

## Common Commands

```bash
# Development
npm run start:dev          # Start with hot reload (nest start --watch)
npm run start:debug        # Start with debugger attached

# Build
npm run build              # prisma generate && nest build → outputs to dist/

# Database
npm run db:migrate:dev     # Create/apply dev migration (prisma migrate dev)
npm run db:migrate:deploy  # Apply migrations in production (prisma migrate deploy)
npm run prisma:generate    # Regenerate Prisma client after schema changes
npm run db:seed            # Seed the database (tsx prisma/seed.ts)
npm run db:erase-customers # Erase all customer data (admin utility)

# Code Quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting

# Testing
npm run test               # Jest unit tests
npm run test:watch         # Jest in watch mode
npm run test:cov           # Jest with coverage report
npm run test:e2e           # End-to-end tests

# Utilities
npm run inter:test         # Test Banco Inter auth flow
npm run webhook:setup      # Set up bank webhooks
```

## Architecture Patterns

### Module Organization

Each feature module follows the NestJS convention:

```
module-name/
├── module-name.module.ts       # @Module definition
├── module-name.controller.ts   # HTTP route handlers
├── module-name.service.ts      # Business logic
├── dto/                        # Input validation (class-validator DTOs)
│   ├── create-*.dto.ts
│   └── update-*.dto.ts
├── services/                   # Additional services (if module is complex)
├── controllers/                # Additional controllers (if multiple route groups)
├── tasks/                      # @Cron / @Interval scheduled tasks
├── types/                      # TypeScript interfaces and types
└── decorators/                 # Custom decorators
```

### Key Design Patterns

- **Gateway Pattern**: `BankingGatewayService` in `src/banking/` delegates to either Inter or FDBank based on `SystemSettings.activeBankProvider`. When adding banking features, work through this gateway rather than calling Inter/FDBank services directly.
- **forwardRef**: Used to resolve circular dependencies between modules (e.g., Auth ↔ Affiliates). Follow the same pattern if you encounter circular imports.
- **Global ValidationPipe**: Configured in `main.ts` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. All incoming request bodies are validated and stripped of unknown properties automatically.
- **Scheduled Tasks**: `@nestjs/schedule` is used for polling (Inter PIX status, FDBank PIX polling). Tasks are defined in `tasks/` subdirectories within modules.

### Authentication & Authorization

- **JWT tokens** expire in 8 hours. Payload contains `{ sub (userId), email, role, customerId }`.
- **Guards** are applied per-route or per-controller:
  - `JwtAuthGuard` — validates Bearer token
  - `RolesGuard` + `@Roles(Role.ADMIN)` — role-based access
  - `OwnerOrAdminGuard` — checks resource ownership or admin privilege
- **AuthRequest** type extends Express Request with `user` payload. Access via `@Req() req: AuthRequest`.

```typescript
// Typical protected route pattern
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get('admin-only')
async adminEndpoint(@Req() req: AuthRequest) {
  // req.user.sub = userId, req.user.customerId, req.user.role
}
```

### Database (Prisma)

- Schema is at `prisma/schema.prisma`. All models, enums, and relations are defined there.
- After changing the schema, run `npm run db:migrate:dev` to create a migration, then `npm run prisma:generate` to update the client.
- The `PrismaService` in `src/prisma/` extends `PrismaClient` and is injected throughout the app.
- Monetary values use `Decimal` types (`@db.Decimal(18, 2)` for BRL, `@db.Decimal(18, 6)` for USDT).
- Payment amounts in `Payment` and `Deposit` models are stored as integers (centavos).

### Key Data Models

| Model | Purpose |
|---|---|
| User | Auth credentials, role, spread config, preferences |
| Customer | PF/PJ data, KYC status, bank integration IDs, affiliate link |
| Account | BRL balance, PIX key, daily/monthly limits |
| Transaction | All financial movements (PIX, conversion, fee, reversal) |
| Wallet | Crypto wallet per network (Solana, Tron, Ethereum, etc.) |
| Conversion | BRL ↔ USDT exchange tracking with full audit trail |
| Payment | Outgoing PIX payments |
| Deposit | Incoming PIX deposits |
| PixKey | PIX key registration and validation state |
| Affiliate / AffiliateCommission | Referral tracking and commission payouts |
| SystemSettings | Singleton for active bank provider and feature flags |
| WebhookLog | Audit trail for all incoming webhooks |

### Key Enums

- **Role**: `ADMIN`, `CUSTOMER`
- **CustomerType**: `PF` (Pessoa Fisica), `PJ` (Pessoa Juridica)
- **AccountStatus**: `not_requested`, `requested`, `in_review`, `approved`, `rejected`, `suspended`
- **ConversionType**: `BUY` (BRL→USDT), `SELL` (USDT→BRL)
- **ConversionStatus**: `PENDING` → `PIX_SENT` → `USDT_BOUGHT` → `USDT_WITHDRAWN` → `COMPLETED` (BUY flow) or `PENDING` → `USDT_RECEIVED` → `USDT_SOLD` → `PIX_OUT_SENT` → `COMPLETED` (SELL flow)
- **WalletNetwork**: `SOLANA`, `ETHEREUM`, `POLYGON`, `BSC`, `TRON`, `BITCOIN`, `AVALANCHE`, `ARBITRUM`, `OPTIMISM`, `BASE`
- **BankProvider**: `INTER`, `FDBANK`

## Code Conventions

### Naming

- **Files**: kebab-case with type suffix — `auth.service.ts`, `create-customer.dto.ts`, `jwt-auth.guard.ts`
- **Classes**: PascalCase — `AuthService`, `CustomersController`, `CreateCustomerDto`
- **Methods/variables**: camelCase
- **Enums**: PascalCase names, UPPER_SNAKE_CASE values

### DTOs and Validation

- All request DTOs use `class-validator` decorators (`@IsString()`, `@IsEmail()`, `@IsOptional()`, `@ValidateIf()`, etc.)
- DTOs use `class-transformer`'s `@Type()` for nested objects
- Swagger documentation is added via `@ApiProperty()` on DTO fields and `@ApiOperation()` / `@ApiTags()` on controllers
- The global `ValidationPipe` strips unknown fields and rejects requests with forbidden properties

### Error Handling

- Use NestJS built-in exceptions: `BadRequestException`, `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `ConflictException`
- External API errors are caught with try/catch and logged via NestJS `Logger`
- Logger pattern: `private readonly logger = new Logger(ClassName.name)`

### Formatting & Linting

- **Prettier**: single quotes, trailing commas (`all`)
- **ESLint**: TypeScript-recommended rules with type checking enabled
  - `@typescript-eslint/no-explicit-any`: off (intentionally allowed)
  - `@typescript-eslint/no-floating-promises`: warn
  - `@typescript-eslint/no-unsafe-argument`: warn

### TypeScript Configuration

- Target: ES2023, Module: nodenext
- `strictNullChecks`: enabled
- `noImplicitAny`: enabled
- `experimentalDecorators` and `emitDecoratorMetadata`: enabled (required for NestJS)
- Output to `./dist` with source maps and declaration files

## API Documentation

When the app is running:

- **Swagger UI**: `http://localhost:{PORT}/api/swagger`
- **Scalar (modern docs)**: `http://localhost:{PORT}/api/docs`
- **OpenAPI JSON**: auto-generated as `openapi.json` in project root on startup
- **Health check**: `GET /health`

Default port is `5000` locally, `3333` in production.

## Environment Variables

Required variables for development:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/otsem_db
JWT_SECRET=your-secret-key
```

Banking (Banco Inter):
```env
INTER_CLIENT_ID=
INTER_CLIENT_SECRET=
INTER_API_URL=https://cdpj.partners.bancointer.com.br
INTER_CERT_PATH=./inter-keys/certificado.crt
INTER_KEY_PATH=./inter-keys/chave_privada.key
```

Banking (FDBank):
```env
FDBANK_API_URL=
FDBANK_API_KEY=
```

Exchange (OKX):
```env
OKX_API_URL=https://www.okx.com
OKX_SOLANA_DEPOSIT_ADDRESS=
OKX_TRON_DEPOSIT_ADDRESS=
```

Blockchain:
```env
SOLANA_HOT_WALLET_PRIVATE_KEY=
TRON_HOT_WALLET_PRIVATE_KEY=
```

Services:
```env
RESEND_API_KEY=
FRONTEND_BASE_URL=
PRODUCT_NAME=OTSEM Bank
```

## CI/CD Pipeline

Defined in `.github/workflows/deploy.yml`. Triggered on push to `main`.

1. Checkout → Node 20 setup → `npm ci` → `prisma generate` → `nest build`
2. Artifact (dist + package files + Prisma schema/migrations) is tarred and SCP'd to DigitalOcean droplet
3. On server: extract, install prod deps, resolve/deploy Prisma migrations, PM2 reload

Production runs via PM2 (`ecosystem.config.js`) on port 3333 at `/var/www/otsem-api`.

## Key Business Flows

### BUY Flow (BRL → USDT)

1. `GET /wallet/quote-buy` — fetch OKX rate, apply spread, return quote
2. `POST /wallet/buy-usdt` — create Conversion (PENDING), initiate PIX via banking gateway
3. Webhook confirms PIX sent → status `PIX_SENT`
4. Place OKX market BUY order → status `USDT_BOUGHT`
5. Withdraw USDT to customer wallet → status `USDT_WITHDRAWN`
6. Blockchain confirmation → status `COMPLETED`, affiliate commission calculated

### SELL Flow (USDT → BRL)

1. `GET /wallet/quote-sell-usdt` — fetch rate, calculate quote
2. `GET /wallet/sell-tx-data` — return transaction data for client-side signing
3. `POST /wallet/submit-signed-sell` — customer submits signed txHash
4. Monitor blockchain for USDT arrival at OKX deposit address → `USDT_RECEIVED`
5. Place OKX market SELL order → `USDT_SOLD`
6. Send PIX to customer's registered PIX key → `PIX_OUT_SENT` → `COMPLETED`

### Customer KYC Flow

1. Register via `POST /auth/register`
2. Create customer profile via `POST /customers/pf/self` or `/pj/self`
3. Initiate KYC via Didit integration (selfie + document verification)
4. Didit webhook updates verification status
5. Admin reviews and approves/rejects via `PATCH /customers/:id/approve`
6. On approval, system provisions customer on active banking provider

## Working With This Codebase

### Adding a New Module

1. Create the module directory under `src/`
2. Create `*.module.ts`, `*.controller.ts`, `*.service.ts`, and `dto/` directory
3. Register the module in `src/app.module.ts` imports
4. Inject `PrismaService` for database access
5. Add Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) to controllers
6. Add guards (`@UseGuards(JwtAuthGuard)`) for protected routes

### Adding a New Prisma Model

1. Define the model in `prisma/schema.prisma`
2. Run `npm run db:migrate:dev` to create a migration
3. Run `npm run prisma:generate` to update the client types
4. Access via `this.prisma.modelName` in services

### Adding a New Endpoint

1. Define the DTO in `dto/` with class-validator decorators
2. Add the route handler in the controller with appropriate guards and Swagger decorators
3. Implement business logic in the service layer
4. The global ValidationPipe handles input validation automatically

### Testing

- Unit tests go next to source files as `*.spec.ts`
- E2E tests go in `test/` directory
- Run `npm run test` for unit tests, `npm run test:e2e` for integration tests

## Important Notes

- **Monetary precision**: BRL uses `Decimal(18, 2)`, USDT uses `Decimal(18, 6)`. Payment/Deposit amounts are stored as integers (centavos). Always handle decimal arithmetic carefully.
- **Banking gateway**: The `BankingGatewayService` reads `SystemSettings` to determine which provider (Inter or FDBank) to use. Do not call bank-specific services directly for payment operations.
- **Webhook idempotency**: Webhook handlers use `WebhookLog` to track processed events. The `endToEnd` field is the primary identifier for PIX transactions.
- **Client-side signing**: The SELL flow uses client-side transaction signing. The backend generates transaction data, the frontend signs it, and the backend verifies/submits it. Never handle customer private keys on the server.
- **Certificates**: Banco Inter requires mTLS certificates stored in `inter-keys/`. These are gitignored and must be provisioned separately on each environment.
- **Spread calculation**: Each user can have a custom `spreadValue` on the User model and `spreadPercent` on the Customer model. The conversion service uses these for profit margin calculations.
