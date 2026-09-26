import { useFocusEffect, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAttachmentSyncHistory, getPaymentSyncHistory, getSyncHistory, runSyncCycle } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { resolveClientConflict, resolveItemConflict, resolveOrderConflict, type AttachmentEntry, type OutboxEntry, type PaymentEntry } from '../../../src/offline/store';
import { palette, useAppTheme } from '../../../src/theme';

const actionLabels = { create: 'Création', update: 'Modification', archive: 'Archivage', delete: 'Suppression', cancel: 'Annulation', resolve: 'Résolution' } as const;
const statusLabels = { pending: 'En attente', applied: 'Synchronisée', conflict: 'Conflit', rejected: 'Refusée', blocked: 'Bloquée', superseded: 'Remplacée' } as const;

export default function SynchronisationScreen() {
  const router = useRouter(); const theme = useAppTheme();
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setEntries((await getSyncHistory()).reverse()); setPayments((await getPaymentSyncHistory()).reverse()); setAttachments((await getAttachmentSyncHistory()).reverse()); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Historique indisponible.'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function retry() {
    setBusy(true); setError(null);
    try { await runSyncCycle(); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Synchronisation impossible.'); }
    finally { setBusy(false); }
  }

  async function resolve(entry: OutboxEntry, choice: 'server' | 'local') {
    setBusy(true); setError(null);
    try { if (entry.operation.entityKind === 'client') await resolveClientConflict(entry.operation.operationId, choice);
      else if (entry.operation.entityKind === 'order') await resolveOrderConflict(entry.operation.operationId, choice);
      else await resolveItemConflict(entry.operation.operationId, choice); await retry(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Résolution impossible.'); }
    finally { setBusy(false); await load(); }
  }

  const pending = entries.filter((entry) => entry.status === 'pending').length + payments.filter((entry) => entry.status === 'pending').length + attachments.filter((entry) => entry.status === 'pending').length;
  const problems = entries.filter((entry) => ['conflict', 'rejected', 'blocked'].includes(entry.status)).length + payments.filter((entry) => entry.status === 'rejected').length + attachments.filter((entry) => entry.status === 'rejected').length;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.back, { borderColor: theme.colors.border }]}><ArrowLeft color={theme.colors.text} size={20} /></Pressable>
        <View style={styles.heading}><AppText variant="title2">Synchronisation</AppText><AppText color={theme.colors.textMuted} variant="caption">Historique des modifications sur cet appareil</AppText></View>
      </View>
      <View style={[styles.summary, { borderColor: theme.colors.border }]}>
        <View style={styles.metric}><Clock3 color={theme.colors.primary} size={20} /><AppText variant="title3">{pending}</AppText><AppText color={theme.colors.textMuted} variant="caption">en attente</AppText></View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.metric}><ShieldAlert color={problems ? theme.colors.secondary : theme.colors.textMuted} size={20} /><AppText variant="title3">{problems}</AppText><AppText color={theme.colors.textMuted} variant="caption">à examiner</AppText></View>
      </View>
      <Pressable disabled={busy} onPress={() => void retry()} style={[styles.retry, { backgroundColor: theme.colors.primary }]}>
        {busy ? <ActivityIndicator color={palette.white} /> : <RefreshCw color={palette.white} size={18} />}
        <AppText color={palette.white} variant="label">Synchroniser maintenant</AppText>
      </Pressable>
      {error ? <AppText color={theme.colors.secondary} variant="caption">{error}</AppText> : null}
      <AppText variant="title3">Journal des opérations</AppText>
      {entries.length === 0 && payments.length === 0 && attachments.length === 0 ? <AppText color={theme.colors.textMuted}>Aucune modification locale à synchroniser.</AppText> : null}
      {attachments.map((entry) => <View key={entry.id} style={[styles.entry, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.entryTop}><Clock3 color={entry.status === 'rejected' ? theme.colors.secondary : theme.colors.primary} size={18} /><AppText numberOfLines={1} style={styles.entryTitle} variant="label">Fichier · {entry.name}</AppText><AppText color={entry.status === 'rejected' ? theme.colors.secondary : theme.colors.textMuted} variant="caption">{entry.status === 'pending' ? 'En attente' : entry.status === 'applied' ? 'Envoyé' : 'Refusé'}</AppText></View>
        <AppText color={theme.colors.textMuted} variant="caption">{new Date(entry.createdAt).toLocaleString('fr-FR')}</AppText>
        {entry.message ? <AppText color={theme.colors.secondary} variant="caption">{entry.message}</AppText> : null}
      </View>)}
      {payments.map((entry) => <View key={entry.idempotencyKey} style={[styles.entry, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.entryTop}><Clock3 color={entry.status === 'rejected' ? theme.colors.secondary : theme.colors.primary} size={18} /><AppText style={styles.entryTitle} variant="label">Encaissement · {entry.payload.amount.toLocaleString('fr-FR')} {entry.payload.currency ?? ''}</AppText><AppText color={entry.status === 'rejected' ? theme.colors.secondary : theme.colors.textMuted} variant="caption">{entry.status === 'pending' ? 'Provisoire' : entry.status === 'applied' ? 'Confirmé' : 'Refusé'}</AppText></View>
        <AppText color={theme.colors.textMuted} variant="caption">{new Date(entry.createdAt).toLocaleString('fr-FR')}</AppText>
        {entry.message ? <AppText color={theme.colors.secondary} variant="caption">{entry.message}</AppText> : null}
      </View>)}
      {entries.map((entry) => {
        const problem = ['conflict', 'rejected', 'blocked'].includes(entry.status);
        const Icon = problem ? AlertCircle : entry.status === 'applied' ? CheckCircle2 : Clock3;
        const serverClient = entry.operation.entityKind === 'client' ? entry.receipt?.server as { deleted_at?: string | null } | undefined : null;
        const canKeepLocal = entry.operation.entityKind === 'order_item' ? Boolean(entry.receipt?.server)
          : entry.operation.entityKind === 'order' ? Boolean(entry.receipt?.server && !(entry.receipt.server as { cancelled_at?: string | null }).cancelled_at)
          : Boolean(serverClient && !serverClient.deleted_at && entry.operation.action !== 'create');
        return <View key={entry.operation.operationId} style={[styles.entry, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.entryTop}><Icon color={problem ? theme.colors.secondary : theme.colors.primary} size={18} /><AppText style={styles.entryTitle} variant="label">{actionLabels[entry.operation.action]} {entry.operation.entityKind === 'client' ? 'client' : entry.operation.entityKind === 'measurement' ? 'mensuration' : entry.operation.entityKind === 'order' ? 'commande' : 'article'}</AppText><AppText color={problem ? theme.colors.secondary : theme.colors.textMuted} variant="caption">{statusLabels[entry.status]}</AppText></View>
          <AppText color={theme.colors.textMuted} variant="caption">{new Date(entry.operation.clientCreatedAt).toLocaleString('fr-FR')}</AppText>
          {entry.receipt?.message ? <AppText color={theme.colors.textMuted} variant="caption">{entry.receipt.message}</AppText> : null}
          {entry.status === 'conflict' && entry.operation.entityKind !== 'measurement' ? <View style={styles.actions}>
            <Pressable disabled={busy} onPress={() => Alert.alert('Conserver la version du serveur ?', 'Les modifications locales resteront dans le journal, mais ne seront pas appliquées.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Conserver', onPress: () => void resolve(entry, 'server') }])} style={[styles.action, { borderColor: theme.colors.border }]}><AppText variant="caption">Version serveur</AppText></Pressable>
            {canKeepLocal ? <Pressable disabled={busy} onPress={() => Alert.alert('Réappliquer la version locale ?', 'La fiche actuelle du serveur sera remplacée par votre dernière version locale. Cette décision sera historisée.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Réappliquer', onPress: () => void resolve(entry, 'local') }])} style={[styles.action, { borderColor: theme.colors.primary }]}><AppText color={theme.colors.primary} variant="caption">Version locale</AppText></Pressable> : null}
          </View> : null}
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { gap: 15, padding: 18, paddingBottom: 32 }, header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 7 }, back: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, heading: { flex: 1 }, summary: { alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', paddingVertical: 16 }, metric: { alignItems: 'center', flex: 1, gap: 4 }, divider: { height: 54, width: 1 }, retry: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 48 }, entry: { borderRadius: 8, borderWidth: 1, gap: 7, padding: 14 }, entryTop: { alignItems: 'center', flexDirection: 'row', gap: 8 }, entryTitle: { flex: 1 }, actions: { flexDirection: 'row', gap: 8, marginTop: 8 }, action: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 5 } });
