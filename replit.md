# OTSEM API

## Overview

The OTSEM API is a NestJS backend designed for financial services, specializing in PIX payments, comprehensive customer management with KYC, and multi-bank as well as crypto exchange integrations. Its core purpose is to provide a robust and secure platform for managing financial transactions, user identities, and digital assets.

**Key Capabilities:**
- User Authentication (JWT)
- Customer Management & KYC (Didit integration)
- PIX Payment Processing (via Banco Inter)
- Multi-bank Integration (Banco Inter, FDBank)
- Cryptocurrency Exchange Integration (OKX for BRL to USDT conversions)
- Multi-network Wallet Management (Solana, Ethereum, Polygon, BSC, Tron, etc.)
- Affiliate System for commission-based earnings
- Admin dashboard for monitoring and analytics

The project aims to streamline financial operations, enhance user experience through automated processes like PIX key validation and micro-transfers, and provide a secure environment for digital asset management.

## User Preferences

I prefer iterative development and clear, concise explanations. Please ask before making major architectural changes or introducing new external dependencies. I value well-structured code and comprehensive testing.

## System Architecture

The system is built on **NestJS 11**, leveraging a modular architecture to separate concerns. **PostgreSQL** is used as the primary database, managed by **Prisma ORM**. Authentication is handled via **JWT tokens** using Passport.js. API documentation is generated with **Swagger**.

**Key Architectural Decisions & Features:**

-   **Unified Transaction Model**: A single `Transaction` model handles all financial movements (PIX_IN, PIX_OUT, CONVERSION) with detailed status tracking (`PENDING`, `COMPLETED`, `FAILED`), balance logging (`balanceBefore`, `balanceAfter`), and comprehensive metadata (payer/receiver info, bank payloads).
-   **Customer Management with KYC**: Integration with the **Didit API** for identity verification, allowing for secure customer onboarding and compliance.
-   **Multi-network Wallet System**: Supports various blockchain networks (Solana, Ethereum, Polygon, BSC, Tron) with capabilities for wallet creation, import, and management. Includes tracking for OKX whitelist status for withdrawals.
-   **PIX Integration**:
    -   **Automatic Reconciliation**: Polling of bank APIs for paid PIX charges and intelligent customer identification for automatic account crediting.
    -   **PIX Key Management**: Endpoints for listing, creating, and deleting PIX keys with an automated micro-transfer validation mechanism.
    -   **PIX Send Validation**: Strict checks for KYC status, valid PIX keys, sufficient balance, and adherence to transaction limits before processing outbound PIX payments.
-   **BRL to USDT Conversion Flow (BUY)**: Facilitates conversion from BRL to USDT using OKX exchange, with direct withdrawal to customer's specified wallet (Solana or Tron).
-   **USDT to BRL Conversion Flow (SELL)**: Customer sends USDT directly to OKX deposit address → System monitors deposits → Sells USDT for BRL → Credits BRL to customer's OTSEM account balance.
-   **Affiliate System**:
    -   Manages affiliate profiles, commission rates, and payouts.
    -   Automated commission calculation on BRL to USDT conversions.
    -   Admin and public endpoints for managing and tracking affiliate activities and earnings.
-   **Admin Endpoints**: Dedicated administration routes for managing affiliates, viewing conversion statistics, and monitoring system health.
-   **Design Patterns**: Emphasis on services, controllers, and DTOs as per NestJS best practices.

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Authentication**: Passport JWT
-   **Email Service**: Resend (for password resets)
-   **Banking APIs**:
    -   Banco Inter (for PIX payments and related services)
    -   FDBank
-   **KYC Verification**: Didit API
-   **Cryptocurrency Exchange**: OKX (for BRL to USDT conversions and withdrawals)

## Database Schema - Conversions Table

A tabela `conversions` armazena dados estruturados de todas as conversões BRL→USDT:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String | ID único (cuid) |
| customerId | String | FK para Customer |
| accountId | String | FK para Account |
| brlCharged | Decimal(18,2) | BRL cobrado do cliente |
| brlExchanged | Decimal(18,2) | BRL enviado para OKX |
| spreadPercent | Decimal(6,4) | % do spread aplicado |
| spreadBrl | Decimal(18,2) | Lucro bruto (BRL) |
| usdtPurchased | Decimal(18,6) | USDT comprado na OKX |
| usdtWithdrawn | Decimal(18,6) | USDT enviado ao cliente |
| exchangeRate | Decimal(10,4) | Taxa de câmbio BRL/USDT |
| network | String | SOLANA ou TRON |
| walletAddress | String | Endereço de destino |
| okxOrderId | String | ID da ordem na OKX |
| okxWithdrawId | String | ID do saque na OKX |
| affiliateCommission | Decimal(18,2) | Comissão do afiliado |
| okxWithdrawFee | Decimal(18,6) | Taxa de saque OKX (USDT) |
| okxTradingFee | Decimal(18,2) | Taxa de trading OKX (BRL) |
| totalOkxFees | Decimal(18,2) | Total de taxas OKX (BRL) |
| grossProfit | Decimal(18,2) | Lucro bruto |
| netProfit | Decimal(18,2) | Lucro líquido |
| status | Enum | PENDING, PIX_SENT, USDT_BOUGHT, USDT_WITHDRAWN, COMPLETED, FAILED |

### Admin Spread Management
- `PATCH /admin/users/:id/spread` - Ajustar spread do cliente
- Body: `{ "spreadPercent": 0.95 }` (spread em %)
- O sistema converte automaticamente para spreadValue (0.95% → 0.9905)

## SELL Flow (USDT → BRL) - Client-Side Signing

O cliente assina a transação no frontend (chave privada nunca sai do dispositivo) e o backend recebe apenas o txHash.

### Fluxo de Assinatura Client-Side (Recomendado)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/wallet/sell-tx-data?walletId=X&usdtAmount=Y&network=Z` | GET | Retorna dados para construir transação no frontend |
| `/wallet/submit-signed-sell` | POST | Recebe txHash após frontend assinar e submeter |
| `/wallet/quote-sell-usdt?usdtAmount=X&network=Y` | GET | Cotação: quanto BRL o cliente recebe |
| `/wallet/deposit-address?network=SOLANA\|TRON` | GET | Endereço OKX fixo para depósito |
| `/wallet/pending-sell-deposits` | GET | Verifica depósitos pendentes (admin) |
| `/wallet/process-sell/:conversionId` | POST | Processa venda após depósito confirmado (admin) |

### Client-Side Signing - Fluxo Frontend

1. **GET /wallet/sell-tx-data** → Recebe:
   - `toAddress`: Endereço OKX fixo
   - `usdtAmountRaw`: Valor em menor unidade (6 decimais)
   - `tokenMint` (Solana) ou `contractAddress` (Tron)
   - `quote`: Cotação BRL a receber

2. **Frontend assina e submete** transação usando:
   - Solana: `@solana/web3.js` + `@solana/spl-token`
   - Tron: `TronWeb`

3. **POST /wallet/submit-signed-sell** → Body:
   ```json
   { "walletId": "...", "usdtAmount": 100, "network": "TRON", "txHash": "..." }
   ```

### Endereços OKX Fixos (ENV)
- **TRON**: `OKX_TRON_DEPOSIT_ADDRESS`
- **Solana**: `OKX_SOLANA_DEPOSIT_ADDRESS`

### SELL Flow Status Progression
1. `PENDING` - Transação submetida, aguardando confirmação blockchain
2. `USDT_RECEIVED` - USDT confirmado na OKX
3. `USDT_SOLD` - USDT vendido por BRL na OKX
4. `COMPLETED` - BRL creditado no saldo OTSEM do cliente

### SELL Flow - Crédito em Conta (Não PIX)
**Importante:** O SELL flow credita o valor BRL diretamente no saldo OTSEM do cliente (balance interno), NÃO envia PIX para conta externa. O cliente pode depois sacar o saldo via PIX OUT se desejar.

### Automated SELL Processing (SellProcessingService)

O sistema possui um cron job que roda **a cada minuto** para processar vendas automaticamente:

1. **Polling de Depósitos OKX**: Verifica novos depósitos na OKX
2. **Matching por txHash ou Amount/Network/Time**: Associa depósitos a conversões pendentes
3. **Venda Automática**: Vende USDT por BRL na OKX via market order
4. **Crédito em Conta**: Credita o valor BRL no saldo OTSEM do cliente
5. **Detecção de Órfãos**: Alerta sobre depósitos não processados (sem conversão correspondente)

**Arquivos chave:**
- `src/wallet/sell-processing.service.ts` - Orquestra todo o fluxo automatizado
- `src/okx/services/okx.service.ts` - `sellUsdtForBrl()`, `getRecentDeposits()`

**Importante:** O balance OTSEM do cliente **AUMENTA** no SELL flow. O BRL é creditado internamente na conta OTSEM, e o cliente pode sacar via PIX OUT quando desejar.

### Fee Model
- **Cliente paga apenas spread**: 0.95% (padrão, configurável por usuário)
- **spreadPercent** armazenado como decimal (0.0095 = 0.95%)
- **netProfit = spreadBrl - totalOkxFees - affiliateCommission**

## Transaction subType Field

A partir de 05/01/2026, transações de conversão incluem o campo `subType` para diferenciar COMPRA de VENDA:

| type | subType | Descrição | Valor |
|------|---------|-----------|-------|
| CONVERSION | BUY | Compra de USDT com BRL | Negativo (saída de BRL) |
| CONVERSION | SELL | Venda de USDT por BRL | Positivo (entrada de BRL via PIX) |

**Frontend deve verificar:**
```javascript
if (tx.type === 'CONVERSION') {
  if (tx.subType === 'SELL') {
    // Mostrar como "Venda de USDT" com valor POSITIVO
  } else if (tx.subType === 'BUY') {
    // Mostrar como "Compra de USDT" com valor NEGATIVO
  }
}
```

**Para transações antigas sem subType:** verificar a `description` - se começa com "Venda" é SELL, senão é BUY.

## KYC por Níveis (17/01/2026)

Sistema de limites de transação baseado em nível de verificação KYC.

### Níveis e Limites Mensais

| Nível | Pessoa Física (PF) | Pessoa Jurídica (PJ) |
|-------|-------------------|---------------------|
| LEVEL_1 | R$ 30.000/mês | R$ 50.000/mês |
| LEVEL_2 | R$ 100.000/mês | R$ 200.000/mês |
| LEVEL_3 | Ilimitado | Ilimitado |

### Endpoints Cliente

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/customers/me/limits` | GET | Ver limites e uso mensal do cliente |

**Resposta exemplo:**
```json
{
  "customerId": "...",
  "customerType": "PF",
  "kycLevel": "LEVEL_1",
  "monthlyLimit": 30000,
  "usedThisMonth": 5000,
  "availableThisMonth": 25000,
  "isUnlimited": false,
  "percentUsed": 16.67
}
```

### Endpoints Admin

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/admin/users/:id/kyc-level` | PATCH | Alterar nível KYC do cliente |
| `/admin/users/:id/limits` | GET | Ver limites e uso do cliente |
| `/admin/users/kyc-levels/config` | GET | Ver configuração de limites por nível |

**Upgrade de nível:**
```json
PATCH /admin/users/:id/kyc-level
{ "kycLevel": "LEVEL_2" }
```

### Validação de Limites

O sistema valida automaticamente antes de processar:
- Compra de USDT (BUY flow)
- Envio de PIX (PIX OUT)

Se o limite for excedido, retorna erro 400:
```json
{
  "message": "Limite mensal excedido. Disponível: R$ 25000.00. Solicitado: R$ 30000.00. Upgrade para Nível 2 para aumentar seu limite."
}
```

### Tabela KycLevelConfig

Configuração de limites populada automaticamente na inicialização:
```sql
SELECT * FROM kyc_level_configs;
-- LEVEL_1 | PF | 30000
-- LEVEL_2 | PF | 100000
-- LEVEL_3 | PF | 0 (ilimitado)
-- LEVEL_1 | PJ | 50000
-- LEVEL_2 | PJ | 200000
-- LEVEL_3 | PJ | 0 (ilimitado)
```

## Sistema de Upgrade de KYC (17/01/2026)

Fluxo para clientes solicitarem upgrade de nível KYC com envio de documentos.

### Endpoints Cliente

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/customers/kyc-upgrade-requests` | POST | Criar solicitação de upgrade |
| `/customers/me/kyc-upgrade-requests` | GET | Listar minhas solicitações |

**Criar solicitação:**
```json
POST /customers/kyc-upgrade-requests
{
  "targetLevel": "LEVEL_2",
  "documents": [
    { "name": "comprovante_renda.pdf", "objectPath": "/objects/kyc-upgrades/uuid.pdf" }
  ]
}
```

### Endpoints Admin

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/admin/kyc-upgrade-requests` | GET | Listar todas solicitações |
| `/admin/kyc-upgrade-requests/:id` | GET | Detalhes de uma solicitação |
| `/admin/kyc-upgrade-requests/:id/approve` | POST | Aprovar solicitação |
| `/admin/kyc-upgrade-requests/:id/reject` | POST | Rejeitar solicitação |

**Query params:** `?status=PENDING|APPROVED|REJECTED`

**Aprovar:**
```json
POST /admin/kyc-upgrade-requests/:id/approve
Response: { "success": true, "message": "Upgrade aprovado" }
```

**Rejeitar:**
```json
POST /admin/kyc-upgrade-requests/:id/reject
{ "reason": "Documentos ilegíveis" }
```

### Status da Solicitação
- `PENDING` - Aguardando análise
- `APPROVED` - Aprovada (kycLevel atualizado automaticamente)
- `REJECTED` - Rejeitada (motivo em adminNotes)