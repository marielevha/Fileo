import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/src/components/Text';
import { OnboardingIllustration } from '@/src/features/onboarding/OnboardingIllustration';
import { colors } from '@/src/theme/colors';

const slides = [
  {
    title: 'Commandes sans brouillon',
    description: 'Creez une commande, ajoutez les articles et gardez les mesures au bon endroit.',
    kind: 'orders',
  },
  {
    title: 'Planning clair',
    description: 'Suivez les essayages, les echeances et les retards sans perdre le fil.',
    kind: 'planning',
  },
  {
    title: 'Paiements maitrises',
    description: 'Visualisez les acomptes, les soldes et les encaissements attendus par commande.',
    kind: 'payments',
  },
] as const;

type SymbolName = ComponentProps<typeof SymbolView>['name'];

export function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isFirst = index === 0;
  const isLast = index === slides.length - 1;
  const canGoBack = !isFirst;

  const nextIcon = useMemo<SymbolName>(
    () => ({
      ios: isLast ? 'checkmark' : 'chevron.right',
      android: isLast ? 'check' : 'chevron_right',
      web: isLast ? 'check' : 'chevron_right',
    }),
    [isLast],
  );

  function goLogin() {
    router.replace('/login');
  }

  function goNext() {
    if (isLast) {
      goLogin();
      return;
    }
    setIndex((value) => value + 1);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoBack}
            onPress={() => setIndex((value) => Math.max(0, value - 1))}
            style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={24}
              tintColor={colors.background}
            />
          </Pressable>

          <Pressable accessibilityRole="button" onPress={goLogin} style={styles.skipButton}>
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        </View>

        <View style={styles.illustrationWrap}>
          <OnboardingIllustration kind={slide.kind} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((item, dotIndex) => (
              <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>

          <Pressable accessibilityRole="button" onPress={goNext} style={styles.nextButton}>
            <SymbolView name={nextIcon} size={28} tintColor={colors.white} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 32,
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  navButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  navButtonDisabled: {
    opacity: 0,
  },
  skipButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  skipText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  illustrationWrap: {
    alignItems: 'center',
    flex: 1.15,
    justifyContent: 'center',
    minHeight: 330,
    paddingHorizontal: 2,
  },
  copy: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 30,
    paddingHorizontal: 8,
  },
  title: {
    color: '#251f3d',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },
  description: {
    color: '#6d6683',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 290,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    paddingLeft: 6,
  },
  dot: {
    backgroundColor: '#eadff7',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 18,
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
});
