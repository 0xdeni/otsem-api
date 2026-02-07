# OTSEM API - Security Audit Report

**Date:** 2026-02-07
**Scope:** Full codebase review (src/, prisma/, scripts/, config, CI/CD)

---

## Executive Summary

This audit identified **38 security vulnerabilities** across the OTSEM API codebase. The findings include **11 critical**, **10 high**, **12 medium**, and **5 low** severity issues. The most urgent problems are:

1. **Missing authentication/authorization on admin and financial endpoints** (anyone can create PIX transfers, manage wallets, approve KYC)
2. **Private keys stored in plaintext** in the database despite the field being named `encryptedPrivateKey`
3. **Hardcoded JWT secret fallback** that would allow complete auth bypass
4. **No webhook signature verification** on the Didit KYC webhook (attackers can approve any account)
5. **25 known dependency vulnerabilities** (5 high severity, including `elliptic` crypto library)

---

## CRITICAL Severity (11)

### C1. Missing Authentication: FDBank PIX Transfer Controller

- **File:** `src/fdbank/controllers/fdbank-pix-transfer.controller.ts:8-42`
- **Issue:** The controller has **zero authentication guards**. All endpoints are fully public.
- **Impact:** Anyone on the internet can create PIX transfers, generate QR codes, and capture QR data without authenticating.
- **Fix:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)`.

### C2. Privilege Escalation: Admin Wallets Controller Missing @Roles

- **File:** `src/admin-dashboard/admin-wallets.controller.ts:14-48`
- **Issue:** Only `JwtAuthGuard` is applied; `RolesGuard` and `@Roles(Role.ADMIN)` are missing.
- **Impact:** Any authenticated CUSTOMER can list all wallets, update OKX whitelist status, and toggle any wallet active/inactive.
- **Fix:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)`.

### C3. Privilege Escalation: Affiliates Controller Missing @Roles

- **File:** `src/affiliates/affiliates.controller.ts:18-110`
- **Issue:** Only `JwtAuthGuard` is applied; no role restriction.
- **Impact:** Any authenticated user can create/update/delete affiliates, manipulate spread rates, payout addresses, and mark commissions as paid.
- **Fix:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)`.

### C4. KYC Bypass: Didit Webhook Has No Signature Verification

- **File:** `src/didit/didit.controller.ts:14-86`
- **Issue:** The webhook accepts any POST request and updates customer KYC status without verifying the request origin. Compare with Inter webhook (`inter-webhook.controller.ts:157-174`) which properly validates HMAC signatures.
- **Impact:** An attacker can approve any customer's KYC by POSTing a crafted payload with their `session_id`.
- **Fix:** Implement webhook signature verification (HMAC or similar) matching the Didit provider's documentation.

### C5. IDOR: Account Summary Endpoint Missing Ownership Check

- **File:** `src/accounts/accounts.controller.ts:30-42`
- **Issue:** `GET /:customerId/summary` accepts any `customerId` and returns that customer's account data. No ownership check is performed.
- **Impact:** Any CUSTOMER can view any other customer's account balance and summary.
- **Fix:** Add `OwnerOrAdminGuard` or verify `req.user.customerId === customerId`.

### C6. Hardcoded JWT Secret Fallback

- **File:** `src/auth/jwt.strategy.ts:13`
- **Code:** `secretOrKey: process.env.JWT_SECRET || 'default-secret-change-me'`
- **Impact:** If `JWT_SECRET` env var is unset, any attacker who knows this default string can forge valid JWT tokens and impersonate any user, including admins.
- **Fix:** Remove the fallback; throw an error at startup if `JWT_SECRET` is missing.

### C7. Private Keys Stored in Plaintext

- **Files:** `prisma/schema.prisma:416`, `src/wallet/wallet.service.ts:87,112,153`
- **Issue:** The `encryptedPrivateKey` field stores raw hex-encoded private keys without any encryption. Solana keys are stored as `Buffer.from(keypair.secretKey).toString('hex')`, Tron keys are stored as plaintext strings.
- **Impact:** A database breach exposes ALL customer cryptocurrency private keys, resulting in total loss of funds.
- **Fix:** Implement field-level encryption using AES-256-GCM with a KMS-managed key (e.g., AWS KMS, HashiCorp Vault). Decrypt only at signing time in memory.

### C8. Private Keys Returned in API Responses

- **File:** `src/wallet/wallet.service.ts:84-125`
- **Code:** `return { publicKey, secretKey, wallet };`
- **Impact:** Private keys are sent over the network to clients on wallet creation. Even over HTTPS, this is a significant exposure vector (client-side storage, browser history, logs).
- **Fix:** Never return private keys in API responses. If the user must back up their key, use a dedicated secure export flow.

### C9. Token Revocation Not Enforced

- **File:** `src/auth/jwt.strategy.ts:17-28`
- **Issue:** The `validate()` method never checks if the associated refresh token has been revoked. The `revoked` field exists in the DB (`prisma/schema.prisma:165`) and is set on logout (`auth.service.ts:455`), but JWTs remain valid.
- **Impact:** Logging out does not actually invalidate tokens. Stolen tokens remain usable until they expire.
- **Fix:** Check token revocation status in the `validate()` method, or implement a token blacklist cache.

### C10. No Logout Endpoint Exposed

- **File:** `src/auth/auth.controller.ts`
- **Issue:** `AuthService.logout()` exists (`auth.service.ts:451-462`) but no HTTP endpoint exposes it. There is no `POST /auth/logout` route.
- **Impact:** Users cannot programmatically log out. Combined with C9, this means sessions cannot be terminated.
- **Fix:** Add a `POST /auth/logout` endpoint that revokes refresh tokens.

### C11. Sensitive Data Logging - OKX Credentials

- **File:** `src/okx/services/okx-auth.service.ts:23,25`
- **Code:** `console.log('OKX prehash:', prehash)` and `console.log('OKX sign:', sign)`
- **Impact:** OKX API authentication data (including HMAC signatures) is logged to stdout in production, potentially exposing exchange API credentials.
- **Fix:** Remove all `console.log` statements containing sensitive data.

---

## HIGH Severity (10)

### H1. CORS Allows All Origins If Env Var Missing

- **File:** `src/main.ts:12-23`
- **Code:** `origin: allowedOrigins ?? true` — if `FRONTEND_BASE_URL` is unset, CORS defaults to allowing ALL origins.
- **Impact:** Any malicious website can make authenticated cross-origin requests with cookies/tokens.
- **Fix:** Default to denying all origins; require explicit whitelist.

### H2. XSS in Email Templates

- **File:** `src/mail/mail.service.ts:85-86,118`
- **Issue:** `recipientName` and `message` parameters are interpolated directly into HTML email templates without sanitization.
- **Impact:** Attackers can inject HTML/JavaScript into emails via crafted names or messages.
- **Fix:** HTML-escape all user-supplied values before template interpolation.

### H3. File Upload Without Validation

- **File:** `src/customers/kyc-upgrade.controller.ts:40-89`
- **Issue:** KYC file uploads accept any file type (no MIME whitelist), no per-file size limit, and the file extension is taken directly from user input.
- **Impact:** Malicious file upload (executables, scripts), disk exhaustion attacks.
- **Fix:** Whitelist MIME types (PDF, JPG, PNG), enforce size limits, validate file extensions server-side.

### H4. Weak Password Requirements

- **Files:** `src/auth/dto/login.dto.ts:18-19`, `src/users/dto/register.dto.ts:6`, `src/auth/dto/reset-password.dto.ts:7`
- **Issue:** Minimum password length is only 6-8 characters with no complexity requirements. Passwords like `123456` are accepted.
- **Impact:** Trivially brutable passwords on a financial platform.
- **Fix:** Require minimum 12 characters with mixed case, numbers, and special characters.

### H5. No Rate Limiting on Financial Endpoints

- **Files:** `src/wallet/wallet.controller.ts:308-323`, `src/payments/`, `src/transfers/`
- **Issue:** Rate limiting (`@Throttle`) is only applied to auth endpoints. Withdrawal, payment, and transfer endpoints have no rate limiting.
- **Impact:** Brute-force parameter attacks, rapid-fire withdrawal attempts.
- **Fix:** Apply `@Throttle()` to all financial operation endpoints.

### H6. Race Condition in Balance Checks

- **File:** `src/wallet/wallet.service.ts:335,393`
- **Issue:** Balance is checked in application memory before the blockchain transaction executes. Concurrent requests could both pass the balance check simultaneously.
- **Impact:** Potential double-spend or overdraw on concurrent withdrawal requests.
- **Fix:** Use database-level pessimistic locking (e.g., `SELECT ... FOR UPDATE`) or serialize account mutations.

### H7. Password Change Doesn't Invalidate Tokens

- **File:** `src/auth/auth.service.ts:321-324`, `src/auth/jwt.strategy.ts:17-28`
- **Issue:** `passwordChangedAt` is updated on password reset, but `jwt.strategy.validate()` never checks it. Old JWTs issued before the password change remain valid.
- **Impact:** If a password is compromised and changed, the attacker's existing tokens still work.
- **Fix:** Compare `payload.iat` against `user.passwordChangedAt` in the JWT validation.

### H8. No Refresh Token Endpoint

- **File:** `src/auth/auth.controller.ts`
- **Issue:** Refresh tokens are generated and stored but no `POST /auth/refresh` endpoint exists.
- **Impact:** Clients must re-authenticate every 15 minutes when the access token expires, which incentivizes storing passwords client-side.
- **Fix:** Implement a token refresh endpoint.

### H9. No Account Lockout After Failed Login Attempts

- **File:** `src/auth/auth.service.ts`
- **Issue:** While rate limiting exists (5 attempts/60s), there is no persistent account lockout. Attackers can continue trying indefinitely at the throttled rate.
- **Impact:** Slow brute-force attacks over days/weeks.
- **Fix:** Lock accounts after N failed attempts within a time window; require email verification or admin unlock.

### H10. Validation Gaps - Inline @Body() Types

- **Files:** `src/solana/solana.controller.ts:44`, `src/okx/okx.controller.ts:65-71,85-88,146-151`, `src/pix-keys/pix-keys.controller.ts:82`
- **Issue:** Multiple endpoints use inline TypeScript types (`@Body() body: { ... }`) instead of DTO classes. The global `ValidationPipe` only validates class-validator decorators on DTO classes, so these inputs bypass all validation.
- **Impact:** Unvalidated amounts, addresses, currencies, and status values pass directly to services.
- **Fix:** Create proper DTO classes with `@ApiProperty()` and `class-validator` decorators for every endpoint.

---

## MEDIUM Severity (12)

### M1. No HTTPS Enforcement

- **File:** `src/main.ts:59-62`
- **Issue:** No HTTPS redirect or HSTS headers at the application level. Relies entirely on reverse proxy configuration.
- **Fix:** Add Helmet middleware with HSTS, or enforce HTTPS redirects.

### M2. Role Enum Mismatch

- **File:** `src/auth/roles.enum.ts:1`
- **Issue:** TypeScript type defines `'ADMIN' | 'CLIENT'` but Prisma schema uses `ADMIN | CUSTOMER`. Code uses `CUSTOMER` everywhere.
- **Fix:** Update `roles.enum.ts` to match the Prisma schema.

### M3. Inconsistent bcrypt Salt Rounds

- **File:** `src/auth/auth.service.ts:17,303`
- **Issue:** Login/register use `SALT_ROUNDS = 10`, but password reset uses hardcoded `12`.
- **Fix:** Use the `SALT_ROUNDS` constant everywhere.

### M4. Default Admin Credentials in Seed

- **File:** `prisma/seed.ts:6-7`
- **Code:** Email `admin@otsembank.com`, password `Admin@123`
- **Fix:** Generate a random password at seed time and print it once. Require change on first login.

### M5. URL Parameter Injection in External API Calls

- **Files:** `src/tron/tron.service.ts:113`, `src/okx/services/okx.service.ts:80,100,123,141`
- **Issue:** User-supplied values are interpolated directly into URLs without encoding.
- **Fix:** Use `URL`/`URLSearchParams` APIs or `encodeURIComponent()`.

### M6. Partial Private Key Logging

- **File:** `src/solana/solana.service.ts:57`
- **Code:** `this.logger.error('Primeiros 10 chars: ${privateKey.substring(0, 10)}...')`
- **Fix:** Never log any portion of private keys.

### M7. Hot Wallet Address Logged on Startup

- **Files:** `src/solana/solana.service.ts:51`, `src/tron/tron.service.ts:52`
- **Fix:** Remove or redact in production logging.

### M8. Hardcoded PIX Keys / Deposit Addresses

- **Files:** `src/inter/services/inter-pix.service.ts:410`, `src/wallet/wallet.service.ts:647`
- **Issue:** Hardcoded PIX key `50459025000126` used as fallback.
- **Fix:** Require configuration via environment variables without fallbacks.

### M9. Missing parseInt Radix

- **File:** `src/affiliates/affiliates.controller.ts:46-47`
- **Fix:** Use `parseInt(page, 10)`.

### M10. Unlimited Concurrent Sessions

- **Issue:** No limit on active sessions per user. No way to list or invalidate other sessions.
- **Fix:** Implement session limits and session management endpoints.

### M11. No Recipient Address Format Validation

- **Files:** `src/wallet/wallet.service.ts:355-435`, `src/solana/solana.service.ts:139-145`, `src/tron/tron.service.ts:99-102`
- **Issue:** Recipient addresses are not validated against chain-specific formats before transaction signing.
- **Fix:** Validate Solana (base58, 32-44 chars), Tron (`T` + 33 alphanumeric), EVM (0x + 40 hex) before processing.

### M12. OKX Withdrawal Missing Fund Password

- **File:** `src/okx/services/okx.service.ts:456-476`
- **Issue:** The simplified withdrawal method omits the `pwd` (fund password) field.
- **Fix:** Always require fund password for OKX withdrawals.

---

## LOW Severity (5)

### L1. Password Reset URL Disclosed in Non-Production

- **File:** `src/auth/auth.service.ts:283-286`
- **Issue:** Reset URL returned in response when `NODE_ENV !== 'production'` or `SHOW_RESET_URL=true`.
- **Fix:** Ensure `SHOW_RESET_URL` is never set in production.

### L2. No Global Guard Application

- **File:** `src/main.ts`
- **Issue:** Guards are applied per-controller rather than globally, making it easy to forget on new endpoints.
- **Fix:** Apply `JwtAuthGuard` globally via `APP_GUARD` and use a `@Public()` decorator for public routes.

### L3. Transaction Addresses in Logs

- **Files:** `src/wallet/wallet.service.ts:413`, `src/tron/tron.service.ts:201,237`
- **Issue:** Recipient addresses logged in transactions, enabling transaction correlation.
- **Fix:** Redact or hash addresses in logs.

### L4. Unnecessary JSON Round-Trip

- **File:** `src/customers/kyc-upgrade.service.ts:57`
- **Code:** `JSON.parse(JSON.stringify(dto.documents))`
- **Fix:** Remove unnecessary serialization.

### L5. Missing `@IsNotEmpty()` on Some DTO Fields

- **Issue:** Some DTOs have `@IsString()` but not `@IsNotEmpty()`, allowing empty strings.
- **Fix:** Add `@IsNotEmpty()` where blank values are invalid.

---

## Dependency Vulnerabilities (npm audit)

**25 total** (5 high, 3 moderate, 17 low):

| Package | Severity | Issue |
|---------|----------|-------|
| `elliptic` | HIGH | Risky cryptographic implementation (affects ethers, alchemy-sdk) |
| `bigint-buffer` | HIGH | Buffer overflow via `toBigIntLE()` (affects @solana/spl-token) |
| `@isaacs/brace-expansion` | HIGH | Uncontrolled resource consumption |
| `qs` | HIGH | arrayLimit bypass allows DoS |
| `webpack` | HIGH | buildHttp SSRF bypass (affects @nestjs/cli) |

**Fix:** Run `npm audit fix` for non-breaking fixes. Evaluate `npm audit fix --force` for breaking changes (especially migrating `@solana/spl-token` and `alchemy-sdk`).

---

## Remediation Priority

### Immediate (before any production traffic)

1. **C1-C5:** Fix all missing auth guards and IDOR issues
2. **C6:** Remove hardcoded JWT secret fallback
3. **C7-C8:** Encrypt private keys, stop returning them in responses
4. **C11:** Remove sensitive data from logs
5. **H1:** Fix CORS to deny by default

### Within 1 week

6. **C4:** Add Didit webhook signature verification
7. **C9-C10:** Implement token revocation and logout endpoint
8. **H2-H3:** Fix XSS in email templates and file upload validation
9. **H4-H5:** Strengthen passwords and add rate limiting to financial endpoints
10. **H6:** Add pessimistic locking for financial operations
11. **H10:** Replace all inline `@Body()` types with validated DTOs

### Within 2 weeks

12. **H7-H9:** Fix token invalidation on password change, add refresh endpoint, add account lockout
13. **M1-M12:** Address all medium-severity issues
14. Run `npm audit fix` and evaluate dependency upgrades
15. Apply global guards (`APP_GUARD`) to prevent future auth omissions
