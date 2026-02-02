import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useDaemon } from './hooks/useDaemon';
import { useProducts } from './hooks/useProducts';
import { Header } from './components/Header';
import { ProductList } from './components/ProductList';
import { ProductDetail } from './components/ProductDetail';
import { LogPanel } from './components/LogPanel';
import { StatusBar } from './components/StatusBar';
import { NotificationBanner } from './components/NotificationBanner';
import { theme } from './theme';

/**
 * Main TUI Application Component
 */
const App: React.FC = () => {
  const { exit } = useApp();

  // Connect to daemon via IPC
  const {
    connected,
    lastHeartbeat,
    products,
    logs,
    error,
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
      if (viewMode === 'list') {
        switchView('detail');
      } else {
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
    <Box flexDirection="column" padding={1}>
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

      {/* Main content area */}
      <Box flexDirection="row" marginBottom={1}>
        {/* Left column: Product list or detail */}
        <Box flexGrow={1} marginRight={1}>
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

        {/* Right column: Log panel */}
        <Box width="40%">
          <LogPanel logs={logs} />
        </Box>
      </Box>

      {/* Bottom status bar */}
      <StatusBar
        lastHeartbeat={lastHeartbeat}
        productCount={stats.total}
        availableCount={stats.available}
        viewMode={viewMode}
      />
    </Box>
  );
};

export default App;
