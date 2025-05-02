FROM node:18-slim

WORKDIR /app

# Install dependencies for canvas and fonts
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-noto \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all project files
COPY . .

# Build TypeScript files
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"] 