import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/src/theme/colors';

type OnboardingIllustrationProps = {
  kind: 'orders' | 'planning' | 'payments';
};

const ink = colors.background;
const soft = '#f3e9fb';

export function OnboardingIllustration({ kind }: OnboardingIllustrationProps) {
  if (kind === 'planning') return <PlanningIllustration />;
  if (kind === 'payments') return <PaymentsIllustration />;
  return <OrdersIllustration />;
}

function OrdersIllustration() {
  return (
    <Svg viewBox="0 0 360 320" width="100%" height="100%">
      <Ellipse cx="176" cy="162" rx="138" ry="96" fill={soft} />
      <Path d="M70 234 C114 206 176 218 220 246" fill="none" stroke={colors.cyan} strokeWidth="8" strokeLinecap="round" />
      <Path d="M226 224 C252 194 286 190 312 224" fill="none" stroke={colors.accent} strokeWidth="8" strokeLinecap="round" />

      <G transform="translate(82 122) rotate(-10)">
        <Rect x="0" y="0" width="106" height="76" rx="16" fill="#fff" stroke={ink} strokeWidth="8" />
        <Path d="M22 24 H82" stroke={colors.accent} strokeWidth="6" strokeLinecap="round" />
        <Path d="M22 43 H70" stroke={colors.cyan} strokeWidth="6" strokeLinecap="round" />
        <Path d="M22 60 H88" stroke="#8279bd" strokeWidth="5" strokeLinecap="round" />
      </G>

      <G transform="translate(188 58)">
        <Path d="M46 44 C24 8 -30 16 -28 62 C-26 96 6 100 34 84 C54 73 58 55 46 44Z" fill={ink} />
        <Circle cx="18" cy="72" r="28" fill="#fff7fb" stroke={ink} strokeWidth="7" />
        <Path d="M4 72 h1 M29 72 h1" stroke={ink} strokeWidth="7" strokeLinecap="round" />
        <Path d="M8 86 C18 94 29 92 36 84" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />

        <Path d="M-28 118 C6 78 72 84 96 128 C76 166 8 172 -28 118Z" fill={colors.accent} stroke={ink} strokeWidth="8" strokeLinejoin="round" />
        <Path d="M-26 118 C-74 90 -92 112 -118 140" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" />
        <Path d="M92 122 C130 84 154 102 174 132" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" />
        <Path d="M-8 168 L-42 236" fill="none" stroke={ink} strokeWidth="11" strokeLinecap="round" />
        <Path d="M56 168 L104 236" fill="none" stroke={ink} strokeWidth="11" strokeLinecap="round" />
        <Path d="M-42 236 C-60 240 -72 236 -84 226" fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" />
        <Path d="M104 236 C124 240 138 236 148 224" fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" />
      </G>

      <Path d="M271 72 C288 86 294 104 288 126" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <Path d="M300 76 C320 100 322 127 307 151" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <Path d="M52 116 C35 136 31 160 42 184" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function PlanningIllustration() {
  return (
    <Svg viewBox="0 0 360 320" width="100%" height="100%">
      <Ellipse cx="184" cy="164" rx="132" ry="104" fill={soft} />
      <Path d="M76 234 C116 202 170 210 206 248" fill="none" stroke={colors.accent} strokeWidth="8" strokeLinecap="round" />

      <G transform="translate(76 102)">
        <Rect x="0" y="0" width="230" height="160" rx="25" fill="#fff" stroke={ink} strokeWidth="8" />
        <Path d="M0 28 C8 4 24 0 48 0 H182 C208 0 226 6 230 30 V48 H0Z" fill={colors.accent} />
        <Path d="M56 -22 V30 M174 -22 V30" stroke={ink} strokeWidth="7" strokeLinecap="round" />
        {[42, 105, 168].map((x) => (
          <G key={x}>
            <Circle cx={x} cy={82} r="16" fill="#fff" stroke={ink} strokeWidth="6" />
            <Circle cx={x} cy={128} r="16" fill="#fff" stroke={ink} strokeWidth="6" />
          </G>
        ))}
        <Circle cx="168" cy="128" r="17" fill={colors.cyan} stroke={ink} strokeWidth="5" />
      </G>

      <G transform="translate(166 50)">
        <Path d="M42 42 C20 8 -30 16 -28 60 C-26 88 2 94 28 82 C50 72 56 54 42 42Z" fill={ink} />
        <Circle cx="14" cy="70" r="26" fill="#fff7fb" stroke={ink} strokeWidth="7" />
        <Path d="M3 70 h1 M26 70 h1" stroke={ink} strokeWidth="7" strokeLinecap="round" />
      </G>

      <Path d="M242 224 L326 174 L350 220" fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M304 266 C336 246 350 222 346 194" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <Path d="M44 164 C34 142 36 122 51 104" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function PaymentsIllustration() {
  return (
    <Svg viewBox="0 0 360 320" width="100%" height="100%">
      <Ellipse cx="182" cy="162" rx="130" ry="104" fill={soft} />
      <Path d="M236 236 C266 206 306 208 334 238" fill="none" stroke={colors.cyan} strokeWidth="8" strokeLinecap="round" />

      <G transform="translate(154 78)">
        <Rect x="0" y="0" width="104" height="178" rx="26" fill="#fff" stroke={ink} strokeWidth="8" />
        <Rect x="19" y="36" width="66" height="58" rx="16" fill={colors.cyan} />
        <Path d="M30 66 H74" stroke={ink} strokeWidth="7" strokeLinecap="round" />
        <Path d="M24 122 H82" stroke={colors.accent} strokeWidth="6" strokeLinecap="round" />
        <Path d="M31 146 H73" stroke="#8279bd" strokeWidth="5" strokeLinecap="round" />
      </G>

      <G transform="translate(76 138)">
        <Circle cx="38" cy="38" r="34" fill="#eadff7" stroke={ink} strokeWidth="8" />
        <Path d="M38 20 V56 M20 38 H56" stroke={colors.accent} strokeWidth="8" strokeLinecap="round" />
      </G>

      <G transform="translate(256 64)">
        <Circle cx="18" cy="50" r="25" fill="#fff7fb" stroke={ink} strokeWidth="7" />
        <Path d="M-16 128 C10 96 54 98 72 136" fill={colors.accent} stroke={ink} strokeWidth="8" strokeLinejoin="round" />
        <Path d="M56 104 L104 66" stroke={ink} strokeWidth="10" strokeLinecap="round" />
        <Rect x="94" y="25" width="54" height="72" rx="12" fill="#fff" stroke={ink} strokeWidth="7" transform="rotate(14 121 61)" />
        <Path d="M-4 118 L-54 158" stroke={ink} strokeWidth="10" strokeLinecap="round" />
      </G>

      <Path d="M300 160 H344 M322 138 V182" stroke={ink} strokeWidth="9" strokeLinecap="round" />
      <Path d="M44 236 C90 202 130 210 160 242" fill="none" stroke={colors.accent} strokeWidth="8" strokeLinecap="round" />
    </Svg>
  );
}
