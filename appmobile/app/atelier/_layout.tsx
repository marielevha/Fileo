import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getAuthSession } from '../../src/auth/session';
import { SyncOverviewProvider } from '../../src/sync/overview';

export default function AtelierLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getAuthSession().then((session) => {
      if (!active) return;
      if (!session) router.replace('/login');
      else setReady(true);
    });
    return () => { active = false; };
  }, [router]);

  if (!ready) return <View style={{ backgroundColor: '#1F1235', flex: 1 }} />;
  return <SyncOverviewProvider><Stack screenOptions={{ headerShown: false }} /></SyncOverviewProvider>;
}
