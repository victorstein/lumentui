import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';
import { Product } from '../hooks/useDaemon';

interface ProductListProps {
  products: Product[];
  selectedIndex: number;
  totalProducts: number;
  availableProducts: number;
}

/**
 * Product list table component
 */
export const ProductList: React.FC<ProductListProps> = ({
  products,
  selectedIndex,
  totalProducts,
  availableProducts,
}) => {
  if (products.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.border} padding={1}>
        <Text color={theme.colors.textMuted}>No products found.</Text>
        <Text dimColor>The daemon might still be fetching products...</Text>
      </Box>
    );
  }

  // Format price
  const formatPrice = (variants: Product['variants']) => {
    if (variants.length === 0) return 'N/A';
    
    const prices = variants.map((v) => parseFloat(v.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return `$${minPrice.toFixed(2)}`;
    }

    return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
  };

  // Get availability status
  const getAvailabilityIndicator = (product: Product) => {
    if (product.available) {
      return <Text color={theme.colors.available}>{theme.symbols.check} Available</Text>;
    } else {
      return <Text color={theme.colors.unavailable}>{theme.symbols.cross} Sold Out</Text>;
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.border}>
      {/* Header */}
      <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
        <Box width="60%">
          <Text bold color={theme.colors.primary}>
            Product Name
          </Text>
        </Box>
        <Box width="20%">
          <Text bold color={theme.colors.primary}>
            Price
          </Text>
        </Box>
        <Box width="20%">
          <Text bold color={theme.colors.primary}>
            Status
          </Text>
        </Box>
      </Box>

      {/* Product rows */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {products.map((product, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box key={product.id} marginBottom={index < products.length - 1 ? 1 : 0}>
              <Box
                width="100%"
                paddingX={1}
              >
                {isSelected && (
                  <Text color={theme.colors.accent} bold>
                    {theme.symbols.arrow}{' '}
                  </Text>
                )}
                
                <Box width="60%">
                  <Text color={isSelected ? theme.colors.text : theme.colors.textDim} bold={isSelected}>
                    {product.title}
                  </Text>
                </Box>

                <Box width="20%">
                  <Text color={isSelected ? theme.colors.text : theme.colors.textDim} bold={isSelected}>
                    {formatPrice(product.variants)}
                  </Text>
                </Box>

                <Box width="20%">{getAvailabilityIndicator(product)}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer stats */}
      <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1} justifyContent="space-between">
        <Text dimColor>
          Showing {products.length} of {totalProducts} products
        </Text>
        <Text color={theme.colors.available}>
          {availableProducts} available
        </Text>
      </Box>
    </Box>
  );
};
