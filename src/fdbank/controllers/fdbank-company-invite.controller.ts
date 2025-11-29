import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { FdbankCompanyInviteService } from '../services/fdbank-company-invite.service';

@Controller('fdbank/company-invites')
export class FdbankCompanyInviteController {
    constructor(private readonly companyInviteService: FdbankCompanyInviteService) { }

    @Get()
    async listCompanyInvites() {
        return await this.companyInviteService.listCompanyInvites();
    }

    @Post()
    async createCompanyInvite(@Body() data: any) {
        return await this.companyInviteService.createCompanyInvite(data);
    }

    @Delete(':id')
    async deleteCompanyInvite(@Param('id') id: string) {
        return await this.companyInviteService.deleteCompanyInvite(id);
    }
}