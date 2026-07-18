import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

const wordmarkLightUri = Image.resolveAssetSource(
  require('../../assets/branding/optime-logo-light.svg')
).uri;
const wordmarkDarkUri = Image.resolveAssetSource(
  require('../../assets/branding/optime-logo-dark.svg')
).uri;
const iconUri = Image.resolveAssetSource(require('../../assets/branding/optime-icon.svg')).uri;

interface BrandLogoProps {
  variant?: 'icon' | 'wordmark';
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export function BrandLogo({ variant = 'wordmark', width, style }: BrandLogoProps) {
  const { mode } = useTheme();
  const resolvedWidth = width ?? (variant === 'wordmark' ? 196 : 84);
  const height = variant === 'wordmark' ? resolvedWidth / 4 : resolvedWidth;
  const uri = variant === 'icon' ? iconUri : mode === 'dark' ? wordmarkDarkUri : wordmarkLightUri;

  return (
    <View accessible accessibilityLabel="OptiMe" style={[styles.container, style]}>
      <SvgUri height={height} uri={uri} width={resolvedWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});
