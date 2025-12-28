# Use Node 20 Alpine as base
FROM node:20-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Expose port (optional, for health checks)
EXPOSE 3000

# Start the worker
CMD ["node", "dist/index.js"]
