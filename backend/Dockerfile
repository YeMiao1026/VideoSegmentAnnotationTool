# Backend Dockerfile
# Builds a Python image with ffmpeg installed and runs the Flask app with gunicorn
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system deps including ffmpeg
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy app code
COPY backend /app

# Create downloads directory (mounted as volume optionally)
RUN mkdir -p /app/downloads

EXPOSE 5000

# Use gunicorn for production; adjust worker count as needed
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
