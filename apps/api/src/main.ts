import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/business-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const port = configService.get<number>('app.port') ?? 3000;

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => {
      const isLocalhost = !origin || origin.includes('localhost') || origin.includes('127.0.0.1');
      if (isLocalhost || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('不允许的 CORS 跨域请求: ' + origin), false);
      }
    },
    credentials: true,
  });

  // 2. 配置 Swagger 在线接口文档
  const config = new DocumentBuilder()
    .setTitle('经销商平台后服务 API (自动文档)')
    .setDescription('通过查看这个页面，外部团队可以轻松了解本系统的所有可用接口。')
    .setVersion('1.0.0')
    .addBearerAuth() // 开启全局 JWT Token 传递功能
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json', // 提供给前端的一键拉取生成 JSON 端点
  });

  await app.listen(port);
}
bootstrap();
