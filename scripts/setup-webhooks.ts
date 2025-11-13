import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InterWebhookService } from '../src/inter/services/inter-webhook.service';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    const webhookService = app.get(InterWebhookService);

    const webhookUrl =
        process.env.WEBHOOK_BASE_URL || 'https://sua-api.com';

    console.log('🔧 Configurando webhooks da Inter...\n');
    console.log(`📍 URL Base: ${webhookUrl}\n`);

    try {
        // ✅ Verificar callbacks existentes
        console.log('🔍 Verificando callbacks existentes...\n');

        const pixCallback = await webhookService.getCallbacks('pix');
        const boletoCallback = await webhookService.getCallbacks('boletos');

        console.log('Pix atual:', pixCallback.webhookUrl || 'Nenhum');
        console.log('Boleto atual:', boletoCallback.webhookUrl || 'Nenhum');
        console.log();

        // ✅ Configurar Pix
        console.log('📱 Configurando webhook de Pix...');
        await webhookService.createCallback('pix', {
            webhookUrl: `${webhookUrl}/inter/webhooks/receive/pix`,
        });
        console.log('✅ Pix webhook configurado!\n');

        // ✅ Configurar Boletos
        console.log('📄 Configurando webhook de Boletos...');
        await webhookService.createCallback('boletos', {
            webhookUrl: `${webhookUrl}/inter/webhooks/receive/boletos`,
        });
        console.log('✅ Boleto webhook configurado!\n');

        console.log('🎉 Webhooks configurados com sucesso!\n');

        // ✅ Verificar novamente
        console.log('✅ Verificação final:');
        const pixFinal = await webhookService.getCallbacks('pix');
        const boletoFinal = await webhookService.getCallbacks('boletos');

        console.log('Pix:', pixFinal.webhookUrl);
        console.log('Boleto:', boletoFinal.webhookUrl);
    } catch (error: any) {
        console.error('❌ Erro ao configurar webhooks:', error.message);
        console.error('Detalhes:', error.response?.data || error);
        process.exit(1);
    }

    await app.close();
    process.exit(0);
}

bootstrap().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});