import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { getEntitlements } from '@/api/account';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { Text } from '@/components/Text';
import { BillingError } from '@/features/billing/billing.error';
import {
  getBillingAvailability,
  getBillingOffers,
  getDefaultBillingProductKey,
  openBillingManagement,
  purchaseBillingProduct,
  restoreBillingPurchases
} from '@/features/billing/revenuecat-billing.service';
import type {
  BillingErrorCode,
  BillingOffer,
  BillingPeriod
} from '@/features/billing/billing.types';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme/theme-provider';
import type { SubscriptionPlan } from '@/types/api';

const PLANS: SubscriptionPlan[] = ['FREE', 'PLUS', 'PRO'];
const PLAN_BENEFIT_KEYS = {
  FREE: [
    'billing.plans.FREE.benefit1',
    'billing.plans.FREE.benefit2',
    'billing.plans.FREE.benefit3'
  ],
  PLUS: [
    'billing.plans.PLUS.benefit1',
    'billing.plans.PLUS.benefit2',
    'billing.plans.PLUS.benefit3'
  ],
  PRO: [
    'billing.plans.PRO.benefit1',
    'billing.plans.PRO.benefit2',
    'billing.plans.PRO.benefit3'
  ]
} as const;

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const availability = getBillingAvailability();
  const [period, setPeriod] = useState<BillingPeriod>('ANNUAL');
  const [feedbackCode, setFeedbackCode] = useState<BillingErrorCode | null>(null);
  const [toast, setToast] = useState<'updated' | 'pending' | null>(null);

  const entitlements = useQuery({
    queryKey: ['entitlements'],
    queryFn: getEntitlements
  });
  const offerings = useQuery({
    queryKey: ['billing-offerings', user?.id],
    queryFn: () => getBillingOffers(user!.id),
    enabled: Boolean(user?.id && availability.available && entitlements.isSuccess),
    retry: 1
  });
  const offersByKey = useMemo(
    () => new Map((offerings.data ?? []).map((offer) => [offer.key, offer])),
    [offerings.data]
  );

  const refreshBackendAccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['usage'] });
    return queryClient.fetchQuery({
      queryKey: ['entitlements'],
      queryFn: getEntitlements
    });
  };

  const purchase = useMutation({
    mutationFn: (offer: BillingOffer) => purchaseBillingProduct(user!.id, offer.key),
    onSuccess: async (result) => {
      const updated = await refreshBackendAccess();
      setToast(result.subscriptionCount > 0 && updated.isPremium ? 'updated' : 'pending');
    },
    onError: (error) => handleBillingError(error, setFeedbackCode)
  });
  const restore = useMutation({
    mutationFn: () => restoreBillingPurchases(user!.id),
    onSuccess: async (result) => {
      const updated = await refreshBackendAccess();
      setToast(result.subscriptionCount > 0 && updated.isPremium ? 'updated' : 'pending');
    },
    onError: (error) => handleBillingError(error, setFeedbackCode)
  });
  const manage = useMutation({
    mutationFn: () => openBillingManagement(user!.id),
    onError: (error) => handleBillingError(error, setFeedbackCode)
  });

  if (entitlements.isLoading) {
    return (
      <Screen topSafeArea={false}>
        <ScreenSkeleton variant="detail" />
      </Screen>
    );
  }

  if (entitlements.isError) {
    return (
      <Screen topSafeArea={false}>
        <Card>
          <Text variant="heading">{t('billing.accessUnavailable')}</Text>
          <Text variant="muted">{t('billing.accessUnavailableMessage')}</Text>
          <Button
            title={t('common.retry')}
            variant="secondary"
            loading={entitlements.isRefetching}
            onPress={() => entitlements.refetch()}
          />
        </Card>
      </Screen>
    );
  }

  const currentPlan = entitlements.data?.currentPlan ?? 'FREE';
  const actionPending = purchase.isPending || restore.isPending || manage.isPending;
  const availabilityCode =
    availability.reason ??
    (offerings.isError || (offerings.isSuccess && offerings.data.length === 0)
      ? 'OFFERING_UNAVAILABLE'
      : null);

  return (
    <Screen topSafeArea={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Crown size={22} color={colors.recovery} />
        </View>
        <Text variant="heading">{t('billing.choosePlan')}</Text>
        <Text variant="muted" style={styles.centered}>
          {t('billing.intro')}
        </Text>
      </View>

      <Card style={styles.currentCard}>
        <Text variant="label">{t('billing.currentPlan')}</Text>
        <Text variant="heading">{t(`billing.plans.${currentPlan}.name`)}</Text>
        <Text variant="muted">
          {t(`billing.quality.${entitlements.data?.planQualityMode ?? 'BASIC'}`)}
        </Text>
      </Card>

      <View style={styles.periodPicker}>
        {(['MONTHLY', 'ANNUAL'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: period === item }}
            accessibilityLabel={t(`billing.period.${item}`)}
            onPress={() => setPeriod(item)}
            style={[styles.periodOption, period === item ? styles.periodOptionSelected : null]}
          >
            <Text
              variant="button"
              style={period === item ? styles.periodTextSelected : styles.periodText}
            >
              {t(`billing.period.${item}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.planList}>
        {PLANS.map((plan) => {
          const offer =
            plan === 'FREE'
              ? null
              : offersByKey.get(getDefaultBillingProductKey(plan, period)) ?? null;
          const isCurrent = currentPlan === plan;
          return (
            <PlanCard
              key={plan}
              plan={plan}
              current={isCurrent}
              offer={offer}
              purchasing={purchase.isPending && purchase.variables?.key === offer?.key}
              disabled={actionPending || !availability.available || offerings.isLoading}
              onPurchase={offer ? () => purchase.mutate(offer) : undefined}
            />
          );
        })}
      </View>

      {availabilityCode ? (
        <Card variant="muted" style={styles.availabilityCard}>
          <Sparkles size={20} color={colors.info} />
          <View style={styles.availabilityCopy}>
            <Text variant="bodyStrong">{t('billing.unavailableTitle')}</Text>
            <Text variant="caption">{t(`billing.errors.${availabilityCode}`)}</Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.secondaryActions}>
        {availability.available ? (
          <Button
            title={t('billing.restore')}
            variant="secondary"
            loading={restore.isPending}
            disabled={actionPending || !user}
            accessibilityLabel={t('billing.restore')}
            onPress={() => restore.mutate()}
          />
        ) : null}
        {entitlements.data?.isPremium && availability.available ? (
          <Button
            title={t('billing.manage')}
            variant="ghost"
            loading={manage.isPending}
            disabled={actionPending || !user}
            accessibilityLabel={t('billing.manage')}
            onPress={() => manage.mutate()}
          />
        ) : null}
        <Text variant="finePrint" style={styles.centered}>
          {t('billing.backendAuthority')}
        </Text>
      </View>

      {toast ? (
        <AppToast
          title={t(toast === 'updated' ? 'billing.accessUpdated' : 'billing.accessPending')}
          message={t(
            toast === 'updated'
              ? 'billing.accessUpdatedMessage'
              : 'billing.accessPendingMessage'
          )}
          tone={toast === 'updated' ? 'success' : 'info'}
          onDismiss={() => setToast(null)}
        />
      ) : null}
      <AppFeedbackSheet
        visible={Boolean(feedbackCode)}
        title={t('billing.purchaseIssue')}
        message={t(`billing.errors.${feedbackCode ?? 'UNKNOWN'}`)}
        tone="warning"
        actions={[
          {
            label: t('common.close'),
            variant: 'secondary',
            onPress: () => setFeedbackCode(null)
          }
        ]}
        onClose={() => setFeedbackCode(null)}
      />
    </Screen>
  );
}

function PlanCard({
  plan,
  current,
  offer,
  purchasing,
  disabled,
  onPurchase
}: {
  plan: SubscriptionPlan;
  current: boolean;
  offer: BillingOffer | null;
  purchasing: boolean;
  disabled: boolean;
  onPurchase?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const benefits = PLAN_BENEFIT_KEYS[plan].map((key) => t(key));

  return (
    <Card style={styles.planCard}>
      <View style={styles.planHeader}>
        <View style={styles.planTitle}>
          <Text variant="heading">{t(`billing.plans.${plan}.name`)}</Text>
          <Text variant="caption">{t(`billing.plans.${plan}.quality`)}</Text>
        </View>
        {current ? (
          <View style={styles.currentPill}>
            <Text variant="label" style={styles.currentPillText}>
              {t('billing.current')}
            </Text>
          </View>
        ) : null}
      </View>
      {plan === 'FREE' ? (
        <Text variant="bodyStrong">{t('billing.freePrice')}</Text>
      ) : (
        <View>
          <Text variant="heading">
            {offer?.localizedPrice ?? t('billing.storePriceUnavailable')}
          </Text>
          {offer?.period === 'ANNUAL' && offer.localizedPricePerMonth ? (
            <Text variant="caption">
              {t('billing.perMonthApprox', { price: offer.localizedPricePerMonth })}
            </Text>
          ) : null}
        </View>
      )}
      <View style={styles.benefits}>
        {benefits.map((benefit) => (
          <View key={benefit} style={styles.benefit}>
            <View style={styles.check}>
              <Check size={13} color={colors.textOnAccent} strokeWidth={3} />
            </View>
            <Text variant="body" style={styles.benefitText}>
              {benefit}
            </Text>
          </View>
        ))}
      </View>
      {!current && plan !== 'FREE' ? (
        <Button
          title={t('billing.selectPlan', { plan: t(`billing.plans.${plan}.name`) })}
          loading={purchasing}
          disabled={disabled || !offer}
          accessibilityLabel={t('billing.selectPlan', {
            plan: t(`billing.plans.${plan}.name`)
          })}
          onPress={onPurchase}
        />
      ) : null}
    </Card>
  );
}

function handleBillingError(
  error: unknown,
  setFeedbackCode: (code: BillingErrorCode) => void
) {
  if (error instanceof BillingError && error.code === 'PURCHASE_CANCELLED') return;
  setFeedbackCode(error instanceof BillingError ? error.code : 'UNKNOWN');
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    hero: {
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.recoveryMuted,
      borderRadius: 20,
      height: 44,
      justifyContent: 'center',
      width: 44
    },
    centered: {
      textAlign: 'center'
    },
    currentCard: {
      backgroundColor: colors.surfaceElevated
    },
    periodPicker: {
      alignSelf: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      padding: 4,
      width: '100%'
    },
    periodOption: {
      alignItems: 'center',
      borderRadius: 11,
      flex: 1,
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    periodOptionSelected: {
      backgroundColor: colors.accent
    },
    periodText: {
      color: colors.textSecondary
    },
    periodTextSelected: {
      color: colors.textOnAccent
    },
    planList: {
      gap: 14
    },
    planCard: {
      gap: 16
    },
    planHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between'
    },
    planTitle: {
      flex: 1,
      gap: 2
    },
    currentPill: {
      backgroundColor: colors.accentMuted,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7
    },
    currentPillText: {
      color: colors.accent
    },
    benefits: {
      gap: 10
    },
    benefit: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10
    },
    benefitText: {
      flex: 1
    },
    check: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 9,
      height: 18,
      justifyContent: 'center',
      marginTop: 3,
      width: 18
    },
    availabilityCard: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12
    },
    availabilityCopy: {
      flex: 1,
      gap: 3
    },
    secondaryActions: {
      gap: 8,
      paddingBottom: 10
    }
  });
