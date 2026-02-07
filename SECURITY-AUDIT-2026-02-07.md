# OTSEM API — Security Audit Report

**Date:** 2026-02-07
**Triggered by:** Unauthorized activity detected on production (otsempay.com)
**Branch:** `claude/track-test-completion-WeaqD`

---

## 1. Incident Summary

At approximately **07:26 UTC** on Feb 7, 2026, an unknown actor registered the account `pentest777@test.com` on the production system. By **07:48 UTC**, five fake PIX_IN (deposit) transactions had been injected:

| Description             | Amount (BRL)  | Status   |
|-------------------------|---------------|----------|
| Test charge R$ 10       | R$ 10,00      | Pendente |
| Test charge R$ 100      | R$ 100,00     | Pendente |
| Test charge R$ 1000     | R$ 1.000,00   | Pendente |
| Test charge R$ 10000    | R$ 10.000,00  | Pendente |
| Test charge R$ 100000   | R$ 100.000,00 | Pendente |

A customer account was also deleted during the incident. The admin manually deleted the `pentest` account afterwards.

Additional anomaly: the "Disponivel" field displayed **R$ NaN**, indicating a bug in balance calculation when processing invalid/fake transaction data.

---

## 2. How the Attack Worked

```
1. Attacker visits otsempay.com

2. Registers account: POST /auth/register
   → email: pentest777@test.com
   → No email verification required — account immediately active

3. Discovers webhook endpoint (from Swagger docs at /api/swagger or /api/docs)
   → POST /inter/webhooks/receive/pix — documented as "Público"

4. Sends fake PIX webhook payloads directly to the endpoint:

   POST /inter/webhooks/receive/pix
   Content-Type: application/json
   (no x-inter-signature header needed — validation was skipped)

   {
     "pix": [{
       "endToEndId": "E1234567890TEST",
       "txid": "<matching-customer-txid>",
       "valor": 100000,
       "infoPagador": "Test charge R$ 100000",
       "pagador": { "nome": "Test", "cpf": "00000000000" }
     }]
   }

5. Webhook processed without signature validation
   → Fake PIX_IN transactions created in the database
   → Transactions show as "Pendente" on the admin dashboard

6. Attacker may have also explored other unprotected endpoints:
   → GET /users          — list all users (no auth)
   → GET /accounts/:id/summary — view any balance (no auth)
   → POST /tron/send-usdt      — drain Tron hot wallet (no auth)
   → POST /solana/send-sol     — drain Solana hot wallet (no auth)
   → POST /okx/withdraw-usdt   — drain OKX exchange (any JWT, no admin check)
```

---

## 3. Root Cause

Two primary vulnerabilities enabled the attack:

**3.1 — Open registration, no email verification.**
`POST /auth/register` creates a fully active account instantly. No confirmation email, no manual approval.

**3.2 — Unauthenticated webhook endpoints with optional signature validation.**
`POST /inter/webhooks/receive/pix` was completely public. Signature validation was skipped if the `x-inter-signature` header was omitted. If `INTER_WEBHOOK_SECRET` was not set in the environment, the validation function returned `true` unconditionally.

---

## 4. What Was Vulnerable vs What Is Now Secured

### 4.1 — Webhook Endpoints (CRITICAL — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `POST /inter/webhooks/receive/pix` | Public, signature optional, no rate limit | Signature **mandatory**, rate-limited (30/min/IP via ThrottlerGuard), rejected webhooks logged with IP + User-Agent |
| `POST /inter/webhooks/receive/boletos` | Same | Same fix applied |
| `POST /fdbank/webhooks/receive/pix` | Public, **zero** authentication | Requires `x-webhook-secret` header matching `FDBANK_WEBHOOK_SECRET` env var; uses `crypto.timingSafeEqual` |
| `POST /webhook-fd` (legacy) | Public, zero authentication | Same secret validation as above |

**Key change in `inter-webhook.service.ts`:**
```
BEFORE: if (!secret) return true;   // bypass validation
NOW:    if (!secret) return false;   // reject webhook
```

**Key change in `inter-webhook.controller.ts`:**
```
BEFORE: if (signature) { validate... }  // skip if no header
NOW:    if (!signature) { reject }       // mandatory
```

### 4.2 — Blockchain Controllers (CRITICAL — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `POST /tron/send-usdt` | **No auth at all** — anyone on the internet could drain the hot wallet | `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)` |
| `POST /tron/create-wallet` | No auth | Admin only |
| `GET /tron/hot-wallet` | No auth — exposed hot wallet address and balances | Admin only |
| `GET /tron/balance` | No auth | Admin only |
| `POST /solana/send-sol` | **No auth at all** — same risk as Tron | Admin only |
| `GET /solana/hot-wallet` | No auth | Admin only |

### 4.3 — OKX Exchange Controller (CRITICAL — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `POST /okx/withdraw-usdt` | Any authenticated user (including customers) | `@Roles(ADMIN)` only |
| `POST /okx/withdraw-simple` | Any authenticated user | Admin only |
| `POST /okx/withdraw-crypto` | Any authenticated user | Admin only |
| `POST /okx/buy-and-check-history` | Any authenticated user | Admin only |
| `POST /okx/buy-crypto` | Any authenticated user | Admin only |
| `POST /okx/transfer-to-funding` | Any authenticated user | Admin only |
| `POST /okx/transfer-crypto-to-funding` | Any authenticated user | Admin only |
| `GET /okx/balance-*`, `GET /okx/all-balances` | Any authenticated user | Admin only |
| `GET /okx/spot/*`, `POST /okx/spot/order` | Any authenticated user | `@Roles(CUSTOMER, ADMIN)` — customer-facing |

### 4.4 — Users Controller (CRITICAL — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `GET /users` | **No auth** — anyone could list all users | `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)` |
| `PATCH /users/:id` | No auth — anyone could modify any user | Admin only |
| `PATCH /users/:id/password` | No auth — anyone could change any password | Admin only |

### 4.5 — Accounts Controller (HIGH — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `GET /accounts/:customerId/summary` | **No auth** — anyone could view any balance by guessing ID | `JwtAuthGuard` + `RolesGuard` + `@Roles(CUSTOMER, ADMIN)` |

### 4.6 — Test PIX Endpoint (HIGH — FIXED)

| Endpoint | Before | Now |
|---|---|---|
| `POST /inter/pix/testar-envio` | Any authenticated user (no `@Roles`); `console.log` leaked request bodies | `@Roles(ADMIN)` only; `console.log` removed |

### 4.7 — RolesGuard Default Behavior (HIGH — FIXED)

| Behavior | Before | Now |
|---|---|---|
| When `@UseGuards(RolesGuard)` applied but no `@Roles()` decorator | **Returned `true`** — allowed any authenticated user | **Default-deny** — requires ADMIN role; logs a warning |
| `@Roles` resolution | Only checked handler-level | Checks handler-level first, then falls back to class-level `@Roles` |

### 4.8 — Audit Logging & Rate Limiting (NEW)

| Feature | Details |
|---|---|
| **Rejected webhook logging** | Failed signature/missing header attempts are logged to `WebhookLog` table with IP address and User-Agent |
| **Rate limiting** | Webhook endpoints now have `ThrottlerGuard` — 30 requests/minute/IP (via `@nestjs/throttler`) |
| **WebhookLog schema** | `ipAddress` and `userAgent` columns added to track webhook origin |

---

## 5. Files Changed

| File | What Changed |
|---|---|
| `src/auth/roles.guard.ts` | Default-deny when no `@Roles`; class-level fallback; warning logs |
| `src/tron/tron.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` |
| `src/solana/solana.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` |
| `src/okx/okx.controller.ts` | Added `RolesGuard`; `@Roles(ADMIN)` on exchange ops; `@Roles(CUSTOMER, ADMIN)` on spot |
| `src/users/users.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` at controller level |
| `src/accounts/accounts.controller.ts` | Added auth guards + `@Roles(CUSTOMER, ADMIN)` on summary |
| `src/inter/controllers/inter-webhook.controller.ts` | Mandatory signature; rate limiting; IP/UA logging; re-throw on auth errors |
| `src/inter/services/inter-webhook.service.ts` | Fail-closed when `INTER_WEBHOOK_SECRET` not set; `logRejectedWebhook()` method; IP/UA tracked in all webhook logs |
| `src/inter/controllers/inter-pix.controller.ts` | `testar-envio` restricted to ADMIN; `console.log` removed |
| `src/fdbank/controllers/fdbank-webhook.controller.ts` | Shared secret validation via `x-webhook-secret` header |
| `src/fdbank/controllers/fdbank-webhook-legacy.controller.ts` | Same secret validation on legacy `/webhook-fd` endpoint |
| `prisma/schema.prisma` | `ipAddress` and `userAgent` columns added to `WebhookLog` |
| `prisma/migrations/20260207100000_add_webhook_audit_fields` | Migration for new columns |
| `src/app.module.ts` | `ThrottlerModule` added globally |

---

## 6. What You Must Do Now

### IMMEDIATE (before deploying)

- [ ] **Set `INTER_WEBHOOK_SECRET`** in production environment — get the HMAC secret from your Inter Bank dashboard/configuration. Without this, **all Inter PIX webhooks will be rejected**.
- [ ] **Set `FDBANK_WEBHOOK_SECRET`** in production environment — choose a strong random secret and configure FDBank to send it in the `x-webhook-secret` header. Without this, **all FDBank webhooks will be rejected**.
- [ ] **Rotate `JWT_SECRET`** in production — the attacker had access to the user list and could have captured tokens. Generate a new secret to invalidate all existing sessions.
- [ ] **Review server access logs** for 07:00–08:00 UTC on Feb 7 — identify the attacker's IP, check what other endpoints they hit, and whether any funds were actually moved.
- [ ] **Clean up the database** — delete the fake PIX transactions, deposits, and any related records created by `pentest777@test.com`. Check for other suspicious accounts.
- [ ] **Merge and deploy** this branch (`claude/track-test-completion-WeaqD`) to production.

### AFTER DEPLOYING — Verify Fixes

- [ ] `POST /inter/webhooks/receive/pix` without `x-inter-signature` header → should return **400**
- [ ] `POST /fdbank/webhooks/receive/pix` without `x-webhook-secret` header → should return **400**
- [ ] `POST /webhook-fd` without `x-webhook-secret` header → should return **400**
- [ ] `GET /tron/hot-wallet` without JWT → should return **401**
- [ ] `POST /tron/send-usdt` with customer JWT → should return **403**
- [ ] `GET /solana/hot-wallet` without JWT → should return **401**
- [ ] `POST /okx/withdraw-usdt` with customer JWT → should return **403**
- [ ] `GET /users` without JWT → should return **401**
- [ ] `GET /accounts/<any-id>/summary` without JWT → should return **401**
- [ ] `POST /inter/pix/testar-envio` with customer JWT → should return **403**
- [ ] Confirm legitimate Inter Bank webhooks still process correctly (test with a real small PIX)

### SOON (next sprint)

| Priority | Action | Why |
|---|---|---|
| **HIGH** | Add email verification to registration | Prevents instant account creation by attackers |
| **HIGH** | Add signature validation to Didit KYC webhook | Same vulnerability pattern as Inter/FDBank — currently unprotected |
| **HIGH** | Verify `OwnerOrAdminGuard` JWT field mapping | Uses `user.userId` which may be undefined if the JWT field is actually `sub` — could silently allow access |
| **MEDIUM** | Add IP whitelisting for bank webhooks | Restrict webhook endpoints to known Inter/FDBank IP ranges as defense-in-depth |
| **MEDIUM** | Add rate limiting to registration and login | Prevent brute-force and mass account creation |
| **MEDIUM** | Validate webhook payload schemas | Reject malformed data before processing — prevents injection of unexpected fields |
| **MEDIUM** | Fix the `R$ NaN` balance bug | The "Disponivel" field shows NaN when invalid transaction data is present |
| **LOW** | Disable Swagger/Scalar in production | `/api/swagger` and `/api/docs` expose your full API surface to attackers — the pentest user likely used these to discover the webhook endpoint |
| **LOW** | Restrict `openapi.json` access | Auto-generated on startup and publicly accessible — documents all admin/internal endpoints |
| **LOW** | Review `logger.debug()` calls | Some log full request bodies/headers which may leak sensitive data in production logs |

---

## 7. Summary

**9 critical/high vulnerabilities** were found and fixed. The most severe: webhook endpoints accepted unsigned requests, blockchain controllers had zero authentication (hot wallets were exposed to the internet), and the OKX exchange account could be drained by any registered customer.

The fixes enforce mandatory authentication on all sensitive endpoints, fail-closed webhook validation, rate limiting, and audit logging. The RolesGuard now defaults to deny instead of allow.

**Before deploying, you must set `INTER_WEBHOOK_SECRET` and `FDBANK_WEBHOOK_SECRET` — otherwise webhook processing will stop working.**
