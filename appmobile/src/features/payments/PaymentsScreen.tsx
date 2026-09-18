import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';

const rows = [
  { title: 'CMD-0004 - Nadine Makaya', subtitle: 'Acompte recu 5 000 FCFA', meta: '7 000' },
  { title: 'CMD-0003 - Rodrigue Samba', subtitle: 'Solde attendu a la remise', meta: '3 500' },
  { title: 'CMD-0002 - Grace Bouiti', subtitle: 'Paiement complet', meta: 'OK' },
];

export function PaymentsScreen() {
  return (
    <Screen>
      <Text variant="title">Paiements</Text>
      <View style={styles.metrics}>
        <MetricCard label="A encaisser" tone="accent" value="10k" />
        <MetricCard label="En retard" tone="warning" value="2" />
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">Suivi encaissement</Text>
        {rows.map((row) => (
          <ListRow key={row.title} {...row} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    gap: 4,
  },
});
