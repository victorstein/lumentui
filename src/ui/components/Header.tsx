import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

interface HeaderProps {
  connected: boolean;
  lastHeartbeat: number | null;
}

/**
 * Header component with logo and connection status
 */
export const Header: React.FC<HeaderProps> = ({ connected, lastHeartbeat }) => {
  // Calculate time since last heartbeat
  const getHeartbeatStatus = () => {
    if (!connected) {
      return <Text color={theme.colors.error}>Disconnected</Text>;
    }

    if (!lastHeartbeat) {
      return <Text color={theme.colors.warning}>Connecting...</Text>;
    }

    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    const secondsAgo = Math.floor(timeSinceHeartbeat / 1000);

    if (secondsAgo < 60) {
      return <Text color={theme.colors.success}>Connected</Text>;
    } else if (secondsAgo < 120) {
      return <Text color={theme.colors.warning}>Stale (1m)</Text>;
    } else {
      return (
        <Text color={theme.colors.error}>
          Stale ({Math.floor(secondsAgo / 60)}m)
        </Text>
      );
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Logo */}
      <Box>
        <Text color={theme.colors.primary} bold>
          {theme.logo}
        </Text>
      </Box>

      {/* Status bar */}
      <Box
        justifyContent="space-between"
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
      >
        <Box>
          <Text dimColor>Status: </Text>
          {getHeartbeatStatus()}
        </Box>

        <Box>
          <Text dimColor>Daemon: </Text>
          <Text color={connected ? theme.colors.success : theme.colors.error}>
            {connected ? theme.symbols.check : theme.symbols.cross}
          </Text>
        </Box>

        {lastHeartbeat && (
          <Box>
            <Text dimColor>Last poll: </Text>
            <Text>{new Date(lastHeartbeat).toLocaleTimeString()}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
