import { useRouter } from 'expo-router';

import { OnboardingScreen } from '../src/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  const router = useRouter();

  return <OnboardingScreen onContinue={() => router.replace('/login')} />;
}
