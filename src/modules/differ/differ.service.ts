import { Injectable } from '@nestjs/common';
import { ProductDto } from '../api/dto/product.dto';

export interface DiffResult {
  newProducts: ProductDto[];
  updatedProducts: ProductDto[];
}

@Injectable()
export class DifferService {
  /**
   * Compare existing products with new products to find differences
   * @param existingProducts - Products currently in the database
   * @param newProducts - Products fetched from Shopify
   * @returns Object containing new and updated products
   */
  compare(
    existingProducts: ProductDto[],
    newProducts: ProductDto[],
  ): DiffResult {
    // Create a set of existing product IDs for quick lookup
    const existingProductIds = new Set(existingProducts.map((p) => p.id));

    // Filter new products that don't exist in the database
    const newProductList = newProducts.filter(
      (p) => !existingProductIds.has(p.id),
    );

    // For now, we only detect new products
    // Updated products detection could be added here in the future
    const updatedProductList: ProductDto[] = [];

    return {
      newProducts: newProductList,
      updatedProducts: updatedProductList,
    };
  }
}
