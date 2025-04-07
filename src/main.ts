import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './errors/global-exceptions.filter';
import { ConstantsProvider } from '@modules/constants/constants.provider';

async function start() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  const constants = app.get(ConstantsProvider);

  await app.listen(constants.PORT);
  return { port: constants.PORT };
}

start()
  .then(({ port }) => console.log(`Server started on ${port}`))
  .catch(console.error);
