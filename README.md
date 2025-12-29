# Billing Request OS - Backend

FastAPI backend for the Billing Request OS application.

## Tech Stack

- Python 3.11+
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL / Supabase
- Slack SDK
- Resend (email)

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL or Supabase account

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env_default .env

# Edit .env with your configuration
```

### Configuration

Copy `.env_default` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_PROVIDER` | `postgres` or `supabase` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SUPABASE_URL` | Supabase project URL | If using Supabase |
| `SUPABASE_KEY` | Supabase anon key | If using Supabase |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | If using Supabase |
| `SECRET_KEY` | JWT signing key | Yes |
| `SLACK_BOT_TOKEN` | Slack bot OAuth token | For Slack integration |
| `RESEND_API_KEY` | Resend API key | For email sending |

### Running the Server

```bash
# Development
uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API docs: `http://localhost:8000/docs`

## Project Structure

```
app/
├── api/          # API route handlers
├── core/         # Config, security, dependencies
├── models/       # SQLAlchemy models
├── schemas/      # Pydantic schemas
├── services/     # Business logic (Slack, email, etc.)
└── main.py       # FastAPI app entry point
```

## Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Deployment (Render)

1. Push code to GitHub
2. Create new Web Service in [Render Dashboard](https://dashboard.render.com/new/web)
3. Connect your GitHub repo
4. Set root directory to `backend`
5. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables:
   - `DATABASE_PROVIDER` = `supabase`
   - `DATABASE_URL` = Your Supabase connection string
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_KEY` = Your Supabase anon key
   - `SUPABASE_SERVICE_KEY` = Your Supabase service role key
   - `SECRET_KEY` = Generate a secure random string
   - `CORS_ORIGINS` = `["https://your-app.vercel.app"]`
   - `SLACK_ENABLED` = `false`
   - `EMAIL_ENABLED` = `false`
   - `DEBUG` = `false`
7. Deploy

**Note:** Free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds.
