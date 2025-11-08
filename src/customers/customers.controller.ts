import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

/**
 * Define o tipo AuthRequest com o campo `user` vindo do payload do JWT.
 */
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role?: string;
    };
}

@Controller('customers')
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    @Get()
    async list(@Query() query: ListCustomersDto) {
        return this.service.list(query);
    }

    /**
    * Retorna o cliente do usuário logado (autenticado via JWT).
    * Usa o sub do token (ID do usuário) e busca o Customer vinculado.
    */
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getMyCustomer(@Req() req: AuthRequest) {
        const userId = req.user?.id;

        if (!userId) {
            throw new UnauthorizedException('Usuário não autenticado.');
        }

        const customer = await this.service.findByUserId(userId);

        if (!customer) {
            return {
                success: false,
                message: 'Nenhum cliente vinculado a este usuário.',
                data: null,
            };
        }

        return customer
    }

    @Get(':id')
    async get(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Get('by-tax/:tax')
    async getByTax(@Param('tax') tax: string) {
        const id = await this.service.resolveCustomerId(tax);
        if (!id) return null;
        return this.service.findById(id);
    }

    @Post('pf')
    async createPF(@Body() dto: CreatePersonDto) {
        return this.service.createPF(dto);
    }

    @Post('pj')
    async createPJ(@Body() dto: CreateCompanyDto) {
        return this.service.createPJ(dto);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

}
