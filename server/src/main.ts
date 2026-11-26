import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { allowedOrigins } from './common/origins';

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
  // The seed route never exists outside NODE_ENV=test with memory storage.
  const testSeed = process.env.NODE_ENV === 'test' && storage === 'memory';
  const app = await NestFactory.create(AppModule.forRoot({ storage, testSeed }));
  configureApp(app);
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
