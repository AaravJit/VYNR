import { createServer } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { AnthropicVisionProvider } from './providers/anthropic.ts';

const config = loadConfig();
if (!config.anthropicApiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Refusing to start: see server/.env.example.');
  process.exit(1);
}

const provider = new AnthropicVisionProvider({ apiKey: config.anthropicApiKey, model: config.model });
const app = createApp({ config, provider });
const server = createServer({ requestTimeout: 60_000, headersTimeout: 15_000 }, (req, res) => {
  void app.handle(req, res);
});

const sweeper = setInterval(app.sweep, 60_000);
sweeper.unref();

server.listen(config.port, config.host, () => {
  console.log(`vynr recognition server listening on ${config.host}:${config.port} (model ${config.model})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
