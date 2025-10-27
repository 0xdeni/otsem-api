import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PixModule } from './pix/pix.module';
import { CashOutModule } from './pix/cashout.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PixModule, CashOutModule, AuthModule, UsersModule

  ],
  providers: [PrismaService],
})
export class AppModule { }
