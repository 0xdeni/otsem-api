import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterModule } from '../inter/inter.module';
import { OkxModule } from '../okx/okx.module';
import { FdbankModule } from '../fdbank/fdbank.module';
import { MailModule } from '../mail/mail.module';

import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminWalletsService } from './admin-wallets.service';
import { AdminWalletsController } from './admin-wallets.controller';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    forwardRef(() => InterModule),
    forwardRef(() => OkxModule),
    forwardRef(() => FdbankModule),
  ],
  controllers: [AdminDashboardController, AdminUsersController, AdminWalletsController],
  providers: [AdminDashboardService, AdminUsersService, AdminWalletsService],
  exports: [AdminDashboardService, AdminUsersService, AdminWalletsService],
})
export class AdminDashboardModule { }
