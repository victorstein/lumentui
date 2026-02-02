import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShopifyService } from './shopify/shopify.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    AuthModule, // Para obtener cookies
  ],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class ApiModule {}
