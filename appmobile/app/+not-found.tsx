import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable' }} />
      <Screen scroll={false}>
        <Text variant="title">Page introuvable</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Retourner a l'accueil</Text>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 18,
  },
  linkText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
});
