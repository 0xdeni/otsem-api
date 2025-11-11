import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrxAuthService } from '../../brx/brx-auth.service';
import {
  UpdatePixLimitDto,
  BrxPixLimitResponse,
  PixLimitResult,
} from './dto/update-pix-limit.dto';

@Injectable()
export class PixLimitsService {
  private readonly baseUrl =
    process.env.BRX_BASE_URL ?? 'https://apisbank.brxbank.com.br';

  constructor(
    private readonly http: HttpService,
    private readonly brxAuth: BrxAuthService,
  ) {}

  /**
   * productId: use o ID fornecido pela BRX (ex.: 1 = Pix; confirmar com o comercial/BRX qual o ID do BigPix).
   */
  async setPixLimits(
    accountHolderId: string,
    productId: number,
    dto: UpdatePixLimitDto,
  ): Promise<PixLimitResult> {
    const token = await this.brxAuth.getAccessToken();

    const url = `${this.baseUrl}/product/parameters/account-holders/${accountHolderId}/products/${productId}/limit-pix`;

    // A BRX espera PascalCase:
    const body = {
      SingleTransfer: dto.singleTransfer,
      DayTime: dto.daytime,
      NightTime: dto.nighttime,
      Monthly: dto.monthly,
    };

    const { data } = await firstValueFrom(
      this.http.patch<BrxPixLimitResponse>(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
    );

    const payload = data?.Extensions?.Data;
    if (!payload) {
      throw new BadRequestException('Resposta inválida ao definir limite Pix.');
    }

    return {
      clientId: payload.ClientId,
      productId: payload.ProductId,
      singleTransfer: payload.SingleTransfer,
      daytime: payload.DayTime,
      nighttime: payload.NightTime,
      monthly: payload.Monthly,
      message: data.Extensions?.Message,
    };
  }
}
