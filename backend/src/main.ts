import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Global API Prefix
  app.setGlobalPrefix('api/v1')

  // Security Middleware
  app.use(helmet())

  // Strict CORS Policies
  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-gowa-signature'],
  })

  // DTO Input Validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
  await app.listen(PORT, '0.0.0.0')
  console.log(`Enterprise WhatsApp CRM Backend running on http://0.0.0.0:${PORT}/api/v1`)
}

bootstrap()
