import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class DiditWebhookPayloadDto {
  @ApiProperty({ description: 'ID da sessão de verificação' })
  @IsString()
  session_id: string;

  @ApiProperty({ description: 'Status da sessão' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Decisão da verificação: Approved, Declined, Review' })
  @IsOptional()
  @IsString()
  decision?: string;

  @ApiPropertyOptional({ description: 'Dados do vendor passados na criação' })
  @IsOptional()
  @IsString()
  vendor_data?: string;

  @ApiPropertyOptional({ description: 'Tipo do webhook' })
  @IsOptional()
  @IsString()
  webhook_type?: string;

  @ApiPropertyOptional({ description: 'ID do workflow' })
  @IsOptional()
  @IsString()
  workflow_id?: string;

  @ApiPropertyOptional({ description: 'Timestamp do evento' })
  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @ApiPropertyOptional({ description: 'Data de criação' })
  @IsOptional()
  @IsNumber()
  created_at?: number;

  @ApiPropertyOptional()
  @IsOptional()
  document_data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  face_data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  updated_at?: string;
}
