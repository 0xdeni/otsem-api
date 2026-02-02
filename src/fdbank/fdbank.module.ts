import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import fdbankConfig from './fdbank.config';
import { PrismaModule } from '../prisma/prisma.module';
import { FdbankService } from './services/fdbank.service';
import { FdbankCustomerService } from './services/fdbank-customer.service';
import { FdbankPixTransferService } from './services/fdbank-pix-transfer.service';
import { FdbankController } from './controllers/fdbank.controller';
import { FdbankCustomerController } from './controllers/fdbank-customer.controller';
import { FdbankPixContactController } from './controllers/fdbank-pix-contact.controller';
import { FdbankPixContactService } from './services/fdbank-pix-contact.service';
import { FdbankBankAccountService } from './services/fdbank-bank-account.service';
import { FdbankBankAccountController } from './controllers/fdbank-bank-account.controller';
import { FdbankPixKeyService } from './services/fdbank-pix-key.service';
import { FdbankPixKeyController } from './controllers/fdbank-pix-key.controller';
import { FdbankPixTransferController } from './controllers/fdbank-pix-transfer.controller';
import { FdbankPixIntegrationService } from './services/fdbank-pix-integration.service';
import { FdbankWebhookService } from './services/fdbank-webhook.service';
import { FdbankWebhookController } from './controllers/fdbank-webhook.controller';
import { FdbankWebhookLegacyController } from './controllers/fdbank-webhook-legacy.controller';
import { FdbankPixPollingTask } from './tasks/fdbank-pix-polling.task';

@Module({
    imports: [ConfigModule.forFeature(fdbankConfig), PrismaModule],
    providers: [
        FdbankService,
        FdbankBankAccountService,
        FdbankPixKeyService,
        FdbankCustomerService,
        FdbankPixContactService,
        FdbankPixTransferService,
        FdbankPixIntegrationService,
        FdbankWebhookService,
        FdbankPixPollingTask,
    ],
    controllers: [
        FdbankController,
        FdbankPixKeyController,
        FdbankBankAccountController,
        FdbankCustomerController,
        FdbankPixContactController,
        FdbankPixTransferController,
        FdbankWebhookController,
        FdbankWebhookLegacyController,
    ],
    exports: [
        FdbankService,
        FdbankBankAccountService,
        FdbankCustomerService,
        FdbankPixContactService,
        FdbankPixTransferService,
        FdbankPixIntegrationService,
        FdbankWebhookService,
    ],
})
export class FdbankModule { }
