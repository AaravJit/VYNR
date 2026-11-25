/**
 * Licensing register for third-party vehicle data. A dataset is shown in the
 * app only when its status is `approved`, which requires the owner's sign-off
 * (CLAUDE.md: specifications only from a properly licensed, recorded source).
 * See docs/DATA_SOURCES.md.
 */
export type DataSourceStatus = 'approved' | 'quarantined';

export interface DataSource {
  id: string;
  name: string;
  licence: string;
  status: DataSourceStatus;
  reason: string;
}

export const DATA_SOURCES = {
  'wikipedia-specs-2026-11': {
    id: 'wikipedia-specs-2026-11',
    name: 'English Wikipedia generation articles (66 generations), accessed 25 Nov 2026',
    licence: 'CC BY-SA 4.0 (attribution and share-alike)',
    status: 'quarantined',
    reason:
      'Owner has not approved CC BY-SA data in a commercial app; transcribed by an AI pass and only spot-checked. Not shown until approved or re-verified against a licensed source.',
  },
} as const satisfies Record<string, DataSource>;

export type DataSourceId = keyof typeof DATA_SOURCES;

export function isApproved(id: DataSourceId): boolean {
  return (DATA_SOURCES[id] as DataSource).status === 'approved';
}
