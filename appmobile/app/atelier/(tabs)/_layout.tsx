import { Tabs } from 'expo-router';
import { ClipboardList, Home, Menu, UsersRound, CalendarDays } from 'lucide-react-native';

import { useAppTheme } from '../../../src/theme';
import { syncBadge, useSyncOverview } from '../../../src/sync/overview';

export default function AtelierTabsLayout() {
  const theme = useAppTheme();
  const sync = useSyncOverview();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarLabelStyle: { fontFamily: theme.fontFamilies.bodySemiBold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} /> }} />
      <Tabs.Screen name="commandes" options={{ title: 'Commandes', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }} />
      <Tabs.Screen name="planning" options={{ title: 'Planning', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarBadge: syncBadge(sync), tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }} />
    </Tabs>
  );
}
