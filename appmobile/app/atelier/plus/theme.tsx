import { Monitor, Moon, Sun } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '../../../src/components/AppText';
import { MorePage, SelectRow, moreStyles } from '../../../src/features/more/ui';
import { useAppTheme, useThemePreference, type ThemePreference } from '../../../src/theme';

const choices: Array<{ value: ThemePreference; label: string; detail: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Système', detail: 'Suivre le réglage de l’appareil', icon: Monitor },
  { value: 'light', label: 'Clair', detail: 'Toujours utiliser le thème clair', icon: Sun },
  { value: 'dark', label: 'Sombre', detail: 'Toujours utiliser le thème sombre', icon: Moon },
];

export default function ThemeScreen(){const theme=useAppTheme();const {preference,setPreference}=useThemePreference();return <MorePage title="Thème"><View style={moreStyles.section}>{choices.map(({value,label,detail})=><SelectRow detail={detail} key={value} label={label} onPress={()=>setPreference(value)} selected={preference===value}/>)}</View><AppText color={theme.colors.textMuted} variant="caption">Ce choix est conservé sur cet appareil.</AppText></MorePage>;}
