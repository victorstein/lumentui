import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';
import { Product } from '../hooks/useDaemon';

interface ProductDetailProps {
  product: Product | null;
}

/**
 * Product detail view component
 */
export const ProductDetail: React.FC<ProductDetailProps> = ({ product }) => {
  if (!product) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.border} padding={1}>
        <Text color={theme.colors.textMuted}>No product selected.</Text>
      </Box>
    );
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.border} padding={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          {product.title}
        </Text>
      </Box>

      {/* Basic Info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Vendor: </Text>
          <Text>{product.vendor}</Text>
        </Box>
        <Box>
          <Text dimColor>Type: </Text>
          <Text>{product.productType}</Text>
        </Box>
        <Box>
          <Text dimColor>Handle: </Text>
          <Text color={theme.colors.textDim}>{product.handle}</Text>
        </Box>
      </Box>

      {/* Availability */}
      <Box marginBottom={1}>
        <Text dimColor>Availability: </Text>
        {product.available ? (
          <Text color={theme.colors.available}>
            {theme.symbols.check} Available
          </Text>
        ) : (
          <Text color={theme.colors.unavailable}>
            {theme.symbols.cross} Sold Out
          </Text>
        )}
      </Box>

      {/* Variants */}
      {product.variants.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.colors.secondary}>
            Variants ({product.variants.length}):
          </Text>
          {product.variants.map((variant) => (
            <Box key={variant.id} marginLeft={2}>
              <Text color={theme.colors.textDim}>{theme.symbols.bullet} </Text>
              <Text>{variant.title}: </Text>
              <Text color={theme.colors.accent}>${variant.price}</Text>
              <Text dimColor> (Stock: {variant.inventoryQuantity})</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Tags */}
      {product.tags.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.colors.secondary}>
            Tags:
          </Text>
          <Box marginLeft={2}>
            <Text color={theme.colors.textDim}>
              {product.tags.join(', ')}
            </Text>
          </Box>
        </Box>
      )}

      {/* Images */}
      {product.images.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.colors.secondary}>
            Images ({product.images.length}):
          </Text>
          {product.images.slice(0, 3).map((image, index) => (
            <Box key={image.id} marginLeft={2}>
              <Text color={theme.colors.textDim}>{theme.symbols.bullet} </Text>
              <Text color={theme.colors.info}>{image.src}</Text>
            </Box>
          ))}
          {product.images.length > 3 && (
            <Box marginLeft={2}>
              <Text dimColor>... and {product.images.length - 3} more</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Timestamps */}
      <Box flexDirection="column" marginTop={1} borderColor={theme.colors.border} borderStyle="single" paddingX={1}>
        <Box>
          <Text dimColor>Created: </Text>
          <Text>{formatDate(product.createdAt)}</Text>
        </Box>
        <Box>
          <Text dimColor>Updated: </Text>
          <Text>{formatDate(product.updatedAt)}</Text>
        </Box>
        <Box>
          <Text dimColor>Published: </Text>
          <Text>{formatDate(product.publishedAt)}</Text>
        </Box>
      </Box>

      {/* ID */}
      <Box marginTop={1}>
        <Text dimColor>Product ID: {product.id}</Text>
      </Box>
    </Box>
  );
};
