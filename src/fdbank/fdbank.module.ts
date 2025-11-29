import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import fdbankConfig from './fdbank.config';
import { FdbankService } from './services/fdbank.service';
import { FdbankAuthService } from './services/fdbank-auth.service';
import { FdbankCustomerService } from './services/fdbank-customer.service';
import { FdbankController } from './controllers/fdbank.controller';
import { FdbankCustomerController } from './controllers/fdbank-customer.controller';
import { FdbankPixContactController } from './controllers/fdbank-pix-contact.controller';
import { FdbankPixContactService } from './services/fdbank-pix-contact.service';

@Module({
    imports: [ConfigModule.forFeature(fdbankConfig)],
    providers: [FdbankService, FdbankAuthService, FdbankCustomerService, FdbankPixContactService],
    controllers: [FdbankController, FdbankCustomerController, FdbankPixContactController],
    exports: [FdbankService, FdbankAuthService, FdbankCustomerService, FdbankPixContactService],
})
export class FdbankModule { }