# OTSEM API — Security Audit Report

**Date:** 2026-02-07
**Triggered by:** Unauthorized activity detected on production (otsempay.com)

---

## 1. Incident Summary

At approximately **07:26 UTC** on Feb 7, 2026, an unknown actor registered the account `pentest777@test.com` on the production system. By **07:48 UTC**, five fake PIX_IN (deposit) transactions had been injected into the system:

| Description             | Amount (BRL)  | Status   |
|-------------------------|---------------|----------|
| Test charge R$ 10       | R$ 10,00      | Pendente |
| Test charge R$ 100      | R$ 100,00     | Pendente |
| Test charge R$ 1000     | R$ 1.000,00   | Pendente |
| Test charge R$ 10000    | R$ 10.000,00  | Pendente |
| Test charge R$ 100000   | R$ 100.000,00 | Pendente |

A customer account was also deleted during the incident. The admin manually deleted the `pentest` account afterwards.

Additional anomaly observed: the "Disponivel" field displayed **R$ NaN**, indicating a bug in balance calculation when processing invalid/fake transaction data.

---

## 2. Root Cause Analysis

The attacker exploited two primary vulnerabilities:

### 2.1 Open Registration (No Email Verification)

The `POST /auth/register` endpoint allows anyone to create an account with just an email and password. There is no email verification step, and KYC LEVEL_1 can be auto-approved with a valid CPF. This gave the attacker a fully active account in seconds.

### 2.2 Unauthenticated Webhook Endpoints (Critical)

The PIX webhook endpoint `POST /inter/webhooks/receive/pix` was **completely public** — no JWT auth, no IP whitelisting, and signature validation was **optional**:

- If no `x-inter-signature` header was sent, validation was skipped entirely
- If `INTER_WEBHOOK_SECRET` was not configured in the environment, the validation function returned `true` unconditionally

This allowed the attacker to POST arbitrary JSON payloads to the webhook endpoint, creating fake PIX deposit transactions for any customer account.

---

## 3. Vulnerabilities Found & Fixed

### CRITICAL — Now Fixed

| # | Vulnerability | File(s) | Before | After |
|---|---|---|---|---|
| 1 | **Inter webhook: no mandatory signature validation** | `inter-webhook.controller.ts`, `inter-webhook.service.ts` | Signature check skipped if header missing; returned `true` if env var not set | Signature header is **required**; rejects if `INTER_WEBHOOK_SECRET` not configured |
| 2 | **FDBank webhook: zero authentication** | `fdbank-webhook.controller.ts`, `fdbank-webhook-legacy.controller.ts` | No auth of any kind — fully public POST endpoint | Requires `x-webhook-secret` header matching `FDBANK_WEBHOOK_SECRET` env var; uses `crypto.timingSafeEqual` |
| 3 | **Tron controller: no auth guards** | `tron.controller.ts` | No `@UseGuards`, no `@Roles` — `POST /tron/send-usdt` was publicly accessible (anyone could drain the hot wallet) | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` at controller level |
| 4 | **Solana controller: no auth guards** | `solana.controller.ts` | Same as Tron — `POST /solana/send-sol` was publicly accessible | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` at controller level |
| 5 | **OKX controller: no role restrictions** | `okx.controller.ts` | Only `@UseGuards(JwtAuthGuard)` — any authenticated customer could withdraw USDT, buy crypto, view exchange balances, transfer funds | Added `RolesGuard`; all exchange operations restricted to `@Roles(Role.ADMIN)`; customer-facing spot endpoints set to `@Roles(Role.CUSTOMER, Role.ADMIN)` |
| 6 | **Users controller: no auth at all** | `users.controller.ts` | No guards — anyone could `GET /users` (list all users), `PATCH /users/:id` (modify any user), `PATCH /users/:id/password` (change any password) | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` at controller level |
| 7 | **Accounts summary: no auth** | `accounts.controller.ts` | `GET /accounts/:customerId/summary` had no guards — anyone could view any customer's balance by guessing their ID | Added `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.CUSTOMER, Role.ADMIN)` |
| 8 | **Test PIX endpoint: no role restriction** | `inter-pix.controller.ts` | `POST /inter/pix/testar-envio` — no `@Roles` decorator, so any authenticated user (including customers) could send real PIX payments through Inter; also had `console.log` leaking request data | Added `@Roles(Role.ADMIN)`; removed `console.log` |
| 9 | **RolesGuard: default-allow** | `roles.guard.ts` | When `@UseGuards(RolesGuard)` was applied but no `@Roles()` decorator was present, the guard returned `true` — allowing any authenticated user | Changed to **default-deny**: if no `@Roles` is specified, only ADMIN is allowed; also now checks class-level `@Roles` as fallback |

---

## 4. Required Environment Variables (Post-Deploy)

After deploying these fixes, the following environment variables **must** be set on the production server. Without them, all webhook processing will be rejected (fail-closed):

```
INTER_WEBHOOK_SECRET=<your-hmac-secret-from-inter-bank>
FDBANK_WEBHOOK_SECRET=<your-shared-secret-for-fdbank>
```

If either variable is missing, the respective webhook endpoint will reject all incoming requests and log an error.

---

## 5. Files Changed

| File | Changes |
|---|---|
| `src/auth/roles.guard.ts` | Default-deny policy; class-level `@Roles` fallback; logging |
| `src/tron/tron.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` |
| `src/solana/solana.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` |
| `src/okx/okx.controller.ts` | Added `RolesGuard`; `@Roles(ADMIN)` on exchange ops; `@Roles(CUSTOMER, ADMIN)` on spot |
| `src/users/users.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(ADMIN)` |
| `src/accounts/accounts.controller.ts` | Added `JwtAuthGuard`, `RolesGuard`, `@Roles(CUSTOMER, ADMIN)` on summary |
| `src/inter/controllers/inter-webhook.controller.ts` | Signature now mandatory on PIX + Boleto endpoints |
| `src/inter/services/inter-webhook.service.ts` | Rejects when `INTER_WEBHOOK_SECRET` not configured |
| `src/inter/controllers/inter-pix.controller.ts` | `testar-envio` restricted to ADMIN; removed `console.log` |
| `src/fdbank/controllers/fdbank-webhook.controller.ts` | Added shared secret validation via `x-webhook-secret` header |
| `src/fdbank/controllers/fdbank-webhook-legacy.controller.ts` | Same shared secret validation on legacy `/webhook-fd` endpoint |

---

## 6. Remaining Recommendations (Not Yet Implemented)

These items are not critical blockers but should be addressed soon:

### HIGH Priority

| # | Issue | Recommendation |
|---|---|---|
| 1 | **No email verification on registration** | Add email verification flow — send a confirmation link before activating the account |
| 2 | **KYC LEVEL_1 auto-approval** | Require manual review or additional verification before granting any KYC level |
| 3 | **Didit KYC webhook has no signature verification** | Add signature/secret validation to the Didit webhook endpoint |
| 4 | **OwnerOrAdminGuard uses `user.userId`** | Verify the JWT payload maps correctly; `userId` may be undefined if the field is actually `sub` |

### MEDIUM Priority

| # | Issue | Recommendation |
|---|---|---|
| 5 | **IP whitelisting for bank webhooks** | Add middleware to restrict webhook endpoints to known bank IP ranges (Inter, FDBank) |
| 6 | **Rate limiting** | Add rate limiting on registration, login, and webhook endpoints to prevent abuse |
| 7 | **Webhook payload schema validation** | Validate that webhook payloads match expected schemas before processing (reject malformed data) |
| 8 | **Audit logging** | Log all admin actions, auth events, and webhook processing to a dedicated audit table |
| 9 | **Balance NaN bug** | Investigate and fix the `R$ NaN` display in "Disponivel" — likely caused by invalid data from fake transactions |

### LOW Priority

| # | Issue | Recommendation |
|---|---|---|
| 10 | **Debug logging in production** | Review all `this.logger.debug()` calls that log full request bodies/headers — these may leak sensitive data in production logs |
| 11 | **Swagger/Scalar exposure** | Consider disabling `/api/swagger` and `/api/docs` in production, or protecting them behind admin auth |
| 12 | **OpenAPI spec auto-generation** | The `openapi.json` file is written on startup — ensure it's not publicly accessible, as it documents all endpoints including internal/admin ones |

---

## 7. How the Attack Worked (Step-by-Step)

```
1. Attacker visits otsempay.com
2. Registers account: POST /auth/register
   - email: pentest777@test.com
   - No email verification required → account immediately active

3. Discovers webhook endpoint (likely from Swagger docs at /api/swagger or /api/docs)
   - POST /inter/webhooks/receive/pix — documented as "Público"

4. Sends fake PIX webhook payloads directly to the endpoint:
   POST /inter/webhooks/receive/pix
   Content-Type: application/json
   (no x-inter-signature header needed)

   {
     "pix": [{
       "endToEndId": "E1234567890TEST",
       "txid": "<matching-customer-txid>",
       "valor": 100000,
       "infoPagador": "Test charge R$ 100000",
       "pagador": { "nome": "Test", "cpf": "00000000000" }
     }]
   }

5. Webhook is processed without signature validation
   → Fake PIX_IN transactions created in the database
   → Transactions show as "Pendente" on the admin dashboard

6. Attacker may have also explored other unprotected endpoints:
   - GET /users (list all users — no auth)
   - GET /accounts/:id/summary (view any balance — no auth)
   - POST /tron/send-usdt (drain Tron hot wallet — no auth)
   - POST /solana/send-sol (drain Solana hot wallet — no auth)
   - POST /okx/withdraw-usdt (drain OKX exchange — only needed JWT, no admin check)
```

---

## 8. Verification Checklist

After deploying, verify these items:

- [ ] `INTER_WEBHOOK_SECRET` is set in production environment
- [ ] `FDBANK_WEBHOOK_SECRET` is set in production environment
- [ ] Test that `POST /inter/webhooks/receive/pix` without signature returns 400
- [ ] Test that `POST /fdbank/webhooks/receive/pix` without `x-webhook-secret` returns 400
- [ ] Test that `GET /tron/hot-wallet` without JWT returns 401
- [ ] Test that `POST /tron/send-usdt` with customer JWT returns 403
- [ ] Test that `GET /solana/hot-wallet` without JWT returns 401
- [ ] Test that `POST /okx/withdraw-usdt` with customer JWT returns 403
- [ ] Test that `GET /users` without JWT returns 401
- [ ] Test that `GET /accounts/:id/summary` without JWT returns 401
- [ ] Test that `POST /inter/pix/testar-envio` with customer JWT returns 403
- [ ] Review and delete any suspicious accounts and transactions from the database
- [ ] Rotate the admin JWT secret (`JWT_SECRET`) as a precaution
- [ ] Review server access logs for the period around 07:00-08:00 UTC on Feb 7

---

*Report generated as part of commit `fb3eba5` on branch `claude/track-test-completion-WeaqD`.*
