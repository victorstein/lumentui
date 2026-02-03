import React from 'react';
import { Box, Text, Static } from 'ink';
import { theme } from '../theme.js';
import { LogEntry } from '../hooks/useDaemon.js';

interface LogPanelProps {
  logs: LogEntry[];
}

/**
 * Log panel component showing daemon logs with Static for performance
 */
export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const getLogColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return theme.colors.error;
      case 'warn':
      case 'warning':
        return theme.colors.warning;
      case 'info':
        return theme.colors.info;
      case 'debug':
        return theme.colors.textDim;
      default:
        return theme.colors.text;
    }
  };

  const getLogSymbol = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return theme.symbols.cross;
      case 'warn':
      case 'warning':
        return theme.symbols.warning;
      case 'info':
        return theme.symbols.info;
      case 'debug':
        return theme.symbols.bullet;
      default:
        return theme.symbols.dot;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      flexGrow={1}
    >
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color={theme.colors.primary}>
          {theme.symbols.info} Daemon Logs
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.colors.border}>{'─'.repeat(40)}</Text>
      </Box>

      {/* Logs */}
      <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
        {logs.length === 0 ? (
          <Text color={theme.colors.textMuted}>No logs yet...</Text>
        ) : (
          logs.map((log, index) => (
            <Box key={index} flexShrink={0}>
              <Text color={theme.colors.textMuted}>
                {formatTime(log.timestamp)}{' '}
              </Text>
              <Text color={getLogColor(log.level)}>
                {getLogSymbol(log.level)}{' '}
              </Text>
              <Text wrap="truncate">{log.message}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
