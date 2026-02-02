import { Module } from '@nestjs/common';
import { DifferService } from './differ.service';

@Module({
  providers: [DifferService],
  exports: [DifferService],
})
export class DifferModule {}
