import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../theme.js';

interface LogoProps {
  compact?: boolean;
}

/**
 * Reusable Logo component with gradient styling
 */
export const Logo: React.FC<LogoProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <Box>
        <Gradient colors={['#00d4ff', '#8338ec', '#ff006e']}>
          <Text bold>{theme.symbols.star} lumentui</Text>
        </Gradient>
      </Box>
    );
  }

  return (
    <Box>
      <Gradient colors={['#00d4ff', '#8338ec', '#ff006e']}>
        <Text bold>{theme.logo}</Text>
      </Gradient>
    </Box>
  );
};
