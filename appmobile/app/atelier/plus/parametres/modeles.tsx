import { useFocusEffect } from 'expo-router';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { deleteTemplate, getBootstrap, listTemplates, saveTemplate, type TemplateInput } from '../../../../src/api/client';
import { AppText } from '../../../../src/components/AppText';
import { ActionButton, MorePage } from '../../../../src/features/more/ui';
import { palette, useAppTheme } from '../../../../src/theme';
import type { ArticleTemplate } from '../../../../src/types/dashboard';

type FieldDraft = { id: string; label: string; unit: string };
type TemplateDraft = {
  id?: string;
  name: string;
  description: string;
  defaultWorkType: 'creation' | 'retouche';
  active: boolean;
  sortOrder: string;
  fields: FieldDraft[];
};

const emptyDraft = (unit = 'cm'): TemplateDraft => ({
  name: '',
  description: '',
  defaultWorkType: 'creation',
  active: true,
  sortOrder: '0',
  fields: [{ id: makeId(), label: '', unit }],
});

export default function TemplatesScreen() {
  const theme = useAppTheme();
  const [templates, setTemplates] = useState<ArticleTemplate[]>([]);
  const [units, setUnits] = useState(['cm', 'mm', 'm']);
  const [draft, setDraft] = useState<TemplateDraft>(() => emptyDraft());
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitOptions = useMemo(() => Array.from(new Set([...units, ...draft.fields.map((field) => field.unit).filter(Boolean)])), [draft.fields, units]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrap, result] = await Promise.all([getBootstrap(), listTemplates()]);
      setUnits(bootstrap.workshop.measurementUnits?.length ? bootstrap.workshop.measurementUnits : ['cm', 'mm', 'm']);
      setTemplates(result.items);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function startCreate() {
    setDraft(emptyDraft(units[0] ?? 'cm'));
    setEditorOpen(true);
    setError(null);
  }

  function startEdit(template: ArticleTemplate) {
    setDraft({
      id: template.id,
      name: template.name,
      description: template.description ?? '',
      defaultWorkType: template.defaultWorkType,
      active: template.active,
      sortOrder: String(template.sortOrder ?? 0),
      fields: template.fields.length
        ? template.fields.map((field) => ({ id: makeId(), label: field.label, unit: field.unit || units[0] || 'cm' }))
        : [{ id: makeId(), label: '', unit: units[0] ?? 'cm' }],
    });
    setEditorOpen(true);
    setError(null);
  }

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setDraft((current) => ({ ...current, fields: current.fields.map((field) => field.id === id ? { ...field, ...patch } : field) }));
  }

  function removeField(id: string) {
    setDraft((current) => {
      const fields = current.fields.filter((field) => field.id !== id);
      return { ...current, fields: fields.length ? fields : [{ id: makeId(), label: '', unit: units[0] ?? 'cm' }] };
    });
  }

  async function submit() {
    const name = draft.name.trim();
    if (name.length < 2) return setError('Renseignez le nom du modèle.');
    const fields = draft.fields
      .map((field) => ({ label: field.label.trim(), unit: field.unit.trim() || units[0] || 'cm' }))
      .filter((field) => field.label);
    if (!fields.length) return setError('Ajoutez au moins une mensuration.');
    const payload: TemplateInput = {
      name,
      description: draft.description.trim() || null,
      defaultWorkType: draft.defaultWorkType,
      active: draft.active,
      sortOrder: Math.max(0, Number.parseInt(draft.sortOrder, 10) || 0),
      fields,
    };
    setSaving(true);
    setError(null);
    try {
      await saveTemplate(payload, draft.id);
      setEditorOpen(false);
      setDraft(emptyDraft(units[0] ?? 'cm'));
      await load();
      Alert.alert('Modèle enregistré');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(template: ArticleTemplate) {
    Alert.alert('Supprimer le modèle', template.name, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void remove(template.id) },
    ]);
  }

  async function remove(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteTemplate(id);
      if (draft.id === id) setEditorOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MorePage error={error} loading={loading} title="Modèles">
      <View style={styles.stack}>
        <ActionButton label={editorOpen ? 'Masquer le formulaire' : 'Nouveau modèle'} onPress={editorOpen ? () => setEditorOpen(false) : startCreate} secondary={editorOpen} />
        {editorOpen ? (
          <View style={[styles.editor, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Label text="Article" />
            <Field onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))} placeholder="Robe, pantalon..." value={draft.name} />
            <Label text="Description" />
            <Field onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))} placeholder="Usage interne optionnel" value={draft.description} />
            <Label text="Type par défaut" />
            <View style={[styles.segmented, { backgroundColor: theme.colors.surfaceMuted }]}>
              <SegmentButton label="Création" selected={draft.defaultWorkType === 'creation'} onPress={() => setDraft((current) => ({ ...current, defaultWorkType: 'creation' }))} />
              <SegmentButton label="Retouche" selected={draft.defaultWorkType === 'retouche'} onPress={() => setDraft((current) => ({ ...current, defaultWorkType: 'retouche' }))} />
            </View>
            <View style={styles.inline}>
              <View style={{ flex: 1 }}>
                <Label text="Ordre" />
                <Field keyboardType="number-pad" onChangeText={(value) => setDraft((current) => ({ ...current, sortOrder: value }))} value={draft.sortOrder} />
              </View>
              <View style={styles.switchRow}>
                <AppText variant="label">Actif</AppText>
                <Switch onValueChange={(value) => setDraft((current) => ({ ...current, active: value }))} thumbColor={draft.active ? theme.colors.primary : undefined} value={draft.active} />
              </View>
            </View>
            <View style={styles.fieldsHeader}>
              <AppText variant="label">Mensurations</AppText>
              <Pressable onPress={() => setDraft((current) => ({ ...current, fields: [...current.fields, { id: makeId(), label: '', unit: units[0] ?? 'cm' }] }))} style={styles.addInline}>
                <Plus color={theme.colors.primary} size={17} />
                <AppText color={theme.colors.primary} variant="caption">Ajouter</AppText>
              </Pressable>
            </View>
            {draft.fields.map((field) => (
              <View key={field.id} style={[styles.fieldRow, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
                <TextInput onChangeText={(value) => updateField(field.id, { label: value })} placeholder="Poitrine" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.measureInput, { color: theme.colors.text }]} value={field.label} />
                <Pressable onPress={() => updateField(field.id, { unit: nextUnit(field.unit, unitOptions) })} style={[styles.unitButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <AppText color={theme.colors.primary} variant="label">{field.unit || units[0] || 'cm'}</AppText>
                  <ChevronDown color={theme.colors.textSubtle} size={13} />
                </Pressable>
                <Pressable accessibilityLabel="Retirer la mensuration" onPress={() => removeField(field.id)} style={styles.iconButton}>
                  <Trash2 color={theme.colors.secondary} size={16} />
                </Pressable>
              </View>
            ))}
            <View style={styles.actions}>
              {draft.id ? <Pressable onPress={() => setEditorOpen(false)} style={[styles.outline, { borderColor: theme.colors.border }]}><X color={theme.colors.textMuted} size={18} /><AppText variant="label">Annuler</AppText></Pressable> : null}
              <Pressable disabled={saving} onPress={() => void submit()} style={[styles.save, saving && styles.disabled]}>
                {saving ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={18} /><AppText color={palette.white} variant="label">Enregistrer</AppText></>}
              </Pressable>
            </View>
          </View>
        ) : null}
        {templates.map((template) => (
          <View key={template.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.cardCopy}>
              <View style={styles.cardTitle}>
                <AppText variant="label">{template.name}</AppText>
                <AppText color={template.active ? theme.colors.accent : theme.colors.textMuted} variant="caption">{template.active ? 'Actif' : 'Inactif'}</AppText>
              </View>
              <AppText color={theme.colors.textMuted} numberOfLines={2} variant="caption">{template.fields.map((field) => `${field.label} ${field.unit}`).join(' · ') || 'Aucune mensuration'}</AppText>
            </View>
            <Pressable accessibilityLabel="Modifier" onPress={() => startEdit(template)} style={styles.iconButton}><Pencil color={theme.colors.primary} size={18} /></Pressable>
            <Pressable accessibilityLabel="Supprimer" onPress={() => confirmDelete(template)} style={styles.iconButton}><Trash2 color={theme.colors.secondary} size={18} /></Pressable>
          </View>
        ))}
        {!templates.length ? <AppText color={theme.colors.textMuted} style={styles.empty} variant="caption">Aucun modèle configuré.</AppText> : null}
      </View>
    </MorePage>
  );
}

function Label({ text }: { text: string }) {
  const theme = useAppTheme();
  return <AppText color={theme.colors.textMuted} variant="caption">{text}</AppText>;
}

function Field(props: ComponentProps<typeof TextInput>) {
  const theme = useAppTheme();
  return <TextInput {...props} placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.input, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border, color: theme.colors.text }]} />;
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return <Pressable onPress={onPress} style={[styles.segment, selected && { backgroundColor: theme.colors.primary }]}><AppText color={selected ? palette.white : theme.colors.textMuted} variant="caption">{label}</AppText></Pressable>;
}

function nextUnit(current: string, units: string[]) {
  const options = units.length ? units : ['cm', 'mm', 'm'];
  const index = options.indexOf(current);
  return options[(index + 1) % options.length] ?? 'cm';
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const styles = StyleSheet.create({
  stack: { gap: 12, marginTop: 8 },
  editor: { borderRadius: 8, borderWidth: 1, gap: 9, padding: 14 },
  input: { borderRadius: 8, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 15, minHeight: 48, paddingHorizontal: 12 },
  segmented: { borderRadius: 8, flexDirection: 'row', padding: 4 },
  segment: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 38 },
  inline: { alignItems: 'flex-end', flexDirection: 'row', gap: 12 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 48 },
  fieldsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  addInline: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 34 },
  fieldRow: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 52, paddingHorizontal: 8 },
  measureInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 44 },
  unitButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 3, height: 34, justifyContent: 'center', minWidth: 58, paddingHorizontal: 7 },
  iconButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 38 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  outline: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 13 },
  save: { alignItems: 'center', backgroundColor: palette.violet700, borderRadius: 8, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 15 },
  disabled: { opacity: .5 },
  card: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 72, padding: 12 },
  cardCopy: { flex: 1, gap: 4, minWidth: 0 },
  cardTitle: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', marginTop: 18 },
});
