import { ShopifyProduct } from '../interfaces/shopify.interface';
import { ProductDto } from '../dto/product.dto';

export class ProductNormalizer {
  /**
   * Convert Shopify product to internal DTO
   */
  static normalize(product: ShopifyProduct, baseUrl: string): ProductDto {
    // Calculate min price from variants
    const minPrice = Math.min(
      ...product.variants.map((v) => parseFloat(v.price)),
    );

    // Check if any variant is available
    const available = product.variants.some((v) => v.inventory_quantity > 0);

    // Strip HTML from description
    const description = product.body_html
      ? product.body_html.replace(/<[^>]*>/g, '')
      : null;

    return {
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      price: minPrice,
      available,
      variants: product.variants.map((v) => ({
        id: v.id.toString(),
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        available: v.inventory_quantity > 0,
        inventoryQuantity: v.inventory_quantity,
      })),
      images: product.images.map((img) => ({
        id: img.id.toString(),
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
      })),
      description,
      url: `${baseUrl}/products/${product.handle}`,
    };
  }

  /**
   * Normalize array of products
   */
  static normalizeAll(
    products: ShopifyProduct[],
    baseUrl: string,
  ): ProductDto[] {
    return products.map((p) => this.normalize(p, baseUrl));
  }
}
