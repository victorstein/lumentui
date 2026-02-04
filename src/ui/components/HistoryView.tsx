import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme.js';
import {
  useNotificationHistory,
  NotificationHistoryFilters,
  FormattedNotification,
} from '../hooks/useNotificationHistory.js';

type DateFilterMode = '7days' | '30days' | 'all';
type StatusFilterMode = 'all' | 'sent' | 'failed';
type SortColumn = 'timestamp' | 'name' | 'status';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 50;

export const HistoryView: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [productIdFilter, setProductIdFilter] = useState<string | undefined>(
    undefined,
  );
  const [sortColumn, setSortColumn] = useState<SortColumn>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  const {
    history: rawHistory,
    loading,
    error,
  } = useNotificationHistory(filters);

  const sortedHistory = useMemo(() => {
    const sorted = [...rawHistory];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'name': {
          const aName = (
            a.productTitle || `Product ${a.productId}`
          ).toLowerCase();
          const bName = (
            b.productTitle || `Product ${b.productId}`
          ).toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        }
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [rawHistory, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / PAGE_SIZE));
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return sortedHistory.slice(startIndex, endIndex);
  }, [sortedHistory, currentPage]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  useInput((input, key) => {
    if (input === 'd') {
      setDateFilter((prev) => {
        if (prev === 'all') return '7days';
        if (prev === '7days') return '30days';
        return 'all';
      });
      setCurrentPage(1);
    } else if (input === 's') {
      setStatusFilter((prev) => {
        if (prev === 'all') return 'sent';
        if (prev === 'sent') return 'failed';
        return 'all';
      });
      setCurrentPage(1);
    } else if (input === 'c') {
      setDateFilter('all');
      setStatusFilter('all');
      setProductIdFilter(undefined);
      setCurrentPage(1);
    } else if (input === 't') {
      toggleSort('timestamp');
    } else if (input === 'n') {
      toggleSort('name');
    } else if (input === 'x') {
      toggleSort('status');
    } else if (key.rightArrow && currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    } else if (key.leftArrow && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    } else if (key.pageDown && currentPage < totalPages) {
      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    } else if (key.pageUp && currentPage > 1) {
      setCurrentPage((prev) => Math.max(prev - 1, 1));
    } else if (input === 'h') {
      setCurrentPage(1);
    } else if (input === 'e') {
      setCurrentPage(totalPages);
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

  if (sortedHistory.length === 0) {
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

  const getSortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

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
          <Text
            bold
            color={
              sortColumn === 'timestamp'
                ? theme.colors.primary
                : theme.colors.textDim
            }
          >
            TIMESTAMP{getSortIndicator('timestamp')}
          </Text>
        </Box>
        <Box width="40%">
          <Text
            bold
            color={
              sortColumn === 'name'
                ? theme.colors.primary
                : theme.colors.textDim
            }
          >
            PRODUCT{getSortIndicator('name')}
          </Text>
        </Box>
        <Box width="15%">
          <Text
            bold
            color={
              sortColumn === 'status'
                ? theme.colors.primary
                : theme.colors.textDim
            }
          >
            STATUS{getSortIndicator('status')}
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
        {paginatedHistory.map((notification) => (
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
            {sortedHistory.length} notification
            {sortedHistory.length === 1 ? '' : 's'}
            {totalPages > 1 && (
              <Text color={theme.colors.primary}>
                {' '}
                • Page {currentPage} of {totalPages}
              </Text>
            )}
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text dimColor>
            Filters: <Text color={theme.colors.accent}>d</Text>=date{' '}
            <Text color={theme.colors.accent}>s</Text>=status{' '}
            <Text color={theme.colors.accent}>c</Text>=clear | Sort:{' '}
            <Text color={theme.colors.accent}>t</Text>=timestamp{' '}
            <Text color={theme.colors.accent}>n</Text>=name{' '}
            <Text color={theme.colors.accent}>x</Text>=status
          </Text>
        </Box>
        {totalPages > 1 && (
          <Box marginTop={0}>
            <Text dimColor>
              Pages: <Text color={theme.colors.accent}>←/→</Text> or{' '}
              <Text color={theme.colors.accent}>PgUp/PgDn</Text>=navigate{' '}
              <Text color={theme.colors.accent}>h</Text>=first{' '}
              <Text color={theme.colors.accent}>e</Text>=last
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
