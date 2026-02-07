import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { BankingGatewayService } from './banking-gateway.service';
import { StatementsService } from '../statements/statements.service';
import { InterPixKeysService } from '../inter/services/inter-pix-keys.service';
import { InterAuthService } from '../inter/services/inter-auth.service';
import type { AuthRequest } from '../auth/jwt-payload.type';

type LegacyTxStatus = 'created' | 'pending' | 'confirmed' | 'failed' | 'refunded';
type LegacyQrFormat = 'copy-paste' | 'image' | 'both';

const LEGACY_TYPE_TO_INTER: Record<string, 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE'> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'EMAIL',
  phone: 'TELEFONE',
};

const KEY_TYPE_ID: Record<string, number> = {
  CPF: 1,
  CNPJ: 2,
  EMAIL: 3,
  TELEFONE: 4,
  ALEATORIA: 5,
};

@ApiTags('PIX Legacy Admin Compatibility')
@ApiBearerAuth()
@Controller('pix')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PixLegacyAdminController {
  constructor(
    private readonly bankingGateway: BankingGatewayService,
    private readonly statements: StatementsService,
    private readonly interPixKeys: InterPixKeysService,
    private readonly interAuth: InterAuthService,
  ) {}

  private normalizeTxStatus(status?: string): LegacyTxStatus {
    const current = (status || '').toUpperCase();
    if (current === 'PROCESSING' || current === 'PENDING') return 'pending';
    if (current === 'COMPLETED') return 'confirmed';
    if (current === 'FAILED' || current === 'CANCELED') return 'failed';
    if (current === 'REVERSED') return 'refunded';
    return 'created';
  }

  private makeEndToEndSeed(seed: string) {
    const safeSeed = (seed || 'PIX').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `${safeSeed}${Date.now()}${random}`.slice(0, 32);
  }

  private async createRandomInterKeyRaw(): Promise<string> {
    const axios = this.interAuth.getAxiosInstance();
    const response = await axios.post('/banking/v2/pix/chaves', {
      tipoChave: 'ALEATORIA',
    });
    const key = response.data?.chave;
    if (!key) {
      throw new BadRequestException('Não foi possível criar chave aleatória');
    }
    return key;
  }

  @Get('keys/account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: listar chaves Pix por account holder' })
  async listLegacyPixKeys() {
    const keys = await this.interPixKeys.listKeys();

    return {
      bank: { name: 'Inter', ispb: '077', code: '077' },
      keys: (keys || []).map((key) => ({
        key: key.chave,
        keyType: key.tipoChave?.toLowerCase(),
        keyTypeId: KEY_TYPE_ID[key.tipoChave] ?? 0,
        createdAt: key.dataCriacao ?? new Date().toISOString(),
        account: key.conta
          ? {
              branch: key.conta.agencia,
              number: key.conta.numeroConta,
              type: key.conta.tipoConta,
            }
          : undefined,
      })),
      message: 'Chaves carregadas com sucesso',
    };
  }

  @Post('keys/account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: criar chave Pix por account holder' })
  async createLegacyPixKey(
    @Req() req: AuthRequest,
    @Body()
    body: {
      keyType?: string;
      pixKey?: string;
      value?: string;
      chave?: string;
    },
  ) {
    const normalizedType = (body.keyType || '').toLowerCase();
    const customerId = req.user?.customerId || '';

    if (!normalizedType) {
      throw new BadRequestException('keyType é obrigatório');
    }

    if (normalizedType === 'random') {
      const key = customerId
        ? await this.interPixKeys
            .registerRandomKey(customerId)
            .catch(() => this.createRandomInterKeyRaw())
        : await this.createRandomInterKeyRaw();

      return {
        statusCode: 201,
        extensions: {
          message: 'Chave criada com sucesso',
          data: {
            key,
            keyType: 'ALEATORIA',
            keyTypeId: KEY_TYPE_ID.ALEATORIA,
          },
        },
      };
    }

    const interType = LEGACY_TYPE_TO_INTER[normalizedType];
    if (!interType) {
      throw new BadRequestException('keyType inválido. Use: cpf, cnpj, email, phone, random');
    }

    const keyValue = (body.pixKey || body.value || body.chave || '').trim();
    if (!keyValue) {
      throw new BadRequestException('pixKey é obrigatório para este tipo');
    }

    const created = await this.interPixKeys.registerKey(
      customerId || 'admin-compat',
      interType,
      keyValue,
    );

    return {
      statusCode: 201,
      extensions: {
        message: 'Chave criada com sucesso',
        data: {
          key: created.chave || keyValue,
          keyType: created.tipoChave || interType,
          keyTypeId: KEY_TYPE_ID[created.tipoChave || interType] ?? 0,
        },
      },
    };
  }

  @Delete('keys/account-holders/:accountHolderId/key/:key')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: excluir chave Pix por account holder' })
  async deleteLegacyPixKey(@Param('key') key: string) {
    await this.interPixKeys.deleteKey(decodeURIComponent(key));
    return { ok: true, message: 'Chave removida com sucesso' };
  }

  @Get('keys/account-holders/:accountHolderId/key/:key')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: pré-consulta de chave Pix' })
  async precheckLegacyPixKey(@Param('key') key: string) {
    const data = await this.interPixKeys.getKey(decodeURIComponent(key));

    return {
      StatusCode: 200,
      Extensions: {
        Data: {
          Name: data.correntista?.nome || null,
          TaxNumber: data.correntista?.cpfCnpj || null,
          Key: data.chave,
          KeyType: data.tipoChave,
          KeyTypeId: KEY_TYPE_ID[data.tipoChave] ?? 0,
          BankData: {
            Ispb: '077',
            Name: 'Inter',
            BankCode: '077',
            Branch: data.conta?.agencia || '',
            Account: data.conta?.numeroConta || '',
            AccountType: data.conta?.tipoConta || '',
            AccountTypeId: 0,
          },
          EndToEnd: this.makeEndToEndSeed(data.chave),
        },
      },
    };
  }

  @Get('transactions/account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: histórico de transações Pix por account holder' })
  async listLegacyPixTransactions(
    @Param('accountHolderId') accountHolderId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const limit = Math.min(Math.max(Number(pageSize) || 10, 1), 100);

    const result = await this.statements.getPixTransactionsByAccountHolder(
      accountHolderId,
      currentPage,
      limit,
    );

    const items = (result.transactions || []).map((tx: any) => {
      const direction = tx.type === 'PIX_OUT' ? 'out' : 'in';
      const mappedStatus = this.normalizeTxStatus(tx.status);

      return {
        id: tx.transactionId,
        endToEndId: tx.endToEnd || undefined,
        direction,
        amount: Number(tx.amount || 0),
        key: direction === 'out' ? tx.recipientCpf || undefined : tx.senderCpf || undefined,
        description: tx.description || null,
        status: mappedStatus,
        createdAt: tx.createdAt,
        counterpartyName: direction === 'out' ? tx.recipientName || null : tx.senderName || null,
        counterpartyTaxNumber:
          direction === 'out' ? tx.recipientCpf || null : tx.senderCpf || null,
      };
    });

    const filtered = status ? items.filter((tx: any) => tx.status === status) : items;

    return {
      items: filtered,
      total: status ? filtered.length : result.total,
      page: result.page,
      pageSize: limit,
    };
  }

  @Get('transactions/account-holders/:accountHolderId/precheck')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: pré-consulta para envio Pix' })
  async precheckLegacyPixTransaction(@Query('pixKey') pixKey?: string) {
    const normalizedKey = (pixKey || '').trim();
    if (!normalizedKey) {
      throw new BadRequestException('pixKey é obrigatório');
    }

    try {
      const keyData = await this.interPixKeys.getKey(normalizedKey);
      return {
        endToEndPixKey: this.makeEndToEndSeed(normalizedKey),
        name: keyData.correntista?.nome || null,
        taxNumber: keyData.correntista?.cpfCnpj || null,
        bankData: {
          Ispb: '077',
          Name: 'Inter',
          BankCode: '077',
          Branch: keyData.conta?.agencia || '',
          Account: keyData.conta?.numeroConta || '',
          AccountType: keyData.conta?.tipoConta || '',
          AccountTypeId: 0,
        },
      };
    } catch {
      return {
        endToEndPixKey: this.makeEndToEndSeed(normalizedKey),
        name: null,
        taxNumber: null,
        bankData: null,
      };
    }
  }

  @Post('transactions/account-holders/:accountHolderId/send')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: enviar Pix por account holder' })
  async sendLegacyPixTransaction(
    @Body() body: { pixKey?: string; amount?: string | number; description?: string },
  ) {
    const pixKey = (body.pixKey || '').trim();
    const amount = Number(body.amount);

    if (!pixKey) {
      return { ok: false, message: 'pixKey é obrigatório' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: 'Valor inválido' };
    }

    try {
      const result = await this.bankingGateway.sendPixInternal({
        valor: amount,
        chaveDestino: pixKey,
        tipoChave: 'CHAVE',
        descricao: body.description,
      });

      return {
        ok: true,
        message: 'Pix enviado com sucesso',
        endToEndId: result.endToEndId,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error?.message || 'Falha ao enviar PIX',
      };
    }
  }

  @Post('transactions/account-holders/:accountHolderId/qr/static')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Legacy: gerar QR code estático de Pix' })
  async generateLegacyStaticQr(
    @Body()
    body: {
      pixKey?: string;
      value?: number;
      message?: string;
      format?: LegacyQrFormat;
    },
  ) {
    const value = body.value && Number.isFinite(Number(body.value)) ? Number(body.value) : undefined;

    const qrData = await this.bankingGateway.createCobranca(
      {
        valor: value && value > 0 ? value : undefined,
        descricao: body.message || undefined,
      },
      undefined,
    );

    const copyPaste =
      qrData?.pixCopiaECola ||
      qrData?.copiaECola ||
      qrData?.qrCode ||
      qrData?.emv ||
      null;

    const imageBase64 =
      qrData?.imagemQrcodeBase64 ||
      qrData?.imageBase64 ||
      null;

    return {
      ok: true,
      data: {
        identifier: qrData?.txid || this.makeEndToEndSeed('QR'),
        pixKey: body.pixKey || '',
        value: value ?? null,
        message: body.message || null,
        format: body.format || 'both',
        copyPaste,
        imageBase64,
      },
    };
  }
}
