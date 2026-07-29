import { AuthEmailPurpose } from './email-delivery.interface';

interface AuthEmailTemplateInput {
  code: string;
  purpose: AuthEmailPurpose;
  expiresInMinutes: number;
  locale: string;
  supportEmail?: string;
}

export interface AuthEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

interface AuthEmailCopy {
  language: string;
  verificationSubject: string;
  resetSubject: string;
  verificationTitle: string;
  resetTitle: string;
  verificationMessage: string;
  resetMessage: string;
  expiry: (minutes: number) => string;
  ignore: string;
  support: (email: string) => string;
}

const EMAIL_COPY: Record<'en-US' | 'ru-RU' | 'fr-FR' | 'zh-CN', AuthEmailCopy> = {
  'en-US': {
    language: 'en',
    verificationSubject: 'Verify your OptiMe email',
    resetSubject: 'Reset your OptiMe password',
    verificationTitle: 'Verify your email',
    resetTitle: 'Reset your password',
    verificationMessage: 'Enter this code in OptiMe to finish creating your account.',
    resetMessage: 'Enter this code in OptiMe to choose a new password.',
    expiry: (minutes) => `This code expires in ${minutes} minutes.`,
    ignore: 'If you did not request this, you can safely ignore this email.',
    support: (email) => `Need help? Contact ${email}.`
  },
  'ru-RU': {
    language: 'ru',
    verificationSubject: 'Подтвердите email в OptiMe',
    resetSubject: 'Сброс пароля OptiMe',
    verificationTitle: 'Подтвердите email',
    resetTitle: 'Сбросьте пароль',
    verificationMessage: 'Введите этот код в OptiMe, чтобы завершить создание аккаунта.',
    resetMessage: 'Введите этот код в OptiMe, чтобы выбрать новый пароль.',
    expiry: (minutes) => `Код действует ${minutes} минут.`,
    ignore: 'Если вы не запрашивали этот код, просто проигнорируйте письмо.',
    support: (email) => `Нужна помощь? Напишите на ${email}.`
  },
  'fr-FR': {
    language: 'fr',
    verificationSubject: 'Vérifiez votre adresse e-mail OptiMe',
    resetSubject: 'Réinitialisez votre mot de passe OptiMe',
    verificationTitle: 'Vérifiez votre adresse e-mail',
    resetTitle: 'Réinitialisez votre mot de passe',
    verificationMessage: 'Saisissez ce code dans OptiMe pour terminer la création de votre compte.',
    resetMessage: 'Saisissez ce code dans OptiMe pour choisir un nouveau mot de passe.',
    expiry: (minutes) => `Ce code expire dans ${minutes} minutes.`,
    ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
    support: (email) => `Besoin d'aide ? Contactez ${email}.`
  },
  'zh-CN': {
    language: 'zh-CN',
    verificationSubject: '验证您的 OptiMe 邮箱',
    resetSubject: '重置您的 OptiMe 密码',
    verificationTitle: '验证邮箱',
    resetTitle: '重置密码',
    verificationMessage: '请在 OptiMe 中输入此验证码，以完成账户创建。',
    resetMessage: '请在 OptiMe 中输入此验证码，以设置新密码。',
    expiry: (minutes) => `此验证码将在 ${minutes} 分钟后失效。`,
    ignore: '如果这不是您的操作，请忽略此邮件。',
    support: (email) => `需要帮助？请联系 ${email}。`
  }
};

export function buildAuthEmailTemplate(input: AuthEmailTemplateInput): AuthEmailTemplate {
  const copy = EMAIL_COPY[resolveEmailLocale(input.locale)];
  const verification = input.purpose === 'EMAIL_VERIFICATION';
  const title = verification ? copy.verificationTitle : copy.resetTitle;
  const message = verification ? copy.verificationMessage : copy.resetMessage;
  const subject = verification ? copy.verificationSubject : copy.resetSubject;
  const expiry = copy.expiry(input.expiresInMinutes);
  const support = input.supportEmail ? copy.support(input.supportEmail) : undefined;
  const footer = [copy.ignore, support].filter(Boolean).join('\n');

  return {
    subject,
    text: [title, message, input.code, expiry, footer].filter(Boolean).join('\n\n'),
    html: `<!doctype html>
<html lang="${copy.language}">
  <body style="margin:0;background:#f2f2f7;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(message)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:24px;padding:32px;">
            <tr><td style="font-size:26px;font-weight:800;padding-bottom:24px;">OptiMe</td></tr>
            <tr><td style="font-size:24px;font-weight:800;padding-bottom:12px;">${escapeHtml(title)}</td></tr>
            <tr><td style="font-size:16px;line-height:24px;color:#636366;padding-bottom:24px;">${escapeHtml(message)}</td></tr>
            <tr>
              <td align="center" style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f2f2f7;border-radius:16px;padding:20px 12px;">
                ${escapeHtml(input.code)}
              </td>
            </tr>
            <tr><td style="font-size:15px;line-height:22px;color:#636366;padding-top:24px;">${escapeHtml(expiry)}</td></tr>
            <tr><td style="font-size:13px;line-height:20px;color:#8e8e93;padding-top:24px;">${escapeHtml(footer)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  };
}

export function resolveEmailLocale(locale: string): keyof typeof EMAIL_COPY {
  const normalized = locale.trim().toLowerCase();

  if (normalized.startsWith('ru')) return 'ru-RU';
  if (normalized.startsWith('fr')) return 'fr-FR';
  if (normalized.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
