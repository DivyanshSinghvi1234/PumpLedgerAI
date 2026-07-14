# Stage 1: Build static site using Node
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy codebase
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve using hardened Nginx
FROM nginx:alpine-slim AS runtime

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy build artifacts to nginx public path
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose non-root port
EXPOSE 8080

# Configure files to be owned by nginx user
RUN touch /tmp/nginx.pid && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx /tmp/nginx.pid /usr/share/nginx/html

# Switch to the non-root user
USER nginx

CMD ["nginx", "-g", "daemon off;"]
