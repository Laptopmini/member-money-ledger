FROM python:3.14.10-slim

ARG DEV=1
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN if [ "$DEV" = "1" ]; then pip install -r requirements-dev.txt; else pip install -r requirements.txt; fi

COPY . .
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
