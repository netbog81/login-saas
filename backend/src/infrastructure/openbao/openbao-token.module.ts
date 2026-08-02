import { Module, Global } from '@nestjs/common';
import { OpenbaoTokenProvider } from './openbao-token.provider';

@Global()
@Module({
  providers: [OpenbaoTokenProvider],
  exports: [OpenbaoTokenProvider],
})
export class OpenbaoTokenModule {}
