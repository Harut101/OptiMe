import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();
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
        'Discard unsaved changes?',
        'Your updates have not been saved yet.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              discardConfirmed.current = true;
              navigation.dispatch(event.data.action);
            }
          }
        ]
      );
    });
  }, [hasUnsavedChanges, navigation]);
}
