import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { costMicros, imageTokens, maxInputTokens } from '../src/pricing.ts';
import { AnthropicVisionProvider, type CallStyle, type MessagesClient } from '../src/providers/anthropic.ts';
import { needsEscalation, TieredVisionProvider } from '../src/providers/tiered.ts';
import { type Identification, UpstreamError, type VisionProvider } from '../src/providers/types.ts';
import type { RecognitionResponse } from '../src/shared/types.ts';
import { jpegWithExif } from './helpers.ts';

const image = { jpeg: jpegWithExif(), width: 1024, height: 768 };
const signal = new AbortController().signal;

function fakeClient(respond: (params: Record<string, unknown>) => unknown) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return respond(params);
        },
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

const textMessage = (text: string, stop_reason = 'end_turn', model = 'claude-haiku-5-5') => ({
  stop_reason,
  model,
  usage: { input_tokens: 1700, output_tokens: 120 },
  content: [{ type: 'text', text }],
});

const provider = (client: MessagesClient, style: CallStyle = 'fast', model = 'claude-haiku-5-5') =>
  new AnthropicVisionProvider({ model, style, maxTokens: 1024, maxImageEdge: 1280, client });

const kia = { vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', generation: null, confidence: 0.81 }], notes: null };

describe('AnthropicVisionProvider', () => {
  it('sends a capped structured-output request with thinking off on the fast tier and reports cost', async () => {
    const { client, calls } = fakeClient(() => textMessage(JSON.stringify(kia)));
    const r = await provider(client).identify(image, signal);
    assert.deepEqual(r.response, kia);
    assert.deepEqual(r.calls, [{ model: 'claude-haiku-5-5', inputTokens: 1700, outputTokens: 120, costMicros: costMicros('claude-haiku-5-5', 1700, 120) }]);
    const req = calls[0]!;
    assert.equal(req.model, 'claude-haiku-5-5');
    assert.equal(req.max_tokens, 1024);
    assert.deepEqual(req.thinking, { type: 'disabled' });
    assert.equal(req.fallbacks, undefined);
    const cfg = req.output_config as { effort: string; format: { type: string } };
    assert.equal(cfg.effort, 'low');
    assert.equal(cfg.format.type, 'json_schema');
    const content = (req.messages as { content: { type: string; source?: { media_type: string } }[] }[])[0]!.content;
    assert.equal(content[0]!.type, 'image');
    assert.equal(content[0]!.source!.media_type, 'image/jpeg');
    assert.match(String(req.system), /licence plates/);
    assert.match(String(req.system), /never a video-game or fictional equivalent/);
  });

  it('uses adaptive thinking and the refusal fallback on the careful tier, billing the model that answered', async () => {
    const { client, calls } = fakeClient(() => textMessage(JSON.stringify(kia), 'end_turn', 'claude-sonnet-5'));
    const r = await provider(client, 'careful', 'claude-sonnet-5-5').identify(image, signal);
    const req = calls[0]!;
    assert.equal(req.thinking, undefined);
    assert.equal(req.fallbacks, 'default');
    assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(r.calls[0]!.model, 'claude-sonnet-5');
  });

  it('rejects refusals, truncation, non-JSON and out-of-range output, keeping the billed cost', async () => {
    const cases: [unknown, string][] = [
      [textMessage('', 'refusal'), 'refused'],
      [textMessage('{"vehicleDetected":', 'max_tokens'), 'invalid_output'],
      [textMessage('I think it is a Golf'), 'invalid_output'],
      [textMessage(JSON.stringify({ ...kia, candidates: [{ ...kia.candidates[0], confidence: 3 }] })), 'invalid_output'],
    ];
    for (const [msg, kind] of cases) {
      await assert.rejects(provider(fakeClient(() => msg).client).identify(image, signal), (e: UpstreamError) => {
        return e.kind === kind && e.costMicros > 0;
      });
    }
  });

  it('maps SDK errors to upstream error kinds', async () => {
    const headers = new Headers();
    const cases: [Error, string][] = [
      [new Anthropic.RateLimitError(429, undefined, 'rate', headers), 'rate_limited'],
      [new Anthropic.AuthenticationError(401, undefined, 'auth', headers), 'misconfigured'],
      [new Anthropic.APIConnectionError({ message: 'net' }), 'unavailable'],
    ];
    for (const [error, kind] of cases) {
      const p = provider(
        fakeClient(() => {
          throw error;
        }).client,
      );
      await assert.rejects(p.identify(image, signal), (e: { kind?: string }) => e.kind === kind);
    }
  });

  it('bounds the worst-case cost from the image edge and the output cap', () => {
    assert.equal(imageTokens(1024, 768), 37 * 28);
    const p = provider(fakeClient(() => null).client);
    assert.equal(p.worstCaseMicros, costMicros('claude-haiku-5-5', maxInputTokens(1280), 1024));
    // Haiku 5.5 worst case stays well under a tenth of a cent.
    assert.ok(p.worstCaseMicros < 1000);
  });
});

class Stub implements VisionProvider {
  calls = 0;
  readonly id: string;
  readonly worstCaseMicros = 100;
  private readonly answer: () => RecognitionResponse;
  constructor(id: string, answer: () => RecognitionResponse) {
    this.id = id;
    this.answer = answer;
  }
  async identify(): Promise<Identification> {
    this.calls++;
    return { response: this.answer(), calls: [{ model: this.id, inputTokens: 1, outputTokens: 1, costMicros: 10 }] };
  }
}

const answer = (confidence: number, second?: { make: string; model: string; confidence: number }): RecognitionResponse => ({
  vehicleDetected: true,
  candidates: [{ make: 'BMW', model: 'M3', generation: null, confidence }, ...(second ? [{ ...second, generation: null }] : [])],
  notes: null,
});

describe('TieredVisionProvider', () => {
  const policy = { minConfidence: 0.7, minMargin: 0.15 };

  it('escalates only uncertain answers', () => {
    assert.equal(needsEscalation(answer(0.9), policy), false);
    assert.equal(needsEscalation(answer(0.6), policy), true);
    assert.equal(needsEscalation(answer(0.8, { make: 'BMW', model: 'M4', confidence: 0.7 }), policy), true);
    assert.equal(needsEscalation(answer(0.8, { make: 'BMW', model: 'M3', confidence: 0.75 }), policy), false);
    assert.equal(needsEscalation({ vehicleDetected: false, candidates: [], notes: null }, policy), false);
  });

  it('keeps confident cheap answers and escalates uncertain ones, summing the cost', async () => {
    const fast = new Stub('fast', () => answer(0.95));
    const careful = new Stub('careful', () => answer(0.9));
    const t = new TieredVisionProvider(fast, careful, policy);
    assert.equal(t.worstCaseMicros, 200);
    let r = await t.identify(image, signal);
    assert.equal(careful.calls, 0);
    assert.equal(r.calls.length, 1);

    const unsure = new TieredVisionProvider(new Stub('fast', () => answer(0.4)), careful, policy);
    r = await unsure.identify(image, signal);
    assert.equal(careful.calls, 1);
    assert.equal(r.response.candidates[0]!.confidence, 0.9);
    assert.equal(r.calls.reduce((a, c) => a + c.costMicros, 0), 20);
  });

  it('returns the paid-for first answer when escalation fails', async () => {
    const failing: VisionProvider = {
      id: 'careful',
      worstCaseMicros: 100,
      identify: async () => {
        throw new UpstreamError('unavailable', 'down', 7);
      },
    };
    const r = await new TieredVisionProvider(new Stub('fast', () => answer(0.4)), failing, policy).identify(image, signal);
    assert.equal(r.response.candidates[0]!.confidence, 0.4);
    assert.equal(r.calls.reduce((a, c) => a + c.costMicros, 0), 17);
  });
});
