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

import { register } from '../../api/client';
import { AppText } from '../../components/AppText';
import { BrandLogo } from '../../components/BrandLogo';
import { palette, useAppTheme } from '../../theme';
import type { CountryCode } from '../../types/auth';

const countries = [
  { code: 'CG' as const, label: 'Congo', dial: '+242', currency: 'XAF' as const },
  { code: 'CD' as const, label: 'RDC', dial: '+243', currency: 'CDF' as const },
];

export function RegisterScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [country, setCountry] = useState<CountryCode>('CG');
  const [fullName, setFullName] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [city, setCity] = useState('');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = countries.find((item) => item.code === country) ?? countries[0];

  async function submit() {
    if (!fullName.trim() || !workshopName.trim() || !phone.trim() || !password) {
      setError('Complétez les informations obligatoires.');
      return;
    }
    if (password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!termsAccepted) {
      setError('Acceptez les conditions pour continuer.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register({
        fullName: fullName.trim(),
        workshopName: workshopName.trim(),
        city: city.trim() || undefined,
        affiliateCode: affiliateCode.trim() || undefined,
        country,
        currency: selectedCountry.currency,
        phone,
        password,
        termsAccepted: true,
      });
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <BrandLogo inverse size="small" />
          </View>

          <View style={styles.heading}>
            <AppText color={palette.white} style={styles.title} variant="title2">
              Créez votre atelier
            </AppText>
            <AppText color="rgba(255, 255, 255, 0.62)" style={styles.intro}>
              Configurez votre accès Filéo en quelques informations.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText color="rgba(255, 255, 255, 0.78)" variant="label">Pays</AppText>
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
                    <AppText color={selected ? palette.white : 'rgba(255, 255, 255, 0.62)'} variant="label">
                      {item.label} {item.dial}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <Field label="Nom complet" onChangeText={setFullName} placeholder="Votre nom" value={fullName} />
            <Field label="Nom de l’atelier" onChangeText={setWorkshopName} placeholder="Atelier Filéo" value={workshopName} />
            <Field label="Ville (facultatif)" onChangeText={setCity} placeholder="Brazzaville" value={city} />
            <Field autoCapitalize="characters" label="Code d'affiliation (facultatif)" onChangeText={setAffiliateCode} placeholder="FILEO-BZV" value={affiliateCode} />

            <View style={styles.fieldGroup}>
              <AppText color="rgba(255, 255, 255, 0.78)" variant="label">Numéro de téléphone</AppText>
              <View style={styles.phoneField}>
                <AppText color={theme.colors.accent} variant="bodyMedium">{selectedCountry.dial}</AppText>
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

            <PasswordField
              label="Mot de passe"
              onChangeText={setPassword}
              onToggle={() => setPasswordVisible((visible) => !visible)}
              value={password}
              visible={passwordVisible}
            />
            <PasswordField
              label="Confirmer le mot de passe"
              onChangeText={setConfirmation}
              onSubmit={submit}
              onToggle={() => setPasswordVisible((visible) => !visible)}
              value={confirmation}
              visible={passwordVisible}
            />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              onPress={() => setTermsAccepted((accepted) => !accepted)}
              style={styles.termsRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted ? <Check color={palette.violet950} size={14} strokeWidth={3} /> : null}
              </View>
              <AppText color="rgba(255, 255, 255, 0.7)" style={styles.termsText} variant="caption">
                J’accepte les conditions générales et la politique de confidentialité.
              </AppText>
            </Pressable>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AppText color="#FFD8E8" variant="caption">{error}</AppText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.submitButton, (pressed || loading) && styles.submitButtonPressed]}
            >
              {loading ? (
                <ActivityIndicator color={palette.violet950} />
              ) : (
                <AppText color={palette.violet950} variant="bodyMedium">Créer mon compte</AppText>
              )}
            </Pressable>

            <View style={styles.loginRow}>
              <AppText color="rgba(255, 255, 255, 0.62)" variant="caption">Déjà un compte ?</AppText>
              <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.replace('/login')}>
                <AppText color={theme.colors.accent} variant="label">Se connecter</AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' };

function Field({ label, value, placeholder, onChangeText, autoCapitalize = 'words' }: FieldProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.fieldGroup}>
      <AppText color="rgba(255, 255, 255, 0.78)" variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.32)"
        selectionColor={theme.colors.accent}
        style={styles.textField}
        value={value}
      />
    </View>
  );
}

type PasswordProps = {
  label: string;
  value: string;
  visible: boolean;
  onChangeText: (value: string) => void;
  onToggle: () => void;
  onSubmit?: () => void;
};

function PasswordField({ label, value, visible, onChangeText, onToggle, onSubmit }: PasswordProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.fieldGroup}>
      <AppText color="rgba(255, 255, 255, 0.78)" variant="label">{label}</AppText>
      <View style={styles.passwordField}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="8 caractères minimum"
          placeholderTextColor="rgba(255, 255, 255, 0.32)"
          secureTextEntry={!visible}
          selectionColor={theme.colors.accent}
          style={styles.passwordInput}
          value={value}
        />
        <Pressable accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} hitSlop={10} onPress={onToggle} style={styles.iconButton}>
          {visible ? <EyeOff color="rgba(255, 255, 255, 0.62)" size={20} /> : <Eye color="rgba(255, 255, 255, 0.62)" size={20} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.violet950, flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { alignSelf: 'center', flexGrow: 1, maxWidth: 520, paddingHorizontal: 24, paddingVertical: 20, width: '100%' },
  brand: { alignItems: 'center', minHeight: 48 },
  heading: { alignItems: 'center', marginBottom: 26, marginTop: 20 },
  title: { textAlign: 'center' },
  intro: { marginTop: 8, maxWidth: 360, textAlign: 'center' },
  form: { gap: 12 },
  countryControl: { backgroundColor: '#291A39', borderRadius: 12, flexDirection: 'row', gap: 4, padding: 4 },
  countryOption: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  countryOptionSelected: { backgroundColor: '#5930B5' },
  fieldGroup: { gap: 7 },
  textField: { backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 12, borderWidth: 1, color: palette.white, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 56, paddingHorizontal: 16, paddingVertical: 0 },
  phoneField: { alignItems: 'center', backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 16 },
  phoneDivider: { backgroundColor: '#4A365E', height: 24, marginHorizontal: 12, width: 1 },
  phoneInput: { color: palette.white, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 54, paddingVertical: 0 },
  passwordField: { alignItems: 'center', backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 56, paddingLeft: 16 },
  passwordInput: { color: palette.white, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 54, paddingVertical: 0 },
  iconButton: { alignItems: 'center', height: 52, justifyContent: 'center', width: 52 },
  termsRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginTop: 2, minHeight: 42 },
  termsText: { flex: 1, lineHeight: 19 },
  checkbox: { alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.46)', borderRadius: 5, borderWidth: 1.5, height: 20, justifyContent: 'center', marginTop: 1, width: 20 },
  checkboxChecked: { backgroundColor: '#55D3CC', borderColor: '#55D3CC' },
  errorBox: { backgroundColor: 'rgba(232, 76, 155, 0.16)', borderColor: 'rgba(241, 120, 181, 0.44)', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  submitButton: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 14, justifyContent: 'center', marginTop: 4, minHeight: 56, paddingHorizontal: 24 },
  submitButtonPressed: { opacity: 0.78 },
  loginRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 8, minHeight: 32 },
});
