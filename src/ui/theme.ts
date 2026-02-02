/**
 * TUI Theme - Color scheme and styles for Ink components
 */

export const theme = {
  colors: {
    // Brand colors
    primary: '#00d4ff', // Cyan
    secondary: '#ff006e', // Hot pink
    accent: '#8338ec', // Purple

    // Status colors
    success: '#06ffa5', // Green
    warning: '#ffbe0b', // Yellow
    error: '#ff006e', // Red
    info: '#00d4ff', // Cyan

    // UI colors
    text: '#ffffff', // White
    textDim: '#888888', // Gray
    textMuted: '#555555', // Dark gray
    border: '#444444', // Border gray
    background: '#000000', // Black
    backgroundAlt: '#111111', // Dark background

    // Product status
    available: '#06ffa5', // Green
    unavailable: '#888888', // Gray
    soldOut: '#ff006e', // Red
  },

  // ASCII Art Logo
  logo: `
╦  ╦ ╦╔╦╗╔═╗╔╗╔╔╦╗╦ ╦╦
║  ║ ║║║║║╣ ║║║ ║ ║ ║║
╩═╝╚═╝╩ ╩╚═╝╝╚╝ ╩ ╚═╝╩
`,

  // Symbols
  symbols: {
    bullet: '●',
    arrow: '→',
    check: '✓',
    cross: '✗',
    warning: '⚠',
    info: 'ℹ',
    heart: '♥',
    star: '★',
    circle: '◯',
    dot: '•',
  },

  // Borders
  borders: {
    single: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    },
    double: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
    },
  },
};

export type Theme = typeof theme;
