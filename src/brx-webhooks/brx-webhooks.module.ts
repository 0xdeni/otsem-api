// src/brx-webhooks/brx-webhooks.module.ts
import { Module } from '@nestjs/common';
import { BrxWebhooksController } from './brx-webhooks.controller';
import { BrxWebhooksService } from './brx-webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BrxWebhooksController],
  providers: [BrxWebhooksService],
  exports: [BrxWebhooksService],
})
export class BrxWebhooksModule { }
