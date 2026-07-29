import { buildAuthEmailTemplate, resolveEmailLocale } from './auth-email-template';

describe('auth email templates', () => {
  it.each([
    ['en', 'en-US', 'Verify your OptiMe email'],
    ['ru-RU', 'ru-RU', 'Подтвердите email в OptiMe'],
    ['fr', 'fr-FR', 'Vérifiez votre adresse e-mail OptiMe'],
    ['zh-CN', 'zh-CN', '验证您的 OptiMe 邮箱']
  ])('localizes verification email for %s', (locale, resolvedLocale, subject) => {
    expect(resolveEmailLocale(locale)).toBe(resolvedLocale);

    const template = buildAuthEmailTemplate({
      code: '123456',
      purpose: 'EMAIL_VERIFICATION',
      expiresInMinutes: 10,
      locale,
      supportEmail: 'support@optime.example'
    });

    expect(template.subject).toBe(subject);
    expect(template.text).toContain('123456');
    expect(template.html).toContain('123456');
    expect(template.html).toContain('support@optime.example');
    expect(template.html).not.toContain('<script');
    expect(template.html).not.toContain('tracking');
  });

  it('uses password reset copy without exposing account data', () => {
    const template = buildAuthEmailTemplate({
      code: '654321',
      purpose: 'PASSWORD_RESET',
      expiresInMinutes: 10,
      locale: 'en-US'
    });

    expect(template.subject).toBe('Reset your OptiMe password');
    expect(template.text).toContain('choose a new password');
    expect(template.text).not.toContain('@');
  });
});
