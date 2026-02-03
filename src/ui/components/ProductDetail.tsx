import React from 'react';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../theme.js';
import { Product } from '../hooks/useDaemon.js';

interface ProductDetailProps {
  product: Product | null;
}

/**
 * Product detail view with sections and clickable links
 */
export const ProductDetail: React.FC<ProductDetailProps> = ({ product }) => {
  if (!product) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        padding={1}
      >
        <Text color={theme.colors.textMuted}>No product selected.</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      padding={1}
      flexGrow={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          {product.title}
        </Text>
      </Box>

      {/* Divider */}
      <Box>
        <Text color={theme.colors.border}>{'─'.repeat(50)}</Text>
      </Box>

      {/* Basic Info */}
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <Box>
          <Text color={theme.colors.textDim}>Handle </Text>
          <Text>{product.handle}</Text>
        </Box>
        <Box>
          <Text color={theme.colors.textDim}>Price </Text>
          <Text color={theme.colors.accent} bold>
            ${product.price.toFixed(2)}
          </Text>
        </Box>
        <Box>
          <Text color={theme.colors.textDim}>Status </Text>
          {product.available ? (
            <Text color={theme.colors.available} bold>
              {theme.symbols.check} Available
            </Text>
          ) : (
            <Text color={theme.colors.unavailable}>
              {theme.symbols.cross} Sold Out
            </Text>
          )}
        </Box>
        <Box>
          <Text color={theme.colors.textDim}>URL </Text>
          <Link url={product.url}>
            <Text color={theme.colors.info}>{product.url}</Text>
          </Link>
        </Box>
      </Box>

      {/* Description */}
      {product.description && (
        <>
          <Box>
            <Text color={theme.colors.border}>{'─'.repeat(50)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            <Text bold color={theme.colors.secondary}>
              Description
            </Text>
            <Box marginLeft={2} marginTop={0}>
              <Text color={theme.colors.textDim}>{product.description}</Text>
            </Box>
          </Box>
        </>
      )}

      {/* Variants */}
      {product.variants.length > 0 && (
        <>
          <Box>
            <Text color={theme.colors.border}>{'─'.repeat(50)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            <Text bold color={theme.colors.secondary}>
              Variants ({product.variants.length})
            </Text>
            {product.variants.map((variant) => (
              <Box key={variant.id} marginLeft={2}>
                <Text color={theme.colors.textDim}>
                  {theme.symbols.bullet}{' '}
                </Text>
                <Text bold>{variant.title}</Text>
                <Text color={theme.colors.accent}>
                  {' '}
                  ${variant.price.toFixed(2)}
                </Text>
                <Text dimColor> (Stock: {variant.inventoryQuantity})</Text>
                {variant.available ? (
                  <Text color={theme.colors.available}>
                    {' '}
                    {theme.symbols.check}
                  </Text>
                ) : (
                  <Text color={theme.colors.unavailable}>
                    {' '}
                    {theme.symbols.cross}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* Images */}
      {product.images.length > 0 && (
        <>
          <Box>
            <Text color={theme.colors.border}>{'─'.repeat(50)}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginBottom={1}>
            <Text bold color={theme.colors.secondary}>
              Images ({product.images.length})
            </Text>
            {product.images.slice(0, 3).map((image) => (
              <Box key={image.id} marginLeft={2}>
                <Text color={theme.colors.textDim}>
                  {theme.symbols.bullet}{' '}
                </Text>
                <Link url={image.src}>
                  <Text color={theme.colors.info}>{image.src}</Text>
                </Link>
              </Box>
            ))}
            {product.images.length > 3 && (
              <Box marginLeft={2}>
                <Text dimColor>... and {product.images.length - 3} more</Text>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>ID: {product.id}</Text>
      </Box>
      <Box>
        <Text dimColor>
          Press{' '}
          <Text color={theme.colors.accent} bold>
            esc
          </Text>{' '}
          to go back
        </Text>
      </Box>
    </Box>
  );
};
