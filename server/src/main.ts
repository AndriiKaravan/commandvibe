import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: allowedOrigins(),
    allowedHeaders: [
      'authorization',
      'content-type',
      'x-realtime-session',
      'x-firebase-appcheck',
      'x-app-platform',
      'x-app-build',
    ],
  });
  app.enableShutdownHooks();
}

async function bootstrap(): Promise<void> {
  const storage = process.env.STORAGE === 'memory' ? 'memory' : 'firestore';
  const app = await NestFactory.create(AppModule.forRoot({ storage }));
  configureApp(app);
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
