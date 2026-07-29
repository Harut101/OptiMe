import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/theme-provider';
import { LegalDocumentLinks } from './LegalDocumentLinks';

interface PrivacyConsentFieldProps {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
}

export function PrivacyConsentField({
  accepted,
  onChange,
  error
}: PrivacyConsentFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel={t('auth.consent')}
        onPress={() => onChange(!accepted)}
        style={styles.consentRow}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: accepted ? colors.info : colors.border },
            accepted ? { backgroundColor: colors.info } : null
          ]}
        >
          {accepted ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
        <View style={styles.copy}>
          <Text variant="caption">{t('auth.consent')}</Text>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        </View>
      </Pressable>
      <View style={styles.links}>
        <LegalDocumentLinks />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8
  },
  consentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    marginTop: 1,
    width: 24
  },
  copy: {
    flex: 1,
    gap: 4
  },
  error: {
    fontSize: 13,
    fontWeight: '700'
  },
  links: {
    paddingLeft: 34
  }
});
