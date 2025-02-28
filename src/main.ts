import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './errors/global-exceptions.filter';

const PORT = process.env.PORT || 3000;

async function start() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  await app.listen(PORT);
}
start()
  .then(() => console.log(`Server started on ${PORT}`))
  .catch(console.error);
