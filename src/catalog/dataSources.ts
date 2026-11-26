/**
 * Licensing register for third-party vehicle data. A dataset is shown in the
 * app only when its status is `approved`, which requires the owner's sign-off
 * (CLAUDE.md: specifications only from a properly licensed, recorded source).
 * See docs/DATA_SOURCES.md.
 */
export type DataSourceStatus = 'approved' | 'quarantined';

/** What a licence requires the app to show next to the data (CC BY-SA 4.0 section 3). */
export interface Attribution {
  /** Who created the original material. */
  creator: string;
  /** Short credit shown in the app. */
  credit: string;
  licenceName: string;
  licenceUrl: string;
  /** How VYNR changed the material, as the licence requires us to say. */
  changes: string;
  /** Where anyone can get the adapted data under the same licence (share-alike). */
  adaptedDataUrl: string;
}

export interface DataSource {
  id: string;
  name: string;
  licence: string;
  status: DataSourceStatus;
  reason: string;
  /** Required for approved sources: who approved it and when (ISO date). */
  approval?: { by: string; on: string };
  attribution?: Attribution;
}

export const DATA_SOURCES = {
  'wikipedia-specs-2026-11': {
    id: 'wikipedia-specs-2026-11',
    name: 'English Wikipedia generation articles (66 generations), accessed 25 Nov 2026',
    licence: 'CC BY-SA 4.0 (attribution and share-alike)',
    status: 'approved',
    reason:
      'Owner approved use under CC BY-SA 4.0 on 26 Nov 2026. Shown with attribution, a licence link and a note of changes; the adapted dataset is published under the same licence. Transcribed by an AI pass and spot-checked, so the app says it may contain errors.',
    approval: { by: 'owner', on: '2026-11-26' },
    attribution: {
      creator: 'Wikipedia contributors',
      credit: 'Specifications adapted from English Wikipedia articles by Wikipedia contributors',
      licenceName: 'CC BY-SA 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      changes: 'Figures extracted from the articles and restructured; nothing estimated or converted',
      adaptedDataUrl: 'https://github.com/AaravJit/VYNR/blob/main/data/specs.json',
    },
  },
} as const satisfies Record<string, DataSource>;

export type DataSourceId = keyof typeof DATA_SOURCES;

export function isApproved(id: DataSourceId): boolean {
  const s = DATA_SOURCES[id] as DataSource;
  // An approval without a recorded sign-off, or a licence without attribution, does not count.
  return s.status === 'approved' && s.approval != null && s.attribution != null;
}

export function attributionFor(id: DataSourceId): Attribution | undefined {
  return isApproved(id) ? (DATA_SOURCES[id] as DataSource).attribution : undefined;
}
