import { PropsWithChildren } from 'react';
import { StyleSheet, Text as NativeText, TextStyle } from 'react-native';

import { colors } from '@/src/theme/colors';

type TextProps = PropsWithChildren<{
  style?: TextStyle | TextStyle[];
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'metric';
}>;

export function Text({ children, style, variant = 'body' }: TextProps) {
  return <NativeText style={[styles.base, styles[variant], style]}>{children}</NativeText>;
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
  title: {
    color: colors.textStrong,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textStrong,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  metric: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
