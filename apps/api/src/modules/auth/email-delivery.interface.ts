export type AuthEmailPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export interface SendAuthCodeInput {
  email: string;
  code: string;
  purpose: AuthEmailPurpose;
  expiresInMinutes: number;
  locale: string;
}

export interface EmailDeliveryService {
  sendAuthCode(input: SendAuthCodeInput): Promise<void>;
}
