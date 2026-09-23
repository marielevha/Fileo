import { Check, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login } from '../../api/client';
import { saveAuthSession } from '../../auth/session';
import { AppText } from '../../components/AppText';
import { BrandLogo } from '../../components/BrandLogo';
import { palette, useAppTheme } from '../../theme';
import type { CountryCode } from '../../types/auth';

const countries: Array<{ code: CountryCode; label: string; dial: string }> = [
  { code: 'CG', label: 'Congo', dial: '+242' },
  { code: 'CD', label: 'RDC', dial: '+243' },
];

const testCredentials = __DEV__
  ? { phone: '061111111', password: 'Atelier2026!' }
  : { phone: '', password: '' };

export function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [country, setCountry] = useState<CountryCode>('CG');
  const [phone, setPhone] = useState(testCredentials.phone);
  const [password, setPassword] = useState(testCredentials.password);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = countries.find((item) => item.code === country) ?? countries[0];

  async function submit() {
    if (!phone.trim() || !password) {
      setError('Renseignez votre numéro et votre mot de passe.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const session = await login({ country, phone, password });
      await saveAuthSession(session, remember);
      router.replace('/atelier');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <BrandLogo inverse size="small" />
            <AppText color={palette.white} style={styles.title} variant="title2">
              Connectez-vous à votre atelier
            </AppText>
            <AppText color="rgba(255, 255, 255, 0.62)" style={styles.intro}>
              Retrouvez vos clients, commandes et encaissements au même endroit.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText color="rgba(255, 255, 255, 0.78)" variant="label">
              Pays
            </AppText>
            <View style={styles.countryControl}>
              {countries.map((item) => {
                const selected = item.code === country;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={item.code}
                    onPress={() => setCountry(item.code)}
                    style={[styles.countryOption, selected && styles.countryOptionSelected]}
                  >
                    <AppText
                      color={selected ? palette.white : 'rgba(255, 255, 255, 0.62)'}
                      variant="label"
                    >
                      {item.label} {item.dial}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <AppText color="rgba(255, 255, 255, 0.78)" variant="label">
                Numéro de téléphone
              </AppText>
              <View style={styles.phoneField}>
                <AppText color={theme.colors.accent} variant="bodyMedium">
                  {selectedCountry.dial}
                </AppText>
                <View style={styles.phoneDivider} />
                <TextInput
                  accessibilityLabel="Numéro de téléphone"
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  onChangeText={setPhone}
                  placeholder="06 123 45 67"
                  placeholderTextColor="rgba(255, 255, 255, 0.32)"
                  selectionColor={theme.colors.accent}
                  style={styles.phoneInput}
                  value={phone}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText color="rgba(255, 255, 255, 0.78)" variant="label">
                Mot de passe
              </AppText>
              <View style={styles.passwordField}>
                <TextInput
                  accessibilityLabel="Mot de passe"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  placeholder="Votre mot de passe"
                  placeholderTextColor="rgba(255, 255, 255, 0.32)"
                  returnKeyType="done"
                  secureTextEntry={!passwordVisible}
                  selectionColor={theme.colors.accent}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  hitSlop={10}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  style={styles.iconButton}
                >
                  {passwordVisible ? (
                    <EyeOff color="rgba(255, 255, 255, 0.62)" size={20} />
                  ) : (
                    <Eye color="rgba(255, 255, 255, 0.62)" size={20} />
                  )}
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              onPress={() => setRemember((value) => !value)}
              style={styles.rememberRow}
            >
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember ? <Check color={palette.violet950} size={14} strokeWidth={3} /> : null}
              </View>
              <AppText color="rgba(255, 255, 255, 0.7)" variant="caption">
                Rester connecté sur cet appareil
              </AppText>
            </Pressable>

            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/mot-de-passe-oublie', params: { country, phone: phone.trim() } })} style={styles.forgotLink}>
              <AppText color={theme.colors.accent} variant="label">Mot de passe oublié ?</AppText>
            </Pressable>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AppText color="#FFD8E8" variant="caption">
                  {error}
                </AppText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || loading) && styles.submitButtonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={palette.violet950} />
              ) : (
                <AppText color={palette.violet950} variant="bodyMedium">
                  Se connecter
                </AppText>
              )}
            </Pressable>

            <View style={styles.registerRow}>
              <AppText color="rgba(255, 255, 255, 0.62)" variant="caption">
                Pas encore de compte ?
              </AppText>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => router.replace('/register')}
              >
                <AppText color={theme.colors.accent} variant="label">
                  Créer un compte
                </AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.violet950, flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
  },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { marginTop: 28, textAlign: 'center' },
  intro: { marginTop: 8, maxWidth: 360, textAlign: 'center' },
  form: { gap: 12 },
  countryControl: {
    backgroundColor: '#291A39',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  countryOption: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  countryOptionSelected: { backgroundColor: '#5930B5' },
  fieldGroup: { gap: 7 },
  phoneField: {
    alignItems: 'center',
    backgroundColor: '#291A39',
    borderColor: '#3B2A4D',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  phoneDivider: { backgroundColor: '#4A365E', height: 24, marginHorizontal: 12, width: 1 },
  phoneInput: {
    color: palette.white,
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    minHeight: 54,
    paddingVertical: 0,
  },
  passwordField: {
    alignItems: 'center',
    backgroundColor: '#291A39',
    borderColor: '#3B2A4D',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingLeft: 16,
  },
  passwordInput: {
    color: palette.white,
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    minHeight: 54,
    paddingVertical: 0,
  },
  iconButton: { alignItems: 'center', height: 52, justifyContent: 'center', width: 52 },
  rememberRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    minHeight: 36,
  },
  forgotLink: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center' },
  checkbox: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.46)',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkboxChecked: { backgroundColor: '#55D3CC', borderColor: '#55D3CC' },
  errorBox: {
    backgroundColor: 'rgba(232, 76, 155, 0.16)',
    borderColor: 'rgba(241, 120, 181, 0.44)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 56,
    paddingHorizontal: 24,
  },
  submitButtonPressed: { opacity: 0.78 },
  registerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 32,
  },
});
