import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 严格划定 API 前缀区间，与 Vite Proxy 1:1 双向奔赴
  app.setGlobalPrefix('api');

  // Enforce DTO validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
