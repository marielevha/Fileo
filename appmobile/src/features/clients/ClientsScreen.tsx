import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { Archive, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Search, UsersRound } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listClients } from '../../api/client';
import { AppText } from '../../components/AppText';
import { palette, useAppTheme } from '../../theme';
import type { ClientListItem, ClientPage, ClientSort, SortDirection } from '../../types/clients';

const sorts: Array<{ value: ClientSort; label: string }> = [
  { value: 'name', label: 'Nom' },
  { value: 'orders', label: 'Commandes' },
  { value: 'lastOrder', label: 'Dernière commande' },
  { value: 'createdAt', label: 'Ajout récent' },
];

export function ClientsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [result, setResult] = useState<ClientPage | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<ClientSort>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timeout);
  }, [query]);
  useEffect(() => setPage(1), [debouncedQuery, direction, includeArchived, sort]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setResult(await listClients({ page, pageSize: 10, q: debouncedQuery, includeArchived, sort, direction }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, direction, includeArchived, page, sort]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function chooseSort(value: ClientSort) {
    if (sort === value) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSort(value);
      setDirection(value === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={result?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClientCard item={item} onPress={() => router.push(`/atelier/clients/${item.id}` as Href)} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} />}
        ListHeaderComponent={<View>
          <View style={styles.header}>
            <View style={styles.headerCopy}><AppText color={theme.colors.textMuted} variant="caption">Carnet de clientèle</AppText><AppText variant="title1">Clients</AppText></View>
            <Pressable accessibilityLabel="Nouveau client" onPress={() => router.push('/atelier/clients/nouveau')} style={styles.addButton}><Plus color={palette.white} size={24} strokeWidth={2.5} /></Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Search color={theme.colors.textSubtle} size={19} /><TextInput onChangeText={setQuery} placeholder="Nom ou téléphone" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.searchInput, { color: theme.colors.text }]} value={query} />{loading && result ? <ActivityIndicator color={theme.colors.primary} size="small" /> : null}</View>
          <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
            {sorts.map((option) => <SortChip key={option.value} direction={direction} label={option.label} onPress={() => chooseSort(option.value)} selected={sort === option.value} />)}
          </ScrollView>
          <Pressable onPress={() => setIncludeArchived((value) => !value)} style={styles.archiveToggle}><View style={[styles.checkbox, { backgroundColor: includeArchived ? theme.colors.primary : theme.colors.surface, borderColor: includeArchived ? theme.colors.primary : theme.colors.border }]}>{includeArchived ? <Archive color={palette.white} size={14} /> : null}</View><AppText color={includeArchived ? theme.colors.primary : theme.colors.textMuted} variant="caption">Afficher les clients archivés</AppText></Pressable>
          <View style={styles.resultLine}><AppText color={theme.colors.textMuted} variant="caption">{result ? `${result.total} client${result.total > 1 ? 's' : ''}` : 'Chargement'}</AppText></View>
          {error ? <ErrorBox message={error} onRetry={() => void load()} /> : null}
        </View>}
        ListEmptyComponent={!loading ? <View style={styles.empty}><UsersRound color={theme.colors.textSubtle} size={36} /><AppText style={styles.emptyTitle} variant="title3">Aucun client</AppText><AppText color={theme.colors.textMuted} style={styles.emptyCopy}>Ajoutez un client ou modifiez votre recherche.</AppText></View> : <ActivityIndicator color={theme.colors.primary} size="large" style={styles.loader} />}
        ListFooterComponent={result && result.total > 0 ? <View style={styles.pagination}><Pressable disabled={page <= 1 || loading} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page <= 1 && styles.disabled]}><ChevronLeft color={theme.colors.text} size={19} /></Pressable><AppText color={theme.colors.textMuted} variant="caption">Page {result.page} sur {result.pageCount}</AppText><Pressable disabled={page >= result.pageCount || loading} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, { borderColor: theme.colors.border }, page >= result.pageCount && styles.disabled]}><ChevronRight color={theme.colors.text} size={19} /></Pressable></View> : null}
      />
    </SafeAreaView>
  );
}

function ClientCard({ item, onPress }: { item: ClientListItem; onPress: () => void }) {
  const theme = useAppTheme();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, pressed && styles.pressed]}>
    <View style={[styles.avatar, { backgroundColor: item.archived_at ? theme.colors.surfaceMuted : theme.colors.primarySoft }]}><AppText color={item.archived_at ? theme.colors.textMuted : theme.colors.primary} variant="label">{initials(item.display_name)}</AppText></View>
    <View style={styles.cardCopy}><View style={styles.nameLine}><AppText numberOfLines={1} style={styles.name} variant="bodyMedium">{item.display_name}</AppText>{item.archived_at ? <View style={[styles.archivedBadge, { backgroundColor: theme.colors.surfaceMuted }]}><AppText color={theme.colors.textMuted} variant="caption">Archivé</AppText></View> : null}</View><AppText color={theme.colors.textMuted} numberOfLines={1} variant="caption">{item.phone_e164 || item.other_contact || 'Aucun contact'}</AppText><View style={styles.cardMeta}><AppText color={theme.colors.textSubtle} variant="caption">{item.order_count} commande{item.order_count > 1 ? 's' : ''}</AppText><AppText color={theme.colors.textSubtle} numberOfLines={1} variant="caption">{item.last_order_at ? `Dernière le ${formatDate(item.last_order_at)}` : 'Aucune commande'}</AppText></View></View>
    <ChevronRight color={theme.colors.textSubtle} size={20} />
  </Pressable>;
}

function SortChip({ direction, label, onPress, selected }: { direction: SortDirection; label: string; onPress: () => void; selected: boolean }) {
  const theme = useAppTheme();
  const Icon = direction === 'asc' ? ChevronUp : ChevronDown;
  return <Pressable onPress={onPress} style={[styles.filter, { backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface, borderColor: selected ? theme.colors.primary : theme.colors.border }]}><AppText color={selected ? theme.colors.primary : theme.colors.textMuted} variant="caption">{label}</AppText>{selected ? <Icon color={theme.colors.primary} size={14} /> : null}</Pressable>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) { const theme = useAppTheme(); return <Pressable onPress={onRetry} style={[styles.error, { backgroundColor: theme.colors.secondarySoft, borderColor: theme.colors.secondary }]}><AppText color={theme.colors.secondary} variant="caption">{message} · Réessayer</AppText></Pressable>; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CL'; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  safeArea:{flex:1},content:{flexGrow:1,gap:9,paddingBottom:24,paddingHorizontal:18},header:{alignItems:'center',flexDirection:'row',paddingBottom:18,paddingTop:18},headerCopy:{flex:1},addButton:{alignItems:'center',backgroundColor:palette.violet700,borderRadius:8,height:46,justifyContent:'center',width:46},search:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',paddingHorizontal:13},searchInput:{flex:1,fontFamily:'Inter_400Regular',fontSize:14,height:48,marginLeft:9,paddingVertical:0},filters:{gap:8,paddingVertical:12},filter:{alignItems:'center',borderRadius:999,borderWidth:1,flexDirection:'row',gap:5,justifyContent:'center',minHeight:34,paddingHorizontal:12},archiveToggle:{alignItems:'center',alignSelf:'flex-start',flexDirection:'row',gap:8,minHeight:38},checkbox:{alignItems:'center',borderRadius:5,borderWidth:1,height:22,justifyContent:'center',width:22},resultLine:{marginBottom:5,marginTop:6},card:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',minHeight:104,padding:13},avatar:{alignItems:'center',borderRadius:8,height:48,justifyContent:'center',width:48},cardCopy:{flex:1,marginHorizontal:12,minWidth:0},nameLine:{alignItems:'center',flexDirection:'row'},name:{flexShrink:1},archivedBadge:{borderRadius:999,marginLeft:8,paddingHorizontal:8,paddingVertical:3},cardMeta:{gap:2,marginTop:8},pressed:{opacity:.72},empty:{alignItems:'center',justifyContent:'center',minHeight:260,padding:32},emptyTitle:{marginTop:14},emptyCopy:{marginTop:6,textAlign:'center'},loader:{marginTop:80},pagination:{alignItems:'center',flexDirection:'row',gap:16,justifyContent:'center',paddingVertical:20},pageButton:{alignItems:'center',borderRadius:8,borderWidth:1,height:40,justifyContent:'center',width:44},disabled:{opacity:.3},error:{borderRadius:8,borderWidth:1,marginBottom:8,padding:12},
});
