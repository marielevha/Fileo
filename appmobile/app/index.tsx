import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen';
import { getAuthSession } from '../src/auth/session';
import { hasSeenOnboarding, markOnboardingSeen } from '../src/onboarding/installation';

const SPLASH_HOLD_DURATION = 2500;
const SPLASH_FADE_DURATION = 500;
type Destination = 'atelier' | 'onboarding' | 'login';

export default function Index() {
  const router = useRouter();
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [destination, setDestination] = useState<Destination | null>(null);
  const [holdComplete, setHoldComplete] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await getAuthSession();
      if (session) {
        await markOnboardingSeen().catch(() => undefined);
        return 'atelier' as const;
      }
      return await hasSeenOnboarding() ? 'login' as const : 'onboarding' as const;
    })().then((target) => {
      if (active) setDestination(target);
    }).catch(() => {
      if (active) setDestination('onboarding');
    });
    const timeout = setTimeout(() => setHoldComplete(true), SPLASH_HOLD_DURATION);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!holdComplete || destination === null) return;
    if (destination !== 'onboarding') {
      router.replace(destination === 'atelier' ? '/atelier' : '/login');
      return;
    }
    Animated.timing(splashOpacity, {
      duration: SPLASH_FADE_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) router.replace('/onboarding');
    });
    return () => splashOpacity.stopAnimation();
  }, [destination, holdComplete, router, splashOpacity]);

  return (
    <>
      {destination === 'onboarding' ? <OnboardingScreen onContinue={() => router.replace('/login')} /> : <View style={styles.background} />}
      <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
        <StatusBar style="light" />
        <Image
          accessibilityLabel="Filéo"
          resizeMode="contain"
          source={require('../assets/images/fileo-splash-vertical-hd.png')}
          style={styles.splashLogo}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#1F1235', flex: 1 },
  splash: {
    alignItems: 'center',
    backgroundColor: '#1F1235',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  splashLogo: {
    height: 182,
    width: 160,
  },
});
