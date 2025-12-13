import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DiditService } from './didit.service';
import { DiditController } from './didit.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    PrismaModule,
  ],
  controllers: [DiditController],
  providers: [DiditService],
  exports: [DiditService],
})
export class DiditModule {}
