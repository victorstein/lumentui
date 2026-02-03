import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface LogoProps {
  compact?: boolean;
}

/**
 * Reusable Logo component
 */
export const Logo: React.FC<LogoProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <Box>
        <Text color={theme.colors.primary} bold>
          {theme.symbols.star} lumentui
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={theme.colors.primary} bold>
        {theme.logo}
      </Text>
    </Box>
  );
};
