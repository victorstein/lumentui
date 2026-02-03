import React from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { useDaemon } from './hooks/useDaemon.js';
import { useProducts } from './hooks/useProducts.js';
import { Header } from './components/Header.js';
import { ProductList } from './components/ProductList.js';
import { ProductDetail } from './components/ProductDetail.js';
import { LogPanel } from './components/LogPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { NotificationBanner } from './components/NotificationBanner.js';
import { theme } from './theme.js';

/**
 * Main TUI Application Component
 */
const App: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;

  // Connect to daemon via IPC
  const {
    connected,
    lastHeartbeat,
    products,
    logs,
    error,
    polling,
    newProductNotification,
    forcePoll,
    clearError,
  } = useDaemon();

  // Product selection and filtering
  const {
    selectedIndex,
    selectedProduct,
    viewMode,
    filteredProducts,
    stats,
    selectNext,
    selectPrevious,
    toggleView,
    switchView,
  } = useProducts(products);

  // Keyboard input handling
  useInput((input, key) => {
    // Escape: back to list from detail, or quit from list
    if (key.escape) {
      if (viewMode === 'detail') {
        switchView('list');
      } else {
        exit();
      }
      return;
    }

    // Quit application
    if (input === 'q') {
      exit();
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      selectPrevious();
    } else if (key.downArrow || input === 'j') {
      selectNext();
    }

    // Toggle view
    if (key.return || input === ' ') {
      if (viewMode === 'list' && selectedProduct) {
        switchView('detail');
      } else if (viewMode === 'detail') {
        switchView('list');
      }
    }

    // Force poll
    if (input === 'f') {
      forcePoll();
    }

    // Clear error
    if (input === 'c' && error) {
      clearError();
    }
  });

  return (
    <Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
      {/* Header with logo and status */}
      <Header connected={connected} lastHeartbeat={lastHeartbeat} />

      {/* New product notification banner */}
      {newProductNotification && (
        <NotificationBanner product={newProductNotification} />
      )}

      {/* Error banner */}
      {error && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.colors.error}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={theme.colors.error} bold>
            {theme.symbols.cross} Error: {error}
          </Text>
          <Text dimColor>Press 'c' to clear</Text>
        </Box>
      )}

      {/* Disconnected — show reconnecting screen instead of dashboard */}
      {!connected && (
        <Box
          flexDirection="column"
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
        >
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={theme.colors.warning}
            paddingX={3}
            paddingY={1}
          >
            <Text color={theme.colors.warning} bold>
              {theme.symbols.warning} Daemon not connected
            </Text>
            <Box marginTop={1}>
              <Text dimColor>Attempting to reconnect...</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                If the daemon was stopped, run{' '}
                <Text color={theme.colors.accent} bold>
                  lumentui start
                </Text>
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                Press{' '}
                <Text color={theme.colors.accent} bold>
                  q
                </Text>{' '}
                to quit
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {connected && (
        <>
          {/* Main content area */}
          <Box
            flexDirection={terminalWidth >= 100 ? 'row' : 'column'}
            flexGrow={1}
          >
            {/* Product list or detail */}
            <Box flexGrow={1} marginRight={terminalWidth >= 100 ? 1 : 0}>
              {viewMode === 'list' || !selectedProduct ? (
                <ProductList
                  products={filteredProducts}
                  selectedIndex={selectedIndex}
                  totalProducts={stats.total}
                  availableProducts={stats.available}
                />
              ) : (
                <ProductDetail product={selectedProduct} />
              )}
            </Box>

            {/* Log panel — side column on wide, bottom section on narrow, hidden on tiny */}
            {terminalWidth >= 60 && (
              <Box
                width={terminalWidth >= 100 ? '40%' : '100%'}
                height={terminalWidth >= 100 ? undefined : 8}
                flexDirection="column"
                flexGrow={terminalWidth >= 100 ? 1 : 0}
                flexShrink={0}
              >
                <LogPanel logs={logs} />
              </Box>
            )}
          </Box>

          {/* Bottom status bar */}
          <StatusBar
            lastHeartbeat={lastHeartbeat}
            productCount={stats.total}
            availableCount={stats.available}
            viewMode={viewMode}
            polling={polling}
          />
        </>
      )}
    </Box>
  );
};

export default App;
