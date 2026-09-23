import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { ChevronRight, Ruler, Shapes } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../../src/components/AppText';
import { MorePage } from '../../../../src/features/more/ui';
import { useAppTheme } from '../../../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <MorePage title="Paramètres">
      <View style={styles.stack}>
        <SettingsRow
          detail="Types d'articles et mensurations proposées"
          icon={Shapes}
          label="Modèles"
          onPress={() => router.push('/atelier/plus/parametres/modeles' as Href)}
        />
        <SettingsRow
          detail="Unités disponibles dans les commandes"
          icon={Ruler}
          label="Unités de mesure"
          onPress={() => router.push('/atelier/plus/parametres/unites' as Href)}
        />
      </View>
    </MorePage>
  );
}

function SettingsRow({ icon: Icon, label, detail, onPress }: { icon: typeof Shapes; label: string; detail: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}><Icon color={theme.colors.primary} size={21} /></View>
      <View style={styles.copy}>
        <AppText variant="label">{label}</AppText>
        <AppText color={theme.colors.textMuted} variant="caption">{detail}</AppText>
      </View>
      <ChevronRight color={theme.colors.textSubtle} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10, marginTop: 8 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 72, padding: 12 },
  icon: { alignItems: 'center', borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  copy: { flex: 1, gap: 3, minWidth: 0 },
});
