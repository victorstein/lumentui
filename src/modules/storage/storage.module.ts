import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Global() // Make it global so other modules can use it
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class StorageModule {}
