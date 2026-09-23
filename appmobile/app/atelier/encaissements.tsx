import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Banknote, ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listReceivableOrders, type ReceivableOrderPage } from '../../src/api/client';
import { AppText } from '../../src/components/AppText';
import { useAppTheme } from '../../src/theme';
import { formatMoney } from '../../src/features/orders/orderUi';

export default function ReceivableOrdersScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReceivableOrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => setPage(1), [search]);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setResult(await listReceivableOrders({ page, q: search })); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de charger les commandes.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [page, search]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>
    <FlatList
      data={result?.items ?? []}
      keyExtractor={(item) => item.order.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} />}
      ListHeaderComponent={<View style={styles.headerBlock}>
        <View style={styles.heading}><Pressable accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.back, { borderColor: theme.colors.border }]}><ArrowLeft color={theme.colors.text} size={20} /></Pressable><View style={styles.title}><AppText variant="title2">Encaisser</AppText><AppText color={theme.colors.textMuted} variant="caption">Choisir une commande avec un reste à payer</AppText></View></View>
        <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Search color={theme.colors.textSubtle} size={18} /><TextInput accessibilityLabel="Rechercher une commande à encaisser" onChangeText={setQuery} placeholder="Client ou référence" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.input, { color: theme.colors.text }]} value={query} /></View>
        {error ? <Pressable onPress={() => void load()}><AppText color={theme.colors.secondary} variant="caption">{error} · Réessayer</AppText></Pressable> : null}
        {result ? <AppText color={theme.colors.textMuted} variant="caption">{result.total} commande{result.total > 1 ? 's' : ''} à encaisser</AppText> : null}
      </View>}
      renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/atelier/commandes/[id]', params: { id: item.order.id, payment: '1' } })} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={styles.rowCopy}><AppText numberOfLines={1} variant="label">{item.order.client_name}</AppText><AppText color={theme.colors.textMuted} variant="caption">{item.order.reference}</AppText></View><View style={styles.amount}><AppText color={theme.colors.textMuted} variant="caption">Reste à payer</AppText><AppText color={theme.colors.primary} variant="label">{formatMoney(item.remainingDue.amount, item.remainingDue.currency)}</AppText></View><ChevronRight color={theme.colors.textSubtle} size={18} /></Pressable>}
      ListEmptyComponent={loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : <View style={styles.empty}><Banknote color={theme.colors.textSubtle} size={30} /><AppText variant="title3">{search ? 'Aucun résultat' : 'Aucun solde à encaisser'}</AppText><AppText color={theme.colors.textMuted} style={styles.emptyCopy}> {search ? 'Essayez un autre nom ou une autre référence.' : 'Les commandes à régler apparaîtront ici.'}</AppText></View>}
      ListFooterComponent={result && result.pageCount > 1 ? <View style={styles.pagination}><Pressable accessibilityLabel="Page précédente" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page <= 1 && styles.disabled]}><ChevronLeft color={theme.colors.text} size={18} /></Pressable><AppText variant="caption">{result.page} / {result.pageCount}</AppText><Pressable accessibilityLabel="Page suivante" disabled={page >= result.pageCount} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page >= result.pageCount && styles.disabled]}><ChevronRight color={theme.colors.text} size={18} /></Pressable></View> : null}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { flexGrow: 1, gap: 10, padding: 18, paddingBottom: 30 },
  headerBlock: { gap: 17, marginBottom: 6 }, heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  back: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, title: { flex: 1 },
  search: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 13 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, height: 48, marginLeft: 9 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 76, padding: 13 },
  rowCopy: { flex: 1, gap: 3, minWidth: 0 }, amount: { alignItems: 'flex-end', gap: 3, marginHorizontal: 10 },
  empty: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', minHeight: 250, padding: 30 }, emptyCopy: { textAlign: 'center' },
  loader: { marginTop: 80 }, pagination: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'center', paddingVertical: 16 },
  pageButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 }, disabled: { opacity: 0.4 },
});
