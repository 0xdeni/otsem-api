import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { FdbankCustomerService } from '../services/fdbank-customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Controller('fdbank/customers')
export class FdbankCustomerController {
    constructor(private readonly customerService: FdbankCustomerService) { }

    @Get()
    async listCustomers() {
        return await this.customerService.listCustomers();
    }

    @Post()
    async createCustomer(@Body() data: CreateCustomerDto) {
        return await this.customerService.createCustomer(data);
    }

    @Get(':id')
    async getCustomer(@Param('id') id: string) {
        return await this.customerService.getCustomer(id);
    }

    @Put(':id')
    async updateCustomer(@Param('id') id: string, @Body() data: UpdateCustomerDto) {
        return await this.customerService.updateCustomer(id, data);
    }

    @Delete(':id')
    async deleteCustomer(@Param('id') id: string) {
        return await this.customerService.deleteCustomer(id);
    }
}