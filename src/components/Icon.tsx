import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** Original VYNR line-icon set, drawn on a 24×24 grid with 1.75px strokes. */
export type IconName =
  | 'home'
  | 'garage'
  | 'contracts'
  | 'profile'
  | 'scan'
  | 'close'
  | 'chevron-right'
  | 'chevron-left'
  | 'search'
  | 'check'
  | 'lock'
  | 'bolt'
  | 'alert'
  | 'refresh'
  | 'edit'
  | 'shield'
  | 'download'
  | 'trash'
  | 'flip'
  | 'flash';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.75 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'home' && (
        <>
          <Path d="M4 11.5 12 5l8 6.5" {...p} />
          <Path d="M6.5 10v9h11v-9" {...p} />
          <Path d="M10.5 19v-4.5h3V19" {...p} />
        </>
      )}
      {name === 'garage' && (
        <>
          <Path d="M3.5 9.5 12 5l8.5 4.5V19h-17V9.5Z" {...p} />
          <Path d="M7 19v-6.5h10V19" {...p} />
          <Path d="M7 15.5h10" {...p} />
        </>
      )}
      {name === 'contracts' && (
        <>
          <Rect x={5} y={4} width={14} height={16} rx={2} {...p} />
          <Path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" {...p} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={9} r={3.5} {...p} />
          <Path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8" {...p} />
        </>
      )}
      {name === 'scan' && (
        <>
          <Path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" {...p} />
          <Circle cx={12} cy={12} r={3} {...p} />
        </>
      )}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...p} />}
      {name === 'chevron-right' && <Path d="m10 6 6 6-6 6" {...p} />}
      {name === 'chevron-left' && <Path d="m14 6-6 6 6 6" {...p} />}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6} {...p} />
          <Path d="m15.5 15.5 4 4" {...p} />
        </>
      )}
      {name === 'check' && <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />}
      {name === 'lock' && (
        <>
          <Rect x={5.5} y={10.5} width={13} height={9} rx={2} {...p} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...p} />
        </>
      )}
      {name === 'bolt' && <Path d="M13 3.5 6 13.5h5.5L10.5 20.5 18 10.5h-5.5L13 3.5Z" {...p} />}
      {name === 'alert' && (
        <>
          <Path d="M12 4 3.5 19h17L12 4Z" {...p} />
          <Path d="M12 10v4" {...p} />
          <Circle cx={12} cy={16.6} r={0.6} {...p} />
        </>
      )}
      {name === 'refresh' && (
        <>
          <Path d="M19 12a7 7 0 1 1-2.05-4.95" {...p} />
          <Path d="M19 4.5V8h-3.5" {...p} />
        </>
      )}
      {name === 'edit' && <Path d="M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16 5 19Z" {...p} />}
      {name === 'shield' && <Path d="M12 3.5 5 6.5v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9v-5l-7-3Z" {...p} />}
      {name === 'download' && (
        <>
          <Path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" {...p} />
          <Path d="M5 19.5h14" {...p} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" {...p} />
        </>
      )}
      {name === 'flip' && (
        <>
          <Path d="M4 9.5A8 8 0 0 1 18.5 7M20 14.5A8 8 0 0 1 5.5 17" {...p} />
          <Path d="M18.5 3.5V7H15M5.5 20.5V17H9" {...p} />
        </>
      )}
      {name === 'flash' && <Path d="M12.5 3 7 13h4.5L11 21l6-10.5h-4.5L12.5 3Z" {...p} />}
    </Svg>
  );
}
