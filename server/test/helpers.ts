import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp, type AppDeps } from '../src/app.ts';
import { loadConfig, type ServerConfig } from '../src/config.ts';
import type { VisionProvider } from '../src/providers/types.ts';
import type { RecognitionResponse } from '../src/shared/types.ts';

/** Minimal JPEG byte stream with an EXIF/GPS segment, a table and scan data. */
export function jpegWithExif(extra = 0): Uint8Array {
  const exif = [...'Exif\0\0GPS 51.5N'].map((c) => c.charCodeAt(0));
  const out = [0xff, 0xd8, 0xff, 0xe1, 0x00, exif.length + 2, ...exif, 0xff, 0xdb, 0x00, 0x03, 0x01];
  out.push(0xff, 0xda, 0x00, 0x04, 0x01, 0x02, ...new Array(extra).fill(0xaa), 0xff, 0xd9);
  return Uint8Array.from(out);
}

export const INSTALL = 'a'.repeat(32);
export const okResult: RecognitionResponse = {
  vehicleDetected: true,
  candidates: [{ make: 'Porsche', model: '911', generation: '992', confidence: 0.9 }],
  notes: null,
};

export class FakeProvider implements VisionProvider {
  readonly id = 'fake';
  calls: Uint8Array[] = [];
  usage = { inputTokens: 1000, outputTokens: 100 };
  impl: (signal: AbortSignal) => Promise<RecognitionResponse> = async () => okResult;
  async identify(image: { jpeg: Uint8Array }, signal: AbortSignal, onUsage?: (u: { inputTokens: number; outputTokens: number }) => void) {
    this.calls.push(image.jpeg);
    onUsage?.(this.usage);
    return this.impl(signal);
  }
}

export interface Harness {
  url: string;
  provider: FakeProvider;
  logs: string[];
  clock: { t: number; now(): number };
  close(): Promise<void>;
  post(body: unknown, headers?: Record<string, string>): Promise<Response>;
}

export async function startServer(overrides: Partial<ServerConfig> = {}, deps: Partial<AppDeps> = {}): Promise<Harness> {
  const config = { ...loadConfig({}), quotaDbPath: ':memory:', ...overrides };
  const provider = new FakeProvider();
  const logs: string[] = [];
  const clock = { t: Date.UTC(2026, 10, 25, 12), now: () => clock.t };
  const app = createApp({ config, provider, clock, log: (l) => logs.push(l), ...deps });
  const server: Server = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    provider,
    logs,
    clock,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
    post: (body, headers = {}) =>
      fetch(`${url}/v1/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Install-Id': INSTALL, ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
  };
}

export function imageBody(bytes: Uint8Array = jpegWithExif()) {
  return { image: Buffer.from(bytes).toString('base64'), width: 1024, height: 768 };
}
