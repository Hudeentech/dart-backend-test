import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Body parser limits (support profile image uploads)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Security Headers & Compression
  app.use(helmet());
  app.use(compression());

  // Cross-Origin Resource Sharing
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Route Prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Strict Data Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger / OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('DART.ng API')
    .setDescription(
      'DART.ng Delivery Marketplace Backend - Authoritative Lifecycle, Double-Entry Ledger, and Real-Time Logistics',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'Customer and Rider registration, Argon2id login, and JWT rotation')
    .addTag('Users & Addresses', 'Customer profiles and saved delivery addresses')
    .addTag('Riders', 'Rider profiles, availability beacons, and map-free discovery')
    .addTag('Pricing & Quotes', 'Authoritative server-calculated pricing engine')
    .addTag('Packages', 'Package items, dimensions, and draft order creation')
    .addTag('Orders', 'Authoritative state machine, rider selection, pickup, and delivery confirmation')
    .addTag('Payments', 'Payment gateway adapter, wallet escrow hold, and webhooks')
    .addTag('Wallet & Ledger', 'Auditable double-entry ledger transactions and withdrawals')
    .addTag('Tracking', 'Public milestones and chronological package delivery timeline')
    .addTag('Ratings & Reviews', 'Customer feedback and rolling rider score calculation')
    .addTag('Admin & Operations', 'System audit logs, metrics, and order inspection')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 DART.ng Backend API is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger Documentation is available at: http://localhost:${port}/api/docs`);
}

bootstrap();
