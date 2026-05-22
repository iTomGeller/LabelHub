FROM python:3.12-slim
WORKDIR /app
COPY apps/agent-runtime/pyproject.toml .
COPY apps/agent-runtime/src ./src
RUN pip install --no-cache-dir .
ENV PYTHONPATH=/app/src
EXPOSE 8000
CMD ["uvicorn", "labelhub_agent_runtime.main:app", "--host", "0.0.0.0", "--port", "8000"]
