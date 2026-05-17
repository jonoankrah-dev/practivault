# Dockerfile for Railway with OCR support (pdf2pic + tesseract)
FROM node:20-bookworm

# Install system dependencies required for OCR and PDF rendering
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Railway will set PORT automatically
EXPOSE 3001

# Start the application
CMD ["npm", "start"]