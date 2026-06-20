import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

import { getSettings, updateSettings } from '@/api/settings';
import '@/i18n';
import { detectDeviceLocale } from '@/i18n/locale-detection';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 20_000
          }
        }
      })
  );
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsBootstrap />
      {children}
    </QueryClientProvider>
  );
}

function SettingsBootstrap() {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.accessToken);
  const applySettings = useSettingsStore((state) => state.applySettings);
  const resetToDeviceDefaults = useSettingsStore((state) => state.resetToDeviceDefaults);
  const initializationAttempted = useRef(false);
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: hydrated && Boolean(token)
  });

  useEffect(() => {
    initializationAttempted.current = false;
    if (hydrated && !token) resetToDeviceDefaults();
  }, [hydrated, resetToDeviceDefaults, token]);

  useEffect(() => {
    if (!settings.data) return;

    if (settings.data.initialized) {
      applySettings(
        settings.data.preferredLocale,
        settings.data.measurementSystem,
        true
      );
      return;
    }

    if (initializationAttempted.current) return;
    initializationAttempted.current = true;
    const preferredLocale = detectDeviceLocale();
    void updateSettings({
      preferredLocale,
      measurementSystem: settings.data.measurementSystem
    })
      .then((saved) => {
        queryClient.setQueryData(['settings'], saved);
        applySettings(saved.preferredLocale, saved.measurementSystem, true);
      })
      .catch(() => undefined);
  }, [applySettings, queryClient, settings.data]);

  return null;
}
