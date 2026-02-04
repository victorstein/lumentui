import React, { useState } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { DaemonProvider, useDaemonContext } from './context/DaemonContext.js';
import { useProducts } from './hooks/useProducts.js';
import { Header } from './components/Header.js';
import { ProductList } from './components/ProductList.js';
import { ProductDetail } from './components/ProductDetail.js';
import { LogPanel } from './components/LogPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { NotificationBanner } from './components/NotificationBanner.js';
import { HistoryView } from './components/HistoryView.js';
import { theme } from './theme.js';

type AppView = 'main' | 'history';

const AppContent: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;

  const [appView, setAppView] = useState<AppView>('main');

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
  } = useDaemonContext();

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
    // Handle escape key based on current view
    if (key.escape) {
      if (appView === 'history') {
        setAppView('main');
      } else if (viewMode === 'detail') {
        switchView('list');
      } else {
        exit();
      }
      return;
    }

    // Handle 'b' key to go back from history view
    if (input === 'b' && appView === 'history') {
      setAppView('main');
      return;
    }

    // Quit application
    if (input === 'q') {
      exit();
      return;
    }

    // Open history view (only from main view)
    if (input === 'h' && appView === 'main') {
      setAppView('history');
      return;
    }

    // Only handle main view navigation when in main view
    if (appView === 'main') {
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
          {/* Render different views based on appView state */}
          {appView === 'history' ? (
            <HistoryView />
          ) : (
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
                    flexDirection="column"
                    flexGrow={1}
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
                appView={appView}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <DaemonProvider>
      <AppContent />
    </DaemonProvider>
  );
};

export default App;
