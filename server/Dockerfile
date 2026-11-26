# Build from the server/ directory: docker build -t vynr-recognition .
FROM node:22.18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
# Quotas, spend, the result cache and the economy database live here: mount a persistent volume at /app/data.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]
ENV STATE_FILE=/app/data/vynr-state.sqlite
ENV ECONOMY_STATE_FILE=/app/data/vynr-economy.sqlite
USER node
EXPOSE 8787
CMD ["node", "src/index.ts"]
