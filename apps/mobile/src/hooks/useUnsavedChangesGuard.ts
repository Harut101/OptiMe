import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const discardConfirmed = useRef(false);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      discardConfirmed.current = false;
    }

    return navigation.addListener('beforeRemove', (event) => {
      if (!hasUnsavedChanges || discardConfirmed.current) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        t('unsaved.title'),
        t('unsaved.message'),
        [
          { text: t('common.keepEditing'), style: 'cancel' },
          {
            text: t('common.discard'),
            style: 'destructive',
            onPress: () => {
              discardConfirmed.current = true;
              navigation.dispatch(event.data.action);
            }
          }
        ]
      );
    });
  }, [hasUnsavedChanges, navigation, t]);
}
