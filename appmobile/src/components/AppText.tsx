import { Text, type TextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '../theme';

type TextVariant = 'display' | 'title1' | 'title2' | 'title3' | 'body' | 'bodyMedium' | 'label' | 'caption';

type AppTextProps = TextProps & {
  color?: TextStyle['color'];
  variant?: TextVariant;
};

export function AppText({ color, style, variant = 'body', ...props }: AppTextProps) {
  const theme = useAppTheme();

  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: color ?? theme.colors.text }, style]}
    />
  );
}
