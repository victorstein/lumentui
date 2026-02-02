import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface StatusBarProps {
  lastHeartbeat: number | null;
  productCount: number;
  availableCount: number;
  viewMode: 'list' | 'detail';
}

/**
 * Bottom status bar with stats and hotkeys
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  lastHeartbeat,
  productCount,
  availableCount,
  viewMode,
}) => {
  // Calculate next poll time (every minute)
  const getNextPollTime = () => {
    if (!lastHeartbeat) return 'N/A';

    const nextPoll = lastHeartbeat + 60000; // 1 minute from last poll
    const timeUntil = nextPoll - Date.now();

    if (timeUntil <= 0) {
      return 'polling now...';
    }

    const seconds = Math.ceil(timeUntil / 1000);
    return `${seconds}s`;
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Stats bar */}
      <Box
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text color={theme.colors.primary}>{theme.symbols.star} </Text>
          <Text dimColor>Products: </Text>
          <Text color={theme.colors.text}>{productCount}</Text>
          <Text dimColor> | Available: </Text>
          <Text color={theme.colors.available}>{availableCount}</Text>
        </Box>

        <Box>
          <Text dimColor>Next poll in: </Text>
          <Text color={theme.colors.info}>{getNextPollTime()}</Text>
        </Box>

        <Box>
          <Text dimColor>View: </Text>
          <Text color={theme.colors.accent}>
            {viewMode === 'list' ? 'List' : 'Detail'}
          </Text>
        </Box>
      </Box>

      {/* Hotkeys bar */}
      <Box
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text color={theme.colors.textDim}>
            <Text color={theme.colors.accent} bold>
              ↑/k
            </Text>{' '}
            up{' '}
            <Text color={theme.colors.accent} bold>
              ↓/j
            </Text>{' '}
            down
          </Text>
        </Box>

        <Box>
          <Text color={theme.colors.textDim}>
            <Text color={theme.colors.accent} bold>
              enter/space
            </Text>{' '}
            toggle view
          </Text>
        </Box>

        <Box>
          <Text color={theme.colors.textDim}>
            <Text color={theme.colors.accent} bold>
              f
            </Text>{' '}
            force poll
          </Text>
        </Box>

        <Box>
          <Text color={theme.colors.textDim}>
            <Text color={theme.colors.accent} bold>
              q/esc
            </Text>{' '}
            quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
