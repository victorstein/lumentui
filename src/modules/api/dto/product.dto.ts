/**
 * Internal Product DTO
 * Normalized representation for database storage
 */
export interface ProductDto {
  id: string; // Shopify ID as string
  title: string;
  handle: string;
  price: number; // Converted to number
  compareAtPrice?: number | null;
  available: boolean;
  variants: VariantDto[];
  images: ImageDto[];
  description: string | null;
  url: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
}

export interface VariantDto {
  id: string;
  title: string;
  price: number;
  sku: string | null;
  available: boolean;
  inventoryQuantity: number;
}

export interface ImageDto {
  id: string;
  src: string;
  alt: string | null;
  width: number;
  height: number;
}
