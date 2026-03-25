import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';

  // ── Global prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Global Exception Filter (clean error responses) ──────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global Validation Pipe (class-validator DTOs) ────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // Auto-transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Interceptors ──────────────────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Global Guards ────────────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  );

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LifeTrack Tech API')
    .setDescription(
      `## Elderly Health & Medication Management System

### Core Business Rules
- **Medication Safety**: Drug interaction check is mandatory for all non-generic prescriptions.
- **HTTP 422**: Returned when dosage is missing and \`unknownDosage\` flag is not set.
- **HTTP 400**: Returned when HIGH RISK drug interaction is detected (prescription blocked).
- **Generic Reminders**: \`isGenericReminder=true\` bypasses all safety checks; sets \`requireDisclaimer=true\`.

### Architecture
- **Framework**: NestJS (TypeScript)
- **Database**: MySQL + TypeORM
- **Cache**: Redis (TTL: 5–10 min for drug catalog)
- **Service Discovery**: Consul
- **API Gateway**: Kong
- **OCR**: Python microservice (REST primary, gRPC fallback)
      `,
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addServer(`http://localhost:${port}`, 'Local Development')
    .addTag('Medications', 'Prescription & Drug management with safety checks')
    .addTag('OCR', 'Prescription image scanning via Python OCR service')
    .addTag('Health', 'Vital signs & health metrics')
    .addTag('Auth', 'Authentication & authorization')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  await app.listen(port);

  console.log(`
╔════════════════════════════════════════════════╗
║         LifeTrack Tech — NestJS Backend        ║
╠════════════════════════════════════════════════╣
║  API:     http://localhost:${port}/${apiPrefix}        ║
║  Docs:    http://localhost:${port}/${apiPrefix}/docs   ║
║  Health:  http://localhost:${port}/health             ║
╚════════════════════════════════════════════════╝
  `);
}

bootstrap();
