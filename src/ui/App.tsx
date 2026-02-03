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
    // Quit application
    if (input === 'q' || key.escape) {
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

    // Back to list from detail
    if (key.escape && viewMode === 'detail') {
      switchView('list');
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

      {/* Connection warning */}
      {!connected && !error && (
        <Box
          borderStyle="single"
          borderColor={theme.colors.warning}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={theme.colors.warning}>
            {theme.symbols.warning} Waiting for daemon connection...
          </Text>
        </Box>
      )}

      {/* Main content area — stacks vertically on narrow terminals */}
      <Box flexDirection={terminalWidth >= 100 ? 'row' : 'column'} flexGrow={1}>
        {/* Product list or detail */}
        <Box flexGrow={1} marginRight={terminalWidth >= 100 ? 1 : 0}>
          {viewMode === 'list' ? (
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
    </Box>
  );
};

export default App;
