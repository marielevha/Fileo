import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { colors } from '@/src/theme/colors';

const SPLASH_DURATION_MS = 1100;

export function SplashScreen() {
  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/onboarding');
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.screen}>
      <BrandLogo compact style={styles.mark} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mark: {
    height: 92,
    width: 92,
  },
});
