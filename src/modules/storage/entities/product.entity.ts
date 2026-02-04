export interface ProductEntity {
  id: string;
  title: string;
  handle: string;
  price: number;
  compare_at_price: number | null;
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
  product_title?: string | null;
  availability_change?: string | null;
  error_message?: string | null;
  change_type?: 'new' | 'price_change' | 'availability_change' | null;
  old_value?: string | null; // JSON-encoded old value
  new_value?: string | null; // JSON-encoded new value
}

export interface NotificationHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  status?: 'sent' | 'failed';
  changeType?: 'new' | 'price_change' | 'availability_change';
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  countByProduct: Array<{
    product_id: string;
    product_title: string | null;
    sent_count: number;
    failed_count: number;
  }>;
}
