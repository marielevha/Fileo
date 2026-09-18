import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

const todayRows = [
  { title: 'Robe ceremonie', subtitle: 'Essayage a 14:00 - Nadine Makaya', meta: 'En cours' },
  { title: 'Pantalon droit', subtitle: 'Echeance aujourd hui - Rodrigue Samba', meta: 'Pret' },
  { title: 'Uniforme scolaire', subtitle: 'Mesures a verifier - Grace Bouiti', meta: 'A faire' },
];

export function DashboardScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="caption">Atelier</Text>
          <Text variant="title">Tableau de bord</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Mobile</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <MetricCard label="Commandes ouvertes" tone="accent" value="18" />
        <MetricCard label="A livrer cette semaine" tone="cyan" value="7" />
      </View>
      <View style={styles.metrics}>
        <MetricCard label="Clients actifs" tone="success" value="42" />
        <MetricCard label="Paiements attendus" tone="warning" value="5" />
      </View>

      <Card style={styles.section}>
        <Text variant="subtitle">Aujourdhui</Text>
        {todayRows.map((row) => (
          <ListRow key={row.title} {...row} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: colors.panel,
    fontSize: 12,
    fontWeight: '900',
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    gap: 4,
  },
});
