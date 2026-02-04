import { Injectable } from '@nestjs/common';
import { ProductDto } from '../api/dto/product.dto';

export interface PriceChange {
  product: ProductDto;
  oldPrice: number;
  newPrice: number;
  oldCompareAtPrice?: number;
  newCompareAtPrice?: number;
}

export interface AvailabilityChange {
  product: ProductDto;
  wasAvailable: boolean;
  isAvailable: boolean;
}

export interface DiffResult {
  newProducts: ProductDto[];
  updatedProducts: ProductDto[];
  priceChanges: PriceChange[];
  availabilityChanges: AvailabilityChange[];
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
    const existingProductMap = new Map(existingProducts.map((p) => [p.id, p]));

    const newProductList: ProductDto[] = [];
    const updatedProductList: ProductDto[] = [];
    const priceChangesList: PriceChange[] = [];
    const availabilityChangesList: AvailabilityChange[] = [];

    for (const newProduct of newProducts) {
      const existingProduct = existingProductMap.get(newProduct.id);

      if (!existingProduct) {
        newProductList.push(newProduct);
        continue;
      }

      let hasChanges = false;

      if (
        existingProduct.price !== newProduct.price ||
        existingProduct.compareAtPrice !== newProduct.compareAtPrice
      ) {
        priceChangesList.push({
          product: newProduct,
          oldPrice: existingProduct.price,
          newPrice: newProduct.price,
          oldCompareAtPrice: existingProduct.compareAtPrice ?? undefined,
          newCompareAtPrice: newProduct.compareAtPrice ?? undefined,
        });
        hasChanges = true;
      }

      if (existingProduct.available !== newProduct.available) {
        availabilityChangesList.push({
          product: newProduct,
          wasAvailable: existingProduct.available,
          isAvailable: newProduct.available,
        });
        hasChanges = true;
      }

      if (hasChanges) {
        updatedProductList.push(newProduct);
      }
    }

    return {
      newProducts: newProductList,
      updatedProducts: updatedProductList,
      priceChanges: priceChangesList,
      availabilityChanges: availabilityChangesList,
    };
  }
}
