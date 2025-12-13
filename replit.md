# OTSEM API

A NestJS backend API for financial services including PIX payments, customer management, and multi-bank integration.

## Overview

This is a backend-only NestJS API that provides:
- User authentication (JWT-based)
- Customer management with KYC
- PIX payment processing
- Multi-bank integration (Inter, FDBank)
- OKX crypto exchange integration
- Wallet management

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Passport JWT
- **API Docs**: Swagger (available at `/api/docs`)

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `JWT_SECRET` - Secret for JWT token signing

### Optional (External Services)
- `RESEND_API_KEY` - For email sending (password reset)
- `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET` - Banco Inter API credentials
- `INTER_CERT_PATH`, `INTER_KEY_PATH` - Banco Inter certificate paths
- `FDBANK_API_KEY`, `FDBANK_API_SECRET` - FDBank API credentials
- `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_API_PASSPHRASE` - OKX exchange credentials

## Running Locally

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

## API Documentation

Available at `http://localhost:5000/api/docs` when running.

## Project Structure

- `src/` - Application source code
  - `auth/` - Authentication module
  - `users/` - User management
  - `customers/` - Customer management with KYC
  - `inter/` - Banco Inter integration
  - `fdbank/` - FDBank integration
  - `okx/` - OKX exchange integration
  - `payments/` - Payment processing
  - `wallet/` - Wallet management
  - `prisma/` - Prisma service
- `prisma/` - Database schema and migrations
