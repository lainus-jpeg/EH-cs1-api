# Multi-stage build for Node.js backend
# Stage 1: Dependencies
FROM node:18-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Copy production dependencies from builder
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY app.js .
COPY package.json .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/v1/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })" || exit 1

# Start application
CMD ["node", "app.js"]

