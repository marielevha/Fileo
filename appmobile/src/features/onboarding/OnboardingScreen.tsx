import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { palette, useAppTheme } from '../../theme';

type OnboardingScreenProps = {
  onContinue: () => void;
};

export function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  const { height, width } = useWindowDimensions();
  const theme = useAppTheme();
  const artworkWidth = Math.min(width - 48, 430);
  const artworkHeight = Math.min(height * 0.47, artworkWidth * 0.96);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.artworkArea}>
          <Image
            accessibilityLabel="Une équipe de couture organise les activités de son atelier"
            resizeMode="contain"
            source={require('../../../assets/images/onboarding-workshop.png')}
            style={{ height: artworkHeight, width: artworkWidth }}
          />
        </View>

        <View style={styles.copyArea}>
          <AppText color={palette.white} variant="title1">
            Du talent dans les mains,{`\n`}
            <AppText color={theme.colors.accent} variant="title1">
              du temps sous contrôle.
            </AppText>
          </AppText>
          <AppText color="rgba(255, 255, 255, 0.72)" style={styles.description}>
            Centralisez vos clients, leurs mesures et chaque commande pour avancer sereinement.
          </AppText>

          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <AppText color={palette.violet950} variant="bodyMedium">
              Organiser mon atelier
            </AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.violet950,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 560,
    paddingBottom: 20,
    paddingHorizontal: 24,
    width: '100%',
  },
  artworkArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  copyArea: {
    paddingTop: 12,
  },
  description: {
    marginTop: 14,
    maxWidth: 430,
  },
  button: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 56,
    paddingHorizontal: 24,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
