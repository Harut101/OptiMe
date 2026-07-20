import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react-native';

import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import { Text } from './Text';

type AppToastTone = 'success' | 'info' | 'warning' | 'danger';

interface AppToastProps {
  title: string;
  message?: string | null;
  tone?: AppToastTone;
  onDismiss?: () => void;
}

interface ToastEntry extends AppToastProps {
  id: string;
}

interface ToastContextValue {
  show: (entry: ToastEntry) => void;
  hide: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

export function AppToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const activeToastRef = useRef<ToastEntry | null>(null);
  const show = useCallback((entry: ToastEntry) => {
    const previous = activeToastRef.current;
    activeToastRef.current = entry;
    setToast(entry);
    if (previous && previous.id !== entry.id) previous.onDismiss?.();
  }, []);
  const hide = useCallback((id: string) => {
    if (activeToastRef.current?.id !== id) return;
    activeToastRef.current = null;
    setToast(null);
  }, []);
  const contextValue = useMemo(() => ({ show, hide }), [hide, show]);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      if (activeToastRef.current?.id !== toast.id) return;
      activeToastRef.current = null;
      setToast(null);
      toast.onDismiss?.();
    }, 3200);

    return () => clearTimeout(timeout);
  }, [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      <View style={styles.providerRoot}>
        {children}
        {toast ? (
          <ToastOverlay
            title={toast.title}
            message={toast.message}
            tone={toast.tone}
            onDismiss={() => {
              activeToastRef.current = null;
              setToast(null);
              toast.onDismiss?.();
            }}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function AppToast({ title, message, tone = 'info', onDismiss }: AppToastProps) {
  const context = useContext(ToastContext);
  const id = useRef(`app-toast-${++nextToastId}`).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!context) return;

    context.show({
      id,
      title,
      message,
      tone,
      onDismiss: () => onDismissRef.current?.()
    });

    return () => context.hide(id);
  }, [context, id, message, title, tone]);

  return null;
}

function ToastOverlay({ title, message, tone = 'info', onDismiss }: AppToastProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const themedStyles = createStyles(colors);
  const toneStyles = createToneStyles(colors);
  const translateY = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'danger' ? TriangleAlert : Info;
  const toneStyle = toneStyles[tone];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { duration: 180, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateY, { duration: 220, toValue: 0, useNativeDriver: true })
    ]).start();
  }, [opacity, translateY]);

  return (
    <View
      pointerEvents="box-none"
      style={[themedStyles.root, { paddingTop: Math.max(insets.top + 10, 18) }]}
    >
      <Animated.View style={{ opacity, transform: [{ translateY }], width: '100%', maxWidth: 640 }}>
        <Pressable
          accessibilityRole={onDismiss ? 'button' : 'text'}
          accessibilityLabel={[title, message].filter(Boolean).join('. ')}
          onPress={onDismiss}
          style={[themedStyles.toast, toneStyle.container]}
        >
          <View style={[themedStyles.iconWrap, toneStyle.iconWrap]}>
            <Icon size={17} color={toneStyle.iconColor} strokeWidth={2.6} />
          </View>
          <View style={themedStyles.copy}>
            <Text variant="body" style={themedStyles.title}>{title}</Text>
            {message ? <Text variant="caption">{message}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createToneStyles = (colors: ThemeColors) => ({
  success: {
    container: { borderColor: 'rgba(103, 206, 103, 0.35)' },
    iconWrap: { backgroundColor: colors.nutritionMuted },
    iconColor: colors.success
  },
  info: {
    container: { borderColor: 'rgba(129, 207, 250, 0.38)' },
    iconWrap: { backgroundColor: colors.infoMuted },
    iconColor: colors.info
  },
  warning: {
    container: { borderColor: 'rgba(241, 163, 59, 0.42)' },
    iconWrap: { backgroundColor: colors.warningMuted },
    iconColor: colors.warning
  },
  danger: {
    container: { borderColor: 'rgba(235, 75, 98, 0.38)' },
    iconWrap: { backgroundColor: colors.dangerMuted },
    iconColor: colors.danger
  }
}) as const;

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1
  }
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    alignItems: 'center',
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 18,
    zIndex: 1000
  },
  toast: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 18,
    width: '100%'
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    fontWeight: '800'
  }
});
