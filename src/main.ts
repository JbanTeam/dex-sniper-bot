import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { GlobalExceptionFilter } from './libs/core/errors';

async function start() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const constants = app.get(ConstantsProvider);

  await app.listen(constants.PORT);
  return { port: constants.PORT };
}

start()
  .then(({ port }) => console.log(`Server started on ${port}`))
  .catch(err => {
    console.log(err);
  });
