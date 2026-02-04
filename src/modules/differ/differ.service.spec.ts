import { Test, TestingModule } from '@nestjs/testing';
import { DifferService } from './differ.service';
import { ProductDto } from '../api/dto/product.dto';

describe('DifferService', () => {
  let service: DifferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DifferService],
    }).compile();

    service = module.get<DifferService>(DifferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compare', () => {
    it('should detect new products correctly', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '3',
          title: 'Product 3',
          handle: 'product-3',
          price: 300,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-3',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(1);
      expect(result.newProducts[0].id).toBe('3');
      expect(result.newProducts[0].title).toBe('Product 3');
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should handle empty existing products array', () => {
      const existingProducts: ProductDto[] = [];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(2);
      expect(result.newProducts[0].id).toBe('1');
      expect(result.newProducts[1].id).toBe('2');
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should handle empty new products array', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should return no new products when all products exist', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should handle both arrays being empty', () => {
      const existingProducts: ProductDto[] = [];
      const newProducts: ProductDto[] = [];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should detect price increase', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 150,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(1);
      expect(result.priceChanges[0].oldPrice).toBe(100);
      expect(result.priceChanges[0].newPrice).toBe(150);
      expect(result.priceChanges[0].product.id).toBe('1');
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should detect price decrease', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 150,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(1);
      expect(result.priceChanges[0].oldPrice).toBe(150);
      expect(result.priceChanges[0].newPrice).toBe(100);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should not detect price change when price is the same', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should detect compare_at_price change', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          compareAtPrice: 150,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          compareAtPrice: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(1);
      expect(result.priceChanges[0].oldPrice).toBe(100);
      expect(result.priceChanges[0].newPrice).toBe(100);
      expect(result.priceChanges[0].oldCompareAtPrice).toBe(150);
      expect(result.priceChanges[0].newCompareAtPrice).toBe(200);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should detect sold out (available true to false)', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: false,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(1);
      expect(result.availabilityChanges[0].wasAvailable).toBe(true);
      expect(result.availabilityChanges[0].isAvailable).toBe(false);
      expect(result.availabilityChanges[0].product.id).toBe('1');
    });

    it('should detect back in stock (available false to true)', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: false,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(1);
      expect(result.availabilityChanges[0].wasAvailable).toBe(false);
      expect(result.availabilityChanges[0].isAvailable).toBe(true);
      expect(result.availabilityChanges[0].product.id).toBe('1');
    });

    it('should not detect availability change when availability is the same', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
      expect(result.priceChanges).toHaveLength(0);
      expect(result.availabilityChanges).toHaveLength(0);
    });

    it('should detect multiple changes in single poll', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: false,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
        {
          id: '3',
          title: 'Product 3',
          handle: 'product-3',
          price: 300,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-3',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 150,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
        {
          id: '2',
          title: 'Product 2',
          handle: 'product-2',
          price: 200,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-2',
        },
        {
          id: '3',
          title: 'Product 3',
          handle: 'product-3',
          price: 250,
          available: false,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-3',
        },
        {
          id: '4',
          title: 'Product 4',
          handle: 'product-4',
          price: 400,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-4',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(1);
      expect(result.newProducts[0].id).toBe('4');

      expect(result.updatedProducts).toHaveLength(3);

      expect(result.priceChanges).toHaveLength(2);
      expect(
        result.priceChanges.find((p) => p.product.id === '1'),
      ).toBeDefined();
      expect(
        result.priceChanges.find((p) => p.product.id === '3'),
      ).toBeDefined();

      expect(result.availabilityChanges).toHaveLength(2);
      expect(
        result.availabilityChanges.find((a) => a.product.id === '2'),
      ).toBeDefined();
      expect(
        result.availabilityChanges.find((a) => a.product.id === '3'),
      ).toBeDefined();
    });

    it('should detect both price and availability change for same product', () => {
      const existingProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 100,
          available: true,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const newProducts: ProductDto[] = [
        {
          id: '1',
          title: 'Product 1',
          handle: 'product-1',
          price: 150,
          available: false,
          variants: [],
          images: [],
          description: null,
          url: 'https://shop.lumenalta.com/products/product-1',
        },
      ];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(1);
      expect(result.priceChanges).toHaveLength(1);
      expect(result.priceChanges[0].oldPrice).toBe(100);
      expect(result.priceChanges[0].newPrice).toBe(150);
      expect(result.availabilityChanges).toHaveLength(1);
      expect(result.availabilityChanges[0].wasAvailable).toBe(true);
      expect(result.availabilityChanges[0].isAvailable).toBe(false);
    });
  });
});
