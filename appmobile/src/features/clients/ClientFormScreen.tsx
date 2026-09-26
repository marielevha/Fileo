import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Check, Contact, Phone, UserRound, UsersRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createClient, getClient, updateClient } from '../../api/client';
import { AppText } from '../../components/AppText';
import { palette, useAppTheme } from '../../theme';
import type { ClientInput } from '../../types/clients';

export function ClientFormScreen({ clientId }: { clientId?: string }) {
  const theme = useAppTheme(); const router = useRouter(); const editing = Boolean(clientId);
  const [displayName, setDisplayName] = useState(''); const [phone, setPhone] = useState('');
  const [otherContact, setOtherContact] = useState(''); const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState(''); const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(editing); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!clientId) return;
    let active = true; setLoading(true); setError(null);
    void getClient(clientId).then((client) => { if (!active) return; setDisplayName(client.display_name); setPhone(client.phone_e164 ?? ''); setOtherContact(client.other_contact ?? ''); setGuardianName(client.guardian_name ?? ''); setGuardianPhone(client.guardian_phone ?? ''); setNotes(client.notes ?? ''); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Impossible de charger ce client.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId]));

  async function submit() {
    if (displayName.trim().length < 2) return setError('Indiquez le nom complet du client.');
    const payload: ClientInput = { displayName: displayName.trim(), phone: clean(phone), otherContact: clean(otherContact), guardianName: clean(guardianName), guardianPhone: clean(guardianPhone), notes: clean(notes) };
    setSubmitting(true); setError(null);
    try {
      const result = clientId ? await updateClient(clientId, payload) : await createClient(payload);
      router.replace(`/atelier/clients/${result.id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Impossible de ${editing ? 'modifier' : 'créer'} ce client.`);
    } finally { setSubmitting(false); }
  }

  if (loading) return <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.primary} size="large" /></SafeAreaView>;

  return <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}><Pressable accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.iconButton, { borderColor: theme.colors.border }]}><ArrowLeft color={theme.colors.text} size={21} /></Pressable><View style={styles.heading}><AppText variant="title2">{editing ? 'Modifier le client' : 'Nouveau client'}</AppText><AppText color={theme.colors.textMuted} variant="caption">Coordonnées et informations utiles</AppText></View></View>
        <Section title="Identité et contact"><Label text="Nom complet" /><Field autoCapitalize="words" icon={UserRound} onChangeText={setDisplayName} placeholder="Ex. Amélie Nkouka" value={displayName} /><Label text="Téléphone" /><Field icon={Phone} keyboardType="phone-pad" onChangeText={setPhone} placeholder="06 123 45 67" value={phone} /><Label text="Autre contact" /><Field icon={Contact} onChangeText={setOtherContact} placeholder="Email, WhatsApp secondaire..." value={otherContact} /></Section>
        <Section title="Responsable ou proche"><AppText color={theme.colors.textMuted} variant="caption">Utile lorsque la commande concerne un enfant ou une autre personne.</AppText><Label text="Nom du responsable" /><Field autoCapitalize="words" icon={UsersRound} onChangeText={setGuardianName} placeholder="Optionnel" value={guardianName} /><Label text="Téléphone du responsable" /><Field icon={Phone} keyboardType="phone-pad" onChangeText={setGuardianPhone} placeholder="Optionnel" value={guardianPhone} /></Section>
        <Section title="Notes"><Field multiline onChangeText={setNotes} placeholder="Préférences, habitudes, informations importantes..." value={notes} /></Section>
        {error ? <View style={[styles.error, { backgroundColor: theme.colors.secondarySoft, borderColor: theme.colors.secondary }]}><AppText color={theme.colors.secondary} variant="caption">{error}</AppText></View> : null}
        <Pressable disabled={submitting} onPress={submit} style={({ pressed }) => [styles.submit, (pressed || submitting) && styles.pressed]}>{submitting ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={20} /><AppText color={palette.white} variant="bodyMedium">{editing ? 'Enregistrer les modifications' : 'Créer le client'}</AppText></>}</Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Section({ children, title }: { children: React.ReactNode; title: string }) { const theme=useAppTheme(); return <View style={[styles.section,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}><AppText variant="title3">{title}</AppText><View style={styles.sectionBody}>{children}</View></View>; }
function Label({ text }: { text: string }) { const theme=useAppTheme(); return <AppText color={theme.colors.textMuted} variant="caption">{text}</AppText>; }
function Field({ icon: Icon, multiline, ...props }: React.ComponentProps<typeof TextInput> & { icon?: typeof UserRound }) { const theme=useAppTheme(); return <View style={[styles.fieldWrap,multiline&&styles.fieldMultiline,{backgroundColor:theme.colors.surfaceMuted,borderColor:theme.colors.border}]}>{Icon?<Icon color={theme.colors.textSubtle} size={18}/>:null}<TextInput {...props} multiline={multiline} placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.field,multiline&&styles.multiline,{color:theme.colors.text}]}/></View>; }
function clean(value:string){return value.trim()||null;}

const styles=StyleSheet.create({safeArea:{flex:1},flex:{flex:1},center:{alignItems:'center',flex:1,justifyContent:'center'},content:{alignSelf:'center',gap:14,maxWidth:720,padding:18,paddingBottom:40,width:'100%'},topBar:{alignItems:'center',flexDirection:'row',marginBottom:4},iconButton:{alignItems:'center',borderRadius:8,borderWidth:1,height:44,justifyContent:'center',width:44},heading:{flex:1,marginLeft:13},section:{borderRadius:8,borderWidth:1,padding:16},sectionBody:{gap:10,marginTop:14},fieldWrap:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',minHeight:50,paddingHorizontal:13},fieldMultiline:{alignItems:'flex-start',minHeight:112,paddingTop:4},field:{flex:1,fontFamily:'Inter_400Regular',fontSize:15,minHeight:48,paddingHorizontal:7,paddingVertical:0},multiline:{minHeight:102,paddingTop:12,textAlignVertical:'top'},error:{borderRadius:8,borderWidth:1,padding:12},submit:{alignItems:'center',backgroundColor:palette.violet700,borderRadius:8,flexDirection:'row',gap:9,justifyContent:'center',minHeight:56},pressed:{opacity:.72}});
