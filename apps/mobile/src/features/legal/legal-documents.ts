import { Linking } from 'react-native';

import {
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE_URL
} from '@/config/env';

export type LegalDocument = 'privacy' | 'terms';

export async function openLegalDocument(document: LegalDocument) {
  const url = document === 'privacy' ? PRIVACY_POLICY_URL : TERMS_OF_SERVICE_URL;

  if (!url) return false;

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openSupportEmail() {
  if (!SUPPORT_EMAIL) return false;

  try {
    await Linking.openURL(`mailto:${encodeURIComponent(SUPPORT_EMAIL)}`);
    return true;
  } catch {
    return false;
  }
}
