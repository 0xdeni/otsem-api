import {
    Controller,
    Get,
    Put,
    Body,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BankProvider, Role } from '@prisma/client';

@ApiTags('System Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SystemSettingsController {
    constructor(private readonly settingsService: SystemSettingsService) {}

    @Get('bank')
    @ApiOperation({ summary: 'Get current bank provider settings' })
    async getBankSettings() {
        const settings = await this.settingsService.getSettings();
        return {
            activeBankProvider: settings.activeBankProvider,
            interEnabled: settings.interEnabled,
            fdbankEnabled: settings.fdbankEnabled,
            updatedAt: settings.updatedAt,
        };
    }

    @Put('bank')
    @ApiOperation({ summary: 'Update bank provider settings (toggle active bank, enable/disable banks)' })
    async updateBankSettings(
        @Body() body: {
            activeBankProvider?: BankProvider;
            interEnabled?: boolean;
            fdbankEnabled?: boolean;
        },
    ) {
        if (body.activeBankProvider && !['INTER', 'FDBANK'].includes(body.activeBankProvider)) {
            throw new BadRequestException('activeBankProvider must be INTER or FDBANK');
        }

        const settings = await this.settingsService.updateBankSettings(body);
        return {
            message: 'Bank settings updated',
            activeBankProvider: settings.activeBankProvider,
            interEnabled: settings.interEnabled,
            fdbankEnabled: settings.fdbankEnabled,
        };
    }

    @Put('bank/active')
    @ApiOperation({ summary: 'Set the active bank provider' })
    async setActiveBankProvider(@Body() body: { provider: BankProvider }) {
        if (!body.provider || !['INTER', 'FDBANK'].includes(body.provider)) {
            throw new BadRequestException('provider must be INTER or FDBANK');
        }

        const settings = await this.settingsService.setActiveBankProvider(body.provider);
        return {
            message: `Active bank provider set to ${settings.activeBankProvider}`,
            activeBankProvider: settings.activeBankProvider,
        };
    }

    @Put('bank/toggle')
    @ApiOperation({ summary: 'Enable or disable a specific bank provider' })
    async toggleBank(@Body() body: { provider: BankProvider; enabled: boolean }) {
        if (!body.provider || !['INTER', 'FDBANK'].includes(body.provider)) {
            throw new BadRequestException('provider must be INTER or FDBANK');
        }
        if (typeof body.enabled !== 'boolean') {
            throw new BadRequestException('enabled must be a boolean');
        }

        const settings = await this.settingsService.setBankEnabled(body.provider, body.enabled);
        return {
            message: `Bank ${body.provider} ${body.enabled ? 'enabled' : 'disabled'}`,
            activeBankProvider: settings.activeBankProvider,
            interEnabled: settings.interEnabled,
            fdbankEnabled: settings.fdbankEnabled,
        };
    }
}
