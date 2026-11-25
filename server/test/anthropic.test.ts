import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { AnthropicVisionProvider, type MessagesClient } from '../src/providers/anthropic.ts';
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

const textMessage = (text: string, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }] });

describe('AnthropicVisionProvider', () => {
  it('sends a structured-output request with the image and validates the answer', async () => {
    const { client, calls } = fakeClient(() =>
      textMessage(JSON.stringify({ vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', generation: null, confidence: 0.81 }], notes: null })),
    );
    const p = new AnthropicVisionProvider({ model: 'test-model', client });
    const r = await p.identify(image, signal);
    assert.deepEqual(r, { vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', generation: null, confidence: 0.81 }], notes: null });
    const req = calls[0]!;
    assert.equal(req.model, 'test-model');
    assert.equal((req.output_config as { format: { type: string } }).format.type, 'json_schema');
    const content = (req.messages as { content: { type: string; source?: { media_type: string } }[] }[])[0]!.content;
    assert.equal(content[0]!.type, 'image');
    assert.equal(content[0]!.source!.media_type, 'image/jpeg');
    assert.match(String(req.system), /licence plates/);
  });

  it('rejects refusals, truncation, non-JSON and out-of-range output', async () => {
    const cases: [unknown, string][] = [
      [textMessage('', 'refusal'), 'refused'],
      [textMessage('{"vehicleDetected":', 'max_tokens'), 'invalid_output'],
      [textMessage('I think it is a Golf'), 'invalid_output'],
      [textMessage(JSON.stringify({ vehicleDetected: true, candidates: [{ make: 'Kia', model: 'EV6', generation: null, confidence: 3 }], notes: null })), 'invalid_output'],
    ];
    for (const [msg, kind] of cases) {
      const p = new AnthropicVisionProvider({ model: 'm', client: fakeClient(() => msg).client });
      await assert.rejects(p.identify(image, signal), (e: { kind?: string }) => e.kind === kind);
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
      const p = new AnthropicVisionProvider({
        model: 'm',
        client: fakeClient(() => {
          throw error;
        }).client,
      });
      await assert.rejects(p.identify(image, signal), (e: { kind?: string }) => e.kind === kind);
    }
  });
});
