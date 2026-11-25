/**
 * Anthropic first-party API list prices in US dollars per million tokens, as
 * published for these models on 2026-11-03 (see RESEARCH.md). Used for spend
 * accounting and the pre-call worst-case reservation. Update this table when
 * prices change; an unknown model is refused at startup so spend control can
 * never silently stop working.
 */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
};

/** Most expensive known price, used when a response reports a model we do not list (e.g. a server-side fallback). */
const CONSERVATIVE: ModelPrice = Object.values(MODEL_PRICES).reduce((a, b) => ({
  inputPerMTok: Math.max(a.inputPerMTok, b.inputPerMTok),
  outputPerMTok: Math.max(a.outputPerMTok, b.outputPerMTok),
}));

export function priceFor(model: string): ModelPrice {
  return MODEL_PRICES[model] ?? CONSERVATIVE;
}

export function isPricedModel(model: string): boolean {
  return model in MODEL_PRICES;
}

/** Cost in micro-dollars (1e-6 USD), rounded up so accounting never under-counts. */
export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return Math.ceil(inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok);
}

/** Image tokens per the Claude vision docs (Nov 2026): ceil(w/28) × ceil(h/28). */
export function imageTokens(width: number, height: number): number {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

/** Upper bound on input tokens: a square image at the maximum edge plus the fixed prompt overhead. */
export function maxInputTokens(maxImageEdge: number, promptTokens = 1200): number {
  return imageTokens(maxImageEdge, maxImageEdge) + promptTokens;
}
