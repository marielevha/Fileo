import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { palette, useAppTheme } from '../../theme';

export function MorePage({ children, title, loading = false, error }: PropsWithChildren<{ title: string; loading?: boolean; error?: string | null }>) {
  const theme=useAppTheme(); const router=useRouter();
  return <SafeAreaView style={{flex:1,backgroundColor:theme.colors.background}}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable accessibilityLabel="Retour" onPress={()=>router.back()} style={[styles.back,{borderColor:theme.colors.border}]}><ArrowLeft color={theme.colors.text} size={20}/></Pressable><AppText style={{flex:1}} variant="title2">{title}</AppText></View>
    {error?<View style={[styles.error,{backgroundColor:theme.colors.secondarySoft}]}><AppText color={theme.colors.secondary}>{error}</AppText></View>:null}
    {loading?<ActivityIndicator color={theme.colors.primary} style={{marginTop:28}}/>:children}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export function FormField({label,value,onChangeText,editable=true,keyboardType='default',placeholder}:{label:string;value:string;onChangeText?:(value:string)=>void;editable?:boolean;keyboardType?:'default'|'phone-pad'|'number-pad';placeholder?:string}) {
  const theme=useAppTheme();
  return <View style={styles.fieldGroup}><AppText color={theme.colors.textMuted} variant="caption">{label}</AppText><TextInput accessibilityLabel={label} editable={editable} keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.input,{backgroundColor:editable?theme.colors.surface:theme.colors.surfaceMuted,borderColor:theme.colors.border,color:editable?theme.colors.text:theme.colors.textMuted}]} value={value}/></View>;
}

export function ActionButton({label,onPress,loading=false,disabled=false,secondary=false}:{label:string;onPress:()=>void;loading?:boolean;disabled?:boolean;secondary?:boolean}) {
  const theme=useAppTheme();
  return <Pressable accessibilityRole="button" disabled={loading||disabled} onPress={onPress} style={[styles.button,{backgroundColor:secondary?theme.colors.surface:theme.colors.primary,borderColor:secondary?theme.colors.border:theme.colors.primary,opacity:loading||disabled?0.5:1}]}>{loading?<ActivityIndicator color={secondary?theme.colors.primary:palette.white}/>:secondary?null:<Check color={theme.colors.onPrimary} size={18}/>}<AppText color={secondary?theme.colors.text:theme.colors.onPrimary} variant="label">{label}</AppText></Pressable>;
}

export function SelectRow({label,selected,onPress,detail}:{label:string;selected:boolean;onPress:()=>void;detail?:string}) {
  const theme=useAppTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={[styles.select,{borderColor:selected?theme.colors.primary:theme.colors.border,backgroundColor:selected?theme.colors.primarySoft:theme.colors.surface}]}><View style={{flex:1}}><AppText color={selected?theme.colors.primary:theme.colors.text} variant="label">{label}</AppText>{detail?<AppText color={theme.colors.textMuted} variant="caption">{detail}</AppText>:null}</View><View style={[styles.radio,{borderColor:selected?theme.colors.primary:theme.colors.border,backgroundColor:selected?theme.colors.primary:theme.colors.surface}]}>{selected?<Check color={theme.colors.onPrimary} size={13}/>:null}</View></Pressable>;
}

const styles=StyleSheet.create({page:{alignSelf:'center',gap:16,maxWidth:760,padding:20,paddingBottom:48,width:'100%'},header:{alignItems:'center',flexDirection:'row',gap:12,marginBottom:4},back:{alignItems:'center',borderRadius:8,borderWidth:1,height:44,justifyContent:'center',width:44},error:{borderRadius:8,padding:12},fieldGroup:{gap:7},input:{borderRadius:8,borderWidth:1,fontFamily:'Inter_400Regular',fontSize:15,minHeight:50,paddingHorizontal:13},button:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:8,justifyContent:'center',minHeight:50,paddingHorizontal:16},select:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:12,minHeight:58,padding:13},radio:{alignItems:'center',borderRadius:999,borderWidth:1,height:22,justifyContent:'center',width:22},section:{gap:12,marginTop:12}});
export const moreStyles=styles;
