/**
 * Shopify Product Interface
 * Based on Shopify Products API response
 */
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
  available?: boolean; // Computed field
}

/**
 * Shopify Product Variant Interface
 */
export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string; // String in Shopify API
  sku: string | null;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  available?: boolean; // Computed field
}

/**
 * Shopify Product Image Interface
 */
export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
}

/**
 * Shopify Product Option Interface
 */
export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

/**
 * Shopify API Response Interface
 */
export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}
