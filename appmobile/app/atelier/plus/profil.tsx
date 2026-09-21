import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { getBootstrap, updateProfile } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { ActionButton, FormField, MorePage, moreStyles } from '../../../src/features/more/ui';
import { useAppTheme } from '../../../src/theme';

export default function ProfileScreen() {
  const theme=useAppTheme(); const [name,setName]=useState(''); const [phone,setPhone]=useState(''); const [role,setRole]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  useFocusEffect(useCallback(()=>{let active=true;void getBootstrap().then((data)=>{if(active){setName(data.user.fullName);setPhone(data.user.phone);setRole(data.capabilities.role==='owner'?'Responsable':'Collaborateur');setError(null);}}).catch((caught)=>{if(active)setError(caught instanceof Error?caught.message:'Chargement impossible.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]));
  async function save(){setSaving(true);setError(null);try{await updateProfile(name.trim());Alert.alert('Profil enregistré','Votre nom a été mis à jour.');}catch(caught){setError(caught instanceof Error?caught.message:'Enregistrement impossible.');}finally{setSaving(false);}}
  return <MorePage error={error} loading={loading} title="Mon profil"><View style={moreStyles.section}><FormField label="Nom complet" onChangeText={setName} value={name}/><FormField editable={false} label="Téléphone de connexion" value={phone}/><FormField editable={false} label="Rôle dans l’atelier" value={role}/><AppText color={theme.colors.textMuted} variant="caption">Le numéro de connexion ne peut pas être modifié ici.</AppText></View><ActionButton disabled={name.trim().length<2} label="Enregistrer" loading={saving} onPress={()=>void save()}/></MorePage>;
}
