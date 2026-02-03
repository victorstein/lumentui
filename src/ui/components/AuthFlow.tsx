import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';

type AuthState =
  | 'checking'
  | 'found'
  | 'waiting'
  | 'success'
  | 'timeout'
  | 'error';

interface AuthFlowProps {
  extractCookies: () => Promise<any[]>;
  saveCookies: (cookies: any[]) => Promise<void>;
  testSession: () => Promise<boolean>;
  openBrowser: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 60000;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const AuthFlow: React.FC<AuthFlowProps> = ({
  extractCookies,
  saveCookies,
  testSession,
  openBrowser,
}) => {
  const { exit } = useApp();
  const [state, setState] = useState<AuthState>('checking');
  const [remaining, setRemaining] = useState(60);
  const [frame, setFrame] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [cookieCount, setCookieCount] = useState(0);
  const [cookieInvalid, setCookieInvalid] = useState(false);

  // Spinner animation
  useEffect(() => {
    if (state !== 'checking' && state !== 'waiting') return;
    const timer = setInterval(() => setFrame((f) => f + 1), 80);
    return () => clearInterval(timer);
  }, [state]);

  // Main auth flow
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // First attempt: check existing cookies and validate with a real request
      let hasExistingCookie = false;
      try {
        const cookies = await extractCookies();
        if (cancelled) return;
        await saveCookies(cookies);
        setCookieCount(cookies.length);
        hasExistingCookie = true;
        setState('found');

        // Test if the cookie actually works for authenticated requests
        const isValid = await testSession();
        if (cancelled) return;

        if (isValid) {
          setState('success');
          setTimeout(() => process.exit(0), 1500);
          return;
        }
        // Cookie exists but doesn't work — need login
        setCookieInvalid(true);
      } catch {
        // Cookie not found at all — need login
      }

      if (cancelled) return;
      setState('waiting');
      openBrowser();

      // Poll loop — wait for cookie value to change after login
      const startTime = Date.now();
      let lastCookieValue = '';
      try {
        const existing = await extractCookies();
        lastCookieValue = existing.map((c: any) => c.value).join(';');
      } catch {
        // No cookie yet
      }

      while (Date.now() - startTime < MAX_WAIT_MS && !cancelled) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelled) return;

        setRemaining(
          Math.round((MAX_WAIT_MS - (Date.now() - startTime)) / 1000),
        );

        try {
          const cookies = await extractCookies();
          if (cancelled) return;
          const currentValue = cookies.map((c: any) => c.value).join(';');

          // Only test if the cookie value changed (user logged in)
          if (currentValue !== lastCookieValue) {
            lastCookieValue = currentValue;
            await saveCookies(cookies);
            setCookieCount(cookies.length);

            const isValid = await testSession();
            if (cancelled) return;

            if (isValid) {
              setState('success');
              setTimeout(() => process.exit(0), 1500);
              return;
            }
          }
        } catch {
          // Keep polling
        }
      }

      if (!cancelled) {
        setState('timeout');
        setTimeout(() => process.exit(1), 2000);
      }
    }

    run().catch((err) => {
      if (!cancelled) {
        setErrorMsg(err.message || 'Unknown error');
        setState('error');
        setTimeout(() => process.exit(1), 2000);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const spinner = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Logo */}
      <Box marginBottom={1}>
        <Logo />
      </Box>

      {/* Auth card */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={
          state === 'success' || state === 'found'
            ? theme.colors.success
            : state === 'timeout' || state === 'error'
              ? theme.colors.error
              : theme.colors.primary
        }
        paddingX={2}
        paddingY={1}
      >
        <Box marginBottom={1}>
          <Text color={theme.colors.primary} bold>
            {theme.symbols.star} Authentication
          </Text>
        </Box>

        {/* Checking state */}
        {state === 'checking' && (
          <Box>
            <Text color={theme.colors.info}>
              {spinner} Checking for existing session...
            </Text>
          </Box>
        )}

        {/* Found existing cookies — testing them */}
        {state === 'found' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.info}>
                {spinner} Found session cookie, verifying...
              </Text>
            </Box>
          </Box>
        )}

        {/* Waiting for browser auth */}
        {state === 'waiting' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.info}>
                {spinner} Waiting for authentication...
              </Text>
            </Box>

            {cookieInvalid && (
              <Box marginTop={1}>
                <Text color={theme.colors.warning}>
                  {theme.symbols.warning} Cookie found but session is not
                  authenticated
                </Text>
              </Box>
            )}

            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                {theme.symbols.arrow} Browser opened to{' '}
                <Text color={theme.colors.accent}>shop.lumenalta.com</Text>
              </Text>
              <Text dimColor>
                {theme.symbols.arrow} Please log in to continue
              </Text>
            </Box>

            <Box marginTop={1}>
              <Text color={theme.colors.textDim}>
                Time remaining:{' '}
                <Text
                  color={
                    remaining <= 15 ? theme.colors.warning : theme.colors.info
                  }
                >
                  {remaining}s
                </Text>
              </Text>
            </Box>

            {/* Progress bar */}
            <Box marginTop={1}>
              {(() => {
                const width = 30;
                const progress = Math.max(0, Math.min(1, remaining / 60));
                const filled = Math.round(width * progress);
                const empty = width - filled;
                const barColor =
                  remaining <= 15 ? theme.colors.warning : theme.colors.primary;
                return (
                  <Text>
                    <Text color={theme.colors.textDim}>[</Text>
                    <Text color={barColor}>{'█'.repeat(filled)}</Text>
                    <Text color={theme.colors.textMuted}>
                      {'░'.repeat(empty)}
                    </Text>
                    <Text color={theme.colors.textDim}>]</Text>
                  </Text>
                );
              })()}
            </Box>
          </Box>
        )}

        {/* Success */}
        {state === 'success' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.success} bold>
                {theme.symbols.check} Authentication successful!
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                {cookieCount} cookie{cookieCount !== 1 ? 's' : ''} saved{' '}
                {theme.symbols.arrow} Run{' '}
                <Text color={theme.colors.accent} bold>
                  lumentui start
                </Text>
              </Text>
            </Box>
          </Box>
        )}

        {/* Timeout */}
        {state === 'timeout' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.error} bold>
                {theme.symbols.cross} Authentication timed out
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                Please log in to shop.lumenalta.com in Chrome and run{' '}
                <Text color={theme.colors.accent} bold>
                  lumentui auth
                </Text>{' '}
                again.
              </Text>
            </Box>
          </Box>
        )}

        {/* Error */}
        {state === 'error' && (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.colors.error} bold>
                {theme.symbols.cross} Authentication failed
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>{errorMsg}</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
