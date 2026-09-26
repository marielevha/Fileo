import { ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from './AppText';
import { palette, useAppTheme } from '../theme';

type Row = { id: string; label: string; value: string; unit: string };
type TemplateField = { label: string; unit?: string | null };

const DEFAULT_UNITS = ['cm', 'mm', 'm'];

export function MeasurementRowsEditor({
  value,
  onChange,
  templateFields = [],
  units = DEFAULT_UNITS,
}: {
  value: string;
  onChange: (value: string) => void;
  templateFields?: TemplateField[];
  units?: string[];
}) {
  const theme = useAppTheme();
  const unitOptions = useMemo(() => {
    const configured = units.length ? units : DEFAULT_UNITS;
    return Array.from(new Set([...configured.map((unit) => unit.trim()).filter(Boolean), ...templateFields.map((field) => field.unit ?? '').filter(Boolean)]));
  }, [templateFields, units]);
  const templateKey = useMemo(() => templateFields.map((field) => `${field.label}:${field.unit ?? 'cm'}`).join('|'), [templateFields]);
  const previousTemplateKey = useRef<string | null>(null);
  const previousValue = useRef(value);
  const [rows, setRows] = useState<Row[]>(() => rowsFromText(value));
  const [unitPickerFor, setUnitPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!templateKey) {
      previousTemplateKey.current = '';
      if (previousValue.current !== value) {
        previousValue.current = value;
        setRows(rowsFromText(value));
      }
      return;
    }
    if (previousTemplateKey.current === templateKey) return;
    previousTemplateKey.current = templateKey;
    const next = templateFields.map((field) => ({ id: makeId(), label: field.label, value: '', unit: field.unit || unitOptions[0] || 'cm' }));
    setRows(next);
    previousValue.current = serialiseRows(next);
    onChange(serialiseRows(next));
  }, [onChange, rows.length, templateFields, templateKey, unitOptions, value]);

  function commit(next: Row[]) {
    previousValue.current = serialiseRows(next);
    setRows(next);
    onChange(previousValue.current);
  }

  function updateRow(id: string, patch: Partial<Row>) {
    commit(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function cycleUnit(row: Row) {
    const index = unitOptions.indexOf(row.unit);
    updateRow(row.id, { unit: unitOptions[(index + 1) % unitOptions.length] ?? 'cm' });
  }

  function addRow() {
    commit([...rows, { id: makeId(), label: '', value: '', unit: unitOptions[0] ?? 'cm' }]);
  }

  function removeRow(id: string) {
    const next = rows.filter((row) => row.id !== id);
    commit(next.length ? next : [{ id: makeId(), label: '', value: '', unit: unitOptions[0] ?? 'cm' }]);
  }

  return <View style={styles.wrapper}>
    {rows.map((row) => <View key={row.id} style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
      <TextInput onChangeText={(text) => updateRow(row.id, { label: text })} placeholder="Mesure" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.labelInput, { color: theme.colors.text }]} value={row.label} />
      <TextInput keyboardType="decimal-pad" onChangeText={(text) => updateRow(row.id, { value: text })} placeholder="0" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.valueInput, { color: theme.colors.text }]} value={row.value} />
      <Pressable onLongPress={() => setUnitPickerFor(unitPickerFor === row.id ? null : row.id)} onPress={() => cycleUnit(row)} style={[styles.unitButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText color={theme.colors.primary} variant="label">{row.unit || '-'}</AppText>
        <ChevronDown color={theme.colors.textSubtle} size={13} />
      </Pressable>
      <Pressable accessibilityLabel="Retirer la mesure" onPress={() => removeRow(row.id)} style={styles.removeButton}>
        <Trash2 color={theme.colors.secondary} size={15} />
      </Pressable>
      {unitPickerFor === row.id ? <View style={styles.units}>
        {unitOptions.map((unit) => <Pressable key={unit} onPress={() => { updateRow(row.id, { unit }); setUnitPickerFor(null); }} style={[styles.unitChip, { backgroundColor: row.unit === unit ? theme.colors.primary : theme.colors.surface, borderColor: row.unit === unit ? theme.colors.primary : theme.colors.border }]}>
          <AppText color={row.unit === unit ? palette.white : theme.colors.textMuted} variant="caption">{unit}</AppText>
        </Pressable>)}
      </View>
      : null}
    </View>)}
    <Pressable onPress={addRow} style={[styles.addButton, { borderColor: theme.colors.border }]}>
      <Plus color={theme.colors.primary} size={17} />
      <AppText color={theme.colors.primary} variant="label">Ajouter une mesure</AppText>
    </Pressable>
  </View>;
}

function rowsFromText(value: string): Row[] {
  const rows = value.split('\n').map((line) => {
    const separator = line.indexOf(':');
    if (separator < 0) return null;
    const label = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const match = rawValue.match(/^(.+?)\s+([a-z0-9%°"'/-]{1,12})$/i);
    return { id: makeId(), label, value: (match?.[1] ?? rawValue).trim(), unit: match?.[2] ?? 'cm' };
  }).filter((row): row is Row => Boolean(row?.label));
  return rows.length ? rows : [{ id: makeId(), label: '', value: '', unit: 'cm' }];
}

function serialiseRows(rows: Row[]) {
  return rows.map((row) => {
    const label = row.label.trim();
    if (!label) return '';
    const value = row.value.trim();
    return `${label}: ${value}${value && row.unit ? ` ${row.unit}` : ''}`;
  }).filter(Boolean).join('\n');
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  row: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 52, paddingHorizontal: 8, paddingVertical: 6, flexWrap: 'wrap' },
  labelInput: { flex: 1.2, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 38, minWidth: 112, paddingHorizontal: 0 },
  valueInput: { flex: .7, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 38, minWidth: 58, paddingHorizontal: 0, textAlign: 'right' },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChip: { borderRadius: 999, borderWidth: 1, minHeight: 28, paddingHorizontal: 9, justifyContent: 'center' },
  unitButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 3, height: 34, justifyContent: 'center', minWidth: 54, paddingHorizontal: 7 },
  removeButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 28 },
  addButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44 },
});
