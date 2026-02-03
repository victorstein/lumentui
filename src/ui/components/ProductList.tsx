import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';
import { Product } from '../hooks/useDaemon.js';

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
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.colors.border}
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
      >
        <Box>
          <Text color={theme.colors.primary}>
            <Spinner type="dots" />
          </Text>
          <Text color={theme.colors.primary}> Loading products…</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.colors.textMuted}>
            Waiting for daemon to fetch product catalog
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press{' '}
            <Text color={theme.colors.accent} bold>
              f
            </Text>{' '}
            to force a poll
          </Text>
        </Box>
      </Box>
    );
  }

  // Format price
  const formatPrice = (product: Product) => {
    if (product.variants.length === 0) return `$${product.price.toFixed(2)}`;

    const prices = product.variants.map((v) => v.price);
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
      return (
        <Text color={theme.colors.available}>
          {theme.symbols.check} Available
        </Text>
      );
    } else {
      return (
        <Text color={theme.colors.unavailable}>
          {theme.symbols.cross} Sold Out
        </Text>
      );
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      flexGrow={1}
    >
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
      <Box
        flexDirection="column"
        paddingX={1}
        paddingY={1}
        flexGrow={1}
        overflow="hidden"
        gap={1}
      >
        {products.map((product, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box key={product.id}>
              <Box width="100%" paddingX={1}>
                {isSelected && (
                  <Text color={theme.colors.accent} bold>
                    {theme.symbols.arrow}{' '}
                  </Text>
                )}

                <Box width="60%">
                  <Text
                    color={
                      isSelected ? theme.colors.text : theme.colors.textDim
                    }
                    bold={isSelected}
                    wrap="truncate"
                  >
                    {product.title}
                  </Text>
                </Box>

                <Box width="20%">
                  <Text
                    color={
                      isSelected ? theme.colors.text : theme.colors.textDim
                    }
                    bold={isSelected}
                  >
                    {formatPrice(product)}
                  </Text>
                </Box>

                <Box width="20%">{getAvailabilityIndicator(product)}</Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer stats */}
      <Box
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
        justifyContent="space-between"
      >
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
