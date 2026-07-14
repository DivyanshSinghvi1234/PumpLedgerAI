# Stage 1: Build virtualenv using uv
FROM ghcr.io/astral-sh/uv:python3.13-alpine AS builder

WORKDIR /build

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment
RUN uv venv /opt/venv && \
    . /opt/venv/bin/activate && \
    uv pip install -r pyproject.toml

# Stage 2: Final runtime container
FROM python:3.13-slim AS runtime

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Create a non-root group and user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -d /app -s /bin/bash appuser

WORKDIR /app

# Copy the virtual environment from the builder
COPY --from=builder --chown=appuser:appgroup /opt/venv /opt/venv

# Copy application source code
COPY --chown=appuser:appgroup . .

# Ensure storage folder exists and is owned by non-root user
RUN mkdir -p /app/storage && chown -R appuser:appgroup /app/storage

# Switch to the non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
