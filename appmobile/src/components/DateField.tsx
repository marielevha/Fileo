import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { palette, useAppTheme } from '../theme';
import { AppText } from './AppText';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
};

export function DateField({
  value,
  onChange,
  placeholder = 'Choisir une date',
  allowClear = true,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDate(value));

  function openPicker() {
    setDraftDate(parseDate(value));
    setOpen(true);
  }

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(toDateKey(date));
      return;
    }

    if (date) setDraftDate(date);
  }

  function confirmDate() {
    onChange(toDateKey(draftDate));
    setOpen(false);
  }

  return (
    <>
      <View
        style={[
          styles.control,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: open ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityLabel={value ? `Date sélectionnée : ${formatDisplayDate(value)}` : placeholder}
          accessibilityRole="button"
          onPress={openPicker}
          style={styles.trigger}
        >
          <CalendarDays color={open ? theme.colors.primary : theme.colors.textSubtle} size={18} />
          <AppText
            adjustsFontSizeToFit
            color={value ? theme.colors.text : theme.colors.textSubtle}
            minimumFontScale={0.82}
            numberOfLines={1}
            style={styles.value}
            variant="label"
          >
            {value ? formatDisplayDate(value) : placeholder}
          </AppText>
        </Pressable>

        {allowClear && value ? (
          <Pressable
            accessibilityLabel="Effacer la date"
            hitSlop={8}
            onPress={() => onChange('')}
            style={styles.clear}
          >
            <X color={theme.colors.textMuted} size={17} />
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={draftDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setOpen(false)}
          statusBarTranslucent
          transparent
          visible={open}
        >
          <View style={styles.modalRoot}>
            <Pressable
              accessibilityLabel="Fermer le calendrier"
              onPress={() => setOpen(false)}
              style={styles.backdrop}
            />
            <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
              <View style={styles.sheetHeader}>
                <View>
                  <AppText color={theme.colors.textMuted} variant="caption">Date</AppText>
                  <AppText variant="title3">Sélectionner une date</AppText>
                </View>
                <Pressable
                  accessibilityLabel="Fermer"
                  onPress={() => setOpen(false)}
                  style={[styles.closeButton, { backgroundColor: theme.colors.surfaceMuted }]}
                >
                  <X color={theme.colors.textMuted} size={19} />
                </Pressable>
              </View>

              <DateTimePicker
                accentColor={theme.colors.primary}
                display="spinner"
                locale="fr-FR"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                mode="date"
                onChange={handleChange}
                value={draftDate}
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={() => setOpen(false)}
                  style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                >
                  <AppText variant="label">Annuler</AppText>
                </Pressable>
                <Pressable onPress={confirmDate} style={styles.confirmButton}>
                  <Check color={palette.white} size={18} />
                  <AppText color={palette.white} variant="label">Valider</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  return parseDate(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
  },
  trigger: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  value: {
    flex: 1,
  },
  clear: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 38,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15, 8, 25, 0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: palette.violet700,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
  },
});
