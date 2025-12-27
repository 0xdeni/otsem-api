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
-   **BRL to USDT Conversion Flow**: Facilitates conversion from BRL to USDT using OKX exchange, with direct withdrawal to customer's specified wallet (Solana or Tron).
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