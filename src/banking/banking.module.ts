import { Module } from '@nestjs/common';
import { BankingGatewayService } from './banking-gateway.service';
import { PixController } from './pix.controller';
import { InterModule } from '../inter/inter.module';
import { FdbankModule } from '../fdbank/fdbank.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
    imports: [InterModule, FdbankModule, SystemSettingsModule],
    controllers: [PixController],
    providers: [BankingGatewayService],
    exports: [BankingGatewayService],
})
export class BankingModule {}
