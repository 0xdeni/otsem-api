import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { StatementsModule } from './statements/statements.module';
import { MailModule } from './mail/mail.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { InterModule } from './inter/inter.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { OkxModule } from './okx/okx.module';
import { FdbankModule } from './fdbank/fdbank.module';
import { WalletModule } from './wallet/wallet.module';
import { PixKeysModule } from './pix-keys/pix-keys.module';
import { DiditModule } from './didit/didit.module';
import { TronModule } from './tron/tron.module';
import { SolanaModule } from './solana/solana.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { BankingModule } from './banking/banking.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccountsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    StatementsModule,
    FdbankModule,
    WalletModule,
    PixKeysModule,
    DiditModule,
    OkxModule,
    TronModule,
    SolanaModule,
    MailModule,
    AdminDashboardModule,
    InterModule,
    PaymentsModule,
    TransactionsModule,
    AffiliatesModule,
    BankingModule,
    SystemSettingsModule,
    PushNotificationsModule,
    TransfersModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
