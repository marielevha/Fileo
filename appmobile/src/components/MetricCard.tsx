import { StyleSheet, View } from 'react-native';

import { Card } from '@/src/components/Card';
import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

type MetricCardProps = {
  label: string;
  value: string;
  tone?: 'accent' | 'cyan' | 'success' | 'warning';
};

export function MetricCard({ label, value, tone = 'accent' }: MetricCardProps) {
  return (
    <Card style={styles.card}>
      <View style={[styles.dot, { backgroundColor: colors[tone] }]} />
      <Text variant="metric" style={{ color: colors[tone] }}>
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 146,
    gap: 8,
  },
  dot: {
    borderRadius: 999,
    height: 8,
    width: 34,
  },
});
