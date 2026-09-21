import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Images, Paperclip, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '../theme';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export type AttachmentDraft = {
  id: string;
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

type Props = {
  files: AttachmentDraft[];
  onChange: (files: AttachmentDraft[]) => void;
  disabled?: boolean;
  maxFiles?: number;
};

export function AttachmentPicker({ files, onChange, disabled = false, maxFiles = 8 }: Props) {
  const theme = useAppTheme();
  const [picking, setPicking] = useState(false);
  const full = files.length >= maxFiles;

  function append(incoming: AttachmentDraft[]) {
    const valid = incoming.filter((file) => !file.size || file.size <= MAX_FILE_SIZE);
    const rejected = incoming.filter((file) => file.size && file.size > MAX_FILE_SIZE);
    if (rejected.length) {
      Alert.alert('Fichier trop volumineux', `${rejected.map((file) => file.name).join(', ')} dépasse la limite de 8 Mo.`);
    }
    const room = Math.max(0, maxFiles - files.length);
    onChange([...files, ...valid.slice(0, room)]);
    if (valid.length > room) Alert.alert('Limite atteinte', `${maxFiles} fichiers maximum peuvent être ajoutés.`);
  }

  async function fromCamera() {
    setPicking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Appareil photo non autorisé', 'Autorisez l’accès à la caméra dans les réglages de votre téléphone.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) append(await Promise.all(result.assets.map(prepareImageAsset)));
    } catch { Alert.alert('Photo indisponible', "L'appareil photo n'a pas pu fournir l'image."); }
    finally { setPicking(false); }
  }

  async function fromLibrary() {
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos non autorisées', 'Autorisez l’accès aux photos dans les réglages de votre téléphone.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, maxFiles - files.length),
        quality: 0.7,
      });
      if (!result.canceled) append(await Promise.all(result.assets.map(prepareImageAsset)));
    } catch { Alert.alert('Photos indisponibles', "La photothèque n'a pas pu fournir les images."); }
    finally { setPicking(false); }
  }

  async function fromDocuments() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'],
      });
      if (!result.canceled) append(await Promise.all(result.assets.map(async (asset) => {
        const mimeType = normaliseMimeType(asset.name, asset.mimeType);
        if (mimeType?.startsWith('image/')) {
          return compressImage(asset.uri, asset.name, `${Date.now()}-${asset.name}-${Math.random()}`);
        }
        return { id: `${Date.now()}-${asset.name}-${Math.random()}`, uri: asset.uri, name: asset.name, mimeType, size: asset.size ?? null };
      })));
    } catch { Alert.alert('Document indisponible', "Le document n'a pas pu être ouvert."); }
    finally { setPicking(false); }
  }

  const unavailable = disabled || full || picking;
  return <View style={styles.wrap}>
    <View style={styles.actions}>
      <PickerButton disabled={unavailable} icon={Camera} label="Photo" onPress={fromCamera}/>
      <PickerButton disabled={unavailable} icon={Images} label="Galerie" onPress={fromLibrary}/>
      <PickerButton disabled={unavailable} icon={Paperclip} label="Document" onPress={fromDocuments}/>
    </View>
    {picking ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary}/><AppText color={theme.colors.textMuted} variant="caption">Ouverture…</AppText></View> : null}
    {files.length ? <View style={styles.files}>{files.map((file) => {
      const image = file.mimeType?.startsWith('image/');
      return <View key={file.id} style={[styles.file, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        {image ? <Image source={{ uri: file.uri }} style={styles.preview}/> : <View style={[styles.document, { backgroundColor: theme.colors.primarySoft }]}><FileText color={theme.colors.primary} size={21}/></View>}
        <View style={styles.copy}><AppText numberOfLines={1} variant="label">{file.name}</AppText><AppText color={theme.colors.textMuted} variant="caption">{file.size ? formatSize(file.size) : image ? 'Photo' : 'Document'}</AppText></View>
        <Pressable accessibilityLabel={`Retirer ${file.name}`} disabled={disabled} onPress={() => onChange(files.filter((item) => item.id !== file.id))} style={styles.remove}><X color={theme.colors.textMuted} size={18}/></Pressable>
      </View>;
    })}</View> : <AppText color={theme.colors.textSubtle} style={styles.hint} variant="caption">JPG, PNG, WebP, HEIC ou PDF · 8 Mo maximum</AppText>}
  </View>;
}

function PickerButton({ disabled, icon: Icon, label, onPress }: { disabled: boolean; icon: typeof Camera; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }, (pressed || disabled) && styles.disabled]}><Icon color={theme.colors.primary} size={19}/><AppText numberOfLines={1} variant="caption">{label}</AppText></Pressable>;
}

async function prepareImageAsset(asset: ImagePicker.ImagePickerAsset): Promise<AttachmentDraft> {
  return compressImage(
    asset.uri,
    asset.fileName || `photo-${Date.now()}`,
    `${Date.now()}-${asset.assetId ?? Math.random()}`,
    asset.width,
  );
}

async function compressImage(uri: string, name: string, id: string, knownWidth?: number): Promise<AttachmentDraft> {
  let context = ImageManipulator.manipulate(uri);
  let rendered;
  if (knownWidth === undefined) {
    rendered = await context.renderAsync();
    if (rendered.width > 2048) {
      context = ImageManipulator.manipulate(uri).resize({ width: 2048, height: null });
      rendered = await context.renderAsync();
    }
  } else {
    if (knownWidth > 2048) context.resize({ width: 2048, height: null });
    rendered = await context.renderAsync();
  }
  const compressed = await rendered.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  const baseName = name.replace(/\.[^.]+$/, '');
  return {
    id,
    uri: compressed.uri,
    name: `${baseName}.jpg`,
    mimeType: 'image/jpeg',
    size: null,
  };
}

function normaliseMimeType(name: string, mimeType?: string | null) {
  const value = mimeType?.toLowerCase();
  if (value && value !== 'application/octet-stream') return value === 'image/jpg' ? 'image/jpeg' : value;
  const extension = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' } as Record<string, string>)[extension ?? ''] ?? null;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flex: 1, gap: 6, justifyContent: 'center', minHeight: 62, minWidth: 0, paddingHorizontal: 5 },
  disabled: { opacity: 0.45 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 28 },
  files: { gap: 7 },
  file: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 58, overflow: 'hidden', padding: 7 },
  preview: { borderRadius: 6, height: 44, width: 44 },
  document: { alignItems: 'center', borderRadius: 6, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, marginLeft: 10, minWidth: 0 },
  remove: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  hint: { textAlign: 'center' },
});
