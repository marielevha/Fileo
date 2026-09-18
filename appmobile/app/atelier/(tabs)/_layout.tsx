import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/src/theme/colors';

type TabIconName = ComponentProps<typeof SymbolView>['name'];

function icon(name: TabIconName) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name} tintColor={String(color)} size={24} />
  );
}

export default function AtelierTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: icon({ ios: 'house.fill', android: 'home', web: 'home' }),
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarIcon: icon({ ios: 'doc.text.fill', android: 'list', web: 'list' }),
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: 'Planning',
          tabBarIcon: icon({ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: icon({ ios: 'person.2.fill', android: 'person_2', web: 'person_2' }),
        }}
      />
      <Tabs.Screen
        name="paiements"
        options={{
          title: 'Paiements',
          tabBarIcon: icon({ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }),
        }}
      />
    </Tabs>
  );
}
