// Real-photo recognition benchmark. See docs/BENCHMARK.md.
//
//   ANTHROPIC_API_KEY=... node scripts/benchmark.ts path/to/manifest.json [--limit 50] [--out results.json]
//
// Calls the paid API once per photo (twice when escalation triggers) with the
// exact production prompt and settings. Prints a Markdown summary.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { loadConfig } from '../src/config.ts';
import { AnthropicVisionProvider } from '../src/providers/anthropic.ts';
import { DEFAULT_ESCALATION, TieredVisionProvider } from '../src/providers/tiered.ts';
import type { VisionProvider } from '../src/providers/types.ts';
import { parseRecognizeRequest } from '../src/validation.ts';

export interface BenchItem {
  /** JPEG path relative to the manifest, already resized to at most 1024 px (the app's size). */
  file: string;
  width: number;
  height: number;
  make: string;
  model: string;
  /** Catalog generation, or null when the label is model-level only. */
  generation: string | null;
  /** e.g. "modified", "night", "rear", "partial", "rebadge", "rare". */
  tags?: string[];
  /** Where the photo came from and its licence (you need the right to send it to a third-party API). */
  source: string;
  license: string;
}

export interface BenchResult {
  file: string;
  tags: string[];
  expected: { make: string; model: string; generation: string | null };
  detected: boolean;
  top: { make: string; model: string; generation: string | null; confidence: number } | null;
  makeOk: boolean;
  modelOk: boolean;
  modelInTop3: boolean;
  generationOk: boolean | null;
  latencyMs: number;
  costMicros: number;
  calls: number;
  error: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function band(c: number): 'high' | 'medium' | 'low' {
  return c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low';
}

export function summarise(results: BenchResult[]): string {
  const n = results.length;
  const pct = (k: number, d: number) => (d ? `${((100 * k) / d).toFixed(1)}%` : 'n/a');
  const ok = results.filter((r) => !r.error);
  const genLabelled = ok.filter((r) => r.generationOk !== null);
  const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const q = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : 0);
  const cost = results.reduce((s, r) => s + r.costMicros, 0) / 1e6;
  const lines = [
    `| Metric | Result |`,
    `| --- | --- |`,
    `| Photos | ${n} (${n - ok.length} errors) |`,
    `| Vehicle detected | ${pct(ok.filter((r) => r.detected).length, ok.length)} |`,
    `| Top-1 make | ${pct(ok.filter((r) => r.makeOk).length, ok.length)} |`,
    `| Top-1 make + model | ${pct(ok.filter((r) => r.modelOk).length, ok.length)} |`,
    `| Model in top 3 | ${pct(ok.filter((r) => r.modelInTop3).length, ok.length)} |`,
    `| Generation (where labelled, ${genLabelled.length}) | ${pct(genLabelled.filter((r) => r.generationOk).length, genLabelled.length)} |`,
    `| Latency p50 / p95 | ${q(0.5)} ms / ${q(0.95)} ms |`,
    `| Escalated to second model | ${pct(ok.filter((r) => r.calls > 1).length, ok.length)} |`,
    `| Total cost | $${cost.toFixed(4)} (≈ $${n ? ((cost / n) * 1000).toFixed(2) : '0'} per 1,000) |`,
    '',
    `Reliability by self-reported confidence band (top-1 make + model accuracy):`,
    '',
    `| Band | Photos | Accuracy |`,
    `| --- | --- | --- |`,
  ];
  for (const b of ['high', 'medium', 'low'] as const) {
    const inBand = ok.filter((r) => r.top && band(r.top.confidence) === b);
    lines.push(`| ${b} | ${inBand.length} | ${pct(inBand.filter((r) => r.modelOk).length, inBand.length)} |`);
  }
  const tags = [...new Set(ok.flatMap((r) => r.tags))].sort();
  if (tags.length) {
    lines.push('', `By tag (top-1 make + model):`, '', `| Tag | Photos | Accuracy |`, `| --- | --- | --- |`);
    for (const t of tags) {
      const inTag = ok.filter((r) => r.tags.includes(t));
      lines.push(`| ${t} | ${inTag.length} | ${pct(inTag.filter((r) => r.modelOk).length, inTag.length)} |`);
    }
  }
  const misses = ok.filter((r) => !r.modelOk).slice(0, 15);
  if (misses.length) {
    lines.push('', 'Misses (first 15):', '');
    for (const m of misses) {
      const got = m.top ? `${m.top.make} ${m.top.model} ${m.top.generation ?? ''} (${band(m.top.confidence)})` : 'no vehicle';
      lines.push(`- ${m.file}: expected ${m.expected.make} ${m.expected.model} ${m.expected.generation ?? ''}, got ${got}`);
    }
  }
  return lines.join('\n');
}

export async function runOne(provider: VisionProvider, item: BenchItem, base: string, maxEdge: number): Promise<BenchResult> {
  const expected = { make: item.make, model: item.model, generation: item.generation };
  const started = Date.now();
  const empty = { detected: false, top: null, makeOk: false, modelOk: false, modelInTop3: false, generationOk: null };
  try {
    const bytes = readFileSync(resolve(base, item.file));
    const image = parseRecognizeRequest(
      { image: bytes.toString('base64'), width: item.width, height: item.height },
      { maxImageBytes: 2_000_000, maxImageEdge: maxEdge },
    );
    const { response, calls } = await provider.identify(image, AbortSignal.timeout(60_000));
    const top = response.candidates[0] ?? null;
    const same = (c: { make: string; model: string }) => norm(c.make) === norm(item.make) && norm(c.model) === norm(item.model);
    return {
      file: item.file,
      tags: item.tags ?? [],
      expected,
      detected: response.vehicleDetected,
      top,
      makeOk: !!top && norm(top.make) === norm(item.make),
      modelOk: !!top && same(top),
      modelInTop3: response.candidates.slice(0, 3).some(same),
      generationOk: item.generation === null ? null : !!top && same(top) && norm(top.generation) === norm(item.generation),
      latencyMs: Date.now() - started,
      costMicros: calls.reduce((s, c) => s + c.costMicros, 0),
      calls: calls.length,
      error: null,
    };
  } catch (e) {
    const costMicros = (e as { costMicros?: number }).costMicros ?? 0;
    return { file: item.file, tags: item.tags ?? [], expected, ...empty, latencyMs: Date.now() - started, costMicros, calls: 0, error: String(e) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = args.find((a) => !a.startsWith('--'));
  if (!manifestPath) throw new Error('Usage: node scripts/benchmark.ts manifest.json [--limit N] [--out results.json]');
  const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const items = (JSON.parse(readFileSync(manifestPath, 'utf8')) as BenchItem[]).slice(0, limit);
  const config = loadConfig();
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is required.');
  const opts = { apiKey: config.anthropicApiKey, maxImageEdge: config.maxImageEdge };
  const fast = new AnthropicVisionProvider({ ...opts, model: config.model, style: 'fast', maxTokens: config.maxOutputTokens });
  const careful = config.escalationModel
    ? new AnthropicVisionProvider({ ...opts, model: config.escalationModel, style: 'careful', maxTokens: config.escalationMaxOutputTokens })
    : null;
  const provider = new TieredVisionProvider(fast, careful, { ...DEFAULT_ESCALATION, minConfidence: config.escalateBelow });
  const base = dirname(resolve(manifestPath));
  const results: BenchResult[] = [];
  for (const item of items) {
    // Sequential on purpose: realistic latency and no burst against rate limits.
    const r = await runOne(provider, item, base, config.maxImageEdge);
    results.push(r);
    process.stderr.write(`${r.modelOk ? '✓' : r.error ? '!' : '✗'} ${item.file}\n`);
  }
  if (out) writeFileSync(out, JSON.stringify({ model: config.model, escalation: config.escalationModel, results }, null, 2));
  console.log(`# Benchmark: ${config.model}${config.escalationModel ? ` → ${config.escalationModel}` : ''}\n`);
  console.log(summarise(results));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
