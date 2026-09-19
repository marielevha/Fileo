import { Image, ImageStyle, StyleSheet } from 'react-native';

type BrandLogoProps = {
  compact?: boolean;
  size?: 'splash' | 'header';
  style?: ImageStyle;
};

const lockup = require('../../assets/images/fileo-logo-lockup.png');
const mark = require('../../assets/images/fileo-mark.png');

export function BrandLogo({ compact = false, size = 'header', style }: BrandLogoProps) {
  if (compact) {
    return <Image source={mark} style={[styles.mark, style]} resizeMode="contain" />;
  }

  return <Image source={lockup} style={[styles[size], style]} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  splash: {
    height: 82,
    width: 282,
  },
  header: {
    height: 58,
    width: 200,
  },
  mark: {
    height: 82,
    width: 82,
  },
});
