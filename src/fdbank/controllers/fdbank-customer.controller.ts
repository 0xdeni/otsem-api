import { Controller, Get, Post, Put, Delete, Body, Param, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
        const requiredFields = ['email', 'name'];
        const errors = [];
        const dataAny = data as any;

        for (const field of requiredFields) {
            if (!dataAny[field]) {
                errors.push({ path: field, message: `${field} is required` });
            }
        }

        if (errors.length) {
            throw new BadRequestException({
                isValid: true,
                message: 'Validation error',
                result: errors,
                requestTraceId: null
            });
        }

        try {
            const result = await this.customerService.createCustomer(data);
            return {
                isValid: true,
                message: 'OK',
                result,
                requestTraceId: null
            };
        } catch (error) {
            if (error.response?.status === 400) {
                throw new BadRequestException({
                    isValid: true,
                    message: error.response.data?.message || 'Bad Request',
                    result: error.response.data?.result || null,
                    requestTraceId: null
                });
            }
            throw new InternalServerErrorException({
                isValid: true,
                message: error.message || 'Internal server error',
                result: null,
                requestTraceId: null
            });
        }
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