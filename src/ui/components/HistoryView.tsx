import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';
import {
  useNotificationHistory,
  NotificationHistoryFilters,
} from '../hooks/useNotificationHistory.js';

type DateFilterMode = '7days' | '30days' | 'all';
type StatusFilterMode = 'all' | 'sent' | 'failed';

export const HistoryView: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [productIdFilter, setProductIdFilter] = useState<string | undefined>(
    undefined,
  );

  const filters = useMemo<NotificationHistoryFilters>(() => {
    const result: NotificationHistoryFilters = {};

    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result.dateFrom = sevenDaysAgo.toISOString();
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result.dateFrom = thirtyDaysAgo.toISOString();
    }

    if (statusFilter !== 'all') {
      result.status = statusFilter;
    }

    if (productIdFilter) {
      result.productId = productIdFilter;
    }

    return result;
  }, [dateFilter, statusFilter, productIdFilter]);

  const { history, loading, error } = useNotificationHistory(filters);

  useInput((input) => {
    if (input === 'd') {
      setDateFilter((prev) => {
        if (prev === 'all') return '7days';
        if (prev === '7days') return '30days';
        return 'all';
      });
    } else if (input === 's') {
      setStatusFilter((prev) => {
        if (prev === 'all') return 'sent';
        if (prev === 'sent') return 'failed';
        return 'all';
      });
    } else if (input === 'c') {
      setDateFilter('all');
      setStatusFilter('all');
      setProductIdFilter(undefined);
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
      >
        <Box>
          <Text color={theme.colors.primary}>
            <Spinner type="dots" />
          </Text>
          <Text color={theme.colors.primary}>
            {' '}
            Loading notification history…
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
      >
        <Box>
          <Text color={theme.colors.error}>
            {theme.symbols.cross} Error: {error}
          </Text>
        </Box>
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
      >
        <Box>
          <Text color={theme.colors.textMuted}>
            {theme.symbols.info} No notifications in history
          </Text>
        </Box>
      </Box>
    );
  }

  const hasActiveFilters =
    dateFilter !== 'all' || statusFilter !== 'all' || productIdFilter;

  const dateFilterLabel = {
    all: 'All time',
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
  }[dateFilter];

  const statusFilterLabel = {
    all: 'All statuses',
    sent: 'Sent only',
    failed: 'Failed only',
  }[statusFilter];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.border}
      flexGrow={1}
    >
      {/* Active filters indicator */}
      {hasActiveFilters && (
        <>
          <Box paddingX={1} paddingTop={0} paddingBottom={0}>
            <Text color={theme.colors.accent} bold>
              {theme.symbols.info} Active Filters:{' '}
            </Text>
            {dateFilter !== 'all' && (
              <Text color={theme.colors.primary}>[{dateFilterLabel}] </Text>
            )}
            {statusFilter !== 'all' && (
              <Text color={theme.colors.primary}>[{statusFilterLabel}] </Text>
            )}
            {productIdFilter && (
              <Text color={theme.colors.primary}>
                [Product: {productIdFilter}]{' '}
              </Text>
            )}
          </Box>
          <Box paddingX={1}>
            <Text color={theme.colors.border}>{'─'.repeat(76)}</Text>
          </Box>
        </>
      )}

      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Box width="15%">
          <Text bold color={theme.colors.textDim}>
            TIMESTAMP
          </Text>
        </Box>
        <Box width="40%">
          <Text bold color={theme.colors.textDim}>
            PRODUCT
          </Text>
        </Box>
        <Box width="15%">
          <Text bold color={theme.colors.textDim}>
            STATUS
          </Text>
        </Box>
        <Box width="30%">
          <Text bold color={theme.colors.textDim}>
            DETAILS
          </Text>
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.colors.border}>{'─'.repeat(76)}</Text>
      </Box>

      {/* Notification rows */}
      <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
        {history.map((notification) => (
          <Box key={notification.id} paddingY={0}>
            <Box width="15%">
              <Text color={theme.colors.textDim}>
                {notification.formattedTimestamp}
              </Text>
            </Box>

            <Box width="40%">
              <Text color={theme.colors.text} wrap="truncate">
                {notification.productTitle ||
                  `Product ${notification.productId}`}
              </Text>
            </Box>

            <Box width="15%">
              {notification.status === 'sent' ? (
                <Text color={theme.colors.success}>
                  {theme.symbols.check} sent
                </Text>
              ) : (
                <Text color={theme.colors.error}>
                  {theme.symbols.cross} failed
                </Text>
              )}
            </Box>

            <Box width="30%">
              <Text color={theme.colors.textDim} wrap="truncate">
                {notification.availabilityChange ||
                  notification.errorMessage ||
                  '—'}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box paddingX={1}>
        <Text color={theme.colors.border}>{'─'.repeat(76)}</Text>
      </Box>
      <Box paddingX={1} paddingBottom={0} flexDirection="column">
        <Box marginBottom={0}>
          <Text dimColor>
            {history.length} notification{history.length === 1 ? '' : 's'}
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text dimColor>
            Filters: <Text color={theme.colors.accent}>d</Text>=date{' '}
            <Text color={theme.colors.accent}>s</Text>=status{' '}
            <Text color={theme.colors.accent}>c</Text>=clear
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
