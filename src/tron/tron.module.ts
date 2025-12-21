import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TronService } from './tron.service';
import { TronController } from './tron.controller';

@Module({
    imports: [ConfigModule],
    controllers: [TronController],
    providers: [TronService],
    exports: [TronService]
})
export class TronModule {}
