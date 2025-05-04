# supabase-properties-crud/Dockerfile

# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production # Install only production dependencies

# Stage 2: Build application
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No build step needed for this simple Node server

# Stage 3: Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Copy production dependencies and application code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/supabaseClient.js ./supabaseClient.js
# DO NOT COPY .env - We will inject environment variables via Kubernetes

# Expose the port the app runs on
EXPOSE 3001

# Run the application
CMD ["node", "app.js"]