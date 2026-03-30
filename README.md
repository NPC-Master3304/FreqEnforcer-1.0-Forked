# FreqEnforcer v2.0.0

<img width="2882" height="1863" alt="image" src="https://github.com/user-attachments/assets/27cff08b-bf79-4f26-a7e6-c827944c6cbb" />

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
