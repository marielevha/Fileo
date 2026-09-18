import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { ListRow } from '@/src/components/ListRow';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

const planning = [
  { title: 'Lun. 14 sept.', subtitle: '2 echeances, 1 essayage', meta: '3' },
  { title: 'Mar. 15 sept.', subtitle: 'Chemise manches longues - Serge', meta: '1' },
  { title: 'Mer. 16 sept.', subtitle: 'Aucun evenement critique', meta: '0' },
];

export function PlanningScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Planning</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Semaine</Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text variant="subtitle">Vue rapide</Text>
        {planning.map((item) => (
          <ListRow key={item.title} {...item} />
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
  pill: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    color: colors.textStrong,
    fontWeight: '800',
  },
  card: {
    gap: 4,
  },
});
