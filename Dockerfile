# ============================================================================
# MediBridge Multi-Stage Production Dockerfile (Bonus Point 1: DevOps)
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "server/src/index.js"]
