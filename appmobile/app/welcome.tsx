import { StyleSheet, View } from 'react-native';

import { AppScreen } from '../src/components/AppScreen';
import { AppText } from '../src/components/AppText';
import { BrandLogo } from '../src/components/BrandLogo';
import { useAppTheme } from '../src/theme';

export default function WelcomeScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <View style={[styles.accentTop, { backgroundColor: theme.colors.secondary }]} />
      <View style={[styles.accentSide, { backgroundColor: theme.colors.accent }]} />

      <View style={[styles.header, { paddingHorizontal: theme.spacing[6] }]}>
        <BrandLogo size="small" />
      </View>

      <View style={[styles.main, { paddingHorizontal: theme.spacing[8] }]}>
        <BrandLogo compact size="large" />
        <AppText variant="display" style={styles.title}>
          Votre atelier,{`\n`}
          <AppText variant="display" color={theme.colors.primary}>
            bien organisé.
          </AppText>
        </AppText>
        <AppText color={theme.colors.textMuted} style={styles.subtitle}>
          La gestion pensée pour celles et ceux qui créent.
        </AppText>
      </View>

      <View style={[styles.footer, { paddingHorizontal: theme.spacing[6] }]}>
        <View style={[styles.thread, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.thread, styles.threadShort, { backgroundColor: theme.colors.secondary }]} />
        <View style={[styles.thread, styles.threadTiny, { backgroundColor: theme.colors.accent }]} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accentTop: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: '38%',
    top: 0,
  },
  accentSide: {
    height: 4,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '38%',
  },
  header: {
    alignItems: 'flex-start',
    height: 88,
    justifyContent: 'center',
  },
  main: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    marginTop: -44,
    maxWidth: 560,
    width: '100%',
  },
  title: {
    marginTop: 28,
    maxWidth: 480,
  },
  subtitle: {
    marginTop: 16,
    maxWidth: 340,
  },
  footer: {
    alignItems: 'flex-end',
    gap: 6,
    height: 72,
    justifyContent: 'center',
  },
  thread: {
    borderRadius: 999,
    height: 3,
    width: 88,
  },
  threadShort: {
    width: 56,
  },
  threadTiny: {
    width: 32,
  },
});
