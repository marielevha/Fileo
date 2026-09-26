import { ChevronDown, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getFaq, type FaqResponse } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { ActionButton, MorePage } from '../../../src/features/more/ui';
import { useAppTheme } from '../../../src/theme';

export default function FaqScreen() {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [data, setData] = useState<FaqResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getFaq());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de charger la FAQ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    const questions = data?.items ?? [];
    return term
      ? questions.filter((item) => `${item.question} ${item.answer}`.toLocaleLowerCase('fr').includes(term))
      : questions;
  }, [data, query]);

  return <MorePage title="FAQ" loading={loading && !data} error={error && !data ? error : null}>
    {data ? <>
      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Search color={theme.colors.textSubtle} size={19} />
        <TextInput accessibilityLabel="Rechercher dans la FAQ" onChangeText={setQuery} placeholder="Rechercher une question" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.searchInput, { color: theme.colors.text }]} value={query} />
      </View>
      <View style={styles.list}>
        {filtered.map((item) => <View key={item.id} style={[styles.item, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: openId === item.id }} onPress={() => setOpenId(openId === item.id ? null : item.id)} style={styles.question}>
            <AppText style={styles.questionText} variant="label">{item.question}</AppText>
            <ChevronDown color={theme.colors.primary} size={19} style={{ transform: [{ rotate: openId === item.id ? '180deg' : '0deg' }] }} />
          </Pressable>
          {openId === item.id ? <View style={[styles.answer, { borderTopColor: theme.colors.border }]}><AppText color={theme.colors.textMuted}>{item.answer}</AppText></View> : null}
        </View>)}
      </View>
      {!filtered.length ? <AppText color={theme.colors.textMuted} style={styles.empty}>{query.trim() ? 'Aucune question ne correspond à cette recherche.' : 'Aucune question publiée pour le moment.'}</AppText> : null}
    </> : !loading ? <ActionButton label="Réessayer" onPress={() => void load()} /> : null}
  </MorePage>;
}

const styles = StyleSheet.create({
  search: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 50, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, minHeight: 48, paddingVertical: 0 },
  list: { gap: 9 },
  item: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  question: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 58, padding: 14 },
  questionText: { flex: 1 },
  answer: { borderTopWidth: 1, padding: 14 },
  empty: { paddingVertical: 28, textAlign: 'center' },
});
