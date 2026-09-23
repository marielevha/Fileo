import { useFocusEffect } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getBootstrap, getWorkshopDetails, updateWorkshop } from '../../../../src/api/client';
import { AppText } from '../../../../src/components/AppText';
import { ActionButton, MorePage } from '../../../../src/features/more/ui';
import { useAppTheme } from '../../../../src/theme';

function parseUnits(raw: unknown, fallback = ['cm', 'mm', 'm']) {
  if (Array.isArray(raw)) return raw.map((unit) => String(unit).trim().toLowerCase()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseUnits(parsed, fallback);
    } catch {
      return raw.split(/[\n,;|]+/).map((unit) => unit.trim().toLowerCase()).filter(Boolean);
    }
  }
  return fallback;
}

export default function UnitsScreen() {
  const theme = useAppTheme();
  const [units, setUnits] = useState<string[]>(['cm', 'mm', 'm']);
  const [workshop, setWorkshop] = useState<{ name: string; city: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([getBootstrap(), getWorkshopDetails()])
      .then(([session, details]) => {
        if (!active) return;
        setWorkshop({ name: details.name, city: details.city });
        setUnits(parseUnits(details.measurement_units_json, session.workshop.measurementUnits?.length ? session.workshop.measurementUnits : ['cm', 'mm', 'm']));
        setError(null);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  function updateUnit(index: number, value: string) {
    setUnits((current) => current.map((unit, unitIndex) => unitIndex === index ? value.toLowerCase() : unit));
  }

  function removeUnit(index: number) {
    setUnits((current) => {
      const next = current.filter((_, unitIndex) => unitIndex !== index);
      return next.length ? next : ['cm'];
    });
  }

  async function save() {
    if (!workshop) return;
    const cleaned = Array.from(new Set(units.map((unit) => unit.trim().toLowerCase()).filter(Boolean)));
    if (!cleaned.length) return setError('Ajoutez au moins une unité.');
    setSaving(true);
    setError(null);
    try {
      await updateWorkshop(workshop.name, workshop.city ?? '', cleaned);
      setUnits(cleaned);
      Alert.alert('Unités enregistrées');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MorePage error={error} loading={loading} title="Unités de mesure">
      <View style={styles.stack}>
        <AppText color={theme.colors.textMuted} variant="caption">Ces unités sont proposées dans les modèles, les commandes et les mensurations client.</AppText>
        {units.map((unit, index) => (
          <View key={`${index}-${unit}`} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              autoCapitalize="none"
              onChangeText={(value) => updateUnit(index, value)}
              placeholder="cm"
              placeholderTextColor={theme.colors.textSubtle}
              selectionColor={theme.colors.primary}
              style={[styles.input, { color: theme.colors.text }]}
              value={unit}
            />
            <Pressable accessibilityLabel="Retirer l'unité" onPress={() => removeUnit(index)} style={styles.iconButton}>
              <Trash2 color={theme.colors.secondary} size={18} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setUnits((current) => [...current, ''])} style={[styles.addButton, { borderColor: theme.colors.border }]}>
          <Plus color={theme.colors.primary} size={18} />
          <AppText color={theme.colors.primary} variant="label">Ajouter une unité</AppText>
        </Pressable>
        <ActionButton disabled={!workshop || units.every((unit) => !unit.trim())} label="Enregistrer" loading={saving} onPress={() => void save()} />
      </View>
    </MorePage>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, marginTop: 8 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, minHeight: 50 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  addButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48 },
});
