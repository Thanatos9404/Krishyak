FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt requirements-v2.txt ./
RUN pip install --disable-pip-version-check -r requirements.txt
COPY . .
RUN useradd --uid 10001 --create-home krishyak && mkdir -p /app/data/v2-objects /app/logs /app/soil_cache /app/pest_data && chown -R krishyak:krishyak /app/data /app/logs /app/soil_cache /app/pest_data
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live',timeout=4)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--limit-concurrency", "16"]
