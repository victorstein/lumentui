import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { LogEntry } from '../hooks/useDaemon.js';

interface LogPanelProps {
  logs: LogEntry[];
}

/**
 * Log panel component showing daemon logs
 */
export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  // Get color based on log level
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

  // Get symbol based on log level
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

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      flexGrow={1}
    >
      {/* Header */}
      <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
        <Text bold color={theme.colors.primary}>
          {theme.symbols.info} Daemon Logs
        </Text>
      </Box>

      {/* Logs */}
      <Box
        flexDirection="column"
        paddingX={1}
        paddingY={1}
        flexGrow={1}
        overflow="hidden"
      >
        {logs.length === 0 ? (
          <Text color={theme.colors.textMuted}>No logs yet...</Text>
        ) : (
          logs.map((log, index) => (
            <Box key={index}>
              <Text color={theme.colors.textDim}>
                [{formatTime(log.timestamp)}]
              </Text>
              <Text> </Text>
              <Text color={getLogColor(log.level)}>
                {getLogSymbol(log.level)} {log.level.toUpperCase()}:
              </Text>
              <Text> </Text>
              <Text>{log.message}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
