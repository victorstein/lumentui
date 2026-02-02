import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { ProductDto } from '../../api/dto/product.dto';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseService', () => {
  let service: DatabaseService;
  const TEST_DB_PATH = 'data/test-lumentui.db';

  const mockProducts: ProductDto[] = [
    {
      id: '123',
      title: 'Test Product 1',
      handle: 'test-product-1',
      price: 29.99,
      available: true,
      variants: [
        {
          id: '456',
          title: 'Default',
          price: 29.99,
          sku: 'TEST-001',
          available: true,
          inventoryQuantity: 10,
        },
      ],
      images: [
        {
          id: '789',
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          width: 1000,
          height: 1000,
        },
      ],
      description: 'Test description',
      url: 'https://shop.lumenalta.com/products/test-product-1',
    },
    {
      id: '124',
      title: 'Test Product 2',
      handle: 'test-product-2',
      price: 49.99,
      available: false,
      variants: [],
      images: [],
      description: null,
      url: 'https://shop.lumenalta.com/products/test-product-2',
    },
  ];

  beforeEach(async () => {
    // Delete test DB if exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DB_PATH') return TEST_DB_PATH;
              if (key === 'LOG_LEVEL') return 'error';
              return undefined;
            }),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);

    // Trigger onModuleInit manually
    await service.onModuleInit();
  });

  afterEach(async () => {
    // Cleanup
    await service.onModuleDestroy();

    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Database initialization', () => {
    it('should initialize database and create tables', () => {
      const db = service.getDatabase();

      // Check tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('products');
      expect(tableNames).toContain('polls');
      expect(tableNames).toContain('notifications');
    });

    it('should enable foreign keys', () => {
      const db = service.getDatabase();
      const result = db.pragma('foreign_keys', { simple: true });

      expect(result).toBe(1);
    });
  });

  describe('saveProducts', () => {
    it('should save products to database', () => {
      const count = service.saveProducts(mockProducts);

      expect(count).toBe(2);

      const products = service.getProducts();
      expect(products).toHaveLength(2);

      // Verify products exist (order may vary based on insertion time)
      const titles = products.map((p) => p.title);
      expect(titles).toContain('Test Product 1');
      expect(titles).toContain('Test Product 2');
    });

    it('should update existing products on conflict', () => {
      // First save
      service.saveProducts(mockProducts);

      // Update product
      const updatedProduct: ProductDto = {
        ...mockProducts[0],
        title: 'Updated Title',
        price: 39.99,
      };

      service.saveProducts([updatedProduct]);

      const products = service.getProducts();
      expect(products).toHaveLength(2); // Still 2 products

      const product = service.getProduct('123');
      expect(product?.title).toBe('Updated Title');
      expect(product?.price).toBe(39.99);
    });

    it('should handle empty array', () => {
      const count = service.saveProducts([]);
      expect(count).toBe(0);
    });
  });

  describe('getProducts', () => {
    beforeEach(() => {
      service.saveProducts(mockProducts);
    });

    it('should get all products', () => {
      const products = service.getProducts();

      expect(products).toHaveLength(2);
    });

    it('should filter by available', () => {
      const availableProducts = service.getProducts({ available: true });

      expect(availableProducts).toHaveLength(1);
      expect(availableProducts[0].title).toBe('Test Product 1');
    });

    it('should apply limit', () => {
      const products = service.getProducts({ limit: 1 });

      expect(products).toHaveLength(1);
    });

    it('should apply offset', () => {
      // SQLite requires LIMIT when using OFFSET
      const products = service.getProducts({ limit: 10, offset: 1 });

      expect(products).toHaveLength(1);
    });
  });

  describe('getProduct', () => {
    beforeEach(() => {
      service.saveProducts(mockProducts);
    });

    it('should get product by id', () => {
      const product = service.getProduct('123');

      expect(product).not.toBeNull();
      expect(product?.title).toBe('Test Product 1');
      expect(product?.handle).toBe('test-product-1');
    });

    it('should return null for non-existent product', () => {
      const product = service.getProduct('999');

      expect(product).toBeNull();
    });
  });

  describe('recordPoll', () => {
    it('should record a successful poll', () => {
      const id = service.recordPoll({
        productCount: 10,
        newProducts: 2,
        durationMs: 1500,
        success: true,
      });

      expect(id).toBeGreaterThan(0);

      const polls = service.getPolls();
      expect(polls).toHaveLength(1);
      expect(polls[0].product_count).toBe(10);
      expect(polls[0].new_products).toBe(2);
      expect(polls[0].success).toBe(1);
      expect(polls[0].error).toBeNull();
    });

    it('should record a failed poll with error', () => {
      const id = service.recordPoll({
        productCount: 0,
        newProducts: 0,
        durationMs: 500,
        success: false,
        error: 'Network error',
      });

      expect(id).toBeGreaterThan(0);

      const polls = service.getPolls();
      expect(polls).toHaveLength(1);
      expect(polls[0].success).toBe(0);
      expect(polls[0].error).toBe('Network error');
    });
  });

  describe('getPolls', () => {
    beforeEach(() => {
      // Record multiple polls
      for (let i = 0; i < 5; i++) {
        service.recordPoll({
          productCount: i,
          newProducts: 0,
          durationMs: 1000,
          success: true,
        });
      }
    });

    it('should get polls with default limit', () => {
      const polls = service.getPolls();

      expect(polls).toHaveLength(5);
    });

    it('should respect custom limit', () => {
      const polls = service.getPolls(2);

      expect(polls).toHaveLength(2);
    });

    it('should return polls in descending order by timestamp', () => {
      const polls = service.getPolls();

      // Most recent first
      expect(polls[0].product_count).toBe(4);
      expect(polls[4].product_count).toBe(0);
    });
  });

  describe('getNewProducts', () => {
    it('should get products added within time window', async () => {
      // Save first product
      service.saveProducts([mockProducts[0]]);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Save second product
      service.saveProducts([mockProducts[1]]);

      // Get products from last 60 minutes
      const newProducts = service.getNewProducts(60);

      expect(newProducts).toHaveLength(2);
    });

    it('should not return old products', async () => {
      // Save product
      service.saveProducts([mockProducts[0]]);

      // Get products from last 0 minutes (none should match)
      const newProducts = service.getNewProducts(0);

      expect(newProducts).toHaveLength(0);
    });
  });
});
