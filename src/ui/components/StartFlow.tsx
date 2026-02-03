import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';

interface StartFlowProps {
  daemonOnly: boolean;
  validateConfig: () => { valid: boolean; errors: string[] };
  getDaemonStatus: () => { isRunning: boolean; pid?: number };
  ensureDataDir: () => void;
  getDaemonPath: () => { valid: boolean; path: string; error?: string };
  spawnDaemon: (daemonPath: string) => { pid: number };
  waitForDaemon: () => Promise<boolean>;
  launchTui: () => Promise<void>;
}

type Step =
  | 'validating'
  | 'checking'
  | 'starting'
  | 'connecting'
  | 'ready'
  | 'error';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface StepState {
  step: Step;
  spinnerFrame: number;
  daemonPid?: number;
  errorMessage?: string;
  completedSteps: Array<{ label: string; result: string }>;
}

export const StartFlow: React.FC<StartFlowProps> = ({
  daemonOnly,
  validateConfig,
  getDaemonStatus,
  ensureDataDir,
  getDaemonPath,
  spawnDaemon,
  waitForDaemon,
  launchTui,
}) => {
  const { exit } = useApp();
  const [state, setState] = useState<StepState>({
    step: 'validating',
    spinnerFrame: 0,
    completedSteps: [],
  });

  // Spinner animation
  useEffect(() => {
    if (state.step === 'error' || state.step === 'ready') return;

    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        spinnerFrame: (prev.spinnerFrame + 1) % SPINNER_FRAMES.length,
      }));
    }, 80);

    return () => clearInterval(interval);
  }, [state.step]);

  // Main flow orchestration
  useEffect(() => {
    const runFlow = async () => {
      try {
        // Step 1: Validate config
        if (state.step === 'validating') {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const { valid, errors } = validateConfig();
          if (!valid) {
            setState({
              ...state,
              step: 'error',
              errorMessage: `Configuration invalid: ${errors.join(', ')}`,
            });
            return;
          }
          setState({
            step: 'checking',
            spinnerFrame: 0,
            completedSteps: [{ label: 'Validate config', result: 'OK' }],
          });
          return;
        }

        // Step 2: Check daemon status
        if (state.step === 'checking') {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const status = getDaemonStatus();
          if (status.isRunning) {
            setState({
              step: 'ready',
              spinnerFrame: 0,
              daemonPid: status.pid,
              completedSteps: [
                { label: 'Validate config', result: 'OK' },
                {
                  label: 'Check daemon',
                  result: `Already running (PID ${status.pid})`,
                },
              ],
            });
            return;
          }
          setState((prev) => ({
            ...prev,
            step: 'starting',
            completedSteps: [
              ...prev.completedSteps,
              { label: 'Check daemon', result: 'Not running' },
            ],
          }));
          return;
        }

        // Step 3: Start daemon
        if (state.step === 'starting') {
          await new Promise((resolve) => setTimeout(resolve, 300));
          ensureDataDir();
          const daemonPathResult = getDaemonPath();
          if (!daemonPathResult.valid) {
            setState({
              ...state,
              step: 'error',
              errorMessage:
                daemonPathResult.error || 'Daemon executable not found',
            });
            return;
          }
          const { pid } = spawnDaemon(daemonPathResult.path);
          setState((prev) => ({
            ...prev,
            step: 'connecting',
            daemonPid: pid,
            completedSteps: [
              ...prev.completedSteps,
              { label: 'Start daemon', result: `Spawned (PID ${pid})` },
            ],
          }));
          return;
        }

        // Step 4: Connect to daemon
        if (state.step === 'connecting') {
          const connected = await waitForDaemon();
          if (!connected) {
            setState((prev) => ({
              ...prev,
              step: 'error',
              errorMessage: 'Failed to connect to daemon (timeout)',
            }));
            return;
          }
          setState((prev) => ({
            ...prev,
            step: 'ready',
            completedSteps: [
              ...prev.completedSteps,
              { label: 'Connect to daemon', result: 'Connected' },
            ],
          }));
          return;
        }

        // Step 5: Ready - launch TUI or exit
        if (state.step === 'ready') {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (!daemonOnly) {
            await launchTui();
          } else {
            setTimeout(() => exit(), 1000);
          }
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        }));
      }
    };

    runFlow();
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Exit on error or success
  useEffect(() => {
    if (state.step === 'error') {
      setTimeout(() => exit(), 2000);
    }
  }, [state.step, exit]);

  const getCurrentStepDisplay = () => {
    const spinner = SPINNER_FRAMES[state.spinnerFrame];
    switch (state.step) {
      case 'validating':
        return { label: 'Validate config', spinner };
      case 'checking':
        return { label: 'Check daemon', spinner };
      case 'starting':
        return { label: 'Start daemon', spinner };
      case 'connecting':
        return { label: 'Connect to daemon', spinner };
      case 'ready':
        return null;
      case 'error':
        return null;
      default:
        return null;
    }
  };

  const currentStep = getCurrentStepDisplay();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Logo */}
      <Logo />

      {/* Card with steps */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        paddingX={2}
        paddingY={1}
        marginTop={1}
        width={60}
      >
        {/* Completed steps */}
        {state.completedSteps.map((step, idx) => (
          <Box
            key={idx}
            marginBottom={idx === state.completedSteps.length - 1 ? 0 : 0}
          >
            <Text color={theme.colors.success}>{theme.symbols.check} </Text>
            <Text color={theme.colors.text}>{step.label}: </Text>
            <Text color={theme.colors.textDim}>{step.result}</Text>
          </Box>
        ))}

        {/* Current step */}
        {currentStep && (
          <Box>
            <Text color={theme.colors.info}>{currentStep.spinner} </Text>
            <Text color={theme.colors.text}>{currentStep.label}...</Text>
          </Box>
        )}

        {/* Error state */}
        {state.step === 'error' && (
          <Box marginTop={1}>
            <Text color={theme.colors.error}>
              {theme.symbols.cross} Error: {state.errorMessage}
            </Text>
          </Box>
        )}

        {/* Ready state */}
        {state.step === 'ready' && (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text color={theme.colors.success}>
                {theme.symbols.check} Daemon ready
              </Text>
              {state.daemonPid && (
                <Text color={theme.colors.textDim}>
                  {' '}
                  (PID {state.daemonPid})
                </Text>
              )}
            </Box>
            {daemonOnly ? (
              <Box marginTop={1}>
                <Text color={theme.colors.info}>{theme.symbols.info} Run </Text>
                <Text color={theme.colors.primary} bold>
                  lumentui
                </Text>
                <Text color={theme.colors.info}> to launch the TUI</Text>
              </Box>
            ) : (
              <Box marginTop={1}>
                <Text color={theme.colors.info}>
                  {theme.symbols.arrow} Launching TUI...
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
