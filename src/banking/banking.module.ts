import { Module } from '@nestjs/common';
import { BankingGatewayService } from './banking-gateway.service';
import { InterModule } from '../inter/inter.module';
import { FdbankModule } from '../fdbank/fdbank.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
    imports: [InterModule, FdbankModule, SystemSettingsModule],
    providers: [BankingGatewayService],
    exports: [BankingGatewayService],
})
export class BankingModule {}
