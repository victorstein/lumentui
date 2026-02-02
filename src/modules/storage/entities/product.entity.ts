export interface ProductEntity {
  id: string;
  title: string;
  handle: string;
  price: number;
  available: number; // 0 or 1 (SQLite boolean)
  variants: string; // JSON string
  images: string; // JSON string
  description: string | null;
  url: string;
  first_seen_at: number; // Unix timestamp
  last_seen_at: number; // Unix timestamp
}

export interface PollEntity {
  id?: number;
  timestamp: number;
  product_count: number;
  new_products: number;
  duration_ms: number;
  success: number; // 0 or 1
  error: string | null;
}

export interface NotificationEntity {
  id?: number;
  product_id: string;
  timestamp: number;
  sent: number; // 0 or 1
}
