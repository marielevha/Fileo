import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';

const clients = [
  { title: 'Nadine Makaya', subtitle: '+242069801234 - 2 commandes', meta: 'Active' },
  { title: 'Rodrigue Samba', subtitle: '+242061234567 - 1 commande', meta: 'Active' },
  { title: 'Grace Bouiti', subtitle: 'Contact secondaire renseigne', meta: 'New' },
];

export function ClientsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Clients</Text>
        <PrimaryButton style={styles.button}>Nouveau</PrimaryButton>
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">Carnet atelier</Text>
        {clients.map((client) => (
          <ListRow key={client.title} {...client} />
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
