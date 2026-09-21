import { useFocusEffect } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { declareSubscriptionPayment, getSubscription } from '../../../src/api/client';
import { AppText } from '../../../src/components/AppText';
import { ActionButton, FormField, MorePage, SelectRow } from '../../../src/features/more/ui';
import { useAppTheme } from '../../../src/theme';
import type { Plan, SubscriptionOverview } from '../../../src/types/more';

const channels=[['mobile_money','MTN MoMo'],['airtel_money','Airtel Money'],['transfer','Virement'],['cash','Espèces']] as const;
const statusLabels:Record<string,string>={trial:'Essai',active:'Actif',renewal_due:'À renouveler',suspended:'Suspendu',cancelled:'Annulé',declared:'À valider',provider_pending:'En attente',validated:'Validé',rejected:'Rejeté'};
const formatMoney=(amount:number,currency:string)=>`${new Intl.NumberFormat('fr-FR').format(amount)} ${currency==='XAF'?'FCFA':currency==='CDF'?'FC':currency}`;

export default function SubscriptionScreen(){
  const theme=useAppTheme();const [data,setData]=useState<SubscriptionOverview|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [selectedPlan,setSelectedPlan]=useState('');const [channel,setChannel]=useState<string>('mobile_money');const [reference,setReference]=useState('');const [formOpen,setFormOpen]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{const result=await getSubscription();setData(result);setSelectedPlan((current)=>current||result.currentPlan?.id||result.availablePlans[0]?.id||'');setError(null);}catch(caught){setError(caught instanceof Error?caught.message:'Chargement impossible.');}finally{setLoading(false);}},[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const plan=data?.availablePlans.find((item)=>item.id===selectedPlan);
  async function declare(){if(!plan)return;setBusy(true);setError(null);try{await declareSubscriptionPayment({planId:plan.id,channel,reference:reference.trim()});setReference('');setFormOpen(false);await load();Alert.alert('Paiement déclaré','L’équipe Filéo validera votre déclaration.');}catch(caught){setError(caught instanceof Error?caught.message:'Déclaration impossible.');}finally{setBusy(false);}}
  return <MorePage error={error} loading={loading&&!data} title="Abonnement">{data?<>
    <View style={[styles.current,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}><CreditCard color={theme.colors.primary} size={22}/><View style={{flex:1}}><AppText variant="title3">{data.currentPlan?.label??'Aucune offre'}</AppText><AppText color={theme.colors.textMuted} variant="caption">{statusLabels[data.subscription?.status??'']??'Statut non défini'} · {data.subscription?.current_period_end?`Jusqu’au ${new Date(data.subscription.current_period_end).toLocaleDateString('fr-FR')}`:'Période non définie'}</AppText><AppText color={theme.colors.textMuted} variant="caption">{data.usage.memberLimit===null?'Membres illimités':`${data.usage.activeMembers}/${data.usage.memberLimit} membres actifs`}</AppText></View></View>
    <AppText variant="title3">Offres disponibles</AppText>
    {data.availablePlans.map((item)=><PlanRow key={item.id} onPress={()=>setSelectedPlan(item.id)} plan={item} selected={item.id===selectedPlan}/>) }
    {plan?<><ActionButton label={formOpen?'Masquer le formulaire':'Déclarer un paiement'} onPress={()=>setFormOpen(!formOpen)} secondary/>{formOpen?<View style={styles.form}><AppText variant="title3">Paiement manuel</AppText><AppText color={theme.colors.textMuted} variant="caption">Payez le montant exact de l’offre, puis renseignez la référence de transaction. L’activation intervient après validation par Filéo.</AppText><AppText variant="label">{plan.label} · {formatMoney(plan.price.amount,plan.price.currency)}</AppText><AppText color={theme.colors.textMuted} variant="caption">Moyen de paiement</AppText>{channels.map(([value,label])=><SelectRow key={value} label={label} onPress={()=>setChannel(value)} selected={channel===value}/>) }<FormField label="Référence de transaction" onChangeText={setReference} value={reference}/><ActionButton disabled={!reference.trim()} label="Envoyer la déclaration" loading={busy} onPress={()=>Alert.alert('Confirmer la déclaration',`${formatMoney(plan.price.amount,plan.price.currency)} · ${plan.label}`, [{text:'Retour',style:'cancel'},{text:'Confirmer',onPress:()=>void declare()}])}/></View>:null}</>:null}
    <AppText variant="title3">Historique des paiements</AppText>
    {data.payments.length?data.payments.map((payment)=><View key={payment.id} style={[styles.payment,{borderBottomColor:theme.colors.border}]}><View style={{flex:1}}><AppText variant="label">{formatMoney(payment.amount,payment.currency)}</AppText><AppText color={theme.colors.textMuted} variant="caption">{payment.plan_label??'Offre'} · {new Date(payment.declared_at).toLocaleDateString('fr-FR')}</AppText><AppText color={theme.colors.textSubtle} numberOfLines={1} variant="caption">{payment.external_reference??''}</AppText></View><AppText color={payment.status==='validated'?theme.colors.accent:payment.status==='rejected'?theme.colors.secondary:theme.colors.warning} variant="caption">{statusLabels[payment.status]??payment.status}</AppText></View>):<AppText color={theme.colors.textMuted} variant="caption">Aucun paiement déclaré.</AppText>}
  </>:null}</MorePage>;
}

function PlanRow({plan,selected,onPress}:{plan:Plan;selected:boolean;onPress:()=>void}){const theme=useAppTheme();return <Pressable accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={[styles.plan,{backgroundColor:selected?theme.colors.primarySoft:theme.colors.surface,borderColor:selected?theme.colors.primary:theme.colors.border}]}><View style={{flex:1}}><AppText color={selected?theme.colors.primary:theme.colors.text} variant="label">{plan.label}</AppText><AppText color={theme.colors.textMuted} variant="caption">{plan.limits.members===null?'Membres illimités':`${plan.limits.members} membres`} · {plan.period_months} mois</AppText></View><AppText color={theme.colors.primary} variant="label">{formatMoney(plan.price.amount,plan.price.currency)}</AppText></Pressable>;}

const styles=StyleSheet.create({current:{alignItems:'flex-start',borderRadius:8,borderWidth:1,flexDirection:'row',gap:12,padding:15},plan:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:10,minHeight:74,padding:13},form:{gap:11,marginTop:4},payment:{alignItems:'center',borderBottomWidth:1,flexDirection:'row',gap:10,minHeight:78,paddingVertical:10}});
