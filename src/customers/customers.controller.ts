import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
    constructor(private readonly service: CustomersService) { }

    @Get()
    async list(@Query() query: ListCustomersDto) {
        return this.service.list(query);
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
