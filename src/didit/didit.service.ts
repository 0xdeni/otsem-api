import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SessionDecisionDto } from './dto/create-session.dto';

export interface CreateSessionResult {
  sessionId: string;
  verificationUrl: string;
}

@Injectable()
export class DiditService {
  private readonly logger = new Logger(DiditService.name);
  private readonly baseUrl = 'https://verification.didit.me';
  private readonly apiKey: string;
  private readonly workflowId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('DIDIT_API_KEY') || '';
    this.workflowId = this.configService.get<string>('DIDIT_WORKFLOW_ID') || '';

    if (!this.apiKey || !this.workflowId) {
      this.logger.warn('DIDIT_API_KEY ou DIDIT_WORKFLOW_ID não configurados');
    }
  }

  async createSession(vendorData?: string, callback?: string): Promise<CreateSessionResult> {
    const url = `${this.baseUrl}/v2/session/`;

    const body: Record<string, any> = {
      workflow_id: this.workflowId,
    };

    if (vendorData) {
      body.vendor_data = vendorData;
    }

    if (callback) {
      body.callback = callback;
    }

    try {
      this.logger.log(`Criando sessão Didit com vendorData=${vendorData}`);

      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
        }),
      );

      const { session_id, url: verificationUrl } = response.data;

      this.logger.log(`Sessão criada: sessionId=${session_id}`);

      return {
        sessionId: session_id,
        verificationUrl,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao criar sessão Didit: ${error.message}`, error.response?.data);
      throw new HttpException(
        error.response?.data?.message || 'Erro ao criar sessão de verificação',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSessionDecision(sessionId: string): Promise<SessionDecisionDto> {
    const url = `${this.baseUrl}/v2/session/${sessionId}/decision/`;

    try {
      this.logger.log(`Buscando decisão da sessão ${sessionId}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'x-api-key': this.apiKey,
          },
        }),
      );

      const data = response.data;

      return {
        sessionId: data.session_id || sessionId,
        status: data.status,
        decision: data.decision,
        vendorData: data.vendor_data,
        documentData: data.document_data,
        faceData: data.face_data,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao buscar decisão: ${error.message}`, error.response?.data);
      throw new HttpException(
        error.response?.data?.message || 'Erro ao buscar decisão da verificação',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
