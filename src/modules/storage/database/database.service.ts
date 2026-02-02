import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/logger/logger.service';
import Database from 'better-sqlite3';
import { ProductDto } from '../../api/dto/product.dto';
import { ProductEntity, PollEntity } from '../entities/product.entity';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;
  private readonly DB_PATH: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.DB_PATH =
      this.configService.get<string>('DB_PATH') || 'data/lumentui.db';
  }

  onModuleInit() {
    this.logger.log('Initializing database connection', 'DatabaseService');

    // Initialize SQLite database
    this.db = new Database(this.DB_PATH, {
      verbose: (message) => {
        if (this.configService.get<string>('LOG_LEVEL') === 'debug') {
          this.logger.log(message, 'SQLite');
        }
      },
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    this.runMigrations();

    this.logger.log('Database initialized successfully', 'DatabaseService');
  }

  onModuleDestroy() {
    this.logger.log('Closing database connection', 'DatabaseService');
    this.db.close();
  }

  private runMigrations() {
    this.logger.log('Running database migrations', 'DatabaseService');

    // Create products table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        handle TEXT NOT NULL,
        price REAL NOT NULL,
        available INTEGER NOT NULL,
        variants TEXT NOT NULL,
        images TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    `);

    // Create polls table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        product_count INTEGER NOT NULL,
        new_products INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error TEXT
      )
    `);

    // Create notifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sent INTEGER NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);
      CREATE INDEX IF NOT EXISTS idx_products_first_seen ON products(first_seen_at);
      CREATE INDEX IF NOT EXISTS idx_polls_timestamp ON polls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_notifications_product ON notifications(product_id);
    `);

    this.logger.log('Migrations completed', 'DatabaseService');
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Save products to database
   * Inserts new products or updates last_seen_at for existing ones
   */
  saveProducts(products: ProductDto[]): number {
    const now = Date.now();
    let savedCount = 0;

    const insertStmt = this.db.prepare(`
      INSERT INTO products (
        id, title, handle, price, available, variants, images, 
        description, url, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        price = excluded.price,
        available = excluded.available,
        variants = excluded.variants,
        images = excluded.images,
        description = excluded.description,
        last_seen_at = excluded.last_seen_at
    `);

    const transaction = this.db.transaction((products: ProductDto[]) => {
      for (const product of products) {
        insertStmt.run(
          product.id,
          product.title,
          product.handle,
          product.price,
          product.available ? 1 : 0,
          JSON.stringify(product.variants),
          JSON.stringify(product.images),
          product.description,
          product.url,
          now,
          now,
        );
        savedCount++;
      }
    });

    transaction(products);

    this.logger.log(
      `Saved ${savedCount} products to database`,
      'DatabaseService',
    );
    return savedCount;
  }

  /**
   * Get all products
   */
  getProducts(filters?: {
    available?: boolean;
    limit?: number;
    offset?: number;
  }): ProductEntity[] {
    let query = 'SELECT * FROM products';
    const params: any[] = [];

    if (filters?.available !== undefined) {
      query += ' WHERE available = ?';
      params.push(filters.available ? 1 : 0);
    }

    query += ' ORDER BY first_seen_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.db.prepare(query).all(...params) as ProductEntity[];
  }

  /**
   * Get single product by ID
   */
  getProduct(id: string): ProductEntity | null {
    const result = this.db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(id) as ProductEntity | undefined;

    return result || null;
  }

  /**
   * Record a poll event
   */
  recordPoll(metrics: {
    productCount: number;
    newProducts: number;
    durationMs: number;
    success: boolean;
    error?: string;
  }): number {
    const result = this.db
      .prepare(
        `
        INSERT INTO polls (
          timestamp, product_count, new_products, 
          duration_ms, success, error
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        Date.now(),
        metrics.productCount,
        metrics.newProducts,
        metrics.durationMs,
        metrics.success ? 1 : 0,
        metrics.error || null,
      );

    this.logger.log(
      `Recorded poll: ${metrics.productCount} products`,
      'DatabaseService',
    );
    return result.lastInsertRowid as number;
  }

  /**
   * Get poll history
   */
  getPolls(limit: number = 100): PollEntity[] {
    return this.db
      .prepare('SELECT * FROM polls ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as PollEntity[];
  }

  /**
   * Get new products (first seen within X minutes)
   */
  getNewProducts(minutesAgo: number = 60): ProductEntity[] {
    const threshold = Date.now() - minutesAgo * 60 * 1000;

    return this.db
      .prepare(
        'SELECT * FROM products WHERE first_seen_at > ? ORDER BY first_seen_at DESC',
      )
      .all(threshold) as ProductEntity[];
  }
}
