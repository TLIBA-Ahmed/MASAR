FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home --uid 10001 masar
COPY backend /app/backend
COPY database /app/database
COPY config /app/config
COPY alembic.ini /app/alembic.ini
RUN mkdir -p /app/.local-data/private /app/.cache && chown -R masar:masar /app
USER masar
CMD ["uvicorn","backend.api.app:app","--host","0.0.0.0","--port","8000","--no-access-log"]
