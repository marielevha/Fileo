import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { ChevronRight, CircleHelp, CreditCard, HandCoins, Info, LogOut, Moon, RefreshCw, Settings2, Store, Sun, UserRound, UsersRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBootstrap, logout } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { usePublicConfig } from '../../../src/support/useSupportEmail';
import { syncBadge, useSyncOverview } from '../../../src/sync/overview';
import { useAppTheme, useThemePreference } from '../../../src/theme';
import type { BootstrapResponse } from '../../../src/types/dashboard';

export default function MoreScreen() {
  const theme = useAppTheme();
  const { preference } = useThemePreference();
  const sync = useSyncOverview();
  const { config } = usePublicConfig();
  const router = useRouter();
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void getBootstrap().then((result) => { if (active) { setData(result); setError(null); } }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); });
    return () => { active = false; };
  }, []));

  function confirmLogout() {
    Alert.alert('Se déconnecter', 'Quitter cette session sur cet appareil ?', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void performLogout() },
    ]);
  }
  async function performLogout() {
    setLeaving(true);
    try { await logout(); }
    catch { /* La session locale est fermee meme si le serveur est indisponible. */ }
    finally { router.replace('/login'); setLeaving(false); }
  }

  const owner = data?.capabilities.role === 'owner';
  return <SafeAreaView style={[styles.safe,{backgroundColor:theme.colors.background}]}><ScrollView contentContainerStyle={styles.content}>
    <AppText variant="title1">Plus</AppText>
    {error?<AppText color={theme.colors.secondary}>{error}</AppText>:null}
    <View style={[styles.identity,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}>
      <View style={[styles.avatar,{backgroundColor:theme.colors.primarySoft}]}><UserRound color={theme.colors.primary} size={25}/></View>
      <View style={styles.identityText}><AppText numberOfLines={1} variant="title3">{data?.user.fullName??'Mon profil'}</AppText><AppText color={theme.colors.textMuted} numberOfLines={1} variant="caption">{data?`${data.workshop.name} · ${owner?'Responsable':'Collaborateur'}`:'Chargement...'}</AppText></View>
    </View>
    <View style={styles.group}>
      <AppText color={theme.colors.textMuted} variant="caption">COMPTE ET ATELIER</AppText>
      <MenuRow icon={UserRound} label="Mon profil" onPress={()=>router.push('/atelier/plus/profil')} />
      <MenuRow icon={Store} label="Mon atelier" onPress={()=>router.push('/atelier/plus/atelier')} />
      {owner?<MenuRow icon={UsersRound} label="Équipe" onPress={()=>router.push('/atelier/plus/equipe')} />:null}
      {owner?<MenuRow icon={Settings2} label="Paramètres" onPress={()=>router.push('/atelier/plus/parametres' as Href)} />:null}
      {owner?<MenuRow icon={HandCoins} label="Affiliation" onPress={()=>router.push('/atelier/plus/affiliation' as Href)} />:null}
      {owner?<MenuRow icon={CreditCard} label="Abonnement" onPress={()=>router.push('/atelier/plus/abonnement')} />:null}
    </View>
    <View style={styles.group}>
      <AppText color={theme.colors.textMuted} variant="caption">PRÉFÉRENCES</AppText>
      <MenuRow badge={syncBadge(sync)} icon={RefreshCw} label="Synchronisation" onPress={()=>router.push('/atelier/plus/synchronisation')} />
      <MenuRow icon={preference==='dark'?Moon:Sun} label="Thème" detail={preference==='system'?'Système':preference==='dark'?'Sombre':'Clair'} onPress={()=>router.push('/atelier/plus/theme')} />
    </View>
    <View style={styles.group}>
      <AppText color={theme.colors.textMuted} variant="caption">AIDE ET INFORMATIONS</AppText>
      <MenuRow icon={CircleHelp} label="FAQ" onPress={()=>router.push('/atelier/plus/faq')} />
      <MenuRow icon={Info} label="À propos" onPress={()=>router.push('/atelier/plus/a-propos')} />
    </View>
    <Pressable accessibilityRole="button" disabled={leaving} onPress={confirmLogout} style={[styles.logout,{borderColor:theme.colors.border}]}>{leaving?<ActivityIndicator color={theme.colors.secondary}/>:<LogOut color={theme.colors.secondary} size={20}/>}<AppText color={theme.colors.secondary} variant="label">Se déconnecter</AppText></Pressable>
    <View style={styles.footer}><AppText color={theme.colors.textSubtle} style={styles.footerText} variant="caption">Filéo · Version {config?.appVersion??'1.0.0'}</AppText><AppText color={theme.colors.textSubtle} style={styles.footerText} variant="caption">Propulsé par {config?.companyName??'Nzelobi'}</AppText></View>
  </ScrollView></SafeAreaView>;
}

function MenuRow({icon:Icon,label,detail,badge,onPress}:{icon:typeof UserRound;label:string;detail?:string;badge?:number|'!';onPress:()=>void}) {
  const theme=useAppTheme();
  return <Pressable accessibilityLabel={badge===undefined?label:`${label}, ${badge==='!'?'attention requise':`${badge} élément${badge>1?'s':''} à suivre`}`} accessibilityRole="button" onPress={onPress} style={[styles.row,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}><Icon color={theme.colors.primary} size={20}/><AppText style={styles.rowLabel} variant="label">{label}</AppText>{detail?<AppText color={theme.colors.textMuted} variant="caption">{detail}</AppText>:null}{badge!==undefined?<View style={styles.syncBadge}><AppText color="#fff" style={styles.syncBadgeText}>{badge}</AppText></View>:null}<ChevronRight color={theme.colors.textSubtle} size={18}/></Pressable>;
}

const styles=StyleSheet.create({safe:{flex:1},content:{flexGrow:1,gap:20,padding:20,paddingBottom:32},identity:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:13,padding:15},avatar:{alignItems:'center',borderRadius:8,height:48,justifyContent:'center',width:48},identityText:{flex:1,minWidth:0},group:{gap:9},row:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:12,minHeight:56,paddingHorizontal:15},rowLabel:{flex:1},syncBadge:{alignItems:'center',backgroundColor:'#FF3B30',borderRadius:10,height:20,justifyContent:'center',minWidth:20,paddingHorizontal:4},syncBadgeText:{fontFamily:'Inter_700Bold',fontSize:11,lineHeight:14},logout:{alignItems:'center',alignSelf:'flex-start',borderRadius:8,borderWidth:1,flexDirection:'row',gap:10,minHeight:48,paddingHorizontal:16},footer:{gap:3,marginTop:'auto',paddingTop:8},footerText:{textAlign:'center'}});
