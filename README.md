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
