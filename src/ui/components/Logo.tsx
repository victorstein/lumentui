import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

/**
 * Reusable Logo component
 */
export const Logo: React.FC = () => {
  return (
    <Box>
      <Text color={theme.colors.primary} bold>
        {theme.logo}
      </Text>
    </Box>
  );
};
