# PumpLedgerAI Rules

## Project

This is PumpLedgerAI, an AI-powered petrol pump automation system.

## Tech Stack

- FastAPI
- SQLAlchemy
- Pydantic v2
- SQLite (development)
- PostgreSQL (production)
- React
- TypeScript
- Tailwind CSS

## Code Quality

- Produce production-ready code.
- Keep functions small and modular.
- Add type hints everywhere.
- Reuse existing architecture.
- Do not duplicate code.
- Explain important changes.

## Backend

- Business logic belongs in services.
- Database access belongs in repositories.
- API routes should remain thin.
- Validate all inputs.

## Frontend

- Use functional React components.
- Use TypeScript properly.
- Keep components reusable.

## Vision/OCR

- Never guess extracted values.
- Preserve all numerical values exactly.
- Prioritize OCR accuracy.

## Performance

The application must support:

- Mobile devices
- 24×7 operation
- Multiple users

Optimize for maintainability and reliability.

## Safety

Do not delete existing functionality unless explicitly requested.

Ask before making breaking architectural changes.