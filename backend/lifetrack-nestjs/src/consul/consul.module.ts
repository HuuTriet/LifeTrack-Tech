import { Global, Module } from '@nestjs/common';
import { ConsulService } from './consul.service';

/**
 * ConsulModule is marked @Global so ConsulService is available
 * across the entire application without re-importing.
 */
@Global()
@Module({
  providers: [ConsulService],
  exports: [ConsulService],
})
export class ConsulModule {}
