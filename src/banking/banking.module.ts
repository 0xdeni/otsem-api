import { Module } from '@nestjs/common';
import { BankingGatewayService } from './banking-gateway.service';
import { PixController } from './pix.controller';
import { PixLegacyAdminController } from './pix-legacy-admin.controller';
import { InterModule } from '../inter/inter.module';
import { FdbankModule } from '../fdbank/fdbank.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { StatementsModule } from '../statements/statements.module';

@Module({
    imports: [InterModule, FdbankModule, SystemSettingsModule, StatementsModule],
    controllers: [PixController, PixLegacyAdminController],
    providers: [BankingGatewayService],
    exports: [BankingGatewayService],
})
export class BankingModule {}
