import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Text } from '@/src/components/Text';
import { colors } from '@/src/theme/colors';

type FormFieldProps = TextInputProps & {
  label: string;
};

export function FormField({ label, style, placeholderTextColor = colors.textMuted, ...props }: FormFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={placeholderTextColor}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.textStrong,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
});
