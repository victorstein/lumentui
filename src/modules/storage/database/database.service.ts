import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/logger/logger.service';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { ProductDto } from '../../api/dto/product.dto';
import {
  ProductEntity,
  PollEntity,
  NotificationEntity,
  NotificationHistoryFilters,
  NotificationStats,
} from '../entities/product.entity';
import { PathsUtil } from '../../../common/utils/paths.util';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: SqlJsDatabase;
  private readonly dbPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.dbPath =
      this.configService.get<string>('DB_PATH') || PathsUtil.getDefaultDbPath();
  }

  async onModuleInit() {
    this.logger.log('Initializing database connection', 'DatabaseService');

    // Initialize sql.js WASM
    const SQL = await initSqlJs();

    // Load existing database from file, or create new
    const fileBuffer = fs.existsSync(this.dbPath)
      ? fs.readFileSync(this.dbPath)
      : null;

    this.db = fileBuffer
      ? new SQL.Database(new Uint8Array(fileBuffer))
      : new SQL.Database();

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    // Run migrations
    this.runMigrations();

    this.logger.log('Database initialized successfully', 'DatabaseService');
  }

  onModuleDestroy() {
    this.logger.log('Closing database connection', 'DatabaseService');
    this.persist();
    this.db.close();
  }

  /**
   * Persist database to disk
   * sql.js is in-memory only, so we must manually write to disk
   */
  private persist(): void {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
  }

  /**
   * Query helper: execute SQL and return all results as typed objects
   */
  private queryAll<T>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    if (params.length) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /**
   * Query helper: execute SQL and return first result as typed object
   */
  private queryOne<T>(sql: string, params: any[] = []): T | undefined {
    const results = this.queryAll<T>(sql, params);
    return results[0];
  }

  /**
   * Execute SQL with parameters (for INSERT, UPDATE, DELETE)
   */
  private execute(sql: string, params: any[] = []): void {
    this.db.run(sql, params);
  }

  private runMigrations() {
    this.logger.log('Running database migrations', 'DatabaseService');

    // Create products table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        handle TEXT NOT NULL,
        price REAL NOT NULL,
        compare_at_price REAL,
        available INTEGER NOT NULL,
        variants TEXT NOT NULL,
        images TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )
    `);

    // Add compare_at_price column if it doesn't exist (migration for existing databases)
    const columnsResult = this.db.exec(`PRAGMA table_info(products)`);
    if (columnsResult.length > 0) {
      const columns = columnsResult[0].values.map((row) => row[1]);
      if (!columns.includes('compare_at_price')) {
        this.db.run(`ALTER TABLE products ADD COLUMN compare_at_price REAL`);
        this.logger.log(
          'Added compare_at_price column to products table',
          'DatabaseService',
        );
      }
    }

    // Create polls table
    this.db.run(`
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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sent INTEGER NOT NULL,
        product_title TEXT,
        availability_change TEXT,
        error_message TEXT,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Create notification_history_metadata table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notification_history_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_cleanup_timestamp TEXT NOT NULL,
        records_deleted INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create indexes
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_products_first_seen ON products(first_seen_at)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_polls_timestamp ON polls(timestamp)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_notifications_product ON notifications(product_id)`,
    );

    // Persist after migrations
    this.persist();

    this.logger.log('Migrations completed', 'DatabaseService');
  }

  getDatabase(): SqlJsDatabase {
    return this.db;
  }

  /**
   * Save products to database
   * Inserts new products or updates last_seen_at for existing ones
   */
  saveProducts(products: ProductDto[]): number {
    const now = Date.now();
    let savedCount = 0;

    // Manual transaction
    try {
      this.db.run('BEGIN');

      for (const product of products) {
        this.execute(
          `
          INSERT INTO products (
            id, title, handle, price, compare_at_price, available, variants, images,
            description, url, first_seen_at, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            price = excluded.price,
            compare_at_price = excluded.compare_at_price,
            available = excluded.available,
            variants = excluded.variants,
            images = excluded.images,
            description = excluded.description,
            last_seen_at = excluded.last_seen_at
        `,
          [
            product.id,
            product.title,
            product.handle,
            product.price,
            product.compareAtPrice ?? null,
            product.available ? 1 : 0,
            JSON.stringify(product.variants),
            JSON.stringify(product.images),
            product.description,
            product.url,
            now,
            now,
          ],
        );
        savedCount++;
      }

      this.db.run('COMMIT');
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }

    // Persist after saving products
    this.persist();

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

    return this.queryAll<ProductEntity>(query, params);
  }

  /**
   * Get single product by ID
   */
  getProduct(id: string): ProductEntity | null {
    const result = this.queryOne<ProductEntity>(
      'SELECT * FROM products WHERE id = ?',
      [id],
    );

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
    this.execute(
      `
        INSERT INTO polls (
          timestamp, product_count, new_products,
          duration_ms, success, error
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        Date.now(),
        metrics.productCount,
        metrics.newProducts,
        metrics.durationMs,
        metrics.success ? 1 : 0,
        metrics.error || null,
      ],
    );

    // Get last inserted row ID
    const result = this.queryOne<{ id: number }>(
      'SELECT last_insert_rowid() as id',
    );

    // Persist after recording poll
    this.persist();

    this.logger.log(
      `Recorded poll: ${metrics.productCount} products`,
      'DatabaseService',
    );
    return result?.id || 0;
  }

  /**
   * Get poll history
   */
  getPolls(limit: number = 100): PollEntity[] {
    return this.queryAll<PollEntity>(
      'SELECT * FROM polls ORDER BY timestamp DESC LIMIT ?',
      [limit],
    );
  }

  /**
   * Get new products (first seen within X minutes)
   */
  getNewProducts(minutesAgo: number = 60): ProductEntity[] {
    const threshold = Date.now() - minutesAgo * 60 * 1000;

    return this.queryAll<ProductEntity>(
      'SELECT * FROM products WHERE first_seen_at > ? ORDER BY first_seen_at DESC',
      [threshold],
    );
  }

  /**
   * Record notification in database
   */
  recordNotification(
    productId: string,
    sent: boolean,
    options?: {
      productTitle?: string;
      availabilityChange?: string;
      errorMessage?: string;
    },
  ): void {
    try {
      this.execute(
        `
        INSERT INTO notifications (
          product_id, timestamp, sent, product_title,
          availability_change, error_message
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          productId,
          Date.now(),
          sent ? 1 : 0,
          options?.productTitle || null,
          options?.availabilityChange || null,
          options?.errorMessage || null,
        ],
      );

      // Persist after recording notification
      this.persist();

      this.logger.log(
        `Recorded notification for product ${productId} (sent: ${sent})`,
        'DatabaseService',
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to record notification: ${errorMessage}`,
        'DatabaseService',
      );
    }
  }

  /**
   * Get notification history with advanced filtering
   */
  getNotificationHistory(
    filters?: NotificationHistoryFilters,
  ): NotificationEntity[] {
    try {
      let query = 'SELECT * FROM notifications';
      const params: any[] = [];
      const whereClauses: string[] = [];

      if (filters?.dateFrom) {
        const dateFromTimestamp = new Date(filters.dateFrom).getTime();
        whereClauses.push('timestamp >= ?');
        params.push(dateFromTimestamp);
      }

      if (filters?.dateTo) {
        const dateToTimestamp = new Date(filters.dateTo).getTime();
        whereClauses.push('timestamp <= ?');
        params.push(dateToTimestamp);
      }

      if (filters?.productId) {
        whereClauses.push('product_id = ?');
        params.push(filters.productId);
      }

      if (filters?.status) {
        const sentValue = filters.status === 'sent' ? 1 : 0;
        whereClauses.push('sent = ?');
        params.push(sentValue);
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      query += ' ORDER BY timestamp DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      return this.queryAll<NotificationEntity>(query, params);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get notification history: ${errorMessage}`,
        'DatabaseService',
      );
      return [];
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): NotificationStats {
    try {
      const totalSentResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM notifications WHERE sent = 1',
      );

      const totalFailedResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM notifications WHERE sent = 0',
      );

      const countByProductResult = this.queryAll<{
        product_id: string;
        product_title: string | null;
        sent_count: number;
        failed_count: number;
      }>(
        `
          SELECT
            product_id,
            product_title,
            SUM(CASE WHEN sent = 1 THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN sent = 0 THEN 1 ELSE 0 END) as failed_count
          FROM notifications
          GROUP BY product_id, product_title
          ORDER BY (sent_count + failed_count) DESC
        `,
      );

      return {
        totalSent: totalSentResult?.count || 0,
        totalFailed: totalFailedResult?.count || 0,
        countByProduct: countByProductResult,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get notification stats: ${errorMessage}`,
        'DatabaseService',
      );
      return {
        totalSent: 0,
        totalFailed: 0,
        countByProduct: [],
      };
    }
  }

  /**
   * Get recent notifications within rate limit window
   */
  getRecentNotifications(since: number): Array<{
    product_id: string;
    last_sent: number;
  }> {
    try {
      return this.queryAll(
        `
          SELECT product_id, MAX(timestamp) as last_sent
          FROM notifications
          WHERE sent = 1 AND timestamp > ?
          GROUP BY product_id
        `,
        [since],
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get recent notifications: ${errorMessage}`,
        'DatabaseService',
      );
      return [];
    }
  }

  /**
   * Prune old notification history records
   * Deletes notifications older than 30 days OR keeps only the most recent 100 records
   * Records cleanup operation in notification_history_metadata table
   * @returns Number of records deleted
   */
  pruneNotificationHistory(): number {
    try {
      this.db.run('BEGIN');

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const totalCountResult = this.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM notifications',
      );
      const totalCount = totalCountResult?.count || 0;

      let recordsDeleted = 0;

      if (totalCount > 100) {
        const keepCount = 100;
        const deleteByAgeResult = this.queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM notifications WHERE timestamp < ?',
          [thirtyDaysAgo],
        );
        const deleteByAge = deleteByAgeResult?.count || 0;
        const deleteByLimit = totalCount - keepCount;

        if (deleteByLimit > deleteByAge) {
          this.execute(
            `
              DELETE FROM notifications
              WHERE id IN (
                SELECT id FROM notifications
                ORDER BY timestamp DESC
                LIMIT -1 OFFSET ?
              )
            `,
            [keepCount],
          );
          recordsDeleted = deleteByLimit;
        } else {
          this.execute('DELETE FROM notifications WHERE timestamp < ?', [
            thirtyDaysAgo,
          ]);
          recordsDeleted = deleteByAge;
        }
      } else {
        this.execute('DELETE FROM notifications WHERE timestamp < ?', [
          thirtyDaysAgo,
        ]);
        const deleteResult = this.queryOne<{ count: number }>(
          'SELECT changes() as count',
        );
        recordsDeleted = deleteResult?.count || 0;
      }

      const now = new Date().toISOString();
      this.execute(
        `
          INSERT INTO notification_history_metadata (
            last_cleanup_timestamp, records_deleted, created_at
          )
          VALUES (?, ?, ?)
        `,
        [now, recordsDeleted, now],
      );

      this.db.run('COMMIT');

      this.persist();

      this.logger.log(
        `Pruned ${recordsDeleted} notification records`,
        'DatabaseService',
      );

      return recordsDeleted;
    } catch (error: unknown) {
      this.db.run('ROLLBACK');
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to prune notification history: ${errorMessage}`,
        'DatabaseService',
      );
      return 0;
    }
  }
}
