import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BankProvider } from '@prisma/client';

@Injectable()
export class SystemSettingsService {
    private readonly logger = new Logger(SystemSettingsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Get or create the singleton settings record
     */
    async getSettings() {
        let settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'singleton' },
        });

        if (!settings) {
            settings = await this.prisma.systemSettings.create({
                data: {
                    id: 'singleton',
                    activeBankProvider: 'INTER',
                    interEnabled: true,
                    fdbankEnabled: false,
                },
            });
            this.logger.log('Created default system settings');
        }

        return settings;
    }

    /**
     * Get the currently active bank provider
     */
    async getActiveBankProvider(): Promise<BankProvider> {
        const settings = await this.getSettings();
        return settings.activeBankProvider;
    }

    /**
     * Check if a specific bank provider is enabled
     */
    async isBankEnabled(provider: BankProvider): Promise<boolean> {
        const settings = await this.getSettings();
        if (provider === 'INTER') return settings.interEnabled;
        if (provider === 'FDBANK') return settings.fdbankEnabled;
        return false;
    }

    /**
     * Set the active bank provider (the one used for primary PIX operations)
     */
    async setActiveBankProvider(provider: BankProvider) {
        const settings = await this.prisma.systemSettings.upsert({
            where: { id: 'singleton' },
            update: { activeBankProvider: provider },
            create: {
                id: 'singleton',
                activeBankProvider: provider,
                interEnabled: true,
                fdbankEnabled: provider === 'FDBANK',
            },
        });

        this.logger.log(`Active bank provider set to: ${provider}`);
        return settings;
    }

    /**
     * Enable or disable a specific bank provider
     */
    async setBankEnabled(provider: BankProvider, enabled: boolean) {
        const updateData: any = {};
        if (provider === 'INTER') updateData.interEnabled = enabled;
        if (provider === 'FDBANK') updateData.fdbankEnabled = enabled;

        const settings = await this.prisma.systemSettings.upsert({
            where: { id: 'singleton' },
            update: updateData,
            create: {
                id: 'singleton',
                activeBankProvider: 'INTER',
                interEnabled: provider === 'INTER' ? enabled : true,
                fdbankEnabled: provider === 'FDBANK' ? enabled : false,
            },
        });

        this.logger.log(`Bank ${provider} ${enabled ? 'enabled' : 'disabled'}`);
        return settings;
    }

    /**
     * Toggle both settings at once: set active provider and enable/disable banks
     */
    async updateBankSettings(data: {
        activeBankProvider?: BankProvider;
        interEnabled?: boolean;
        fdbankEnabled?: boolean;
    }) {
        const updateData: any = {};
        if (data.activeBankProvider !== undefined) updateData.activeBankProvider = data.activeBankProvider;
        if (data.interEnabled !== undefined) updateData.interEnabled = data.interEnabled;
        if (data.fdbankEnabled !== undefined) updateData.fdbankEnabled = data.fdbankEnabled;

        const settings = await this.prisma.systemSettings.upsert({
            where: { id: 'singleton' },
            update: updateData,
            create: {
                id: 'singleton',
                activeBankProvider: data.activeBankProvider || 'INTER',
                interEnabled: data.interEnabled ?? true,
                fdbankEnabled: data.fdbankEnabled ?? false,
            },
        });

        this.logger.log(`Bank settings updated: active=${settings.activeBankProvider}, inter=${settings.interEnabled}, fdbank=${settings.fdbankEnabled}`);
        return settings;
    }
}
