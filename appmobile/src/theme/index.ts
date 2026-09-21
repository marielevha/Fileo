import { createContext, createElement, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform, useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';
import { fontFamilies, radii, shadows, spacing, typography } from './foundations';

export type AppTheme = {
  isDark: boolean;
  colors: ThemeColors;
  fontFamilies: typeof fontFamilies;
  radii: typeof radii;
  shadows: typeof shadows;
  spacing: typeof spacing;
  typography: typeof typography;
};

const sharedTheme = { fontFamilies, radii, shadows, spacing, typography };

export const lightTheme: AppTheme = {
  ...sharedTheme,
  isDark: false,
  colors: lightColors,
};

export const darkTheme: AppTheme = {
  ...sharedTheme,
  isDark: true,
  colors: darkColors,
};

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'fileo.theme.preference';
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void }>({
  preference: 'system',
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  useEffect(() => {
    let active = true;
    const load = async () => {
      const stored = Platform.OS === 'web'
        ? typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_KEY)
        : await SecureStore.getItemAsync(THEME_KEY);
      if (active && (stored === 'light' || stored === 'dark')) setPreferenceState(stored);
    };
    void load().catch(() => undefined);
    return () => { active = false; };
  }, []);
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, value);
    } else {
      void SecureStore.setItemAsync(THEME_KEY, value).catch(() => undefined);
    }
  }, []);
  return createElement(ThemeContext.Provider, { value: { preference, setPreference } }, children);
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

export function useAppTheme(): AppTheme {
  const system = useColorScheme();
  const { preference } = useThemePreference();
  return (preference === 'system' ? system === 'dark' : preference === 'dark') ? darkTheme : lightTheme;
}

export { palette } from './colors';
