import { ProductDto } from '../../api/dto/product.dto';
import { ProductEntity } from '../entities/product.entity';

export class StorageNormalizer {
  /**
   * Convert ProductEntity (from DB) to ProductDto
   */
  static fromEntity(entity: ProductEntity): ProductDto {
    return {
      id: entity.id,
      title: entity.title,
      handle: entity.handle,
      price: entity.price,
      available: entity.available === 1,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      variants: JSON.parse(entity.variants),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      images: JSON.parse(entity.images),
      description: entity.description,
      url: entity.url,
      firstSeenAt: new Date(entity.first_seen_at),
      lastSeenAt: new Date(entity.last_seen_at),
    };
  }

  /**
   * Convert array of entities to DTOs
   */
  static fromEntities(entities: ProductEntity[]): ProductDto[] {
    return entities.map((e) => this.fromEntity(e));
  }
}
