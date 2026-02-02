# LumenTUI - Terminal User Interface

Interactive TUI built with Ink (React for terminal).

## Structure

```
src/ui/
├── App.tsx                 # Main TUI application component
├── theme.ts                # Color scheme and styling
├── components/             # UI components
│   ├── Header.tsx         # Logo + connection status
│   ├── ProductList.tsx    # Product table view
│   ├── ProductDetail.tsx  # Detailed product view
│   ├── LogPanel.tsx       # Daemon log display
│   ├── StatusBar.tsx      # Bottom status + hotkeys
│   └── NotificationBanner.tsx  # New product notifications
└── hooks/                  # Custom React hooks
    ├── useDaemon.ts       # IPC client connection to daemon
    └── useProducts.ts     # Product state management
```

## Features

### IPC Connection (useDaemon hook)

- Connects to daemon via Unix socket (`/tmp/lumentui.sock`)
- Listens to events:
  - `daemon:heartbeat` - Periodic daemon health check
  - `products:updated` - Product list refresh
  - `product:new` - New product detected
  - `daemon:error` - Daemon errors
  - `log` - Real-time log streaming
- Emits events:
  - `force-poll` - Trigger immediate poll

### Navigation

- `↑` / `k` - Navigate up
- `↓` / `j` - Navigate down
- `Enter` / `Space` - Toggle between list and detail view
- `f` - Force poll (request immediate fetch)
- `q` / `Esc` - Quit TUI
- `c` - Clear error banner

### Views

#### List View

- Table showing all products
- Columns: Name, Price, Availability
- Stats: Total products, Available count
- Selection indicator

#### Detail View

- Full product information
- Vendor, type, handle
- All variants with prices and inventory
- Tags
- Images (URLs)
- Timestamps (created, updated, published)

### Components

#### Header

- ASCII art logo
- Connection status
- Daemon health indicator
- Last poll timestamp

#### ProductList

- Scrollable product table
- Selection highlighting
- Availability indicators
- Footer with stats

#### ProductDetail

- Comprehensive product information
- Formatted dates
- Variant details
- Image links

#### LogPanel

- Last 10 daemon logs
- Color-coded by level (error, warn, info, debug)
- Timestamps
- Real-time updates

#### StatusBar

- Next poll countdown
- Product statistics
- Current view mode
- Keyboard shortcuts reference

#### NotificationBanner

- Auto-appears on new product
- Shows product name, price, availability
- Auto-dismisses after 5 seconds

## Theme

Consistent color scheme:

- **Primary:** Cyan (`#00d4ff`)
- **Secondary:** Hot Pink (`#ff006e`)
- **Accent:** Purple (`#8338ec`)
- **Success:** Green (`#06ffa5`)
- **Warning:** Yellow (`#ffbe0b`)
- **Error:** Red (`#ff006e`)

ASCII symbols for visual indicators:

- `●` Bullet point
- `→` Arrow/selection
- `✓` Success/available
- `✗` Error/unavailable
- `⚠` Warning
- `ℹ` Info
- `★` Star/highlight

## Usage

Launch TUI with daemon:

```bash
lumentui start
```

Daemon-only mode:

```bash
lumentui start --daemon-only
```

## Dependencies

- **ink** ^5.0.1 - React renderer for terminal
- **react** ^18.3.1 - UI framework
- **node-ipc** ^10.1.0 - Unix socket communication

## Development

Build UI:

```bash
npm run build
```

Watch mode (NestJS daemon):

```bash
npm run start:dev
```

## Architecture

```
┌─────────────────────────┐
│   Ink TUI (React)       │
│   ┌─────────────────┐   │
│   │  useDaemon()    │   │ IPC Client
│   │  (IPC Client)   │◄──┼────────┐
│   └─────────────────┘   │        │
│   ┌─────────────────┐   │        │ Unix Socket
│   │  useProducts()  │   │        │ /tmp/lumentui.sock
│   │  (State)        │   │        │
│   └─────────────────┘   │        │
│                           │        │
│   Components:            │        │
│   - Header               │        │
│   - ProductList          │        │
│   - ProductDetail        │        │
│   - LogPanel             │        │
│   - StatusBar            │        │
│   - NotificationBanner   │        │
└─────────────────────────┘        │
                                    │
┌───────────────────────────────────┼────┐
│   NestJS Daemon                   │    │
│   ┌─────────────────┐            │    │
│   │  IpcGateway     │◄───────────┘    │
│   │  (IPC Server)   │                 │
│   └─────────────────┘                 │
│                                       │
│   Emits:                              │
│   - daemon:heartbeat                  │
│   - products:updated                  │
│   - product:new                       │
│   - daemon:error                      │
│   - log                               │
│                                       │
│   Listens:                            │
│   - force-poll                        │
└───────────────────────────────────────┘
```

## Notes

- TUI requires the daemon to be running
- Connection retries automatically if daemon restarts
- Logs are kept in memory (last 10)
- Product selection persists when switching views
- New product notifications auto-clear after 5s
