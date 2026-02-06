import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import okxConfig from './okx.config';
import { OkxService } from './services/okx.service';
import { OkxController } from './okx.controller';
import { OkxAuthService } from './services/okx-auth.service';
import { OkxSpotService } from './services/okx-spot.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    imports: [ConfigModule.forFeature(okxConfig)],
    providers: [OkxService, OkxAuthService, OkxSpotService, PrismaService],
    controllers: [OkxController],
    exports: [OkxService, OkxSpotService],
})
export class OkxModule { }
