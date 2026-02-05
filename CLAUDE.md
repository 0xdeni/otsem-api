# CLAUDE.md — OTSEM API

## Project Overview

OTSEM API is a Banking as a Service (BaaS) platform built with NestJS and TypeScript. It provides Pix payments, crypto wallet management (BRL <-> USDT conversions), KYC verification, and affiliate commission tracking. The API integrates with Inter Bank, FDBank, OKX exchange, Solana/Tron/EVM blockchains, and Didit KYC.

**Primary language:** Portuguese (Brazilian). Code comments, error messages, API descriptions, and documentation are largely in pt-BR.

## Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Runtime          | Node.js 20+                                     |
| Framework        | NestJS 11                                       |
| Language         | TypeScript 5.7 (ES2023 target)                  |
| ORM              | Prisma 6.19                                     |
| Database         | PostgreSQL                                      |
| Auth             | JWT (passport-jwt) with refresh tokens          |
| Validation       | class-validator + class-transformer             |
| API Docs         | Swagger UI (`/api/swagger`) + Scalar (`/api/docs`) |
| Email            | Resend                                          |
| Crypto           | @solana/web3.js, tronweb, ethers, alchemy-sdk   |
| Exchange         | OKX API                                         |
| Process Manager  | PM2                                             |
| CI/CD            | GitHub Actions -> DigitalOcean (SCP + SSH)      |

## Essential Commands

```bash
# Install dependencies
npm install

# Generate Prisma client (required before running)
npx prisma generate

# Run development server (watch mode)
npm run start:dev

# Build for production
npm run build          # runs prisma generate + nest build

# Start production
npm run start:prod     # node dist/main.js

# Database
npm run db:migrate:dev     # prisma migrate dev (creates migrations)
npm run db:migrate:deploy  # prisma migrate deploy (applies migrations)
npm run db:seed            # seed default admin user
npm run db:erase-customers # delete all customer data (utility)

# Linting & formatting
npm run lint           # eslint with auto-fix
npm run format         # prettier

# Testing
npm test               # jest unit tests
npm run test:watch     # jest watch mode
npm run test:cov       # jest with coverage
npm run test:e2e       # end-to-end tests

# Utility scripts
npm run inter:test     # test Inter Bank auth
npm run webhook:setup  # setup webhook endpoints
```

## Project Structure

```
src/
├── main.ts                    # Bootstrap, CORS, Swagger, ValidationPipe
├── app.module.ts              # Root module importing all feature modules
├── app.controller.ts          # Health check / root endpoint
├── app.service.ts
├── prisma/                    # PrismaModule (global DB access)
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── auth/                      # Authentication & authorization
│   ├── auth.controller.ts     # login, register, forgot/reset, me
│   ├── auth.service.ts        # JWT issuance, bcrypt hashing
│   ├── jwt.strategy.ts        # Passport JWT strategy
│   ├── jwt-auth.guard.ts      # Guard: requires valid JWT
│   ├── roles.guard.ts         # Guard: checks @Roles() decorator
│   ├── roles.decorator.ts     # @Roles(Role.ADMIN) decorator
│   ├── roles.enum.ts          # Role enum (ADMIN, CUSTOMER)
│   ├── owner-or-admin.guard.ts # Guard: resource ownership check
│   ├── jwt-payload.type.ts    # JWT payload interface
│   └── dto/                   # LoginDto, ForgotPasswordDto, etc.
├── customers/                 # Customer profiles (PF/PJ), KYC
│   ├── customers.controller.ts
│   ├── customers.service.ts
│   ├── customer-balance.service.ts
│   ├── customer-kyc.service.ts
│   ├── kyc-limits.service.ts
│   ├── kyc-upgrade.controller.ts
│   ├── kyc-upgrade.service.ts
│   ├── dto/                   # CreateCustomerLocalDto, QueryCustomersDto
│   ├── entities/
│   └── guards/
├── accounts/                  # Banking accounts (balance, limits)
├── statements/                # Balance & statement queries
├── transactions/              # Transaction ledger
├── payments/                  # Outbound Pix payments
├── pix-keys/                  # Pix key management
├── wallet/                    # Multi-network crypto wallets
├── inter/                     # Inter Bank integration
│   ├── inter-banking.controller.ts
│   ├── inter-banking.service.ts
│   ├── inter-pix.controller.ts
│   ├── inter-pix.service.ts
│   ├── inter-pix-keys.controller.ts
│   ├── inter-webhook.controller.ts
│   └── ...
├── fdbank/                    # FDBank integration
├── okx/                       # OKX exchange integration
├── solana/                    # Solana blockchain operations
├── tron/                      # Tron blockchain operations
├── affiliates/                # Affiliate program & commissions
├── admin-dashboard/           # Admin analytics & management
├── banking/                   # Banking provider abstraction
├── system-settings/           # Runtime system configuration
├── mail/                      # Email service (Resend)
├── didit/                     # Didit KYC verification
├── push-notifications/        # Web push notifications
├── common/                    # Shared DTOs (AddressDto, etc.)
├── config/                    # Configuration/validation schemas
├── @types/                    # Custom type declarations
└── scripts/                   # Internal utility scripts

prisma/
├── schema.prisma              # Full database schema (22 models, 13+ enums)
├── migrations/                # 20+ sequential migrations
├── seed.ts                    # Default admin user creation
└── erase-customers.ts         # Data cleanup utility

scripts/
└── change-password.js         # Admin password reset (direct DB)
```

## Architecture Patterns

### Module Structure (NestJS Convention)

Every feature follows the NestJS module pattern:

```
feature/
├── feature.module.ts          # Module declaration
├── feature.controller.ts      # HTTP route handlers
├── feature.service.ts         # Business logic
└── dto/                       # Request/response validation classes
```

### Authentication & Authorization

- **JWT Bearer tokens** in Authorization header
- **Access token:** 15-minute expiry
- **Refresh token:** 7-day expiry, stored in DB
- **Password hashing:** bcrypt with 10 salt rounds
- **Guards are applied per-controller or per-route:**
  ```typescript
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  ```
- Three guards: `JwtAuthGuard`, `RolesGuard`, `OwnerOrAdminGuard`
- Two roles: `ADMIN` (full access), `CUSTOMER` (scoped to own resources)

### Validation

Global `ValidationPipe` is configured in `main.ts`:
- `whitelist: true` — strips unknown properties
- `forbidNonWhitelisted: true` — rejects unknown properties
- `transform: true` — auto-transforms payloads to DTO classes

DTOs use `class-validator` decorators with `@ApiProperty()` for Swagger:
```typescript
@ApiProperty({ example: 'joao@email.com' })
@IsEmail()
email: string;
```

### Error Handling

Standard NestJS `HttpException` subclasses thrown from services:
- `UnauthorizedException`, `BadRequestException`, `ConflictException`
- `ForbiddenException`, `NotFoundException`
- No custom global exception filter — relies on NestJS defaults
- Error messages are often in pt-BR or use snake_case keys (e.g., `'invalid_credentials'`, `'email_already_exists'`)

### Logging

Uses NestJS built-in `Logger` per service:
```typescript
private readonly logger = new Logger(MyService.name);
this.logger.log('message');
this.logger.error('error message');
```

## Database Conventions

### Prisma Schema (`prisma/schema.prisma`)

- **ID generation:** `cuid()` or `uuid()` depending on model
- **Timestamps:** `createdAt` (default now) + `updatedAt` (@updatedAt)
- **Decimal fields:** Use `@db.Decimal(precision, scale)` for monetary values
- **Monetary values in Payments/Deposits:** Stored as `Int` (centavos)
- **Monetary values in Account/Transaction:** Stored as `Decimal(15, 2)`
- **Enums:** Defined in Prisma schema, used throughout TypeScript
- **Indexes:** Applied strategically on foreign keys, status fields, and lookup fields
- **Relations:** Explicit `onDelete` behavior (Cascade, SetNull, Restrict)
- **Table mapping:** Some models use `@@map("table_name")` for snake_case table names

### Migration Workflow

```bash
# Create a new migration during development
npm run db:migrate:dev

# Deploy migrations to production
npm run db:migrate:deploy
```

Migration names follow the format: `YYYYMMDDHHMMSS_description`

## Code Style

### ESLint Configuration (`eslint.config.mjs`)

- Flat config format (ESLint 9+)
- Extends: `eslint.configs.recommended`, `typescript-eslint.configs.recommendedTypeChecked`, `eslint-plugin-prettier/recommended`
- Key rules:
  - `@typescript-eslint/no-explicit-any`: **off** (any is permitted)
  - `@typescript-eslint/no-floating-promises`: **warn**
  - `@typescript-eslint/no-unsafe-argument`: **warn**

### Prettier (`.prettierrc`)

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

### TypeScript (`tsconfig.json`)

- Target: ES2023
- Module: NodeNext
- `strictNullChecks: true`, `noImplicitAny: true`
- `emitDecoratorMetadata: true`, `experimentalDecorators: true`
- `strictBindCallApply: false`

### Naming Conventions

- **Files:** kebab-case (`customer-balance.service.ts`, `jwt-auth.guard.ts`)
- **Classes:** PascalCase (`CustomersService`, `JwtAuthGuard`)
- **DTOs:** PascalCase with suffix (`CreateCustomerLocalDto`, `LoginDto`)
- **Enums:** PascalCase with UPPER_SNAKE values (`Role.ADMIN`, `PaymentStatus.PENDING`)
- **Database fields:** camelCase in Prisma schema
- **Environment variables:** UPPER_SNAKE_CASE

## Environment Variables

Key variables required (configured via `.env` or server environment):

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # Secret for JWT signing
FRONTEND_BASE_URL     # Frontend URL for CORS origin
PORT                  # Server port (default 5000 in dev, 3333 in production)

# Inter Bank
INTER_CLIENT_ID
INTER_CLIENT_SECRET
INTER_CERT_PATH
INTER_KEY_PATH

# OKX Exchange
OKX_API_KEY
OKX_SECRET_KEY
OKX_PASSPHRASE

# Resend (email)
RESEND_API_KEY

# Didit KYC
DIDIT_CLIENT_ID
DIDIT_CLIENT_SECRET

# Web Push
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. Triggers on push to `main` branch
2. Uses Node.js 20
3. Runs `npm ci`, `prisma generate`, `npm run build`
4. Creates tarball of `dist/`, `package.json`, `prisma/` (schema + migrations)
5. SCPs artifact to DigitalOcean droplet
6. SSHs into server: extracts, installs production deps, runs `prisma migrate deploy`, reloads PM2

## API Documentation

- **Swagger UI:** `http://localhost:{PORT}/api/swagger`
- **Scalar API Reference:** `http://localhost:{PORT}/api/docs`
- **OpenAPI spec:** Auto-generated to `./openapi.json` on server startup

## Key Domain Concepts

| Concept | Description |
| --- | --- |
| **Customer (PF/PJ)** | Individual (CPF) or company (CNPJ) with KYC levels |
| **Account** | Banking account with BRL balance, daily/monthly limits |
| **Pix** | Brazilian instant payment system — keys, payments, deposits |
| **Wallet** | Multi-network crypto wallet (Solana, Tron, EVM chains) |
| **Conversion** | BRL <-> USDT exchange via OKX (BUY or SELL flow) |
| **Affiliate** | Partner with referral code, earns commission on conversions |
| **KYC Levels** | LEVEL_1/2/3 with increasing monthly transaction limits |
| **Bank Provider** | Runtime-switchable between Inter and FDBank |
| **Transaction** | Ledger entry tracking all balance-affecting operations |

## Important Notes for AI Assistants

1. **Do not commit `.env` files** or any secrets (API keys, certificates, private keys).
2. **Run `npx prisma generate`** after any schema change before building or running.
3. **Monetary values** — be aware of the dual representation: `Int` (centavos) in Payment/Deposit models vs `Decimal` in Account/Transaction models.
4. **All DTOs must include `@ApiProperty()` decorators** for Swagger documentation.
5. **Use `class-validator` decorators** on all DTO fields for input validation.
6. **Follow the existing module pattern** when adding new features: module + controller + service + dto/.
7. **Error messages** may be in Portuguese or snake_case English keys — follow the existing convention in the module you're editing.
8. **Guards are composable** — combine `JwtAuthGuard`, `RolesGuard`, and `OwnerOrAdminGuard` as needed.
9. **Prisma schema is the source of truth** for the database — always create migrations for schema changes.
10. **The `any` type is permitted** by ESLint config — but prefer typed interfaces where practical.
