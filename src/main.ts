import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const allowed: string[] = [
        'https://0a982c3a-3382-4b9c-bea3-d0188fd5863f-00-2xden0cue9y8d.riker.replit.dev/',
        'https://otsem-gzv6z8fm6-airlogs.vercel.app/',
        'https://otsem-web.vercel.app',
        'https://app.otsempay.com',
        'https://app.otsempay.com.br',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    credentials: true,
    maxAge: 3600
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('OTSEM API')
    .setDescription('Documentação completa das rotas da OTSEM API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Gera o arquivo openapi.json com todas as rotas
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

  const port = process.env.PORT || 3333;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
