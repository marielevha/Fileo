import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen';
import { markOnboardingSeen } from '../src/onboarding/installation';

export default function OnboardingRoute() {
  const router = useRouter();

  useEffect(() => {
    void markOnboardingSeen().catch(() => undefined);
  }, []);

  return <OnboardingScreen onContinue={() => router.replace('/login')} />;
}
