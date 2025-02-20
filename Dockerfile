FROM python:3.11.4

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt update && apt install -y ffmpeg

RUN apt install -y python3-dev && apt install -y gfortran && apt install -y gcc && apt install -y musl-dev


RUN python3 -m pip install --upgrade pip setuptools wheel

COPY app/requirements.txt .

RUN python3 -m pip install -r requirements.txt

COPY ./app /app

RUN mkdir -p /var/log/django && chown -R django:django /var/log/django

WORKDIR /app

COPY ./entrypoint.sh /
ENTRYPOINT ["sh", "/entrypoint.sh"]


