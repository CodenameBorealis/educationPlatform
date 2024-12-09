# For more information, please refer to https://aka.ms/vscode-docker-python
FROM python:3.12.2-bullseye

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . /app
COPY requirements.txt /app/

RUN apt-get -y update && apt-get -y upgrade
RUN apt-get -y install python3-dev default-libmysqlclient-dev build-essential pkg-config coturn

WORKDIR /app

RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install -r requirements.txt
RUN python3 -m pip uninstall --yes channels daphne

RUN python3 -m pip install channels["daphne"]

RUN adduser -u 5678 --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

ENV DJANGO_SETTINGS_MODULE eduPlatform.settings
EXPOSE 8000

#CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "eduPlatform.asgi:application"]
