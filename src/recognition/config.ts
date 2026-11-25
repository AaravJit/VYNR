export type RecognitionMode = 'remote' | 'mock' | 'unconfigured';

export interface RecognitionConfig {
  mode: RecognitionMode;
  endpoint: string | null;
}

/** Maximum automatic identifications per device per day (client-side cost control). */
export const CLIENT_DAILY_RECOGNITION_LIMIT = 40;

/**
 * Resolves the recognition mode from public build-time env vars.
 *
 * - EXPO_PUBLIC_RECOGNITION_MODE=mock   → simulated recognition, development builds only (always labelled)
 * - EXPO_PUBLIC_RECOGNITION_MODE=remote → requires EXPO_PUBLIC_RECOGNITION_ENDPOINT
 * - unset: development builds default to mock; release builds are 'unconfigured'
 *   (manual identification only) so no simulated result can ship by accident.
 *
 * These values are public. Never put API keys in EXPO_PUBLIC_* variables.
 */
export function resolveRecognitionConfig(
  env: { mode?: string; endpoint?: string },
  isDev: boolean,
): RecognitionConfig {
  const endpoint = env.endpoint?.trim() || null;
  const validEndpoint = endpoint && /^https:\/\//i.test(endpoint) ? endpoint : isDev && endpoint?.startsWith('http://') ? endpoint : null;
  const mode = env.mode?.trim().toLowerCase();
  // Simulated recognition is a development tool only: release builds can never enable it.
  if (mode === 'mock') return isDev ? { mode: 'mock', endpoint: null } : { mode: 'unconfigured', endpoint: null };
  if (mode === 'remote') return validEndpoint ? { mode: 'remote', endpoint: validEndpoint } : { mode: 'unconfigured', endpoint: null };
  if (validEndpoint) return { mode: 'remote', endpoint: validEndpoint };
  return isDev ? { mode: 'mock', endpoint: null } : { mode: 'unconfigured', endpoint: null };
}

export function appRecognitionConfig(): RecognitionConfig {
  return resolveRecognitionConfig(
    {
      mode: process.env.EXPO_PUBLIC_RECOGNITION_MODE,
      endpoint: process.env.EXPO_PUBLIC_RECOGNITION_ENDPOINT,
    },
    typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  );
}
