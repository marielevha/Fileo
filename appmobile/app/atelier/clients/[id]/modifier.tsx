import { useLocalSearchParams } from 'expo-router';

import { ClientFormScreen } from '../../../../src/features/clients/ClientFormScreen';

export default function EditClientRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientFormScreen clientId={id} />;
}
