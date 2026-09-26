import { useFocusEffect } from 'expo-router';
import { Copy, Plus, Share2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Switch, TextInput, View } from 'react-native';

import { getAffiliateOverview, joinAffiliateProgram, type AffiliateOverview } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { MorePage } from '../../../src/features/more/ui';
import { useSyncOverview } from '../../../src/sync/overview';
import { palette, useAppTheme } from '../../../src/theme';

export default function AffiliateScreen() {
  const theme = useAppTheme();
  const sync = useSyncOverview();
  const [data, setData] = useState<AffiliateOverview | null>(null);
  const [code, setCode] = useState('');
  const [autoCode, setAutoCode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAffiliateOverview((cached) => {
        setData(cached);
        setLoading(false);
      }));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function join() {
    if (sync.connection === 'offline' || sync.connection === 'error') {
      setError('Connexion requise pour creer le code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await joinAffiliateProgram({ code: code.trim() || undefined, autoGenerate: autoCode });
      setData(result.overview);
      setCode('');
      Alert.alert('Code affilie cree');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Creation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!data?.profile) return;
    await Share.share({ message: `Utilise mon code affilie Fileo : ${data.profile.code}` });
  }

  return (
    <MorePage error={error} loading={loading} title="Affiliation">
      {!data?.profile ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <AppText variant="title3">{data?.settings?.public_title ?? 'Rejoindre le programme'}</AppText>
          <AppText color={theme.colors.textMuted} variant="caption">
            {data?.settings?.public_description ?? 'Creez votre code et recommandez Fileo aux ateliers.'}
          </AppText>
          {data?.settings?.enabled === false ? (
            <View style={[styles.notice, { backgroundColor: theme.colors.warningSoft }]}>
              <AppText color={theme.colors.warning} variant="caption">
                Le programme est temporairement ferme aux nouvelles inscriptions.
              </AppText>
            </View>
          ) : null}

          <View style={styles.optionRow}>
            <AppText variant="label">Generer automatiquement</AppText>
            <Switch onValueChange={setAutoCode} value={autoCode} />
          </View>

          <TextInput
            autoCapitalize="characters"
            editable={!autoCode}
            onChangeText={(value) => setCode(cleanCode(value))}
            placeholder={autoCode ? 'Fileo choisira un code unique' : 'Code souhaite'}
            placeholderTextColor={theme.colors.textSubtle}
            selectionColor={theme.colors.primary}
            style={[
              styles.input,
              autoCode && styles.inputDisabled,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border, color: theme.colors.text },
            ]}
            value={code}
          />
          <AppText color={theme.colors.textMuted} variant="caption">Majuscules, chiffres, - et _ uniquement.</AppText>
          {sync.connection === 'offline' || sync.connection === 'error' ? (
            <View style={[styles.notice, { backgroundColor: theme.colors.warningSoft }]}>
              <AppText color={theme.colors.warning} variant="caption">
                Connectez-vous pour creer un code unique.
              </AppText>
            </View>
          ) : null}

          <Pressable disabled={busy || data?.settings?.enabled === false || sync.connection === 'offline' || sync.connection === 'error'} onPress={join} style={[styles.primary, (busy || data?.settings?.enabled === false || sync.connection === 'offline' || sync.connection === 'error') && styles.disabled]}>
            {busy ? <ActivityIndicator color={palette.white} /> : (
              <>
                <Plus color={palette.white} size={18} />
                <AppText color={palette.white} variant="label">Creer mon code</AppText>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.stack}>
          <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
            <AppText color={theme.colors.primary} variant="caption">Votre code affilie</AppText>
            <AppText color={theme.colors.primary} style={styles.code} variant="title1">{data.profile.code}</AppText>
            <View style={styles.heroActions}>
              <Pressable onPress={() => Alert.alert('Code affilie', data.profile!.code)} style={[styles.secondary, { borderColor: theme.colors.primary }]}>
                <Copy color={theme.colors.primary} size={17} />
                <AppText color={theme.colors.primary} variant="label">Voir</AppText>
              </Pressable>
              <Pressable onPress={() => void share()} style={[styles.secondary, { borderColor: theme.colors.primary }]}>
                <Share2 color={theme.colors.primary} size={17} />
                <AppText color={theme.colors.primary} variant="label">Partager</AppText>
              </Pressable>
            </View>
          </View>

          <View style={styles.grid}>
            {data.totals.length ? data.totals.map((total) => (
              <View key={total.currency} style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <AppText color={theme.colors.textMuted} variant="caption">{total.currency}</AppText>
                <AppText variant="title3">{total.pending.toLocaleString('fr-FR')}</AppText>
                <AppText color={theme.colors.textMuted} variant="caption">en attente - {total.paid.toLocaleString('fr-FR')} paye</AppText>
              </View>
            )) : <AppText color={theme.colors.textMuted} variant="caption">Aucune commission pour le moment.</AppText>}
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <AppText variant="title3">Ateliers apportes</AppText>
            {data.attributions.length ? data.attributions.map((item) => (
              <View key={item.id} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                <AppText style={{ flex: 1 }} variant="label">{item.workshop_name ?? 'Atelier'}</AppText>
                <AppText color={theme.colors.textMuted} variant="caption">{new Date(item.attributed_at).toLocaleDateString('fr-FR')}</AppText>
              </View>
            )) : <AppText color={theme.colors.textMuted} variant="caption">Aucun atelier recommande pour l&apos;instant.</AppText>}
          </View>
        </View>
      )}
    </MorePage>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: { borderRadius: 8, borderWidth: 1, gap: 12, padding: 14 },
  optionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 38 },
  notice: { borderRadius: 8, padding: 10 },
  input: { borderRadius: 8, borderWidth: 1, fontFamily: 'Inter_500Medium', fontSize: 15, minHeight: 50, paddingHorizontal: 12 },
  inputDisabled: { opacity: .65 },
  primary: { alignItems: 'center', backgroundColor: palette.violet700, borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50 },
  disabled: { opacity: .55 },
  hero: { borderRadius: 8, gap: 8, padding: 16 },
  code: { letterSpacing: 0 },
  heroActions: { flexDirection: 'row', gap: 8 },
  secondary: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 12 },
  grid: { gap: 10 },
  stat: { borderRadius: 8, borderWidth: 1, padding: 12 },
  row: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 46 },
});

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}
