import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { login } from '@/src/api/client';
import { Card } from '@/src/components/Card';
import { FormField } from '@/src/components/FormField';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Screen } from '@/src/components/Screen';
import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

export function LoginScreen() {
  const [phone, setPhone] = useState('+242061111111');
  const [password, setPassword] = useState('Atelier2026!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await login({
        country: 'CG',
        phone,
        password,
      });
      router.replace('/atelier');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <View style={styles.hero}>
          <Text variant="title">Fileo</Text>
          <Text variant="body" style={styles.subtitle}>
            Connectez votre atelier et gardez les commandes, le planning et les encaissements sous la main.
          </Text>
        </View>

        <Card style={styles.form}>
          <FormField
            autoCapitalize="none"
            keyboardType="phone-pad"
            label="Telephone"
            onChangeText={setPhone}
            placeholder="+242..."
            value={phone}
          />
          <FormField
            label="Mot de passe"
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            secureTextEntry
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton loading={loading} onPress={submit}>
            Se connecter
          </PrimaryButton>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  hero: {
    gap: 10,
  },
  subtitle: {
    color: colors.text,
    maxWidth: 340,
  },
  form: {
    gap: 16,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
