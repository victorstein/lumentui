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
    });

    it('should handle both arrays being empty', () => {
      const existingProducts: ProductDto[] = [];
      const newProducts: ProductDto[] = [];

      const result = service.compare(existingProducts, newProducts);

      expect(result.newProducts).toHaveLength(0);
      expect(result.updatedProducts).toHaveLength(0);
    });
  });
});
