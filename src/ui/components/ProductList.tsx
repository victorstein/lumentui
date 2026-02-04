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
 * Product list component with styled rows
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
        borderStyle="round"
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

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      flexGrow={1}
    >
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Box width={3}>
          <Text color={theme.colors.textMuted}> </Text>
        </Box>
        <Box width="55%">
          <Text bold color={theme.colors.textDim}>
            PRODUCT
          </Text>
        </Box>
        <Box width="20%">
          <Text bold color={theme.colors.textDim}>
            PRICE
          </Text>
        </Box>
        <Box width="25%">
          <Text bold color={theme.colors.textDim}>
            STATUS
          </Text>
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.colors.border}>{'─'.repeat(76)}</Text>
      </Box>

      {/* Product rows */}
      <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
        {products.map((product, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box key={product.id} paddingY={0}>
              <Box width={3}>
                {isSelected ? (
                  <Text color={theme.colors.accent} bold>
                    {theme.symbols.arrow}{' '}
                  </Text>
                ) : (
                  <Text> </Text>
                )}
              </Box>

              <Box width="55%">
                <Text
                  color={isSelected ? theme.colors.text : theme.colors.textDim}
                  bold={isSelected}
                  wrap="truncate"
                  inverse={isSelected}
                >
                  {isSelected ? ` ${product.title} ` : product.title}
                </Text>
              </Box>

              <Box width="20%">
                <Text
                  color={
                    isSelected ? theme.colors.accent : theme.colors.textDim
                  }
                  bold={isSelected}
                >
                  {formatPrice(product)}
                </Text>
              </Box>

              <Box width="25%">
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
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box paddingX={1}>
        <Text color={theme.colors.border}>{'─'.repeat(76)}</Text>
      </Box>
      <Box paddingX={1} paddingBottom={0} justifyContent="space-between">
        <Text dimColor>
          {products.length} of {totalProducts} products
        </Text>
        <Text color={theme.colors.available}>
          {theme.symbols.bullet} {availableProducts} available
        </Text>
      </Box>
    </Box>
  );
};
