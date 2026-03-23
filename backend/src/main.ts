import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const corsOrigin = config.get<string | string[]>('corsOrigin');
  app.enableCors({
    origin: corsOrigin ?? true,
    credentials: true,
  });
  const port = config.get<number>('port') ?? 3001;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
