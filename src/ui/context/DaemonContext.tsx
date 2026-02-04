import React, { createContext, useContext, ReactNode } from 'react';
import { useDaemon } from '../hooks/useDaemon.js';

type DaemonContextType = ReturnType<typeof useDaemon>;

const DaemonContext = createContext<DaemonContextType | null>(null);

export const DaemonProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const daemon = useDaemon();
  return (
    <DaemonContext.Provider value={daemon}>{children}</DaemonContext.Provider>
  );
};

export const useDaemonContext = (): DaemonContextType => {
  const context = useContext(DaemonContext);
  if (!context) {
    throw new Error('useDaemonContext must be used within DaemonProvider');
  }
  return context;
};
