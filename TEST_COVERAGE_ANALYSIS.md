# Test Coverage Analysis — OTSEM API

**Date:** 2026-02-06
**Overall Coverage:** 11.85% statements | 12.59% branches | 9.45% functions | 11.42% lines

## Current Test Inventory

| Test File | Tests | Stmts% | Branch% | Funcs% | Lines% |
|-----------|-------|--------|---------|--------|--------|
| `auth/auth.service.spec.ts` | 29 | 70.05 | 65.62 | 63.63 | 70.58 |
| `auth/utils/document-validator.spec.ts` | 15 | 95.45 | 84.37 | 100.00 | 96.55 |
| `auth/guards.spec.ts` | 12 | (incl. above) | | | |
| `wallet/wallet.service.spec.ts` | 37 | 18.72 | 24.74 | 22.10 | 18.54 |
| `boleto-payments/boleto-payments.service.spec.ts` | 26 | 49.23 | 51.56 | 40.74 | 50.26 |
| `transactions/transactions.service.spec.ts` | 24 | 51.41 | 34.65 | 56.52 | 52.35 |
| `customers/customers.service.spec.ts` | 15 | 27.77 | 21.34 | 26.31 | 28.84 |
| `customers/kyc-limits.service.spec.ts` | 13 | (incl. above) | | | |
| `app.controller.spec.ts` | 2 | — | — | — | — |
| `test/app.e2e-spec.ts` | 1 | — | — | — | — |
| **Total** | **174** | | | | |

## Modules With Zero Test Coverage

These 18 source modules have no tests whatsoever:

### Tier 1 — Critical Business Logic (highest impact)

| Module | Key Files | Why It Matters |
|--------|-----------|---------------|
| **payments** | `payments.service.ts`, `payments.controller.ts` | Core outbound Pix payment flow. Financial operations with no verification. |
| **transfers** | `transfers.service.ts` | Internal BRL transfers between users. Balance-affecting with no safety net. |
| **accounts** | `accounts.service.ts` | Account balance and limit management. Foundation for all financial operations. |
| **pix-keys** | `pix-keys.service.ts` | Pix key CRUD and lookup. Required for deposits and payments. |
| **statements** | `statements.service.ts` | Balance queries and statement generation. Complex aggregation logic. |

### Tier 2 — External Integrations (high risk of runtime failures)

| Module | Key Files | Why It Matters |
|--------|-----------|---------------|
| **inter** | `inter-pix.service.ts`, `inter-banking.service.ts`, `inter-webhook.service.ts`, `inter-auth.service.ts` | Primary bank integration (Inter Bank). 1,400+ lines in inter-pix.service alone. Webhook processing, auth token management, Pix operations. |
| **fdbank** | `fdbank-banking.service.ts`, `fdbank-pix.service.ts` | Alternate bank provider. Same risks as Inter. |
| **okx** | `okx.service.ts`, `okx-spot.service.ts`, `okx-auth.service.ts` | OKX exchange integration for BRL↔USDT conversions. 800+ lines of trading logic. |
| **didit** | `didit-kyc.service.ts` | KYC verification provider. Identity verification flow. |
| **banking** | `banking-gateway.service.ts` | Provider abstraction layer that switches between Inter and FDBank at runtime. |

### Tier 3 — Supporting Services

| Module | Key Files | Why It Matters |
|--------|-----------|---------------|
| **users** | `users.service.ts` | User management, password changes, user creation. |
| **affiliates** | `affiliates.service.ts` | Affiliate program, commission tracking, referral codes. |
| **admin-dashboard** | `admin-dashboard.service.ts` | Admin analytics and management endpoints. |
| **mail** | `mail.service.ts` | Email sending via Resend (password resets, notifications). |
| **solana** | `solana.service.ts` | Solana blockchain operations, wallet generation, USDT transfers. |
| **tron** | `tron.service.ts` | Tron blockchain operations, TRC-20 transfers. |
| **system-settings** | `system-settings.service.ts` | Runtime configuration (spread, fees, feature flags). |
| **push-notifications** | `push-notifications.service.ts` | Web push notification subscriptions and delivery. |

## Gaps in Existing Tests

Even for modules that have tests, significant gaps exist:

### auth (70% stmts)
- Missing: `refreshToken()` flow, PIN validation, biometric auth, rate limiting on login attempts
- Missing: Controller-level tests (route guards, request validation)

### transactions (51% stmts)
- Missing: Lines 244–348 (fee calculation and complex transaction flows), lines 583–645, 700–710
- Missing: Concurrent transaction handling, webhook-triggered status updates

### boleto-payments (49% stmts)
- Missing: Controller tests, Inter Bank failure scenarios, partial payment handling

### customers (28% stmts)
- Missing: `customer-balance.service.ts` (entirely untested), `customer-kyc.service.ts`, `kyc-upgrade.service.ts`
- Missing: PF vs PJ validation differences, address management, customer deactivation flows

### wallet (19% stmts)
- Missing: `sell-processing.service.ts` (entirely untested — 447 lines), `wallet.controller.ts`
- Missing: Private key encryption, actual blockchain transaction submission, OKX withdrawal flow, affiliate commission on conversions

## Recommendations — Prioritized

### 1. Immediate Priority: Core Financial Services

These modules handle money movement and have the highest bug-impact risk.

**a) `payments.service.ts`** — Outbound Pix payments
- Test payment creation, validation, status transitions
- Test insufficient balance rejection
- Test duplicate payment prevention

**b) `transfers.service.ts`** — Internal BRL transfers
- Test sender/receiver balance updates
- Test self-transfer prevention
- Test insufficient funds handling

**c) `accounts.service.ts`** — Account management
- Test balance queries, limit enforcement
- Test account activation/deactivation
- Test daily/monthly limit calculations

**d) `pix-keys.service.ts`** — Pix key management
- Test key creation, validation (CPF, email, phone, random)
- Test duplicate key prevention
- Test key ownership verification

### 2. High Priority: External Integration Error Handling

These services call third-party APIs and need mocked tests for resilience.

**a) `inter-pix.service.ts`** (1,400+ lines)
- Mock Inter Bank API responses
- Test auth token refresh and expiry
- Test webhook payload processing and validation
- Test error recovery (timeout, 5xx, invalid response)

**b) `okx.service.ts`** (800+ lines)
- Mock OKX API for spot trades
- Test order placement, status polling, cancellation
- Test price slippage protection
- Test withdrawal address validation

**c) `banking-gateway.service.ts`**
- Test provider switching (Inter ↔ FDBank)
- Test fallback behavior on provider failure

**d) `sell-processing.service.ts`** (447 lines, 0% coverage)
- Test USDT sell flow end-to-end
- Test blockchain confirmation handling
- Test failure and refund scenarios

### 3. Medium Priority: Security & Authorization

**a) Controller-level tests** — Currently zero controllers are tested
- Verify route guards (`@UseGuards`) are correctly applied
- Verify role-based access control per endpoint
- Verify request validation (DTO rejection of invalid input)

**b) `didit-kyc.service.ts`**
- Test KYC session creation
- Test webhook callback processing
- Test document verification status mapping

### 4. Lower Priority: Supporting Services

**a) `statements.service.ts`**
- Test date range filtering, pagination
- Test balance aggregation accuracy

**b) `affiliates.service.ts`**
- Test commission calculation
- Test referral code validation

**c) `mail.service.ts`**
- Test email template rendering
- Test Resend API error handling

**d) `system-settings.service.ts`**
- Test configuration retrieval and caching
- Test admin-only update restrictions

### 5. E2E Test Suite

The current E2E test (`test/app.e2e-spec.ts`) has only 1 test. A proper E2E suite should cover:

- **User registration → KYC → Account creation** full flow
- **Pix deposit → Balance update → Pix payment** flow
- **BRL → USDT conversion** flow with mocked OKX
- **Internal transfer** between two users
- **Boleto payment** admin approval workflow
- **Auth flows**: login, token refresh, password reset

## Coverage Targets

| Scope | Current | Target | Notes |
|-------|---------|--------|-------|
| Overall | 11.4% | 50%+ | Focus on business logic, not DTOs/modules |
| Financial services (payments, transfers, accounts, transactions) | ~13% | 80%+ | Highest risk area |
| Auth | 70% | 85%+ | Close gaps in refresh token, controllers |
| External integrations (inter, okx, fdbank) | ~2% | 60%+ | Mock-heavy, focus on error paths |
| Controllers (all) | 0% | 40%+ | Guard verification, input validation |
| E2E | ~0% | Key flows | At least 5 critical user journeys |
