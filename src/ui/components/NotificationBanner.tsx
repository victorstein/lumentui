import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';
import { Product } from '../hooks/useDaemon';

interface NotificationBannerProps {
  product: Product | null;
}

/**
 * Notification banner for new products
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({ product }) => {
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
        <Text color={theme.colors.success} bold>
          {theme.symbols.star} NEW PRODUCT DETECTED! {theme.symbols.star}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text bold color={theme.colors.text}>
          {product.title}
        </Text>
      </Box>

      <Box>
        <Text color={theme.colors.textDim}>
          {product.vendor} • {product.productType}
        </Text>
      </Box>

      {product.variants.length > 0 && (
        <Box marginTop={1}>
          <Text color={theme.colors.accent}>
            Price: ${product.variants[0].price}
          </Text>
          <Text> • </Text>
          <Text color={product.available ? theme.colors.available : theme.colors.unavailable}>
            {product.available ? 'Available' : 'Sold Out'}
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>(This notification will disappear in 5 seconds)</Text>
      </Box>
    </Box>
  );
};
