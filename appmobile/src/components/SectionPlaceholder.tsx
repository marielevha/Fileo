import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from './AppScreen';
import { AppText } from './AppText';
import { useAppTheme } from '../theme';

export function SectionPlaceholder({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const theme = useAppTheme();
  return (
    <AppScreen contentStyle={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon color={theme.colors.primary} size={28} />
      </View>
      <AppText variant="title2">{title}</AppText>
      <AppText color={theme.colors.textMuted} style={styles.copy}>Cette section est la prochaine étape du développement mobile.</AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { alignItems: 'center', borderRadius: 8, height: 56, justifyContent: 'center', marginBottom: 16, width: 56 },
  copy: { marginTop: 8, maxWidth: 280, textAlign: 'center' },
});
