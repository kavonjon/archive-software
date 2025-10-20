# Stage 1: Build React frontend
FROM node:18-slim as frontend-builder

WORKDIR /frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build React app
RUN npm run build

# Stage 2: Python application
FROM python:3.11.4

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt update && apt install -y ffmpeg

RUN apt install -y python3-dev && apt install -y gfortran && apt install -y gcc && apt install -y musl-dev

RUN python3 -m pip install --upgrade pip setuptools wheel

COPY app/requirements.txt .

RUN python3 -m pip install -r requirements.txt

COPY ./app /app

# Copy React build from frontend-builder stage
COPY --from=frontend-builder /frontend/build /app/static-files/frontend

WORKDIR /app

COPY ./entrypoint.sh /
ENTRYPOINT ["sh", "/entrypoint.sh"]
