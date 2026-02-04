import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';

interface StatusViewProps {
  daemonStatus: { isRunning: boolean; pid?: number };
  ipcReachable: boolean | null;
  lastPoll: {
    timestamp: number;
    success: boolean;
    product_count: number;
    new_products: number;
    duration_ms: number;
    error?: string;
  } | null;
  loading: boolean;
}

export const StatusView: React.FC<StatusViewProps> = ({
  daemonStatus,
  ipcReachable,
  lastPoll,
  loading,
}) => {
  const getDaemonStatusColor = () => {
    return daemonStatus.isRunning ? theme.colors.success : theme.colors.error;
  };

  const getIpcStatusColor = () => {
    if (ipcReachable === null) return theme.colors.textDim;
    return ipcReachable ? theme.colors.success : theme.colors.error;
  };

  const getIpcStatusText = () => {
    if (ipcReachable === null) return 'Checking...';
    return ipcReachable ? 'Connected' : 'Not responding';
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        paddingX={2}
        paddingY={1}
        marginTop={1}
      >
        <Gradient colors={['#8338ec', '#00d4ff']}>
          <Text bold>{theme.symbols.star} System Status</Text>
        </Gradient>

        <Box marginTop={1}>
          <Text color={theme.colors.border}>{'─'.repeat(40)}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column" gap={0}>
          <Box flexDirection="row" gap={1}>
            <Text color={getDaemonStatusColor()}>{theme.symbols.bullet}</Text>
            <Text bold>Daemon:</Text>
            <Text color={getDaemonStatusColor()}>
              {daemonStatus.isRunning ? 'Running' : 'Stopped'}
            </Text>
            {daemonStatus.isRunning && daemonStatus.pid && (
              <Text dimColor color={theme.colors.textDim}>
                (PID {daemonStatus.pid})
              </Text>
            )}
          </Box>

          <Box flexDirection="row" gap={1}>
            <Text color={getIpcStatusColor()}>{theme.symbols.bullet}</Text>
            <Text bold>IPC:</Text>
            <Text color={getIpcStatusColor()}>{getIpcStatusText()}</Text>
          </Box>
        </Box>

        {daemonStatus.isRunning && lastPoll && (
          <>
            <Box marginTop={1}>
              <Text color={theme.colors.border}>{'─'.repeat(40)}</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={theme.colors.info}>
                Last Poll
              </Text>
              <Box flexDirection="column" marginTop={1} gap={0} marginLeft={2}>
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>Time:</Text>
                  <Text>{formatTimestamp(lastPoll.timestamp)}</Text>
                </Box>
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>Status:</Text>
                  <Text
                    color={
                      lastPoll.success
                        ? theme.colors.success
                        : theme.colors.error
                    }
                  >
                    {lastPoll.success ? 'Success' : 'Failed'}
                  </Text>
                </Box>
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>Products:</Text>
                  <Text>{lastPoll.product_count}</Text>
                </Box>
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>New:</Text>
                  <Text
                    color={
                      lastPoll.new_products > 0
                        ? theme.colors.success
                        : theme.colors.textDim
                    }
                  >
                    {lastPoll.new_products}
                  </Text>
                </Box>
                <Box flexDirection="row" gap={1}>
                  <Text dimColor>Duration:</Text>
                  <Text>{lastPoll.duration_ms}ms</Text>
                </Box>
                {lastPoll.error && (
                  <Box flexDirection="row" gap={1}>
                    <Text dimColor>Error:</Text>
                    <Text color={theme.colors.error}>{lastPoll.error}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}

        {!daemonStatus.isRunning && (
          <Box marginTop={1} paddingTop={1}>
            <Text dimColor color={theme.colors.textDim}>
              Run lumentui start to start the daemon
            </Text>
          </Box>
        )}
      </Box>

      {loading && (
        <Box marginTop={1}>
          <Text dimColor color={theme.colors.info}>
            {theme.symbols.circle} Loading status...
          </Text>
        </Box>
      )}
    </Box>
  );
};
