import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the export JSON to a temporary file and opens the system share sheet. */
export async function shareExport(data: Record<string, unknown>): Promise<'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `vynr-export-${stamp}.json`);
  if (file.exists) file.delete();
  await file.write(JSON.stringify(data, null, 2));
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export VYNR data', UTI: 'public.json' });
  } finally {
    try {
      file.delete();
    } catch {
      // ignore
    }
  }
  return 'shared';
}
