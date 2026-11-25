/** A detected object's box in normalised frame coordinates (0..1). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function area(b: Box): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

/** 1 at the frame centre, falling to 0 at a corner. */
export function centrality(b: Box): number {
  const cx = b.x + b.width / 2 - 0.5;
  const cy = b.y + b.height / 2 - 0.5;
  return Math.max(0, 1 - Math.hypot(cx, cy) / Math.SQRT1_2);
}

/**
 * Picks the vehicle the player is most likely aiming at when several are in
 * view: large and central wins. The previous target is kept while it still
 * overlaps (IoU ≥ 0.3), so the selection does not flicker between two cars.
 */
export function selectTarget(boxes: Box[], previous: Box | null): Box | null {
  if (boxes.length === 0) return null;
  if (previous) {
    let best: Box | null = null;
    let bestIou = 0.3;
    for (const b of boxes) {
      const o = iou(b, previous);
      if (o >= bestIou) {
        best = b;
        bestIou = o;
      }
    }
    if (best) return best;
  }
  let pick = boxes[0]!;
  let score = -1;
  for (const b of boxes) {
    const s = area(b) * (0.4 + 0.6 * centrality(b));
    if (s > score) {
      score = s;
      pick = b;
    }
  }
  return pick;
}

export function clampBox(b: Box): Box {
  const x = Math.min(1, Math.max(0, b.x));
  const y = Math.min(1, Math.max(0, b.y));
  return { x, y, width: Math.min(1 - x, Math.max(0, b.width)), height: Math.min(1 - y, Math.max(0, b.height)) };
}
