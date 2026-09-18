import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';

const orders = [
  { title: 'CMD-0004 - Nadine Makaya', subtitle: 'Robe civile blanche - reste 19 sept.', meta: '12 000 FCFA' },
  { title: 'CMD-0003 - Rodrigue Samba', subtitle: 'Chemises manches longues - 3 articles', meta: 'Pret' },
  { title: 'CMD-0002 - Grace Bouiti', subtitle: 'Ensemble pagne - en retard', meta: 'Urgent' },
];

export function OrdersScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Commandes</Text>
        <PrimaryButton style={styles.button}>Ajouter</PrimaryButton>
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">Dernieres commandes</Text>
        {orders.map((order) => (
          <ListRow key={order.title} {...order} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  button: {
    minHeight: 44,
    minWidth: 104,
  },
  card: {
    gap: 4,
  },
});
