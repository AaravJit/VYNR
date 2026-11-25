# Build from the server/ directory: docker build -t vynr-recognition .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
# Rate-limit, budget and spend counters persist here. Mount a volume to keep them across deploys.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
USER node
EXPOSE 8787
CMD ["node", "src/index.ts"]
