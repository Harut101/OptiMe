import { HealthProvider } from '@prisma/client';

/**
 * A client must never be able to claim an OAuth-only provider is connected.
 * Future provider callbacks can use a server-side integration path instead.
 */
const CLIENT_CONNECTABLE_PROVIDERS = new Set<HealthProvider>([
  HealthProvider.APPLE_HEALTH,
  // Health Connect and manual summaries use the existing user-consent flow.
  // Their real native sync work remains separately gated by platform support.
  HealthProvider.HEALTH_CONNECT,
  HealthProvider.MANUAL
]);

export function canClientMarkHealthProviderConnected(provider: HealthProvider) {
  return CLIENT_CONNECTABLE_PROVIDERS.has(provider);
}

export function getHealthProviderConnectionError(provider: HealthProvider) {
  if (provider === HealthProvider.GARMIN || provider === HealthProvider.WHOOP) {
    return {
      code: 'HEALTH_PROVIDER_OAUTH_REQUIRED',
      message: 'This provider can be connected only after secure provider authorization is available.'
    };
  }

  return {
    code: 'HEALTH_PROVIDER_CONNECTION_UNAVAILABLE',
    message: 'This provider cannot be marked connected from this app yet.'
  };
}
