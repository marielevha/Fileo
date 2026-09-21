import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { palette, useAppTheme } from '../theme';
import { AppText } from './AppText';

type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
  size?: 'small' | 'medium' | 'large';
};

const sizes = {
  small: { mark: 36, icon: 23, wordmark: 20 },
  medium: { mark: 48, icon: 30, wordmark: 27 },
  large: { mark: 72, icon: 45, wordmark: 40 },
} as const;

function NeedleMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M20.6 5.9C15.8 4.8 11.7 7.2 12 10.8c.3 3.4 4.7 3.6 5.7 6.4.7 2-.7 3.9-2.5 4.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      <Ellipse
        cx={22.6}
        cy={8}
        rx={2.1}
        ry={2.9}
        rotation={37}
        origin="22.6, 8"
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M21 10.7 10.4 25"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10.4 25 7.5 28.7 10 26.2Z" fill={color} />
    </Svg>
  );
}

export function BrandLogo({ compact = false, inverse = false, size = 'medium' }: BrandLogoProps) {
  const theme = useAppTheme();
  const dimensions = sizes[size];

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel="Filéo">
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.mark,
          {
            width: dimensions.mark,
            height: dimensions.mark,
            borderRadius: dimensions.mark * 0.26,
          },
        ]}
      >
        <NeedleMark size={dimensions.icon} color={inverse ? palette.white : theme.colors.onPrimary} />
      </LinearGradient>

      {compact ? null : (
        <View style={styles.wordmark}>
          <AppText
            color={inverse ? palette.white : undefined}
            style={{ fontFamily: theme.fontFamilies.displayBold, fontSize: dimensions.wordmark, lineHeight: Math.ceil(dimensions.wordmark * 1.25) }}
          >
            Fil
          </AppText>
          <AppText
            color={theme.colors.secondary}
            style={{ fontFamily: theme.fontFamilies.displayBold, fontSize: dimensions.wordmark, lineHeight: Math.ceil(dimensions.wordmark * 1.25) }}
          >
            éo
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
});
