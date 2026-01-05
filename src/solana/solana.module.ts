import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SolanaService } from './solana.service';
import { SolanaController } from './solana.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SolanaController],
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
