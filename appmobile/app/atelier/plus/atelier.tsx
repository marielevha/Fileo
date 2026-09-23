import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { getBootstrap, getWorkshopDetails, updateWorkshop } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { ActionButton, FormField, MorePage, moreStyles } from '../../../src/features/more/ui';
import { useAppTheme } from '../../../src/theme';

function unitsFromWorkshop(raw: string | string[] | undefined, fallback: string[]) {
  if (Array.isArray(raw)) return raw.length ? raw : fallback;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((unit) => String(unit)).filter(Boolean);
    } catch {
      return raw.split(/[\n,;|]+/).map((unit) => unit.trim().toLowerCase()).filter(Boolean);
    }
  }
  return fallback;
}

export default function WorkshopScreen() {
  const theme = useAppTheme();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [timezone, setTimezone] = useState('');
  const [measurementUnits, setMeasurementUnits] = useState<string[]>(['cm', 'mm', 'm']);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([getBootstrap(), getWorkshopDetails()])
      .then(([session, data]) => {
        if (!active) return;
        const measurementUnits = unitsFromWorkshop(data.measurement_units_json, session.workshop.measurementUnits?.length ? session.workshop.measurementUnits : ['cm', 'mm', 'm']);
        setOwner(session.capabilities.role === 'owner');
        setName(data.name);
        setCity(data.city ?? '');
        setCountry(data.country_code);
        setCurrency(data.currency);
        setTimezone(data.timezone);
        setMeasurementUnits(measurementUnits);
        setError(null);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateWorkshop(name.trim(), city.trim(), measurementUnits);
      Alert.alert('Atelier enregistré', 'Les informations ont été mises à jour.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MorePage error={error} loading={loading} title="Mon atelier">
      <View style={moreStyles.section}>
        <FormField editable={owner} label="Nom de l'atelier" onChangeText={setName} value={name} />
        <FormField editable={owner} label="Ville" onChangeText={setCity} value={city} />
        <FormField editable={false} label="Pays" value={country === 'CG' ? 'Congo' : country === 'CD' ? 'RDC' : country} />
        <FormField editable={false} label="Devise" value={currency} />
        <FormField editable={false} label="Fuseau horaire" value={timezone} />
        {!owner ? <AppText color={theme.colors.textMuted} variant="caption">Seul un responsable peut modifier les informations de l'atelier.</AppText> : null}
      </View>
      {owner ? <ActionButton disabled={name.trim().length < 2} label="Enregistrer" loading={saving} onPress={() => void save()} /> : null}
    </MorePage>
  );
}
