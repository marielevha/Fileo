import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Check, Eye, EyeOff, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, requestPasswordReset, resendPasswordResetCode, resetPassword, verifyPasswordResetCode } from '../../api/client';
import { AppText } from '../../components/AppText';
import { BrandLogo } from '../../components/BrandLogo';
import { useSupportEmail } from '../../support/useSupportEmail';
import { palette, useAppTheme } from '../../theme';
import type { CountryCode } from '../../types/auth';

type Stage = 'phone' | 'code' | 'password' | 'done';
const countries: Array<{ code: CountryCode; label: string; dial: string }> = [
  { code: 'CG', label: 'Congo', dial: '+242' },
  { code: 'CD', label: 'RDC', dial: '+243' },
];

export function PasswordRecoveryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ country?: string; phone?: string }>();
  const [stage, setStage] = useState<Stage>('phone');
  const [country, setCountry] = useState<CountryCode>(params.country === 'CD' ? 'CD' : 'CG');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsUnavailable, setSmsUnavailable] = useState(false);
  const { email: supportEmail, loading: supportLoading, reload: reloadSupport } = useSupportEmail();
  const dial = countries.find((item) => item.code === country)?.dial ?? '+242';
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (stage !== 'code' || !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, stage]);

  function handleError(caught: unknown) {
    if (caught instanceof ApiError && caught.code === 'sms_not_configured') {
      setSmsUnavailable(true);
      setError('La récupération par SMS n’est pas encore disponible. Contactez l’assistance pour retrouver votre accès.');
    } else setError(caught instanceof Error ? caught.message : 'Une erreur est survenue. Réessayez.');
  }

  async function requestCode(resend = false) {
    if (!phone.trim()) return setError('Indiquez votre numéro de téléphone.');
    setBusy(true); setError(null); setSmsUnavailable(false);
    try {
      const challenge = resend ? await resendPasswordResetCode(country, phone.trim()) : await requestPasswordReset(country, phone.trim());
      setResendAt(new Date(challenge.resendAfter).getTime());
      setNow(Date.now());
      setStage('code');
      setCode('');
    } catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) return setError('Saisissez le code à 6 chiffres.');
    setBusy(true); setError(null);
    try {
      const verified = await verifyPasswordResetCode(country, phone.trim(), code);
      setToken(verified.token);
      setStage('password');
    } catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  async function submitPassword() {
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) return setError('Utilisez au moins 8 caractères, avec une lettre et un chiffre.');
    if (password !== confirmation) return setError('Les mots de passe ne correspondent pas.');
    setBusy(true); setError(null);
    try {
      await resetPassword(token, password);
      setToken(''); setCode(''); setPassword(''); setConfirmation('');
      setStage('done');
    } catch (caught) { handleError(caught); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safeArea}>
    <StatusBar style="light" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityLabel="Retour à la connexion" onPress={() => router.replace('/login')} style={styles.back}><ArrowLeft color={palette.white} size={21} /></Pressable>
        <View style={styles.brand}><BrandLogo inverse size="small" /></View>
        <AppText color={palette.white} variant="title2">{stage === 'done' ? 'Mot de passe modifié' : 'Retrouver votre accès'}</AppText>
        <AppText color={styles.textMuted.color} style={styles.intro}>
          {stage === 'phone' ? 'Indiquez le numéro associé à votre compte pour recevoir un code de vérification.' :
            stage === 'code' ? `Saisissez le code envoyé au ${dial} ${phone.trim()}.` :
              stage === 'password' ? 'Choisissez un nouveau mot de passe pour votre compte.' : 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'}
        </AppText>

        {stage === 'phone' ? <View style={styles.fields}>
          <AppText color={styles.textMuted.color} variant="label">Pays</AppText>
          <View style={styles.countries}>{countries.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: country === item.code }} key={item.code} onPress={() => setCountry(item.code)} style={[styles.country, country === item.code && styles.countryActive]}><AppText color={palette.white} variant="label">{item.label} {item.dial}</AppText></Pressable>)}</View>
          <AppText color={styles.textMuted.color} variant="label">Numéro de téléphone</AppText>
          <View style={styles.phoneField}><AppText color={theme.colors.accent}>{dial}</AppText><TextInput accessibilityLabel="Numéro de téléphone" autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="06 123 45 67" placeholderTextColor={styles.placeholder.color} style={styles.phoneInput} value={phone} /></View>
        </View> : null}

        {stage === 'code' ? <View style={styles.fields}>
          <AppText color={styles.textMuted.color} variant="label">Code de vérification</AppText>
          <TextInput accessibilityLabel="Code de vérification" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} placeholder="000000" placeholderTextColor={styles.placeholder.color} style={[styles.input, styles.codeInput]} value={code} />
          <Pressable accessibilityRole="button" disabled={busy || waitSeconds > 0} onPress={() => void requestCode(true)} style={styles.resend}><AppText color={busy || waitSeconds > 0 ? styles.textMuted.color : theme.colors.accent} variant="label">{waitSeconds > 0 ? `Renvoyer le code dans ${waitSeconds} s` : 'Renvoyer le code'}</AppText></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setStage('phone'); setCode(''); setError(null); }}><AppText color={styles.textMuted.color} variant="caption">Changer de numéro</AppText></Pressable>
        </View> : null}

        {stage === 'password' ? <View style={styles.fields}>
          <AppText color={styles.textMuted.color} variant="label">Nouveau mot de passe</AppText>
          <View style={styles.passwordField}><TextInput accessibilityLabel="Nouveau mot de passe" autoCapitalize="none" autoComplete="new-password" onChangeText={setPassword} secureTextEntry={!passwordVisible} style={styles.passwordInput} value={password} /><Pressable accessibilityLabel={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setPasswordVisible((value) => !value)} style={styles.eye}>{passwordVisible ? <EyeOff color={palette.white} size={20} /> : <Eye color={palette.white} size={20} />}</Pressable></View>
          <AppText color={styles.textMuted.color} variant="label">Confirmer le mot de passe</AppText>
          <TextInput accessibilityLabel="Confirmer le mot de passe" autoCapitalize="none" autoComplete="new-password" onChangeText={setConfirmation} secureTextEntry={!passwordVisible} style={styles.input} value={confirmation} />
        </View> : null}

        {error ? <View accessibilityRole="alert" style={styles.error}><AppText color="#FFD8E8" variant="caption">{error}</AppText></View> : null}
        {smsUnavailable ? <Pressable accessibilityRole={supportEmail ? 'link' : 'button'} disabled={supportLoading && !supportEmail} onPress={() => supportEmail ? void Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent('Accès à mon compte Filéo')}`) : void reloadSupport()} style={styles.support}><Mail color={theme.colors.accent} size={18} /><AppText color={theme.colors.accent} variant="label">{supportEmail ? 'Contacter l’assistance' : supportLoading ? 'Chargement du contact...' : 'Réessayer de charger le contact'}</AppText></Pressable> : null}

        <Pressable accessibilityRole="button" disabled={busy} onPress={() => stage === 'phone' ? void requestCode() : stage === 'code' ? void verifyCode() : stage === 'password' ? void submitPassword() : router.replace('/login')} style={[styles.submit, busy && styles.disabled]}>{busy ? <ActivityIndicator color={palette.violet950} /> : <><AppText color={palette.violet950} variant="bodyMedium">{stage === 'phone' ? 'Recevoir un code' : stage === 'code' ? 'Vérifier le code' : stage === 'password' ? 'Modifier le mot de passe' : 'Se connecter'}</AppText>{stage === 'done' ? <Check color={palette.violet950} size={18} /> : null}</>}</Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.violet950, flex: 1 }, flex: { flex: 1 },
  content: { alignSelf: 'center', flexGrow: 1, justifyContent: 'center', maxWidth: 520, padding: 24, width: '100%' },
  back: { alignItems: 'center', borderColor: '#4A365E', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', marginBottom: 28, width: 44 },
  brand: { marginBottom: 28 }, intro: { marginTop: 9, marginBottom: 28 },
  textMuted: { color: 'rgba(255,255,255,0.72)' }, placeholder: { color: 'rgba(255,255,255,0.38)' },
  fields: { gap: 10 }, countries: { backgroundColor: '#291A39', borderRadius: 8, flexDirection: 'row', gap: 4, marginBottom: 8, padding: 4 },
  country: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center', minHeight: 44 }, countryActive: { backgroundColor: '#5930B5' },
  input: { backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 8, borderWidth: 1, color: palette.white, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  phoneField: { alignItems: 'center', backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 8, borderWidth: 1, flexDirection: 'row', paddingLeft: 16 },
  phoneInput: { color: palette.white, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 54, paddingHorizontal: 12 },
  codeInput: { fontSize: 22, letterSpacing: 0, textAlign: 'center' }, resend: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  passwordField: { alignItems: 'center', backgroundColor: '#291A39', borderColor: '#3B2A4D', borderRadius: 8, borderWidth: 1, flexDirection: 'row' },
  passwordInput: { color: palette.white, flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, minHeight: 54, paddingLeft: 16 }, eye: { alignItems: 'center', height: 52, justifyContent: 'center', width: 52 },
  error: { backgroundColor: 'rgba(232,76,155,0.16)', borderColor: 'rgba(241,120,181,0.44)', borderRadius: 8, borderWidth: 1, marginTop: 18, padding: 12 },
  support: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, minHeight: 44 },
  submit: { alignItems: 'center', backgroundColor: palette.white, borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 22, minHeight: 54 }, disabled: { opacity: 0.7 },
});
