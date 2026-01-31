// src/statements/statements.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { PixTransactionsController } from './pix-transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule, // ← adicionar para validação de ownership
  ],
  controllers: [StatementsController, PixTransactionsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule { }
