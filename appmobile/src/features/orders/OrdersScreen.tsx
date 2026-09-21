import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, PackageOpen, Plus, Search, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listOrders } from '../../api/client';
import { AppText } from '../../components/AppText';
import { palette, useAppTheme } from '../../theme';
import type { OrderFilter, OrderPage, OrderSummary } from '../../types/orders';
import { formatDate, formatMoney, orderStateLabels, stateTone } from './orderUi';

const filters: Array<{ value: OrderFilter; label: string }> = [
  { value: 'all', label: 'Toutes' }, { value: 'late', label: 'En retard' },
  { value: 'nouvelle', label: 'Nouvelles' }, { value: 'en_cours', label: 'En cours' },
  { value: 'prete', label: 'Prêtes' }, { value: 'partiellement_remise', label: 'Partielles' }, { value: 'remise', label: 'Remises' },
  { value: 'annulee', label: 'Annulées' },
];

export function OrdersScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ create?: string; order?: string; q?: string }>();
  const [result, setResult] = useState<OrderPage | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.create === '1') router.replace('/atelier/commandes/nouvelle');
    else if (params.order) router.replace({ pathname: '/atelier/commandes/[id]', params: { id: params.order } });
  }, [params.create, params.order, router]);
  useEffect(() => { if (typeof params.q === 'string') setQuery(params.q); }, [params.q]);
  useEffect(() => { const timeout = setTimeout(() => setDebouncedQuery(query), 350); return () => clearTimeout(timeout); }, [query]);
  useEffect(() => setPage(1), [debouncedQuery, filter]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setResult(await listOrders({ page, pageSize: 10, q: debouncedQuery, filter })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de charger les commandes.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [debouncedQuery, filter, page]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={result?.items ?? []}
        keyExtractor={(item) => item.order.id}
        renderItem={({ item }) => <OrderCard item={item} onPress={() => router.push({ pathname: '/atelier/commandes/[id]', params: { id: item.order.id } })} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} />}
        ListHeaderComponent={<View>
          <View style={styles.header}>
            <View style={styles.headerCopy}><AppText color={theme.colors.textMuted} variant="caption">Gestion de l'atelier</AppText><AppText variant="title1">Commandes</AppText></View>
            <Pressable accessibilityLabel="Nouvelle commande" onPress={() => router.push('/atelier/commandes/nouvelle')} style={styles.addButton}><Plus color={palette.white} size={24} strokeWidth={2.5} /></Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Search color={theme.colors.textSubtle} size={19} />
            <TextInput onChangeText={setQuery} placeholder="Client, référence ou article" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.searchInput, { color: theme.colors.text }]} value={query} />
            <SlidersHorizontal color={theme.colors.textSubtle} size={18} />
          </View>
          <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((option) => { const selected = option.value === filter; return <Pressable key={option.value} onPress={() => setFilter(option.value)} style={[styles.filter, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface }]}><AppText color={selected ? theme.colors.primary : theme.colors.textMuted} variant="caption">{option.label}</AppText></Pressable>; })}
          </ScrollView>
          <View style={styles.resultLine}><AppText color={theme.colors.textMuted} variant="caption">{result ? `${result.total} commande${result.total > 1 ? 's' : ''}` : 'Chargement'}</AppText>{loading && result ? <ActivityIndicator color={theme.colors.primary} size="small" /> : null}</View>
          {error ? <ErrorBox message={error} onRetry={() => void load()} /> : null}
        </View>}
        ListEmptyComponent={!loading ? <View style={styles.empty}><PackageOpen color={theme.colors.textSubtle} size={34} /><AppText style={styles.emptyTitle} variant="title3">Aucune commande</AppText><AppText color={theme.colors.textMuted} style={styles.emptyCopy}>Aucun résultat ne correspond à cette sélection.</AppText></View> : <ActivityIndicator color={theme.colors.primary} size="large" style={styles.loader} />}
        ListFooterComponent={result && result.total > 0 ? <View style={styles.pagination}>
          <Pressable disabled={page <= 1 || loading} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page <= 1 && styles.disabled]}><ChevronLeft color={theme.colors.text} size={19} /></Pressable>
          <AppText color={theme.colors.textMuted} variant="caption">Page {result.page} sur {result.pageCount}</AppText>
          <Pressable disabled={page >= result.pageCount || loading} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page >= result.pageCount && styles.disabled]}><ChevronRight color={theme.colors.text} size={19} /></Pressable>
        </View> : null}
      />
    </SafeAreaView>
  );
}

function OrderCard({ item, onPress }: { item: OrderSummary; onPress: () => void }) {
  const theme = useAppTheme(); const tone = stateTone(item.state);
  const description = item.items.map((row) => row.category).filter(Boolean).slice(0, 3).join(', ');
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surface, borderColor: item.isLate ? theme.colors.secondary : theme.colors.border }, pressed && styles.pressed]}>
    <View style={styles.cardTop}><View style={styles.cardTitle}><AppText numberOfLines={1} variant="bodyMedium">{item.order.client_name}</AppText><AppText color={theme.colors.textMuted} variant="caption">{item.order.reference}</AppText></View><View style={[styles.state, { backgroundColor: tone.background }]}><AppText color={tone.foreground} numberOfLines={1} variant="caption">{orderStateLabels[item.state]}</AppText></View></View>
    <AppText color={theme.colors.textMuted} numberOfLines={1} style={styles.description} variant="caption">{description || 'Aucun article'}</AppText>
    <View style={styles.cardBottom}><View><AppText color={item.isLate ? theme.colors.secondary : theme.colors.textSubtle} variant="caption">{item.isLate ? 'En retard · ' : 'Livraison · '}{formatDate(item.order.promised_date, 'Sans date')}</AppText><AppText color={theme.colors.textSubtle} variant="caption">{item.items.length} article{item.items.length > 1 ? 's' : ''}</AppText></View>{item.balance ? <View style={styles.money}><AppText variant="label">{formatMoney(item.balance.orderTotal.amount, item.balance.orderTotal.currency)}</AppText><AppText color={theme.colors.textMuted} variant="caption">Reste {formatMoney(item.balance.remainingDue.amount, item.balance.remainingDue.currency)}</AppText></View> : null}</View>
  </Pressable>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) { const theme = useAppTheme(); return <Pressable onPress={onRetry} style={[styles.error, { backgroundColor: theme.colors.secondarySoft, borderColor: theme.colors.secondary }]}><AppText color={theme.colors.secondary} variant="caption">{message} · Réessayer</AppText></Pressable>; }

const styles = StyleSheet.create({
  safeArea:{flex:1},listContent:{flexGrow:1,gap:10,paddingBottom:24,paddingHorizontal:18},header:{alignItems:'center',flexDirection:'row',paddingBottom:18,paddingTop:18},headerCopy:{flex:1},addButton:{alignItems:'center',backgroundColor:palette.violet700,borderRadius:8,height:46,justifyContent:'center',width:46},search:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',paddingHorizontal:13},searchInput:{flex:1,fontFamily:'Inter_400Regular',fontSize:14,height:48,marginHorizontal:9,paddingVertical:0},filters:{gap:8,paddingVertical:14},filter:{borderRadius:999,borderWidth:1,justifyContent:'center',minHeight:34,paddingHorizontal:13},resultLine:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',marginBottom:4},card:{borderRadius:8,borderWidth:1,minHeight:152,padding:15},cardTop:{alignItems:'flex-start',flexDirection:'row'},cardTitle:{flex:1,minWidth:0},state:{borderRadius:999,marginLeft:8,maxWidth:135,paddingHorizontal:9,paddingVertical:5},description:{marginTop:12},cardBottom:{alignItems:'flex-end',flexDirection:'row',justifyContent:'space-between',marginTop:14},money:{alignItems:'flex-end',marginLeft:12},pressed:{opacity:.72},empty:{alignItems:'center',justifyContent:'center',minHeight:260,padding:32},emptyTitle:{marginTop:14},emptyCopy:{marginTop:6,textAlign:'center'},loader:{marginTop:80},pagination:{alignItems:'center',flexDirection:'row',gap:16,justifyContent:'center',paddingVertical:20},pageButton:{alignItems:'center',borderRadius:8,borderWidth:1,height:40,justifyContent:'center',width:44},disabled:{opacity:.3},error:{borderRadius:8,borderWidth:1,marginBottom:8,padding:12},
});
