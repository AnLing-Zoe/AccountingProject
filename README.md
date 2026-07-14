# MoneyWise - Personal Finance Tracker

Account management project developed with React + TypeScript + Vite.

## Features

- **Tech Stack**: React 19, TypeScript, Vite
- **Deployment**: Automatic deployment to GitHub Pages via GitHub Actions

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:

```bash
npm run dev
```

Cloud sync is optional. Copy `.env.example` to `.env` and set your Apps Script web app URL:

```env
VITE_GOOGLE_APP_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

`.env` is local-only and must not be committed. Values prefixed with `VITE_` are embedded in the browser bundle, so never use them for secrets. Without this setting, the app stores data only in the browser's `localStorage`.

## Deployment

The project is configured to automatically deploy to GitHub Pages when pushing to the `main` branch.

### Manual Build

To build the project locally:

```bash
npm run build
```

The output will be in the `dist` folder.

## Project Structure

- `src/`: Source code
- `.github/workflows/`: GitHub Actions configurations
- `dist/`: Build output (not versioned)
