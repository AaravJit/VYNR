import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { loadCatalog } from './economy/catalog.ts';
import { DEFAULT_ECONOMY, validateEconomy } from './economy/config.ts';
import { EconomyStore } from './economy/store.ts';
import { AnthropicVisionProvider } from './providers/anthropic.ts';
import { DEFAULT_ESCALATION, TieredVisionProvider } from './providers/tiered.ts';

const config = loadConfig();
if (!config.anthropicApiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Refusing to start: see server/.env.example.');
  process.exit(1);
}
if (config.stateFile !== ':memory:') mkdirSync(dirname(config.stateFile), { recursive: true });
if (config.economyStateFile !== ':memory:') mkdirSync(dirname(config.economyStateFile), { recursive: true });

const catalog = loadCatalog();
const economyErrors = validateEconomy(DEFAULT_ECONOMY, catalog);
if (economyErrors.length > 0) {
  console.error(`Economy config is invalid:\n  ${economyErrors.join('\n  ')}`);
  process.exit(1);
}
// Billing verifiers are not configured: subscription endpoints refuse every purchase (docs/SUBSCRIPTIONS.md).
const economy = config.features.has('economy') ? new EconomyStore(config.economyStateFile, { catalog, config: DEFAULT_ECONOMY }) : undefined;

const fast = new AnthropicVisionProvider({
  apiKey: config.anthropicApiKey,
  model: config.model,
  style: 'fast',
  maxTokens: config.maxOutputTokens,
  maxImageEdge: config.maxImageEdge,
});
const careful = config.escalationModel
  ? new AnthropicVisionProvider({
      apiKey: config.anthropicApiKey,
      model: config.escalationModel,
      style: 'careful',
      maxTokens: config.escalationMaxOutputTokens,
      maxImageEdge: config.maxImageEdge,
    })
  : null;
const provider = new TieredVisionProvider(fast, careful, { ...DEFAULT_ESCALATION, minConfidence: config.escalateBelow });

const app = createApp({ config, provider, economy });
const server = createServer({ requestTimeout: 60_000, headersTimeout: 15_000 }, (req, res) => {
  void app.handle(req, res);
});

const sweeper = setInterval(app.sweep, 60_000);
sweeper.unref();

server.listen(config.port, config.host, () => {
  const worst = (provider.worstCaseMicros / 1e6).toFixed(4);
  console.log(`vynr recognition server listening on ${config.host}:${config.port} (${provider.id}; worst case $${worst} per scan)`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      app.store.close();
      economy?.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
