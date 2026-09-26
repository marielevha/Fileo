import { useFocusEffect, useRouter } from 'expo-router';
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  CloudOff,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, getBootstrap, getDashboardAgenda, listOrders } from '../../api/client';
import { clearAuthSession } from '../../auth/session';
import { AppText } from '../../components/AppText';
import { BrandLogo } from '../../components/BrandLogo';
import { palette, useAppTheme } from '../../theme';
import { SyncStatusButton } from '../../sync/overview';
import type { AgendaFilter as DashboardAgendaFilter, AgendaItem, AgendaPage, BootstrapResponse, Money } from '../../types/dashboard';
import type { OrderPage } from '../../types/orders';

type AgendaFilter = 'all' | DashboardAgendaFilter;

const statusLabels: Record<string, string> = {
  a_realiser: 'À réaliser',
  a_essayer: 'À essayer',
  en_cours: 'En cours',
  pret: 'Prêt',
  remis: 'Remis',
  annule: 'Annulé',
};

const statusColors: Record<string, { background: string; foreground: string }> = {
  a_realiser: { background: palette.violet100, foreground: palette.violet700 },
  a_essayer: { background: palette.amber100, foreground: '#8A5A00' },
  en_cours: { background: palette.cyan100, foreground: '#087B76' },
  pret: { background: palette.pink100, foreground: '#B82D75' },
};

export function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const lightHome = !theme.isDark;
  const homeBackground = lightHome ? '#F5F6F8' : theme.colors.background;
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrderPage | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [agendaPage, setAgendaPage] = useState<AgendaPage | null>(null);
  const [agendaPageNumber, setAgendaPageNumber] = useState(1);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [agendaRevision, setAgendaRevision] = useState(0);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setData(await getBootstrap((cached) => {
        setData(cached);
        setLoading(false);
      }));
      setAgendaRevision((value) => value + 1);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'session_expired') {
        await clearAuthSession();
        router.replace('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    const term = query.trim();
    if (!term) { setSearchResults(null); setSearchError(null); setSearching(false); return; }
    let active = true;
    setSearching(true); setSearchResults(null); setSearchError(null);
    const timer = setTimeout(() => {
      void listOrders({ q: term, page: 1, pageSize: 10 }).then((results) => {
        if (active) setSearchResults(results);
      }).catch((caught) => {
        if (active) setSearchError(caught instanceof Error ? caught.message : 'Recherche indisponible.');
      }).finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (filter === 'all') return;
    let active = true;
    setAgendaLoading(true); setAgendaError(null); setAgendaPage(null);
    void getDashboardAgenda(filter, agendaPageNumber, (cached) => {
      if (active) { setAgendaPage(cached); setAgendaLoading(false); }
    }).then((result) => {
      if (!active) return;
      const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (agendaPageNumber > lastPage) setAgendaPageNumber(lastPage);
      else setAgendaPage(result);
    }).catch((caught) => { if (active) setAgendaError(caught instanceof Error ? caught.message : 'Agenda indisponible.'); })
      .finally(() => { if (active) setAgendaLoading(false); });
    return () => { active = false; };
  }, [filter, agendaPageNumber, agendaRevision]);

  const agenda = filter === 'all' ? data?.dashboard.agenda ?? [] : agendaPage?.items ?? [];
  const selectFilter = (next: AgendaFilter) => { setAgendaPageNumber(1); setFilter(next); };

  if (loading && !data) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: lightHome ? theme.colors.surface : palette.violet950 }]}>
        <BrandLogo inverse={!lightHome} size="medium" />
        <ActivityIndicator color={lightHome ? theme.colors.primary : palette.cyan500} size="large" />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.stateScreen, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.errorIcon, { backgroundColor: theme.colors.secondarySoft }]}>
          <CloudOff color={theme.colors.secondary} size={24} />
        </View>
        <AppText style={styles.stateTitle} variant="title3">Le tableau de bord ne répond pas</AppText>
        <AppText color={theme.colors.textMuted} style={styles.stateCopy}>{error}</AppText>
        <Pressable onPress={() => void load()} style={styles.retryButton}>
          <AppText color={palette.white} variant="label">Réessayer</AppText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const firstName = data.user.fullName.trim().split(/\s+/)[0] || 'Bienvenue';
  const counts = data.dashboard.counts;
  const sectionTitle = filter === 'all' ? 'Prochaines échéances' : filter === 'today'
    ? "À livrer aujourd'hui" : filter === 'late' ? 'Commandes en retard' : filter === 'week' ? 'Échéances sous 7 jours' : 'Prêtes à remettre';

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: lightHome ? theme.colors.surface : palette.violet950 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: homeBackground }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.violet700} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, lightHome && styles.lightHero, lightHome && { borderBottomColor: theme.colors.border }]}>
          <View style={styles.topBar}>
            <BrandLogo compact inverse={!lightHome} size="small" />
            <View style={styles.workshopIdentity}>
              <AppText color={lightHome ? theme.colors.textMuted : 'rgba(255,255,255,0.72)'} variant="caption">{greeting()}, {firstName}</AppText>
              <AppText color={lightHome ? theme.colors.text : palette.white} numberOfLines={1} variant="title3">{data.workshop.name}</AppText>
            </View>
            <SyncStatusButton />
          </View>

          <View style={[styles.searchBox, lightHome && { backgroundColor: homeBackground, borderColor: theme.colors.border }]}>
            <Search color={lightHome ? theme.colors.textSubtle : 'rgba(255,255,255,0.56)'} size={19} />
            <TextInput
              accessibilityLabel="Rechercher une commande"
              onChangeText={setQuery}
              placeholder="Client, commande ou article"
              placeholderTextColor={lightHome ? theme.colors.textSubtle : 'rgba(255,255,255,0.46)'}
              selectionColor={lightHome ? theme.colors.primary : palette.cyan500}
              style={[styles.searchInput, lightHome && { color: theme.colors.text }]}
              value={query}
            />
          </View>
        </View>

        <View style={[styles.body, { backgroundColor: homeBackground }]}>
          {query.trim() ? <View style={styles.results}>
            <View style={styles.sectionHeader}><AppText variant="title3">Commandes</AppText>{searchResults ? <AppText color={theme.colors.textMuted} variant="caption">{searchResults.total} résultat{searchResults.total > 1 ? 's' : ''}</AppText> : null}</View>
            {searching ? <ActivityIndicator color={theme.colors.primary} style={styles.searchLoader} /> : null}
            {searchError ? <AppText color={theme.colors.secondary} variant="caption">{searchError}</AppText> : null}
            {!searching && searchResults?.items.map((item) => <Pressable key={item.order.id} onPress={() => router.push({ pathname: '/atelier/commandes/[id]', params: { id: item.order.id } })} style={[styles.resultRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><View style={styles.resultCopy}><AppText numberOfLines={1} variant="label">{item.order.client_name}</AppText><AppText color={theme.colors.textMuted} numberOfLines={1} variant="caption">{item.order.reference} · {item.items.map((article) => article.category).join(', ')}</AppText></View><ChevronRight color={theme.colors.textSubtle} size={18} /></Pressable>)}
            {!searching && searchResults?.total === 0 ? <AppText color={theme.colors.textMuted} style={styles.emptyText}>Aucune commande trouvée.</AppText> : null}
            {!searching && searchResults && searchResults.total > searchResults.items.length ? <Pressable onPress={() => router.push({ pathname: '/atelier/commandes', params: { q: query.trim() } })} style={styles.allResults}><AppText color={theme.colors.primary} variant="label">Voir tous les résultats</AppText><ChevronRight color={theme.colors.primary} size={17} /></Pressable> : null}
          </View> : <>
          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="title3">Vue d'ensemble</AppText>
              <AppText color={theme.colors.textMuted} variant="caption">{formatFullDate()}</AppText>
            </View>
            {filter !== 'all' ? (
              <Pressable hitSlop={8} onPress={() => selectFilter('all')}>
                <AppText color={theme.colors.primary} variant="label">Tout afficher</AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.metricGrid}>
            <MetricCard active={filter === 'today'} color={palette.violet700} label="À livrer aujourd'hui" onPress={() => selectFilter('today')} value={counts.dueToday} />
            <MetricCard active={filter === 'late'} color={palette.pink500} label="En retard" onPress={() => selectFilter('late')} value={counts.late} />
            <MetricCard active={filter === 'ready'} color={palette.cyan500} label="Prêtes à remettre" onPress={() => selectFilter('ready')} value={counts.readyNotDelivered} />
            <MetricCard active={filter === 'week'} color={palette.amber500} label="Sous 7 jours" onPress={() => selectFilter('week')} value={counts.dueWithinSevenDays} />
          </View>

          <Pressable
            onPress={() => router.push('/atelier/commandes/nouvelle')}
            style={({ pressed }) => [styles.primaryAction, lightHome ? styles.lightPrimaryAction : styles.darkPrimaryAction, lightHome && { backgroundColor: theme.colors.primary }, pressed && styles.pressed]}
          >
            {lightHome ? <>
              <Plus color={palette.white} size={21} strokeWidth={2.4} />
              <AppText color={palette.white} style={styles.actionLabel} variant="label">Nouvelle commande</AppText>
              <ChevronRight color={palette.white} size={19} />
            </> : <>
              <View style={styles.primaryActionIcon}><ClipboardPlus color={palette.violet950} size={22} /></View>
              <View style={styles.actionCopy}>
                <AppText color={palette.white} variant="bodyMedium">Nouvelle commande</AppText>
                <AppText color="rgba(255,255,255,0.62)" variant="caption">Créer et planifier un nouveau travail</AppText>
              </View>
              <ChevronRight color={palette.white} size={21} />
            </>}
          </Pressable>

          <View style={styles.quickActions}>
            <QuickAction icon={UserPlus} label="Client" onPress={() => router.push('/atelier/clients?create=1')} tone={palette.violet100} color={palette.violet700} />
            {data.capabilities.canViewMoney ? (
              <QuickAction icon={Banknote} label="Encaisser" onPress={() => router.push('/atelier/encaissements')} tone={palette.pink100} color={palette.pink500} />
            ) : null}
            <QuickAction icon={CalendarDays} label="Planning" onPress={() => router.push('/atelier/planning')} tone={palette.cyan100} color="#087B76" />
          </View>

          {data.dashboard.finance ? <FinanceStrip finance={data.dashboard.finance} /> : null}

          <View style={[styles.sectionHeader, styles.agendaHeader]}>
            <AppText variant="title3">{sectionTitle}</AppText>
            <Pressable hitSlop={8} onPress={() => router.push(filter === 'week' ? '/atelier/planning?horizon=week' : filter === 'today' ? '/atelier/planning?horizon=today' : filter === 'late' ? '/atelier/planning?horizon=late' : filter === 'ready' ? '/atelier/planning?status=pret' : '/atelier/planning')}>
              <AppText color={theme.colors.primary} variant="label">Voir tout</AppText>
            </Pressable>
          </View>

          <View style={[styles.agenda, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {filter !== 'all' && agendaLoading ? <ActivityIndicator color={theme.colors.primary} style={styles.searchLoader} /> : filter !== 'all' && agendaError ? <View style={styles.emptyAgenda}><AppText color={theme.colors.secondary} variant="caption">{agendaError}</AppText><Pressable onPress={() => setAgendaRevision((value) => value + 1)}><AppText color={theme.colors.primary} variant="label">Réessayer</AppText></Pressable></View> : agenda.length ? agenda.map((item, index) => (
              <AgendaRow item={item} key={item.item_id} last={index === agenda.length - 1} />
            )) : (
              <View style={styles.emptyAgenda}>
                <CalendarDays color={theme.colors.textSubtle} size={25} />
                <AppText color={theme.colors.textMuted} style={styles.emptyText} variant="label">
                  Aucune échéance dans cette sélection
                </AppText>
              </View>
            )}
          </View>
          {filter !== 'all' && agendaPage && agendaPage.total > agendaPage.pageSize ? (
            <View style={styles.agendaPagination}>
              <Pressable accessibilityLabel="Page précédente" disabled={agendaPageNumber <= 1} onPress={() => setAgendaPageNumber((value) => value - 1)} style={styles.pageButton}><ChevronLeft color={agendaPageNumber <= 1 ? theme.colors.textSubtle : theme.colors.primary} size={20} /></Pressable>
              <AppText color={theme.colors.textMuted} variant="caption">{(agendaPage.page - 1) * agendaPage.pageSize + 1}-{Math.min(agendaPage.page * agendaPage.pageSize, agendaPage.total)} sur {agendaPage.total}</AppText>
              <Pressable accessibilityLabel="Page suivante" disabled={agendaPageNumber * agendaPage.pageSize >= agendaPage.total} onPress={() => setAgendaPageNumber((value) => value + 1)} style={styles.pageButton}><ChevronRight color={agendaPageNumber * agendaPage.pageSize >= agendaPage.total ? theme.colors.textSubtle : theme.colors.primary} size={20} /></Pressable>
            </View>
          ) : null}
          </>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ active, color, label, onPress, value }: { active?: boolean; color: string; label: string; onPress: () => void; value: number }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        { backgroundColor: theme.colors.surface, borderColor: active ? color : theme.colors.border },
        active && styles.metricActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.metricMark, { backgroundColor: color }]} />
      <AppText color={color} style={styles.metricValue} variant="title2">{value}</AppText>
      <AppText color={theme.colors.textMuted} numberOfLines={2} style={styles.metricLabel} variant="caption">{label}</AppText>
    </Pressable>
  );
}

function QuickAction({ color, icon: Icon, label, onPress, tone }: { color: string; icon: typeof UserPlus; label: string; onPress: () => void; tone: string }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, { backgroundColor: tone }]}><Icon color={color} size={21} /></View>
      <AppText color={theme.colors.textMuted} numberOfLines={1} variant="caption">{label}</AppText>
    </Pressable>
  );
}

function FinanceStrip({ finance }: { finance: NonNullable<BootstrapResponse['dashboard']['finance']> }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.finance, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.financeColumn}>
        <AppText color={theme.colors.textMuted} variant="caption">Reste à encaisser</AppText>
        <AppText adjustsFontSizeToFit color={theme.colors.secondary} minimumFontScale={0.72} numberOfLines={1} variant="title3">{formatMoney(finance.outstanding)}</AppText>
      </View>
      <View style={[styles.financeDivider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.financeColumn}>
        <AppText color={theme.colors.textMuted} variant="caption">Encaissé ce mois</AppText>
        <AppText adjustsFontSizeToFit color={theme.colors.accent} minimumFontScale={0.72} numberOfLines={1} variant="title3">{formatMoney(finance.collectedThisMonth)}</AppText>
      </View>
    </View>
  );
}

function AgendaRow({ item, last }: { item: AgendaItem; last: boolean }) {
  const router = useRouter();
  const theme = useAppTheme();
  const tone = statusColors[item.status] ?? { background: theme.colors.surfaceMuted, foreground: theme.colors.textMuted };
  const late = Boolean(item.due_date && item.due_date < localDateKey());
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/atelier/commandes/[id]', params: { id: item.order_id } })}
      style={({ pressed }) => [styles.agendaRow, !last && { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
        <AppText color={theme.colors.primary} variant="label">{initials(item.client_name)}</AppText>
      </View>
      <View style={styles.agendaCopy}>
        <AppText numberOfLines={1} variant="label">{item.description || 'Commande sans description'}</AppText>
        <AppText color={theme.colors.textMuted} numberOfLines={1} variant="caption">{item.client_name} · {item.reference}</AppText>
        <AppText color={late ? theme.colors.secondary : theme.colors.textSubtle} variant="caption">
          {formatDueDate(item.due_date, late)}
        </AppText>
      </View>
      <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
        <AppText color={tone.foreground} numberOfLines={1} variant="caption">{statusLabels[item.status] ?? item.status}</AppText>
      </View>
    </Pressable>
  );
}

function localDateKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 18 ? 'Bonjour' : 'Bonsoir';
}

function formatFullDate() {
  const value = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return value.charAt(0).toLocaleUpperCase('fr') + value.slice(1);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('fr')).join('') || 'CL';
}

function formatDueDate(value: string | null, late: boolean) {
  if (!value) return 'Échéance non définie';
  const formatted = new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return late ? `En retard · ${formatted}` : `Échéance · ${formatted}`;
}

function formatMoney(value: Money) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: value.currency, maximumFractionDigits: 0 }).format(value.amount);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
  loadingScreen: { alignItems: 'center', backgroundColor: palette.violet950, flex: 1, gap: 32, justifyContent: 'center' },
  stateScreen: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  stateTitle: { marginTop: 16, textAlign: 'center' },
  stateCopy: { marginTop: 8, textAlign: 'center' },
  errorIcon: { alignItems: 'center', borderRadius: 8, height: 48, justifyContent: 'center', width: 48 },
  retryButton: { backgroundColor: palette.violet700, borderRadius: 8, marginTop: 20, paddingHorizontal: 24, paddingVertical: 13 },
  hero: { backgroundColor: palette.violet950, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 12 },
  lightHero: { backgroundColor: palette.white, borderBottomWidth: 1, paddingBottom: 20 },
  topBar: { alignItems: 'center', flexDirection: 'row' },
  workshopIdentity: { flex: 1, marginHorizontal: 12, minWidth: 0 },
  searchBox: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.13)', borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginTop: 24, paddingHorizontal: 14 },
  searchInput: { color: palette.white, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, height: 48, marginLeft: 10, paddingVertical: 0 },
  body: { paddingBottom: 30, paddingHorizontal: 20, paddingTop: 24 },
  results: { gap: 10 }, searchLoader: { marginTop: 24 },
  resultRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 70, padding: 12 },
  resultCopy: { flex: 1, gap: 4, minWidth: 0 }, allResults: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 44 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metricCard: { borderRadius: 8, borderWidth: 1, flexBasis: '47%', flexGrow: 1, height: 112, justifyContent: 'center', padding: 14 },
  metricActive: { borderWidth: 2, padding: 13 },
  metricMark: { borderRadius: 999, height: 5, marginBottom: 8, width: 28 },
  metricValue: { lineHeight: 28 },
  metricLabel: { marginTop: 4, minHeight: 32 },
  primaryAction: { alignItems: 'center', backgroundColor: palette.violet950, borderRadius: 8, flexDirection: 'row', gap: 12, marginTop: 20, minHeight: 54, paddingHorizontal: 17 },
  lightPrimaryAction: { minHeight: 54 },
  darkPrimaryAction: { gap: 0, minHeight: 72, paddingHorizontal: 12, paddingVertical: 12 },
  primaryActionIcon: { alignItems: 'center', backgroundColor: palette.cyan500, borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  actionCopy: { flex: 1, marginHorizontal: 12, minWidth: 0 },
  actionLabel: { flex: 1 },
  quickActions: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 16 },
  quickAction: { alignItems: 'center', flex: 1, gap: 7, minWidth: 0 },
  quickIcon: { alignItems: 'center', borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  finance: { borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginTop: 22, minHeight: 92, padding: 16 },
  financeColumn: { flex: 1, gap: 6, justifyContent: 'center', minWidth: 0 },
  financeDivider: { marginHorizontal: 14, width: 1 },
  agendaHeader: { marginBottom: 12, marginTop: 28 },
  agenda: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  agendaPagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 },
  pageButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  agendaRow: { alignItems: 'center', flexDirection: 'row', minHeight: 92, padding: 12 },
  avatar: { alignItems: 'center', borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  agendaCopy: { flex: 1, gap: 2, marginHorizontal: 11, minWidth: 0 },
  statusPill: { borderRadius: 999, maxWidth: 92, paddingHorizontal: 9, paddingVertical: 5 },
  emptyAgenda: { alignItems: 'center', minHeight: 140, justifyContent: 'center', padding: 24 },
  emptyText: { marginTop: 10, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
