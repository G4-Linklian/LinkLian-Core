import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'v1', {
    exclude: ['health', 'ping'],
  });


  // Enable validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    transformOptions: {
      //enableImplicitConversion: true,
    },
  }));

  app.enableCors();

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('LinkLian API Documentation')
    .setDescription('API Documentation for LinkLian Server')
    //.setVersion('1.0.0')
    .addServer('http://localhost:5400', 'Local')
    .addServer('https://uat-api.linklian.org', 'Staging')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      docExpansion: 'none',     // พับทั้งหมด
      // defaultModelsExpandDepth: -1, 
      persistAuthorization: true,  // จำ token
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT ?? 5400);
  console.log(`Application is running on: ${await app.getUrl()}/${process.env.API_PREFIX ?? 'v1'}`);
  console.log(`Swagger docs available at: ${await app.getUrl()}/docs`);
}
bootstrap();
