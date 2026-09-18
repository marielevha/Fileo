import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

type ListRowProps = {
  title: string;
  subtitle: string;
  meta?: string;
};

export function ListRow({ title, subtitle, meta }: ListRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text variant="caption">{subtitle}</Text>
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textStrong,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
