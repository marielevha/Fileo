import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts as useOutfitFonts,
} from '@expo-google-fonts/outfit';
import { useAssets } from 'expo-asset';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useAppTheme } from '../src/theme';

void SystemUI.setBackgroundColorAsync('#1F1235');
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return <ThemeProvider><AppRoot /></ThemeProvider>;
}

function AppRoot() {
  const theme = useAppTheme();
  const [assets, assetError] = useAssets([
    require('../assets/images/fileo-splash-vertical-hd.png'),
    require('../assets/images/onboarding-workshop.png'),
  ]);
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [outfitLoaded] = useOutfitFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  const appReady = Boolean(assets) && !assetError && interLoaded && outfitLoaded;

  useEffect(() => {
    if (appReady) {
      void SplashScreen.hideAsync();
    }
  }, [appReady]);

  useEffect(() => {
    if (appReady) void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [appReady, theme.colors.background]);

  if (assetError) {
    throw assetError;
  }

  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.colors.statusBar} />
      <Stack
        screenOptions={{
          animation: 'fade',
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  );
}
