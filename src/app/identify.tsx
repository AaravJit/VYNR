import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalog } from '@/catalog';
import { DevModeBanner, VehicleEmblem } from '@/components/game';
import { Icon } from '@/components/Icon';
import { ScanOverlay } from '@/components/ScanOverlay';
import { Button, EmptyState, Notice, Panel, RarityBadge, Screen, SectionHeader, Txt } from '@/components/ui';
import { VehicleFacts } from '@/components/VehicleFacts';
import { GAME_CONFIG } from '@/domain/config';
import { encounterXp } from '@/domain/progression';
import type { EncounterSource } from '@/domain/types';
import { type CatalogMatch, confidenceBand, matchCandidates } from '@/recognition/matcher';
import { RecognitionError, userMessageFor } from '@/recognition/types';
import { saveThumbnail } from '@/services/imageService';
import { getRecognitionProvider, recognitionConfig, useAppState, useAppStore, useHaptics } from '@/state/AppProvider';
import {
  clearScanSession,
  currentScanSession,
  getScanSession,
  stashOutcome,
  subscribeScanSession,
  updateScanSession,
} from '@/state/scanSession';
import { colors, radius, space } from '@/theme/tokens';

type Phase =
  | { kind: 'analysing' }
  | { kind: 'manual'; reason: 'unconfigured' | 'no_consent' | 'quota' }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

const BAND_COPY = { high: 'High confidence', medium: 'Moderate confidence', low: 'Low confidence' } as const;

export default function Identify() {
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const store = useAppStore();
  const state = useAppState();
  const haptics = useHaptics();
  const current = useSyncExternalStore(subscribeScanSession, currentScanSession, currentScanSession);
  const session = current && current.id === scanId ? current : null;
  const [phase, setPhase] = useState<Phase>(() => (getScanSession(scanId)?.result ? { kind: 'done' } : { kind: 'analysing' }));
  const [openedAt] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Synchronous guard: two taps in the same frame must not record two encounters.
  const savingRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const consent = state.settings.cloudRecognitionConsent;

  // Run recognition once per attempt.
  useEffect(() => {
    const s = getScanSession(scanId);
    if (!s || !state.player || s.result) return;
    // Created before any await so leaving the screen cancels every step, including the upload.
    const controller = new AbortController();
    abortRef.current = controller;
    const stopped = () => controller.signal.aborted;
    // Consent is read from the store at each step, not from this render, so revoking it always wins.
    const consented = () => store.getState().settings.cloudRecognitionConsent;
    const run = async () => {
      if (recognitionConfig.mode === 'unconfigured') return setPhase({ kind: 'manual', reason: 'unconfigured' });
      if (recognitionConfig.mode === 'remote' && !consented()) return setPhase({ kind: 'manual', reason: 'no_consent' });
      if (recognitionConfig.mode === 'remote' && (await store.recognitionAllowance()) <= 0) {
        if (!stopped()) setPhase({ kind: 'manual', reason: 'quota' });
        return;
      }
      if (stopped()) return;
      const provider = await getRecognitionProvider(state.player!.id);
      if (stopped()) return;
      if (!provider) return setPhase({ kind: 'manual', reason: 'unconfigured' });
      setPhase({ kind: 'analysing' });
      try {
        if (!provider.simulated) {
          await store.noteRecognitionUsed();
          // Last check immediately before the photo leaves the device.
          if (stopped()) return;
          if (!consented()) return setPhase({ kind: 'manual', reason: 'no_consent' });
        }
        const result = await provider.recognize(s.image, controller.signal);
        if (stopped()) return;
        updateScanSession(s.id, { result });
        setPhase({ kind: 'done' });
        haptics.success();
      } catch (e) {
        if (stopped()) return;
        haptics.error();
        if (e instanceof RecognitionError && e.code === 'quota_exceeded') {
          setPhase({ kind: 'manual', reason: 'quota' });
        } else {
          setPhase({ kind: 'error', message: userMessageFor(e) });
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [scanId, attempt, consent]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = session?.result ?? null;
  const match = useMemo(
    () => (result ? matchCandidates(catalog, result.candidates) : { matches: [], unmatched: [] }),
    [result],
  );

  // When the model matched but several catalog generations fit, the player must choose one explicitly.
  const topMatch = match.matches[0];
  const generationAmbiguous =
    !!topMatch &&
    topMatch.quality === 'model' &&
    match.matches.filter((m) => m.vehicle.manufacturerId === topMatch.vehicle.manufacturerId && m.vehicle.model === topMatch.vehicle.model)
      .length > 1;

  // Default selection: manual choice, otherwise the top match unless its generation is ambiguous.
  const effectiveId = session?.unknownLabel
    ? null
    : (session?.manualVehicleId ?? selectedId ?? (generationAmbiguous ? null : (match.matches[0]?.vehicle.id ?? null)));
  const vehicle = effectiveId ? catalog.getVehicle(effectiveId) : undefined;
  const selectedMatch: CatalogMatch | undefined = match.matches.find((m) => m.vehicle.id === effectiveId);
  const isManual = !!session?.manualVehicleId && !selectedMatch;

  const priorEncounters = useMemo(
    () => (vehicle ? state.encounters.filter((e) => e.vehicleId === vehicle.id) : []),
    [state.encounters, vehicle],
  );
  const xpPreview = vehicle
    ? encounterXp(
        vehicle.rarity,
        priorEncounters.length,
        priorEncounters.length ? openedAt - priorEncounters[priorEncounters.length - 1]!.createdAt : null,
        GAME_CONFIG,
      )
    : null;

  const openPicker = () => router.push({ pathname: '/catalog-picker', params: { scanId: scanId ?? '' } });

  const confirm = async (unknownLabel?: string) => {
    if (!session || savingRef.current) return;
    if (!vehicle && !unknownLabel) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      let source: EncounterSource;
      if (session.result?.simulated) source = 'simulated';
      else if (isManual || unknownLabel) source = session.result ? 'ai_corrected' : 'manual';
      else source = selectedMatch && selectedMatch === match.matches[0] ? 'ai_confirmed' : 'ai_corrected';

      let photoUri: string | null = null;
      if (state.settings.keepPhotos && session.image) {
        try {
          photoUri = await saveThumbnail(session.image, Crypto.randomUUID());
        } catch {
          photoUri = null; // a thumbnail failure must never block the encounter
        }
      }
      const outcome = await store.recordEncounter({
        vehicleId: unknownLabel ? null : vehicle!.id,
        label: unknownLabel ?? null,
        source,
        confidence: !unknownLabel && selectedMatch ? selectedMatch.confidence : null,
        provider: session.result?.provider ?? null,
        photoUri,
      });
      stashOutcome(outcome);
      clearScanSession();
      router.replace({ pathname: '/discovery/[encounterId]', params: { encounterId: outcome.encounter.id } });
    } catch (e) {
      haptics.error();
      // Keep the identification on screen so the player can simply retry saving.
      setSaveError(e instanceof Error ? e.message : 'Could not save this encounter.');
      savingRef.current = false;
      setSaving(false);
    }
  };

  const exit = () => {
    abortRef.current?.abort();
    clearScanSession();
    router.replace('/');
  };

  if (!session) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon="alert"
          title="This scan has expired"
          body="Scans are kept in memory only. Take a new photo to continue."
          action={<Button label="Open scanner" icon="scan" onPress={() => router.replace('/scan')} />}
        />
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Discard scan" onPress={exit} style={styles.iconBtn}>
        <Icon name="close" size={20} />
      </Pressable>
      <Txt variant="label" upper>
        Identification
      </Txt>
      <View style={{ width: 44 }} />
    </View>
  );

  const preview = (
    <View style={styles.preview}>
      {session.previewUri ? (
        <Image source={{ uri: session.previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Captured photo" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPreview]}>
          <Txt variant="label" color={colors.warning}>
            SIMULATED CAPTURE · NO PHOTO
          </Txt>
        </View>
      )}
      {session.previewUri && session.redactedRegions !== undefined && (
        <View style={styles.privacyBadge} accessibilityLabel={`Privacy protection applied. ${session.redactedRegions} areas blurred on this device.`}>
          <Txt variant="label" color={colors.text}>
            {session.redactedRegions === 0 ? 'NO FACES OR PLATES FOUND' : `${session.redactedRegions} AREA${session.redactedRegions === 1 ? '' : 'S'} BLURRED ON DEVICE`}
          </Txt>
        </View>
      )}
      {phase.kind === 'analysing' && <ScanOverlay active label="ANALYSING SILHOUETTE…" />}
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} header={header} contentStyle={{ paddingBottom: space.xxxl }}>
      <DevModeBanner />
      {preview}

      {saveError && <Notice tone="danger" title="Could not save this sighting" body={`${saveError} Nothing was recorded. Try again.`} />}

      {phase.kind === 'analysing' && (
        <Panel style={{ gap: space.sm }} accessibilityLabel="Analysing photo">
          <Txt variant="label" color={colors.accent}>
            RECOGNITION IN PROGRESS
          </Txt>
          <Txt variant="small" color={colors.textMuted}>
            Matching the silhouette against the VYNR catalog…
          </Txt>
        </Panel>
      )}

      {phase.kind === 'error' && (
        <>
          <Notice tone="danger" title="Identification failed" body={phase.message} />
          <Button label="Try again" icon="refresh" onPress={() => setAttempt((a) => a + 1)} />
          <Button label="Identify manually" variant="secondary" onPress={openPicker} />
        </>
      )}

      {phase.kind === 'manual' && !vehicle && (
        <>
          <Notice
            tone={phase.reason === 'quota' ? 'warning' : 'info'}
            title={
              phase.reason === 'unconfigured'
                ? 'Automatic identification is not configured'
                : phase.reason === 'quota'
                  ? 'Daily identification limit reached'
                  : 'Cloud identification is off'
            }
            body={
              phase.reason === 'no_consent'
                ? 'Your photo has not left this device. Identify the vehicle manually, or allow cloud identification for this and future scans.'
                : 'Choose the vehicle from the catalog to log your encounter.'
            }
          />
          {phase.reason === 'no_consent' && (
            <Button
              label="Allow cloud identification"
              variant="secondary"
              icon="shield"
              onPress={() => void store.setSetting('cloudRecognitionConsent', true)}
            />
          )}
          <Button label="Choose from catalog" icon="search" onPress={openPicker} />
        </>
      )}

      {phase.kind === 'done' && session.result && !session.result.vehicleDetected && !vehicle && (
        <>
          <Notice
            tone="warning"
            title="No vehicle detected"
            body={session.result.notes ?? 'Try again with the whole vehicle in frame and good lighting.'}
          />
          <Button label="Retake photo" icon="scan" onPress={() => router.replace('/scan')} />
          <Button label="Identify manually" variant="secondary" onPress={openPicker} />
        </>
      )}

      {vehicle && (
        <>
          <Panel highlight style={{ gap: space.md }}>
            <View style={styles.predHeader}>
              <Txt variant="label" color={isManual ? colors.info : session.result?.simulated ? colors.warning : colors.accent}>
                {isManual ? 'IDENTIFIED BY YOU' : session.result?.simulated ? 'SIMULATED PREDICTION' : 'AI PREDICTION'}
              </Txt>
              {selectedMatch && !isManual && (
                <Txt variant="mono" color={colors.textMuted}>
                  {Math.round(selectedMatch.confidence * 100)}% · {BAND_COPY[confidenceBand(selectedMatch.confidence)]}
                </Txt>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <VehicleEmblem vehicle={vehicle} size={60} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="h2">{catalog.displayName(vehicle)}</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  {vehicle.generation}
                </Txt>
                <RarityBadge rarity={vehicle.rarity} size="sm" />
              </View>
            </View>
            {selectedMatch?.quality === 'model' && !isManual && (
              <Notice
                tone="warning"
                title="Generation uncertain"
                body="The model matched, but the photo did not confirm this generation. If it looks different, choose another vehicle."
              />
            )}
            {selectedMatch && !isManual && confidenceBand(selectedMatch.confidence) !== 'high' && (
              <Notice tone="warning" title="Not certain" body="Please double-check this identification or pick the correct vehicle." />
            )}
            <Txt variant="small" color={colors.textFaint}>
              VYNR identifies make, model and generation only. Trims and exact model years cannot be reliably determined from
              a photo and are never guessed.
            </Txt>
          </Panel>

          <VehicleFacts vehicle={vehicle} />

          {xpPreview && (
            <Panel style={styles.xpRow}>
              <Txt variant="bodyStrong">
                {priorEncounters.length === 0
                  ? 'First discovery'
                  : xpPreview.onCooldown
                    ? 'Logged recently'
                    : `Re-encounter #${priorEncounters.length + 1}`}
              </Txt>
              <Txt variant="h3" color={colors.accent}>
                +{xpPreview.amount} XP
              </Txt>
            </Panel>
          )}

          <Button label="Confirm & add to garage" icon="check" loading={saving} onPress={() => void confirm()} />
          <Button label="Not right? Choose another vehicle" variant="secondary" onPress={openPicker} disabled={saving} />
        </>
      )}

      {!vehicle && session.unknownLabel && (
        <Panel style={{ gap: space.sm }}>
          <Txt variant="label" color={colors.info}>
            FIELD NOTE · IDENTIFIED BY YOU
          </Txt>
          <Txt variant="h3">{session.unknownLabel}</Txt>
          <Txt variant="small" color={colors.textMuted}>
            Not in the catalog. Earns {GAME_CONFIG.unknownVehicleXp} XP (up to 5 field notes per day) and does not count
            toward collection completion.
          </Txt>
          <Button label="Log field note" icon="check" loading={saving} onPress={() => void confirm(session.unknownLabel!)} />
        </Panel>
      )}

      {!vehicle && !session?.unknownLabel && generationAmbiguous && (
        <Notice
          tone="warning"
          title="Which generation is it?"
          body={`The photo matched the ${catalog.displayName(topMatch!.vehicle)}, but not a specific generation. Choose the one you saw below, or pick another vehicle.`}
        />
      )}

      {(match.matches.length > 1 || (generationAmbiguous && !vehicle)) && (
        <>
          <SectionHeader title={!vehicle && generationAmbiguous ? 'Choose the generation' : 'Other possibilities'} />
          {match.matches
            .filter((m) => m.vehicle.id !== effectiveId)
            .map((m) => (
              <Panel
                key={m.vehicle.id}
                onPress={() => {
                  updateScanSession(session.id, { manualVehicleId: null, unknownLabel: null });
                  setSelectedId(m.vehicle.id);
                }}
                accessibilityLabel={`Select ${catalog.displayName(m.vehicle)} ${m.vehicle.generation}, ${Math.round(m.confidence * 100)} percent`}
                style={styles.alt}
              >
                <VehicleEmblem vehicle={m.vehicle} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{catalog.displayName(m.vehicle)}</Txt>
                  <Txt variant="small" color={colors.textMuted}>
                    {m.vehicle.generation}
                  </Txt>
                </View>
                <Txt variant="mono" color={colors.textMuted}>
                  {Math.round(m.confidence * 100)}%
                </Txt>
              </Panel>
            ))}
          {!vehicle && (
            <Button label="None of these? Choose from the catalog" variant="secondary" icon="search" onPress={openPicker} />
          )}
        </>
      )}

      {phase.kind === 'done' && match.unmatched.length > 0 && (
        <>
          <SectionHeader title="Not in the VYNR catalog yet" />
          {match.unmatched.slice(0, 2).map((u) => {
            const label = `${u.make} ${u.model}`;
            return (
              <Panel key={label} style={{ gap: space.sm }}>
                <Txt variant="bodyStrong">{label}</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  Prediction · {Math.round(u.confidence * 100)}% · not verified. Logging it as a field note earns{' '}
                  {GAME_CONFIG.unknownVehicleXp} XP and does not count toward collection completion.
                </Txt>
                <Button label="Log as field note" variant="secondary" compact disabled={saving} onPress={() => void confirm(label)} />
              </Panel>
            );
          })}
          {!vehicle && <Button label="Choose the correct vehicle from the catalog" icon="search" disabled={saving} onPress={openPicker} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  privacyBadge: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noPreview: { alignItems: 'center', justifyContent: 'center' },
  predHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
