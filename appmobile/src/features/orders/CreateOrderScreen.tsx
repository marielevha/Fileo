import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createOrder, getBootstrap, searchClients, uploadOrderAttachments } from '../../api/client';
import { AppText } from '../../components/AppText';
import { AttachmentPicker, type AttachmentDraft } from '../../components/AttachmentPicker';
import { DateField } from '../../components/DateField';
import { palette, useAppTheme } from '../../theme';
import type { ClientOption, CreateOrderRequest } from '../../types/orders';
import { formatDate, formatMoney, todayKey } from './orderUi';

type DraftItem = {
  id: string;
  category: string;
  description: string;
  workType: 'creation' | 'retouche';
  wearerName: string;
  unitPrice: string;
  dueDate: string;
  measurements: string;
};
type PaymentMethod = 'cash' | 'mobile_money' | 'transfer' | 'other';
const paymentMethodLabels: Record<PaymentMethod, string> = { cash: 'Espèces', mobile_money: 'Mobile money', transfer: 'Virement', other: 'Autre' };

const steps = ['Client', 'Articles', 'Planning', 'Validation'] as const;
const emptyItem = (): DraftItem => ({ id: `${Date.now()}-${Math.random()}`, category: '', description: '', workType: 'creation', wearerName: '', unitPrice: '', dueDate: '', measurements: '' });

export function CreateOrderScreen() {
  const theme = useAppTheme(); const router = useRouter(); const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ clientId?: string; clientName?: string; clientPhone?: string }>();
  const [step, setStep] = useState(0); const [canViewMoney, setCanViewMoney] = useState(false); const [currency, setCurrency] = useState('XAF');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientQuery, setClientQuery] = useState(params.clientName ?? ''); const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(params.clientId && params.clientName ? { id: params.clientId, display_name: params.clientName, phone_e164: params.clientPhone || null } : null);
  const [newClientName, setNewClientName] = useState(''); const [newClientPhone, setNewClientPhone] = useState('');
  const [promisedDate, setPromisedDate] = useState(''); const [fittingDate, setFittingDate] = useState(''); const [instructions, setInstructions] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]); const [draft, setDraft] = useState<DraftItem>(emptyItem()); const [editingId, setEditingId] = useState<string | null>(null); const [showItemDetails, setShowItemDetails] = useState(false);
  const [manualTotal, setManualTotal] = useState(''); const [payment, setPayment] = useState(''); const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash'); const [paymentReference, setPaymentReference] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [loadingClients, setLoadingClients] = useState(true); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => { void getBootstrap().then((data) => { setCanViewMoney(data.capabilities.canViewMoney); setCurrency(data.workshop.currency); }).catch(() => undefined); }, []);
  useEffect(() => {
    let active = true;
    const query = clientQuery.trim();
    if (query.length === 1) {
      setLoadingClients(false);
      return () => { active = false; };
    }
    const timeout = setTimeout(() => {
      setLoadingClients(true);
      void searchClients(query).then((rows) => { if (active) setClients((current) => mergeClients(current, rows)); }).catch(() => undefined).finally(() => { if (active) setLoadingClients(false); });
    }, query ? 220 : 0);
    return () => { active = false; clearTimeout(timeout); };
  }, [clientQuery]);

  const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + integer(item.unitPrice), 0), [items]);
  const orderTotal = itemsTotal > 0 ? itemsTotal : integer(manualTotal);
  const remaining = Math.max(0, orderTotal - integer(payment));
  const clientName = clientMode === 'existing' ? selectedClient?.display_name : newClientName.trim();
  const visibleClients = useMemo(() => filterClients(clients, clientQuery), [clientQuery, clients]);

  function commitDraft() {
    if (draft.category.trim().length < 2) { setItemError("Indiquez le type d'article."); return false; }
    if (draft.description.trim().length < 2) { setItemError('Décrivez le travail à réaliser.'); return false; }
    setItems((current) => editingId ? current.map((item) => item.id === editingId ? draft : item) : [...current, draft]);
    setDraft(emptyItem()); setEditingId(null); setItemError(null); setShowItemDetails(false);
    return true;
  }

  function editItem(item: DraftItem) { setDraft(item); setEditingId(item.id); setItemError(null); setShowItemDetails(true); }
  function cancelEdit() { setDraft(emptyItem()); setEditingId(null); setItemError(null); setShowItemDetails(false); }
  function hasDraftContent() { return Boolean(draft.category.trim() || draft.description.trim() || draft.wearerName.trim() || draft.measurements.trim() || draft.dueDate || draft.unitPrice); }

  function move(next: number) {
    setError(null); setItemError(null); setStep(next);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }

  function continueWizard() {
    setError(null);
    if (step === 0) {
      if (clientMode === 'existing' && !selectedClient) return setError('Sélectionnez un client.');
      if (clientMode === 'new' && newClientName.trim().length < 2) return setError('Indiquez le nom du nouveau client.');
    }
    if (step === 1) {
      if (hasDraftContent() && !commitDraft()) return;
      if (!items.length && !hasDraftContent()) return setError('Ajoutez au moins un article.');
    }
    move(Math.min(steps.length - 1, step + 1));
  }

  function previous() { if (step > 0) move(step - 1); else router.back(); }

  async function submit() {
    if (!items.length) { move(1); return setError('Ajoutez au moins un article.'); }
    setSubmitting(true); setError(null);
    const payload: CreateOrderRequest = {
      ...(clientMode === 'existing' ? { clientId: selectedClient!.id } : { client: { displayName: newClientName.trim(), phone: newClientPhone.trim() || null } }),
      promisedDate: promisedDate || null,
      fittingDate: fittingDate || null,
      instructions: instructions.trim() || null,
      orderTotalAmount: canViewMoney ? orderTotal : 0,
      items: items.map((item) => ({ category: item.category.trim(), description: item.description.trim(), workType: item.workType, wearerName: item.wearerName.trim() || null, quantity: 1, unitPriceAmount: canViewMoney ? integer(item.unitPrice) : 0, dueDate: item.dueDate || null, measurementValues: parseMeasurements(item.measurements) })),
      initialPayment: canViewMoney && integer(payment) > 0 ? { amount: integer(payment), method: paymentMethod, reference: paymentReference.trim() || null, effectiveDate: todayKey(), idempotencyKey: `mobile-order:${Date.now()}:${Math.random().toString(36).slice(2)}` } : null,
    };
    try {
      const result = await createOrder(payload);
      if (attachments.length) {
        try { await uploadOrderAttachments(result.orderId, attachments); }
        catch (caught) { Alert.alert('Commande créée, envoi incomplet', caught instanceof Error ? caught.message : "Certaines pièces jointes n'ont pas pu être envoyées. Vous pourrez les ajouter depuis sa fiche."); }
      }
      router.replace({ pathname: '/atelier/commandes/[id]', params: { id: result.orderId } });
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de créer la commande.'); }
    finally { setSubmitting(false); }
  }

  return <SafeAreaView style={[styles.safeArea,{backgroundColor:theme.colors.background}]}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.flex}>
      <View style={styles.topBar}><Pressable accessibilityLabel={step?'Étape précédente':'Retour'} onPress={previous} style={[styles.iconButton,{borderColor:theme.colors.border}]}><ArrowLeft color={theme.colors.text} size={21}/></Pressable><View style={styles.heading}><AppText variant="title2">Nouvelle commande</AppText><AppText color={theme.colors.textMuted} variant="caption">Étape {step+1} sur {steps.length} · {steps[step]}</AppText></View></View>
      <StepIndicator current={step} onSelect={(index)=>index<step&&move(index)}/>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step===0?<ClientStep clientMode={clientMode} clientQuery={clientQuery} clients={visibleClients} loading={loadingClients} newClientName={newClientName} newClientPhone={newClientPhone} selectedClient={selectedClient} setClientMode={setClientMode} setClientQuery={setClientQuery} setNewClientName={setNewClientName} setNewClientPhone={setNewClientPhone} setSelectedClient={setSelectedClient}/>:null}
        {step===1?<ArticlesStep canViewMoney={canViewMoney} currency={currency} draft={draft} editingId={editingId} error={itemError} items={items} onCancelEdit={cancelEdit} onCommit={commitDraft} onEdit={editItem} onRemove={(id)=>setItems((rows)=>rows.filter((row)=>row.id!==id))} setDraft={setDraft} setShowDetails={setShowItemDetails} showDetails={showItemDetails}/>:null}
        {step===2?<PlanningStep attachments={attachments} canViewMoney={canViewMoney} currency={currency} fittingDate={fittingDate} instructions={instructions} itemsTotal={itemsTotal} manualTotal={manualTotal} payment={payment} paymentMethod={paymentMethod} paymentReference={paymentReference} promisedDate={promisedDate} setAttachments={setAttachments} setFittingDate={setFittingDate} setInstructions={setInstructions} setManualTotal={setManualTotal} setPayment={setPayment} setPaymentMethod={setPaymentMethod} setPaymentReference={setPaymentReference} setPromisedDate={setPromisedDate}/>:null}
        {step===3?<ReviewStep attachmentCount={attachments.length} canViewMoney={canViewMoney} clientName={clientName||'Client'} currency={currency} fittingDate={fittingDate} instructions={instructions} items={items} orderTotal={orderTotal} payment={payment} paymentMethod={paymentMethod} paymentReference={paymentReference} promisedDate={promisedDate} remaining={remaining}/>:null}
        {error?<InlineError message={error}/>:null}
      </ScrollView>
      <View style={[styles.footer,{backgroundColor:theme.colors.background,borderTopColor:theme.colors.border}]}>{step>0?<Pressable disabled={submitting} onPress={previous} style={[styles.backButton,{borderColor:theme.colors.border}]}><ChevronLeft color={theme.colors.text} size={20}/><AppText variant="label">Précédent</AppText></Pressable>:<View/>}<Pressable disabled={submitting} onPress={step===steps.length-1?submit:continueWizard} style={({pressed})=>[styles.nextButton,(pressed||submitting)&&styles.pressed]}>{submitting?<ActivityIndicator color={palette.white}/>:<><AppText color={palette.white} variant="label">{step===steps.length-1?'Créer la commande':'Continuer'}</AppText>{step===steps.length-1?<Check color={palette.white} size={19}/>:<ChevronRight color={palette.white} size={20}/>}</>}</Pressable></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

type ClientStepProps = {
  clientMode:'existing'|'new'; clientQuery:string; clients:ClientOption[]; loading:boolean; newClientName:string; newClientPhone:string; selectedClient:ClientOption|null;
  setClientMode:(value:'existing'|'new')=>void; setClientQuery:(value:string)=>void; setNewClientName:(value:string)=>void; setNewClientPhone:(value:string)=>void; setSelectedClient:(value:ClientOption)=>void;
};
function ClientStep(props:ClientStepProps){const theme=useAppTheme();return <Section eyebrow="Étape 1" title="Pour qui est cette commande ?"><Segmented options={[['existing','Client existant'],['new','Nouveau client']]} value={props.clientMode} onChange={(value)=>props.setClientMode(value as 'existing'|'new')}/>{props.clientMode==='existing'?<><ClientSearch loading={props.loading} onChange={props.setClientQuery} value={props.clientQuery}/><View style={styles.clientList}>{props.clients.slice(0,8).map((client)=>{const selected=client.id===props.selectedClient?.id;return <Pressable key={client.id} onPress={()=>props.setSelectedClient(client)} style={[styles.clientRow,{borderColor:selected?theme.colors.primary:theme.colors.border,backgroundColor:selected?theme.colors.primarySoft:theme.colors.surface}]}><View style={[styles.clientAvatar,{backgroundColor:selected?theme.colors.primary:theme.colors.surfaceMuted}]}><AppText color={selected?palette.white:theme.colors.textMuted} variant="label">{initials(client.display_name)}</AppText></View><View style={styles.clientCopy}><AppText numberOfLines={1} variant="label">{client.display_name}</AppText><AppText color={theme.colors.textMuted} variant="caption">{client.phone_e164||'Sans téléphone'}</AppText></View>{selected?<Check color={theme.colors.primary} size={20}/>:<ChevronRight color={theme.colors.textSubtle} size={18}/>}</Pressable>;})}{!props.clients.length&&!props.loading?<View style={styles.noClients}><AppText color={theme.colors.textMuted} variant="caption">Aucun client trouvé</AppText></View>:null}</View></>:<View style={styles.fields}><Field icon={UserPlus} onChangeText={props.setNewClientName} placeholder="Nom complet" value={props.newClientName}/><Field keyboardType="phone-pad" onChangeText={props.setNewClientPhone} placeholder="Téléphone (optionnel)" value={props.newClientPhone}/></View>}</Section>;}

type ArticlesStepProps={canViewMoney:boolean;currency:string;draft:DraftItem;editingId:string|null;error:string|null;items:DraftItem[];showDetails:boolean;onCancelEdit:()=>void;onCommit:()=>boolean;onEdit:(item:DraftItem)=>void;onRemove:(id:string)=>void;setDraft:React.Dispatch<React.SetStateAction<DraftItem>>;setShowDetails:(value:boolean)=>void;};
function ArticlesStep(props:ArticlesStepProps){const theme=useAppTheme();return <View style={styles.stepStack}>{props.items.length?<Section eyebrow="Commande" title={`Articles ajoutés (${props.items.length})`}>{props.items.map((item)=><View key={item.id} style={[styles.itemRow,{borderBottomColor:theme.colors.border}]}><View style={styles.itemCopy}><AppText variant="label">{item.category}</AppText><AppText color={theme.colors.textMuted} numberOfLines={2} variant="caption">{item.description}</AppText>{props.canViewMoney?<AppText color={theme.colors.primary} variant="caption">{formatMoney(integer(item.unitPrice),props.currency)}</AppText>:null}</View><Pressable accessibilityLabel="Modifier" onPress={()=>props.onEdit(item)} style={styles.rowIcon}><Pencil color={theme.colors.primary} size={18}/></Pressable><Pressable accessibilityLabel="Supprimer" onPress={()=>props.onRemove(item.id)} style={styles.rowIcon}><Trash2 color={theme.colors.secondary} size={18}/></Pressable></View>)}</Section>:null}<Section eyebrow="Étape 2" title={props.editingId?"Modifier l'article":"Ajouter un article"}><Segmented options={[['creation','Création'],['retouche','Retouche']]} value={props.draft.workType} onChange={(value)=>props.setDraft((row)=>({...row,workType:value as 'creation'|'retouche'}))}/><Field onChangeText={(value)=>props.setDraft((row)=>({...row,category:value}))} placeholder="Article : robe, pantalon..." value={props.draft.category}/><Label text="Description du travail"/><Field multiline onChangeText={(value)=>props.setDraft((row)=>({...row,description:value}))} placeholder="Coupe, retouche, finitions..." value={props.draft.description}/><Label text="Mensurations"/><Field multiline onChangeText={(value)=>props.setDraft((row)=>({...row,measurements:value}))} placeholder={'Poitrine: 92\nTaille: 74\nLongueur: 110'} value={props.draft.measurements}/><Pressable onPress={()=>props.setShowDetails(!props.showDetails)} style={[styles.detailsToggle,{borderColor:theme.colors.border}]}><AppText color={theme.colors.primary} variant="label">Détails facultatifs</AppText>{props.showDetails?<ChevronUp color={theme.colors.primary} size={18}/>:<ChevronDown color={theme.colors.primary} size={18}/>}</Pressable>{props.showDetails?<View style={styles.optionalFields}><Label text="Pour qui ?"/><Field onChangeText={(value)=>props.setDraft((row)=>({...row,wearerName:value}))} placeholder="Optionnel" value={props.draft.wearerName}/><View style={styles.twoColumns}><View style={styles.column}><Label text="Échéance"/><Field onChangeText={(value)=>props.setDraft((row)=>({...row,dueDate:value}))} type="date" value={props.draft.dueDate}/></View>{props.canViewMoney?<View style={styles.column}><Label text={`Prix unitaire (${props.currency})`}/><Field keyboardType="number-pad" onChangeText={(value)=>props.setDraft((row)=>({...row,unitPrice:value}))} placeholder="0" value={props.draft.unitPrice}/></View>:null}</View></View>:null}{props.error?<InlineError message={props.error}/>:null}<View style={styles.editorActions}>{props.editingId?<Pressable onPress={props.onCancelEdit} style={[styles.secondaryButton,{borderColor:theme.colors.border}]}><X color={theme.colors.textMuted} size={18}/><AppText variant="label">Annuler</AppText></Pressable>:null}<Pressable onPress={props.onCommit} style={styles.smallPrimary}><Plus color={palette.white} size={19}/><AppText color={palette.white} variant="label">{props.editingId?'Mettre à jour':'Ajouter'}</AppText></Pressable></View></Section></View>;}

type PlanningStepProps = {
  attachments: AttachmentDraft[];
  canViewMoney: boolean;
  currency: string;
  fittingDate: string;
  instructions: string;
  itemsTotal: number;
  manualTotal: string;
  payment: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  promisedDate: string;
  setFittingDate: (value: string) => void;
  setAttachments: (files: AttachmentDraft[]) => void;
  setInstructions: (value: string) => void;
  setManualTotal: (value: string) => void;
  setPayment: (value: string) => void;
  setPaymentMethod: (value: PaymentMethod) => void;
  setPaymentReference: (value: string) => void;
  setPromisedDate: (value: string) => void;
};

function PlanningStep(props: PlanningStepProps) {
  return <View style={styles.stepStack}>
    <Section eyebrow="Étape 3" title="Organiser la commande">
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Label text="Livraison promise"/>
          <Field onChangeText={props.setPromisedDate} type="date" value={props.promisedDate}/>
        </View>
        <View style={styles.column}>
          <Label text="Essayage"/>
          <Field onChangeText={props.setFittingDate} type="date" value={props.fittingDate}/>
        </View>
      </View>
      <Label text="Consignes générales (facultatif)"/>
      <Field multiline onChangeText={props.setInstructions} placeholder="Détails importants pour l'atelier" value={props.instructions}/>
    </Section>

    <Section eyebrow="Facultatif" title="Photos et pièces jointes">
      <AttachmentPicker files={props.attachments} onChange={props.setAttachments}/>
    </Section>

    {props.canViewMoney ? <Section eyebrow="Facultatif" title="Montant et acompte">
      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Label text={`Total commande (${props.currency})`}/>
          <Field editable={props.itemsTotal === 0} keyboardType="number-pad" onChangeText={props.setManualTotal} placeholder="0" value={props.itemsTotal > 0 ? String(props.itemsTotal) : props.manualTotal}/>
        </View>
        <View style={styles.column}>
          <Label text={`Acompte (${props.currency})`}/>
          <Field keyboardType="number-pad" onChangeText={props.setPayment} placeholder="0" value={props.payment}/>
        </View>
      </View>
      {integer(props.payment) > 0 ? <>
        <Label text="Moyen de paiement"/>
        <Segmented options={[["cash","Espèces"],["mobile_money","Mobile"],["transfer","Virement"]]} value={props.paymentMethod} onChange={(value)=>props.setPaymentMethod(value as PaymentMethod)}/>
        <Field onChangeText={props.setPaymentReference} placeholder="Référence (optionnelle)" value={props.paymentReference}/>
      </> : null}
    </Section> : null}
  </View>;
}

type ReviewProps = {
  attachmentCount: number;
  canViewMoney: boolean;
  clientName: string;
  currency: string;
  fittingDate: string;
  instructions: string;
  items: DraftItem[];
  orderTotal: number;
  payment: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  promisedDate: string;
  remaining: number;
};

function ReviewStep(props: ReviewProps) {
  const theme = useAppTheme();
  return <Section eyebrow="Étape 4" title="Récapitulatif">
    <SummaryRow label="Client" value={props.clientName}/>
    <SummaryRow label="Articles" value={`${props.items.length}`}/>
    <SummaryRow label="Livraison" value={formatDate(props.promisedDate || null, 'Sans date')}/>
    <SummaryRow label="Essayage" value={formatDate(props.fittingDate || null, 'Sans date')}/>
    {props.instructions ? <SummaryRow label="Consignes" value={props.instructions}/> : null}
    <SummaryRow label="Pièces jointes" value={props.attachmentCount ? `${props.attachmentCount} fichier${props.attachmentCount > 1 ? 's' : ''}` : 'Aucune'}/>

    {props.items.map((item)=><View key={item.id} style={[styles.reviewItem,{borderTopColor:theme.colors.border}]}>
      <View style={styles.reviewItemCopy}>
        <AppText variant="label">{item.category}</AppText>
        <AppText color={theme.colors.textMuted} variant="caption">{item.workType === 'retouche' ? 'Retouche' : 'Création'}{item.wearerName ? ` · ${item.wearerName}` : ''}</AppText>
        <AppText color={theme.colors.textMuted} numberOfLines={3} variant="caption">{item.description}</AppText>
        {item.measurements ? <AppText color={theme.colors.textSubtle} numberOfLines={3} variant="caption">{item.measurements}</AppText> : null}
        {item.dueDate ? <AppText color={theme.colors.textSubtle} variant="caption">Échéance : {formatDate(item.dueDate)}</AppText> : null}
      </View>
      {props.canViewMoney ? <AppText variant="label">{formatMoney(integer(item.unitPrice), props.currency)}</AppText> : null}
    </View>)}

    {props.canViewMoney ? <View style={[styles.financialSummary,{backgroundColor:theme.colors.primarySoft}]}>
      <SummaryRow label="Total commande" value={formatMoney(props.orderTotal, props.currency)}/>
      {integer(props.payment) > 0 ? <>
        <SummaryRow label="Acompte reçu" value={formatMoney(integer(props.payment), props.currency)}/>
        <SummaryRow label="Moyen" value={paymentMethodLabels[props.paymentMethod]}/>
        {props.paymentReference ? <SummaryRow label="Référence" value={props.paymentReference}/> : null}
      </> : null}
      <View style={styles.remainingRow}>
        <AppText color={theme.colors.textMuted} variant="caption">Reste à payer</AppText>
        <AppText color={theme.colors.primary} variant="title3">{formatMoney(props.remaining, props.currency)}</AppText>
      </View>
    </View> : null}
  </Section>;
}
function StepIndicator({current,onSelect}:{current:number;onSelect:(index:number)=>void}){const theme=useAppTheme();return <View style={styles.progress}>{steps.map((label,index)=><Pressable accessibilityLabel={`Étape ${index+1} : ${label}`} disabled={index>=current} key={label} onPress={()=>onSelect(index)} style={styles.progressStep}><View style={styles.progressTrack}>{index>0?<View style={[styles.progressLine,{backgroundColor:index<=current?theme.colors.primary:theme.colors.border}]}/>:null}<View style={[styles.progressDot,{backgroundColor:index<=current?theme.colors.primary:theme.colors.surface,borderColor:index<=current?theme.colors.primary:theme.colors.border}]}>{index<current?<Check color={palette.white} size={13}/>:<AppText color={index===current?palette.white:theme.colors.textSubtle} variant="caption">{index+1}</AppText>}</View></View><AppText color={index===current?theme.colors.primary:theme.colors.textSubtle} numberOfLines={1} variant="caption">{label}</AppText></Pressable>)}</View>;}
function ClientSearch({loading,onChange,value}:{loading:boolean;onChange:(value:string)=>void;value:string}){const theme=useAppTheme();return <View style={[styles.clientSearch,{backgroundColor:theme.colors.surfaceMuted,borderColor:theme.colors.border}]}><Search color={theme.colors.textSubtle} size={18}/><TextInput autoCorrect={false} onChangeText={onChange} placeholder="Nom ou téléphone" placeholderTextColor={theme.colors.textSubtle} returnKeyType="search" selectionColor={theme.colors.primary} style={[styles.clientSearchInput,{color:theme.colors.text}]} value={value}/>{loading?<ActivityIndicator color={theme.colors.primary} size="small"/>:value?<Pressable accessibilityLabel="Effacer la recherche" onPress={()=>onChange('')} style={styles.clearSearch}><X color={theme.colors.textMuted} size={18}/></Pressable>:null}</View>;}
function Section({children,eyebrow,title}:{children:React.ReactNode;eyebrow?:string;title:string}){const theme=useAppTheme();return <View style={[styles.section,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}>{eyebrow?<AppText color={theme.colors.primary} variant="caption">{eyebrow}</AppText>:null}<AppText variant="title3">{title}</AppText><View style={styles.sectionBody}>{children}</View></View>;}
function SummaryRow({label,value}:{label:string;value:string}){const theme=useAppTheme();return <View style={[styles.summaryRow,{borderBottomColor:theme.colors.border}]}><AppText color={theme.colors.textMuted} variant="caption">{label}</AppText><AppText numberOfLines={3} style={styles.summaryValue} variant="label">{value}</AppText></View>;}
function Label({text}:{text:string}){const theme=useAppTheme();return <AppText color={theme.colors.textMuted} variant="caption">{text}</AppText>;}
function Field({icon:Icon,multiline,type='text',...props}:React.ComponentProps<typeof TextInput>&{icon?:typeof Search;type?:'text'|'date'}){const theme=useAppTheme();if(type==='date'&&typeof props.value==='string'&&props.onChangeText)return <DateField onChange={props.onChangeText} value={props.value}/>;return <View style={[styles.fieldWrap,multiline&&styles.fieldMultiline,{backgroundColor:theme.colors.surfaceMuted,borderColor:theme.colors.border}]}>{Icon?<Icon color={theme.colors.textSubtle} size={18}/>:null}<TextInput {...props} multiline={multiline} placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.field,multiline&&styles.multiline,{color:theme.colors.text}]}/></View>;}
function Segmented({options,value,onChange}:{options:Array<[string,string]>;value:string;onChange:(value:string)=>void}){const theme=useAppTheme();return <View style={[styles.segmented,{backgroundColor:theme.colors.surfaceMuted}]}>{options.map(([key,label])=>{const selected=key===value;return <Pressable key={key} onPress={()=>onChange(key)} style={[styles.segment,selected&&{backgroundColor:theme.colors.primary}]}><AppText color={selected?palette.white:theme.colors.textMuted} numberOfLines={1} variant="caption">{label}</AppText></Pressable>;})}</View>;}
function InlineError({message}:{message:string}){const theme=useAppTheme();return <View style={[styles.error,{backgroundColor:theme.colors.secondarySoft,borderColor:theme.colors.secondary}]}><AppText color={theme.colors.secondary} variant="caption">{message}</AppText></View>;}
function integer(value:string){const parsed=Number(value.replace(/\s/g,'').replace(',','.'));return Number.isFinite(parsed)?Math.max(0,Math.trunc(parsed)):0;}
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()).join('')||'CL';}
function parseMeasurements(value:string){return Object.fromEntries(value.split('\n').map((line)=>line.split(':',2).map((part)=>part.trim())).filter(([key,val])=>key&&val));}
function searchable(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR');}
function filterClients(clients:ClientOption[],query:string){const text=searchable(query.trim()),digits=query.replace(/\D/g,'');if(!text&&!digits)return clients;return clients.filter((client)=>searchable(client.display_name).includes(text)||(digits&&client.phone_e164?.replace(/\D/g,'').includes(digits)));}
function mergeClients(current:ClientOption[],incoming:ClientOption[]){const rows=new Map(current.map((client)=>[client.id,client]));for(const client of incoming)rows.set(client.id,client);return [...rows.values()].sort((a,b)=>a.display_name.localeCompare(b.display_name,'fr',{sensitivity:'base'}));}

const styles=StyleSheet.create({safeArea:{flex:1},flex:{flex:1},topBar:{alignItems:'center',flexDirection:'row',paddingHorizontal:18,paddingTop:12},iconButton:{alignItems:'center',borderRadius:8,borderWidth:1,height:44,justifyContent:'center',width:44},heading:{flex:1,marginLeft:13},progress:{flexDirection:'row',paddingHorizontal:14,paddingTop:16},progressStep:{alignItems:'center',flex:1,gap:5,minWidth:0},progressTrack:{alignItems:'center',height:26,justifyContent:'center',width:'100%'},progressLine:{height:2,left:'-50%',position:'absolute',right:'50%'},progressDot:{alignItems:'center',borderRadius:999,borderWidth:1,height:26,justifyContent:'center',width:26},content:{alignSelf:'center',flexGrow:1,gap:14,maxWidth:720,padding:18,paddingBottom:28,width:'100%'},stepStack:{gap:14},section:{borderRadius:8,borderWidth:1,padding:16},sectionBody:{gap:12,marginTop:14},segmented:{borderRadius:8,flexDirection:'row',padding:4},segment:{alignItems:'center',borderRadius:6,flex:1,justifyContent:'center',minHeight:38,paddingHorizontal:6},fields:{gap:10},fieldWrap:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',minHeight:50,paddingHorizontal:13},fieldMultiline:{alignItems:'flex-start',minHeight:92,paddingTop:4},field:{flex:1,fontFamily:'Inter_400Regular',fontSize:15,minHeight:48,paddingHorizontal:7,paddingVertical:0},multiline:{minHeight:82,paddingTop:12,textAlignVertical:'top'},clientSearch:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',height:50,paddingHorizontal:13},clientSearchInput:{flex:1,fontFamily:'Inter_400Regular',fontSize:15,height:48,marginLeft:8,paddingVertical:0},clearSearch:{alignItems:'center',height:38,justifyContent:'center',width:34},clientList:{gap:8},noClients:{alignItems:'center',minHeight:72,justifyContent:'center'},clientRow:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',minHeight:60,padding:9},clientAvatar:{alignItems:'center',borderRadius:8,height:40,justifyContent:'center',width:40},clientCopy:{flex:1,marginHorizontal:10,minWidth:0},twoColumns:{alignItems:'flex-end',flexDirection:'row',gap:10},column:{flex:1,gap:6},detailsToggle:{alignItems:'center',borderRadius:8,borderWidth:1,flex:1,flexDirection:'row',gap:6,justifyContent:'center',minHeight:50,paddingHorizontal:8},optionalFields:{gap:10},editorActions:{alignItems:'center',flexDirection:'row',gap:8,justifyContent:'flex-end'},secondaryButton:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:7,minHeight:44,paddingHorizontal:14},smallPrimary:{alignItems:'center',backgroundColor:palette.violet700,borderRadius:8,flexDirection:'row',gap:7,minHeight:44,paddingHorizontal:16},itemRow:{alignItems:'center',borderBottomWidth:1,flexDirection:'row',minHeight:74,paddingVertical:9},itemCopy:{flex:1,gap:2,minWidth:0},rowIcon:{alignItems:'center',height:42,justifyContent:'center',width:42},summaryRow:{alignItems:'flex-start',borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between',minHeight:43,paddingVertical:9},summaryValue:{flex:1,marginLeft:16,textAlign:'right'},reviewItem:{alignItems:'flex-start',borderTopWidth:1,flexDirection:'row',gap:12,paddingTop:11},reviewItemCopy:{flex:1,gap:3,minWidth:0},financialSummary:{borderRadius:8,gap:2,padding:12},remainingRow:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',paddingHorizontal:2,paddingTop:10},error:{borderRadius:8,borderWidth:1,padding:12},footer:{alignItems:'center',borderTopWidth:1,flexDirection:'row',justifyContent:'space-between',padding:12,paddingHorizontal:18},backButton:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:4,minHeight:48,paddingHorizontal:12},nextButton:{alignItems:'center',backgroundColor:palette.violet700,borderRadius:8,flexDirection:'row',gap:7,justifyContent:'center',minHeight:48,paddingHorizontal:18},pressed:{opacity:.72}});
