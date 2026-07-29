import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/theme-provider';
import { openLegalDocument, type LegalDocument } from './legal-documents';

export function LegalDocumentLinks() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [unavailable, setUnavailable] = useState(false);

  const open = async (document: LegalDocument) => {
    if (!(await openLegalDocument(document))) {
      setUnavailable(true);
    }
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('legal.privacyPolicy')}
          hitSlop={8}
          onPress={() => void open('privacy')}
        >
          <Text variant="caption" style={[styles.link, { color: colors.info }]}>
            {t('legal.privacyPolicy')}
          </Text>
        </Pressable>
        <Text variant="caption" style={{ color: colors.textMuted }}>|</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('legal.termsOfService')}
          hitSlop={8}
          onPress={() => void open('terms')}
        >
          <Text variant="caption" style={[styles.link, { color: colors.info }]}>
            {t('legal.termsOfService')}
          </Text>
        </Pressable>
      </View>
      <AppFeedbackSheet
        visible={unavailable}
        title={t('legal.unavailableTitle')}
        message={t('legal.unavailableMessage')}
        tone="warning"
        onClose={() => setUnavailable(false)}
        actions={[
          {
            label: t('common.close'),
            variant: 'secondary',
            onPress: () => setUnavailable(false)
          }
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  link: {
    fontWeight: '700',
    textDecorationLine: 'underline'
  }
});
