import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';

interface HeaderProps {
  connected: boolean;
  lastHeartbeat: number | null;
}

/**
 * Header component with gradient logo and connection status
 */
export const Header: React.FC<HeaderProps> = ({ connected, lastHeartbeat }) => {
  const getHeartbeatStatus = () => {
    if (!connected) {
      return (
        <Text color={theme.colors.error}>
          {theme.symbols.cross} Disconnected
        </Text>
      );
    }

    if (!lastHeartbeat) {
      return (
        <Text color={theme.colors.warning}>
          <Spinner type="dots" /> Connecting...
        </Text>
      );
    }

    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    const secondsAgo = Math.floor(timeSinceHeartbeat / 1000);

    if (secondsAgo < 60) {
      return (
        <Text color={theme.colors.success}>
          {theme.symbols.check} Connected
        </Text>
      );
    } else if (secondsAgo < 120) {
      return (
        <Text color={theme.colors.warning}>
          {theme.symbols.warning} Stale (1m)
        </Text>
      );
    } else {
      return (
        <Text color={theme.colors.error}>
          {theme.symbols.warning} Stale ({Math.floor(secondsAgo / 60)}m)
        </Text>
      );
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between" alignItems="center">
        <Logo compact />
        <Box gap={2}>
          <Box>
            <Text dimColor>Status: </Text>
            {getHeartbeatStatus()}
          </Box>
          {lastHeartbeat && (
            <Box>
              <Text dimColor>Last poll: </Text>
              <Text color={theme.colors.textDim}>
                {new Date(lastHeartbeat).toLocaleTimeString()}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      <Box>
        <Text color={theme.colors.border}>{'─'.repeat(80)}</Text>
      </Box>
    </Box>
  );
};
