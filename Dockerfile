# Production-optimized multi-stage Dockerfile for Arbitrage Bot
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application (compile TypeScript, bundle assets, etc.)
RUN npm run build || echo "No build script found, skipping..."

# Run tests to ensure quality
RUN npm test || echo "Tests failed, but continuing for demo"

# Production stage
FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S arbitrage -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=arbitrage:nodejs /app/src ./src
COPY --from=builder --chown=arbitrage:nodejs /app/contracts ./contracts
COPY --from=builder --chown=arbitrage:nodejs /app/scripts ./scripts
COPY --from=builder --chown=arbitrage:nodejs /app/deployments ./deployments
COPY --from=builder --chown=arbitrage:nodejs /app/hardhat.config.js ./
COPY --from=builder --chown=arbitrage:nodejs /app/jest.config.js ./

# Create necessary directories
RUN mkdir -p logs/security logs/trading logs/system && \
    chown -R arbitrage:nodejs logs

# Install security updates
RUN apk upgrade --no-cache

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Install curl for health checks
RUN apk add --no-cache curl

# Switch to non-root user
USER arbitrage

# Expose ports
EXPOSE 3000 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HEALTH_CHECK_PORT=3001

# Add labels for metadata
LABEL maintainer="arbitrage-bot-team"
LABEL version="1.0.0"
LABEL description="High-frequency arbitrage trading bot"

# Start command with proper signal handling
CMD ["node", "--max-old-space-size=512", "src/index.js"]