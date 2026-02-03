import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../theme.js';
import { Product } from '../hooks/useDaemon.js';

interface NotificationBannerProps {
  product: Product | null;
}

/**
 * Notification banner for new products with gradient accent
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  product,
}) => {
  if (!product) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.colors.success}
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Gradient colors={['#06ffa5', '#00d4ff']}>
          <Text bold>
            {theme.symbols.star} NEW PRODUCT DETECTED {theme.symbols.star}
          </Text>
        </Gradient>
      </Box>

      <Box marginTop={1} gap={1}>
        <Text bold color={theme.colors.text}>
          {product.title}
        </Text>
        <Text color={theme.colors.textDim}>({product.handle})</Text>
      </Box>

      {product.price > 0 && (
        <Box gap={1}>
          <Text color={theme.colors.accent} bold>
            ${product.price.toFixed(2)}
          </Text>
          <Text color={theme.colors.textDim}>•</Text>
          <Text
            color={
              product.available
                ? theme.colors.available
                : theme.colors.unavailable
            }
            bold
          >
            {product.available
              ? `${theme.symbols.check} Available`
              : `${theme.symbols.cross} Sold Out`}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Auto-dismiss in 20s</Text>
      </Box>
    </Box>
  );
};
