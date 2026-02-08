FROM node:18-alpine

# Install sqlite3 for database operations
RUN apk add --no-cache sqlite

# Create app directory
WORKDIR /app

# Create data directory
RUN mkdir -p /app/data /app/data/backups && \
    chown -R node:node /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js .
COPY public/ ./public/

# Set proper ownership
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/leaderboard.db
ENV BACKUP_DIR=/app/data/backups

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/stats', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]