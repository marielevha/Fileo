import { ChevronDown, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../../src/components/AppText';
import { MorePage } from '../../../src/features/more/ui';
import { useAppTheme } from '../../../src/theme';

const questions = [
  { id: 'client', title: 'Comment ajouter un client ?', answer: 'Depuis l’onglet Clients, utilisez le bouton d’ajout. Vous pourrez renseigner ses coordonnées puis compléter ses mensurations depuis sa fiche.' },
  { id: 'archive', title: 'Que signifie « client archivé » ?', answer: 'Un client archivé est masqué des listes courantes, sans supprimer sa fiche ni ses commandes. Activez « Afficher les clients archivés » pour le retrouver et le restaurer.' },
  { id: 'order', title: 'Comment créer une commande ?', answer: 'Ouvrez Commandes, puis utilisez le bouton d’ajout. Le formulaire vous guide à travers le client, les articles, le planning et le récapitulatif.' },
  { id: 'photos', title: 'Où ajouter des photos à une commande ?', answer: 'Dans la fiche de commande, ouvrez la section Pièces jointes. Vous pouvez y sélectionner des photos ou des fichiers et les envoyer.' },
  { id: 'planning', title: 'Où voir les échéances et les retards ?', answer: 'L’onglet Planning regroupe les articles à réaliser, à essayer ou à livrer. Les filtres permettent de retrouver une échéance précise.' },
  { id: 'payment', title: 'Comment enregistrer un encaissement ?', answer: 'Dans la fiche de commande, ouvrez Situation financière et choisissez « Enregistrer un encaissement ». Cette action nécessite un accès financier.' },
  { id: 'close', title: 'Comment clôturer une commande ?', answer: 'Dans Actions sur la commande, choisissez « Clôturer toute la commande ». Confirmez que les articles ont été remis et que le solde a été encaissé.' },
  { id: 'access', title: 'Qui peut voir les montants ?', answer: 'Le responsable de l’atelier et les collaborateurs auxquels il a accordé l’accès financier. Le responsable gère ces droits dans Plus > Équipe.' },
] as const;

export default function FaqScreen() {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr');
    return term ? questions.filter((item) => `${item.title} ${item.answer}`.toLocaleLowerCase('fr').includes(term)) : questions;
  }, [query]);

  return <MorePage title="FAQ">
    <View style={[styles.search,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}><Search color={theme.colors.textSubtle} size={19}/><TextInput accessibilityLabel="Rechercher dans la FAQ" onChangeText={setQuery} placeholder="Rechercher une question" placeholderTextColor={theme.colors.textSubtle} selectionColor={theme.colors.primary} style={[styles.searchInput,{color:theme.colors.text}]} value={query}/></View>
    <View style={styles.list}>{filtered.map((item) => <View key={item.id} style={[styles.item,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]}><Pressable accessibilityRole="button" accessibilityState={{expanded:openId===item.id}} onPress={()=>setOpenId(openId===item.id?null:item.id)} style={styles.question}><AppText style={styles.questionText} variant="label">{item.title}</AppText><ChevronDown color={theme.colors.primary} size={19} style={{transform:[{rotate:openId===item.id?'180deg':'0deg'}]}}/></Pressable>{openId===item.id?<View style={[styles.answer,{borderTopColor:theme.colors.border}]}><AppText color={theme.colors.textMuted}>{item.answer}</AppText></View>:null}</View>)}</View>
    {!filtered.length?<AppText color={theme.colors.textMuted} style={styles.empty}>Aucune question ne correspond à cette recherche.</AppText>:null}
  </MorePage>;
}

const styles=StyleSheet.create({search:{alignItems:'center',borderRadius:8,borderWidth:1,flexDirection:'row',gap:10,minHeight:50,paddingHorizontal:13},searchInput:{flex:1,fontFamily:'Inter_400Regular',fontSize:15,minHeight:48,paddingVertical:0},list:{gap:9},item:{borderRadius:8,borderWidth:1,overflow:'hidden'},question:{alignItems:'center',flexDirection:'row',gap:12,minHeight:58,padding:14},questionText:{flex:1},answer:{borderTopWidth:1,padding:14},empty:{paddingVertical:28,textAlign:'center'}});
