// src/inter/dto/webhook-payload.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

// ==================== ENUMS ====================

export enum TipoWebhook {
    PIX = 'pix',
    BOLETO = 'boleto',
}

export enum TipoEvento {
    // PIX
    PIX_RECEBIDO = 'pix.recebido',
    PIX_ENVIADO = 'pix.enviado',
    PIX_DEVOLVIDO = 'pix.devolvido',
    PIX_ESTORNADO = 'pix.estornado',

    // Boleto
    BOLETO_PAGO = 'boleto.pago',
    BOLETO_VENCIDO = 'boleto.vencido',
    BOLETO_CANCELADO = 'boleto.cancelado',
    BOLETO_REGISTRADO = 'boleto.registrado',
}

export enum StatusPix {
    REALIZADA = 'REALIZADA',
    DEVOLVIDA = 'DEVOLVIDA',
    EM_PROCESSAMENTO = 'EM_PROCESSAMENTO',
    REJEITADA = 'REJEITADA',
}

// ==================== PIX PAYLOAD ====================

export class EndToEndIdDto {
    @ApiProperty({ description: 'End to End ID da transação Pix' })
    @IsString()
    e2eId: string;

    @ApiProperty({ description: 'Txid da transação Pix', required: false })
    @IsString()
    @IsOptional()
    txid?: string;

    @ApiProperty({ description: 'Valor da transação em reais' })
    @IsNumber()
    valor: number;

    @ApiProperty({ description: 'Horário da transação' })
    @IsDateString()
    horario: string;

    @ApiProperty({ description: 'Informações do pagador', required: false })
    @IsOptional()
    pagador?: {
        cpf?: string;
        cnpj?: string;
        nome?: string;
    };

    @ApiProperty({ description: 'Informações adicionais', required: false })
    @IsString()
    @IsOptional()
    infoPagador?: string;

    @ApiProperty({ description: 'Devolução PIX', required: false })
    @IsOptional()
    devolucao?: {
        id: string;
        rtrId: string;
        valor: number;
        horario: {
            solicitacao: string;
            liquidacao?: string;
        };
        status: string;
    };
}

export class PixWebhookPayloadDto {
    @ApiProperty({ description: 'Lista de Pix recebidos/enviados', type: [EndToEndIdDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EndToEndIdDto)
    pix: EndToEndIdDto[];
}

// ==================== BOLETO PAYLOAD ====================

export class BoletoWebhookPayloadDto {
    @ApiProperty({ description: 'Código do boleto' })
    @IsString()
    codigoBarras: string;

    @ApiProperty({ description: 'Nosso número' })
    @IsString()
    nossoNumero: string;

    @ApiProperty({ description: 'Status do boleto' })
    @IsString()
    status: string;

    @ApiProperty({ description: 'Valor nominal do boleto' })
    @IsNumber()
    valorNominal: number;

    @ApiProperty({ description: 'Valor pago (se aplicável)', required: false })
    @IsNumber()
    @IsOptional()
    valorPago?: number;

    @ApiProperty({ description: 'Data de vencimento' })
    @IsDateString()
    dataVencimento: string;

    @ApiProperty({ description: 'Data de pagamento', required: false })
    @IsDateString()
    @IsOptional()
    dataPagamento?: string;

    @ApiProperty({ description: 'CPF/CNPJ do pagador', required: false })
    @IsString()
    @IsOptional()
    cpfCnpjPagador?: string;

    @ApiProperty({ description: 'Nome do pagador', required: false })
    @IsString()
    @IsOptional()
    nomePagador?: string;

    @ApiProperty({ description: 'E-mail do pagador', required: false })
    @IsString()
    @IsOptional()
    emailPagador?: string;
}

// ==================== WEBHOOK PAYLOAD GENÉRICO ====================

export class WebhookPayloadDto {
    @ApiProperty({
        description: 'Tipo do webhook',
        enum: TipoWebhook,
        example: TipoWebhook.PIX,
    })
    @IsEnum(TipoWebhook)
    @IsOptional()
    tipo?: TipoWebhook;

    @ApiProperty({
        description: 'Tipo do evento',
        enum: TipoEvento,
        example: TipoEvento.PIX_RECEBIDO,
    })
    @IsEnum(TipoEvento)
    @IsOptional()
    evento?: TipoEvento;

    @ApiProperty({
        description: 'Timestamp do evento',
        example: '2025-11-13T10:30:00.000Z',
    })
    @IsDateString()
    @IsOptional()
    timestamp?: string;

    @ApiProperty({
        description: 'Dados do Pix (quando tipo = pix)',
        type: PixWebhookPayloadDto,
        required: false,
    })
    @ValidateNested()
    @Type(() => PixWebhookPayloadDto)
    @IsOptional()
    pix?: PixWebhookPayloadDto;

    @ApiProperty({
        description: 'Dados do Boleto (quando tipo = boleto)',
        type: BoletoWebhookPayloadDto,
        required: false,
    })
    @ValidateNested()
    @Type(() => BoletoWebhookPayloadDto)
    @IsOptional()
    boleto?: BoletoWebhookPayloadDto;
}

// ==================== RESPONSE DTO ====================

export class WebhookResponseDto {
    @ApiProperty({ description: 'Indica se o webhook foi processado com sucesso' })
    success: boolean;

    @ApiProperty({ description: 'Mensagem de retorno', required: false })
    message?: string;

    @ApiProperty({ description: 'ID da transação criada (se aplicável)', required: false })
    transactionId?: string;

    @ApiProperty({ description: 'Timestamp do processamento' })
    processedAt: string;
}