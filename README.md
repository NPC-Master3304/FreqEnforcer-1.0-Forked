# FreqEnforcer — Electron Edition

## Development

### Prerequisites
- Node.js 18+
- Python 3.10+

### Setup

```bash
npm install
pip install -r requirements.txt
```

### Run

```bash
npm run dev
```

This starts the FastAPI backend (port 8765), Vite dev server (port 5173), and Electron concurrently.

### Individual services

```bash
npm run dev:server    # FastAPI only
npm run dev:vite      # Vite only
npm run dev:electron  # Electron only
```
