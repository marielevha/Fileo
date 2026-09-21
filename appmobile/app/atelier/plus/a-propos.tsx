import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Mail } from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../../src/components/AppText';
import { BrandLogo } from '../../../src/components/BrandLogo';
import { useAppTheme } from '../../../src/theme';

export default function AboutScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.back, { borderColor: theme.colors.border }]}>
            <ArrowLeft color={theme.colors.text} size={20} />
          </Pressable>
          <AppText variant="title2">À propos</AppText>
        </View>

        <View style={styles.intro}>
          <BrandLogo size="medium" />
          <AppText style={styles.tagline} variant="title3">Votre atelier, bien organisé.</AppText>
          <AppText color={theme.colors.textMuted} style={styles.description}>
            Filéo accompagne les ateliers de couture dans le suivi de leur travail quotidien.
          </AppText>
        </View>

        <View style={[styles.story, { borderTopColor: theme.colors.border }]}>
          <View style={styles.storySection}>
            <AppText variant="title3">Garder le fil de chaque commande</AppText>
            <AppText color={theme.colors.textMuted}>
              Une commande relie un client, des mensurations, des articles, des dates et des paiements. Filéo rassemble ces informations pour retrouver ce qui a été convenu et voir ce qu’il reste à faire.
            </AppText>
          </View>
          <View style={styles.storySection}>
            <AppText variant="title3">Avancer ensemble</AppText>
            <AppText color={theme.colors.textMuted}>
              Le planning rend les échéances visibles pour l’équipe. Les accès financiers restent réservés aux personnes autorisées, pendant que chacun suit le travail qui lui revient.
            </AppText>
          </View>
        </View>

        <View style={styles.information}>
          <AppText color={theme.colors.textSubtle} style={styles.sectionLabel} variant="caption">INFORMATIONS</AppText>
          <View style={[styles.infoRow, { borderBottomColor: theme.colors.border }]}>
            <AppText color={theme.colors.textMuted} variant="label">Version</AppText>
            <AppText variant="label">{Constants.expoConfig?.version ?? 'Non disponible'}</AppText>
          </View>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('mailto:support@fileo.app')} style={styles.contactRow}>
            <Mail color={theme.colors.primary} size={19} />
            <View style={styles.contactCopy}><AppText variant="label">Contacter Filéo</AppText><AppText color={theme.colors.textMuted} variant="caption">support@fileo.app</AppText></View>
            <ChevronRight color={theme.colors.textSubtle} size={18} />
          </Pressable>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <AppText color={theme.colors.textSubtle} variant="caption">Propulsé par </AppText>
          <AppText color={theme.colors.textMuted} variant="label">NZELOBI</AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', flexGrow: 1, maxWidth: 640, paddingBottom: 24, paddingHorizontal: 20, paddingTop: 20, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  back: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  intro: { alignItems: 'flex-start', gap: 12, paddingBottom: 28, paddingTop: 30 },
  tagline: { marginTop: 8 },
  description: { maxWidth: 360 },
  story: { borderTopWidth: 1, gap: 24, paddingTop: 26 },
  storySection: { gap: 9 },
  information: { gap: 0, marginTop: 30 },
  sectionLabel: { paddingBottom: 10 },
  infoRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  contactRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 72 },
  contactCopy: { flex: 1, gap: 3, minWidth: 0 },
  footer: { alignItems: 'baseline', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'center', marginTop: 'auto', paddingTop: 18 },
});
