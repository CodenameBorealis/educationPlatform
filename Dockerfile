# For more information, please refer to https://aka.ms/vscode-docker-python
FROM python:3.12.2-slim-bullseye

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . /app
COPY .env.production /app/eduPlatform/.env.production
COPY requirements.txt /app/

WORKDIR /app

RUN pip3 install -r requirements.txt

RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

ENV DJANGO_SETTINGS_MODULE eduPlatform.settings

EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "eduPlatform.asgi:application"]
