FROM node:20-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN=100
ARG INTERNAL_BACKEND_URL=http://backend:8080
ARG INTERNAL_CV_SERVICE_URL=http://cv-service:8000
ARG INTERNAL_MINIO_URL=http://minio:9000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN=$NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN
ENV INTERNAL_BACKEND_URL=$INTERNAL_BACKEND_URL
ENV INTERNAL_CV_SERVICE_URL=$INTERNAL_CV_SERVICE_URL
ENV INTERNAL_MINIO_URL=$INTERNAL_MINIO_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
