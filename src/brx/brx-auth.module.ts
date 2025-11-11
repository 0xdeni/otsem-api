import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BrxAuthService } from './brx-auth.service';

@Module({
  imports: [HttpModule],
  providers: [BrxAuthService],
  exports: [BrxAuthService],
})
export class BrxAuthModule {}
