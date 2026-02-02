---
name: ink
description: Ink TUI specialist for terminal UI components and React hooks
model: sonnet
tools: Read, Edit, Write, Bash, Glob, Grep, TodoWrite, Skill
---

# Ink Agent

Ink TUI specialist for building terminal user interfaces with React.

## Tech Stack

| Component     | Technology |
| ------------- | ---------- |
| TUI Framework | Ink 5      |
| React         | React 18   |
| IPC Client    | node-ipc   |

## Project Structure

```
src/ui/
├── App.tsx                         # Root component, keyboard handler, layout
├── theme.ts                        # Colors, symbols, borders (Theme type)
├── components/
│   ├── Header.tsx                  # Logo, connection status, heartbeat
│   ├── ProductList.tsx             # Table with selection, prices, availability
│   ├── ProductDetail.tsx           # Full product info, variants, tags, images
│   ├── LogPanel.tsx                # Real-time color-coded daemon logs
│   ├── StatusBar.tsx               # Stats, poll countdown, hotkey reference
│   └── NotificationBanner.tsx      # New product alert, auto-dismiss (5s)
└── hooks/
    ├── useDaemon.ts                # IPC client connection, state management
    ├── useDaemon.spec.ts           # Hook tests
    └── useProducts.ts              # Filtering, selection, navigation, stats
```

## Patterns Used

- **Hooks:** `useDaemon()` manages IPC connection + events, `useProducts()` manages product state
- **Keyboard:** `useInput()` from Ink for vi-style navigation (j/k, Enter, f, q)
- **Theme:** Centralized in `theme.ts`, imported by components as `import { theme } from '../theme.js'`
- **IPC events listened:** `daemon:heartbeat`, `products:updated`, `product:new`, `daemon:error`, `log`
- **Layout:** `<Box>` with flexDirection, `<Text>` with color/bold/dim from Ink
- **Date formatting:** Uses `toLocaleString()` — no external date library

## Quick Commands

```bash
npm run build        # Build (includes TUI)
npm test             # Run tests (includes useDaemon.spec.ts)
```

## Task Completion

After completing any task:

```bash
bd sync  # Sync beads changes to git
```
