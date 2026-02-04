import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';

interface StatusBarProps {
  lastHeartbeat: number | null;
  productCount: number;
  availableCount: number;
  viewMode: 'list' | 'detail';
  polling: boolean;
  appView?: 'main' | 'history';
}

/**
 * Bottom status bar with stats and hotkeys
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  lastHeartbeat,
  productCount,
  availableCount,
  viewMode,
  polling,
  appView = 'main',
}) => {
  const getNextPollTime = () => {
    if (!lastHeartbeat) return 'N/A';

    const nextPoll = lastHeartbeat + 60000;
    const timeUntil = nextPoll - Date.now();

    if (timeUntil <= 0) {
      return 'now';
    }

    const seconds = Math.ceil(timeUntil / 1000);
    return `${seconds}s`;
  };

  return (
    <Box flexDirection="column">
      {/* Stats bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text color={theme.colors.textDim}>Products:</Text>
          <Text color={theme.colors.text} bold>
            {productCount}
          </Text>
          <Text color={theme.colors.textDim}>│</Text>
          <Text color={theme.colors.textDim}>Available:</Text>
          <Text color={theme.colors.available} bold>
            {availableCount}
          </Text>
        </Box>

        <Box gap={1}>
          {polling ? (
            <>
              <Text color={theme.colors.warning}>
                <Spinner type="dots" />
              </Text>
              <Text color={theme.colors.warning}>Polling…</Text>
            </>
          ) : (
            <>
              <Text color={theme.colors.textDim}>Next poll:</Text>
              <Text color={theme.colors.info}>{getNextPollTime()}</Text>
            </>
          )}
          <Text color={theme.colors.textDim}>│</Text>
          <Text color={theme.colors.textDim}>View:</Text>
          <Text color={theme.colors.accent} bold>
            {viewMode === 'list' ? 'List' : 'Detail'}
          </Text>
        </Box>
      </Box>

      {/* Hotkeys bar */}
      <Box paddingX={1} gap={2}>
        <Text color={theme.colors.textMuted}>
          <Text color={theme.colors.accent}>↑↓</Text> navigate
        </Text>
        <Text color={theme.colors.textMuted}>
          <Text color={theme.colors.accent}>enter</Text> select
        </Text>
        <Text color={theme.colors.textMuted}>
          <Text color={theme.colors.accent}>f</Text> poll
        </Text>
        {appView === 'main' && (
          <Text color={theme.colors.textMuted}>
            <Text color={theme.colors.accent}>h</Text> history
          </Text>
        )}
        <Text color={theme.colors.textMuted}>
          <Text color={theme.colors.accent}>esc</Text> back
        </Text>
        <Text color={theme.colors.textMuted}>
          <Text color={theme.colors.accent}>q</Text> quit
        </Text>
      </Box>
    </Box>
  );
};
