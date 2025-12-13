import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Dados adicionais do vendor (ex: customerId)' })
  @IsOptional()
  @IsString()
  vendorData?: string;

  @ApiPropertyOptional({ description: 'URL de callback para notificações' })
  @IsOptional()
  @IsUrl()
  callback?: string;
}

export class CreateSessionResponseDto {
  @ApiProperty({ description: 'ID da sessão de verificação' })
  sessionId: string;

  @ApiProperty({ description: 'URL para o usuário completar a verificação' })
  verificationUrl: string;
}

export class SessionDecisionDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  decision: string;

  @ApiPropertyOptional()
  vendorData?: string;

  @ApiPropertyOptional()
  documentData?: Record<string, any>;

  @ApiPropertyOptional()
  faceData?: Record<string, any>;
}
