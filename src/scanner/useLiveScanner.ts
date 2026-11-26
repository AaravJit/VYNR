import type { CameraView } from 'expo-camera';
import { type RefObject, useEffect, useRef, useState } from 'react';

import { catalog } from '@/catalog';
import { recognizeWithGates } from '@/recognition/gated';
import { type CatalogMatch, matchCandidates } from '@/recognition/matcher';
import type { PreparedImage, RecognitionResult } from '@/recognition/types';
import { deleteFileQuietly, measureFrame, prepareForRecognition, type RedactionSummary } from '@/services/imageService';
import { mlKitDetector } from '@/services/redaction';
import { appRecognitionGates } from '@/state/AppProvider';
import type { AppStore } from '@/state/appStore';

import { classifyRecognition } from './livePolicy';
import { type Frame, LiveScanController, type LiveScanView } from './liveScanner';
import { centreProposer, DetectorUnavailableError, mlKitObjectProposer, type ObjectProposer } from './objectDetector';
import { cropAround } from './tracking';

/** Everything the scanner screen needs to show a result and hand it to the identify screen. */
export interface LiveFind {
  result: RecognitionResult;
  image: PreparedImage;
  previewUri: string;
  redaction: RedactionSummary;
  matches: CatalogMatch[];
  /** 'identified' when one catalog vehicle is a strong answer; 'uncertain' when the player should choose or try another angle. */
  outcome: 'identified' | 'uncertain';
}

interface Live {
  store: AppStore;
  playerId: string | null;
}

const INITIAL_VIEW: LiveScanView<LiveFind> = {
  status: 'paused',
  hint: 'searching',
  target: null,
  notice: null,
  found: null,
  blockedReason: null,
  pausedBy: null,
  cloudCalls: 0,
  frameAspect: null,
};

interface Bridge {
  camera: CameraView | null;
  live: Live;
}

function createController(bridge: RefObject<Bridge>, onChange: (v: LiveScanView<LiveFind>) => void) {
  let proposer: ObjectProposer = mlKitObjectProposer();
  let detectorAvailable = true;
  return new LiveScanController<LiveFind>(
    {
      async capture(): Promise<Frame | null> {
        const cam = bridge.current.camera;
        if (!cam) return null;
        // Silent, small, no metadata: this frame is measured on the phone and usually deleted at once.
        const shot = await cam.takePictureAsync({ quality: 0.5, exif: false, base64: false, shutterSound: false });
        return shot ? { uri: shot.uri, width: shot.width, height: shot.height } : null;
      },
      async propose(frame) {
        try {
          return await proposer.propose(frame.uri, frame.width, frame.height);
        } catch (e) {
          if (!(e instanceof DetectorUnavailableError)) throw e;
          // No on-device detector (web preview, Expo Go): fall back to centre framing.
          proposer = centreProposer;
          detectorAvailable = false;
          return proposer.propose(frame.uri, frame.width, frame.height);
        }
      },
      measure: (frame) => measureFrame(frame.uri, frame.width, frame.height),
      async identify(frame, target, signal) {
        const { store, playerId } = bridge.current.live;
        if (!playerId) {
          deleteFileQuietly(frame.uri);
          return { kind: 'blocked', reason: 'not_ready' };
        }
        // Redact on the phone (fail closed), cropped to the chosen car when several objects are in view.
        const crop = detectorAvailable ? cropAround(target) : null;
        const prepared = await prepareForRecognition(frame.uri, frame.width, frame.height, mlKitDetector(), crop ?? undefined);
        let outcome;
        try {
          outcome = await recognizeWithGates(appRecognitionGates(store, playerId), prepared, prepared.redaction, signal);
        } catch {
          return { kind: 'outcome', outcome: 'error', payload: null };
        }
        if (outcome.kind === 'aborted') return { kind: 'outcome', outcome: 'error', payload: null };
        if (outcome.kind === 'manual') return { kind: 'blocked', reason: outcome.reason };
        const result = outcome.result;
        const matches = matchCandidates(catalog, result.candidates).matches;
        const classified = classifyRecognition(result, matches.length);
        if (classified !== 'identified' && classified !== 'uncertain')
          return { kind: 'outcome', outcome: classified, payload: null };
        return {
          kind: 'outcome',
          outcome: classified,
          payload: {
            result,
            image: { base64: prepared.base64, width: prepared.width, height: prepared.height },
            previewUri: prepared.previewUri,
            redaction: prepared.redaction,
            matches,
            outcome: classified,
          },
        };
      },
      discard: (frame) => deleteFileQuietly(frame.uri),
      now: () => Date.now(),
      schedule(fn, ms) {
        const t = setTimeout(fn, ms);
        return () => clearTimeout(t);
      },
    },
    onChange,
  );
}

/**
 * Wires the live scanning loop to the camera, ML Kit and the cloud. Sampling
 * runs only while `active` (scanner focused, app in the foreground, camera ready).
 */
export function useLiveScanner(camera: RefObject<CameraView | null>, active: boolean, live: Live) {
  // The controller runs outside React and reaches the camera, store and player through this ref.
  const bridge = useRef<Bridge>({ camera: null, live });
  const controller = useRef<LiveScanController<LiveFind> | null>(null);
  const [view, setView] = useState<LiveScanView<LiveFind>>(INITIAL_VIEW);

  useEffect(() => {
    bridge.current = { camera: camera.current, live };
  });
  useEffect(() => {
    const c = createController(bridge, setView);
    controller.current = c;
    return () => {
      c.stop();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    if (active) controller.current?.start();
    else controller.current?.stop();
  }, [active]);

  return {
    view,
    /** Dismisses a result or block and scans again; `newSession` also resets the per-session cap. */
    rescan: (newSession = false) => controller.current?.restart(newSession),
    /** Clears a result before leaving the scanner; scanning restarts when the scanner is next active. */
    dismiss: () => controller.current?.dismiss(),
  };
}
