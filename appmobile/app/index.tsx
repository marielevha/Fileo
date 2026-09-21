import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';

import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen';
import { getAuthSession } from '../src/auth/session';

const SPLASH_HOLD_DURATION = 2500;
const SPLASH_FADE_DURATION = 500;

export default function Index() {
  const router = useRouter();
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      void getAuthSession().then((session) => {
        Animated.timing(splashOpacity, {
          duration: SPLASH_FADE_DURATION,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) router.replace(session ? '/atelier' : '/onboarding');
        });
      });
    }, SPLASH_HOLD_DURATION);

    return () => {
      clearTimeout(timeout);
      splashOpacity.stopAnimation();
    };
  }, [router, splashOpacity]);

  return (
    <>
      <OnboardingScreen onContinue={() => router.replace('/login')} />
      <Animated.View pointerEvents="none" style={[styles.splash, { opacity: splashOpacity }]}>
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
