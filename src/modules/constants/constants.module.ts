import { Global, Module } from '@nestjs/common';
import { ConstantsProvider } from './constants.provider';

@Global()
@Module({
  providers: [ConstantsProvider],
  exports: [ConstantsProvider],
})
export class ConstantsModule {}
