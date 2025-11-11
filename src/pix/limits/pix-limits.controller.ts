import { Body, Controller, Param, Patch, Query } from '@nestjs/common';
import { PixLimitsService } from './pix-limits.service';
import { UpdatePixLimitDto } from './dto/update-pix-limit.dto';

@Controller('pix/account-holders/:accountHolderId/limits')
export class PixLimitsController {
  constructor(private readonly service: PixLimitsService) {}

  // Ex.: PATCH /pix/account-holders/{id}/limits/pix?productId=1
  @Patch('pix')
  async patchPixLimits(
    @Param('accountHolderId') accountHolderId: string,
    @Query('productId') productIdStr: string,
    @Body() dto: UpdatePixLimitDto,
  ) {
    const productId = Number(productIdStr);
    if (!Number.isFinite(productId)) {
      throw new Error('productId inválido');
    }
    return this.service.setPixLimits(accountHolderId, productId, dto);
  }
}
