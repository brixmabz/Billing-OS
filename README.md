# Billing Request OS - Frontend

React + TypeScript frontend for the Billing Request OS application.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |
| `VITE_DEV_MODE` | Enable dev features | `false` |
| `VITE_APP_NAME` | Browser tab title | `Billing Request OS` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── api/          # API client and endpoints
├── components/   # Reusable UI components
├── hooks/        # Custom React hooks
├── pages/        # Route pages
│   ├── admin/    # Admin dashboard pages
│   └── collector/# Collector portal pages
└── types/        # TypeScript types
```

## Deployment (Vercel)

1. Push code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com/new)
3. Set root directory to `frontend`
4. Configure environment variables:
   - `VITE_API_URL` = Your backend URL (e.g., `https://billing-os-api.onrender.com/api/v1`)
   - `VITE_DEV_MODE` = `false`
   - `VITE_APP_NAME` = `Billing Request OS`
5. Deploy
