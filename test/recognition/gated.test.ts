import { type RecognitionGates, recognizeWithGates } from '@/recognition/gated';
import { RecognitionError, type RecognitionProvider, type RecognitionResult } from '@/recognition/types';
import type { RedactionSummary } from '@/services/imageService';

const image = { base64: 'AAAA', width: 10, height: 10 };
const redacted: RedactionSummary = { status: 'redacted', faces: 0, plates: 1 };
const answer: RecognitionResult = { vehicleDetected: true, candidates: [], notes: null, provider: 'test', simulated: false };

function setup(over: Partial<RecognitionGates> = {}, provider?: Partial<RecognitionProvider>) {
  const recognize = jest.fn(async () => answer);
  const noteUsed = jest.fn(async () => undefined);
  const p: RecognitionProvider = { id: 'p', simulated: false, recognize, ...provider };
  const gates: RecognitionGates = {
    mode: 'remote',
    consented: () => true,
    allowance: async () => 5,
    noteUsed,
    provider: async () => p,
    ...over,
  };
  return { gates, recognize: p.recognize as jest.Mock, noteUsed };
}

describe('recognizeWithGates', () => {
  it('uploads a redacted photo and counts it against the allowance', async () => {
    const { gates, recognize, noteUsed } = setup();
    const out = await recognizeWithGates(gates, image, redacted, new AbortController().signal);
    expect(out).toEqual({ kind: 'result', result: answer });
    expect(noteUsed).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unavailable', { status: 'unavailable' } as RedactionSummary],
    ['failed', { status: 'failed' } as RedactionSummary],
    ['missing', null],
  ])('never uploads when redaction is %s', async (_label, redaction) => {
    const { gates, recognize, noteUsed } = setup();
    const out = await recognizeWithGates(gates, image, redaction, new AbortController().signal);
    expect(out).toEqual({ kind: 'manual', reason: 'no_redaction' });
    expect(recognize).not.toHaveBeenCalled();
    expect(noteUsed).not.toHaveBeenCalled();
  });

  it('stops without consent, without allowance and when unconfigured', async () => {
    const signal = new AbortController().signal;
    expect(await recognizeWithGates(setup({ consented: () => false }).gates, image, redacted, signal)).toEqual({
      kind: 'manual',
      reason: 'no_consent',
    });
    expect(await recognizeWithGates(setup({ allowance: async () => 0 }).gates, image, redacted, signal)).toEqual({
      kind: 'manual',
      reason: 'quota',
    });
    expect(await recognizeWithGates(setup({ mode: 'unconfigured' }).gates, image, redacted, signal)).toEqual({
      kind: 'manual',
      reason: 'unconfigured',
    });
  });

  it('re-checks consent immediately before the upload', async () => {
    let calls = 0;
    const { gates, recognize } = setup({ consented: () => ++calls < 2 });
    const out = await recognizeWithGates(gates, image, redacted, new AbortController().signal);
    expect(out).toEqual({ kind: 'manual', reason: 'no_consent' });
    expect(recognize).not.toHaveBeenCalled();
  });

  it('does nothing after cancellation', async () => {
    const ctrl = new AbortController();
    const { gates, recognize } = setup({
      allowance: async () => {
        ctrl.abort();
        return 5;
      },
    });
    expect(await recognizeWithGates(gates, image, redacted, ctrl.signal)).toEqual({ kind: 'aborted' });
    expect(recognize).not.toHaveBeenCalled();
  });

  it('maps a server quota error to the manual path and rethrows other errors', async () => {
    const quota = setup({}, { recognize: jest.fn(async () => Promise.reject(new RecognitionError('quota_exceeded', 'q'))) });
    expect(await recognizeWithGates(quota.gates, image, redacted, new AbortController().signal)).toEqual({
      kind: 'manual',
      reason: 'quota',
    });
    const net = setup({}, { recognize: jest.fn(async () => Promise.reject(new RecognitionError('network', 'n'))) });
    await expect(recognizeWithGates(net.gates, image, redacted, new AbortController().signal)).rejects.toThrow('n');
  });

  it('lets the simulated provider run without a photo', async () => {
    const { gates, noteUsed } = setup({ mode: 'mock' }, { simulated: true });
    const out = await recognizeWithGates(gates, null, null, new AbortController().signal);
    expect(out.kind).toBe('result');
    expect(noteUsed).not.toHaveBeenCalled();
  });
});
