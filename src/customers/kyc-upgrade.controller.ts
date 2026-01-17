import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { KycUpgradeService } from './kyc-upgrade.service';
import { KycLevel } from '@prisma/client';

interface DocumentDto {
  name: string;
  objectPath: string;
}

interface CreateUpgradeRequestDto {
  targetLevel: KycLevel;
  documents: DocumentDto[];
}

interface RejectRequestDto {
  reason: string;
}

@ApiTags('KYC Upgrade')
@ApiBearerAuth()
@Controller()
export class KycUpgradeController {
  constructor(private readonly kycUpgradeService: KycUpgradeService) {}

  @Post('customers/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Criar solicitação de upgrade de KYC' })
  async createRequest(@Req() req: any, @Body() body: CreateUpgradeRequestDto) {
    const customerId = req.user.customerId;
    return this.kycUpgradeService.createRequest(customerId, body);
  }

  @Get('customers/me/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar minhas solicitações de upgrade' })
  async getMyRequests(@Req() req: any) {
    const customerId = req.user.customerId;
    return this.kycUpgradeService.getMyRequests(customerId);
  }

  @Get('admin/kyc-upgrade-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todas as solicitações de upgrade (admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  async listRequests(@Query('status') status?: string) {
    return this.kycUpgradeService.listRequests(status);
  }

  @Get('admin/kyc-upgrade-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detalhes de uma solicitação (admin)' })
  async getRequestDetails(@Param('id') id: string) {
    return this.kycUpgradeService.getRequestDetails(id);
  }

  @Post('admin/kyc-upgrade-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aprovar solicitação de upgrade (admin)' })
  async approveRequest(@Param('id') id: string, @Req() req: any) {
    const adminEmail = req.user.email;
    return this.kycUpgradeService.approveRequest(id, adminEmail);
  }

  @Post('admin/kyc-upgrade-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rejeitar solicitação de upgrade (admin)' })
  async rejectRequest(
    @Param('id') id: string,
    @Body() body: RejectRequestDto,
    @Req() req: any,
  ) {
    const adminEmail = req.user.email;
    return this.kycUpgradeService.rejectRequest(id, adminEmail, body.reason);
  }
}
