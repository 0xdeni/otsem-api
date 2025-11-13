import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl, IsString, IsOptional } from 'class-validator';

export class CreateWebhookCallbackDto {
    @ApiProperty({
        description: 'URL do callback (deve ser HTTPS)',
        example: 'https://api.otsembank.com/inter/webhooks/receive/pix',
    })
    @IsNotEmpty({ message: 'URL do webhook é obrigatória' })
    @IsUrl({ require_protocol: true, require_tld: false }, { message: 'URL inválida. Use HTTPS.' })
    webhookUrl: string;
}

export class UpdateWebhookCallbackDto {
    @ApiProperty({
        description: 'Nova URL do callback (deve ser HTTPS)',
        example: 'https://api.otsembank.com/inter/webhooks/receive/pix',
    })
    @IsNotEmpty({ message: 'URL do webhook é obrigatória' })
    @IsUrl({ require_protocol: true, require_tld: false }, { message: 'URL inválida. Use HTTPS.' })
    webhookUrl: string;
}

export class WebhookCallbackResponseDto {
    @ApiProperty({ description: 'URL do callback cadastrada' })
    @IsString()
    webhookUrl: string;

    @ApiProperty({ description: 'Data de criação do callback', required: false })
    @IsOptional()
    @IsString()
    criadoEm?: string;

    @ApiProperty({ description: 'Data de atualização do callback', required: false })
    @IsOptional()
    @IsString()
    atualizadoEm?: string;
}