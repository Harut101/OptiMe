import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from './Card';
import { Screen } from './Screen';

interface ScreenSkeletonProps {
  variant?: 'default' | 'dashboard' | 'detail' | 'list';
  cardCount?: number;
}

export function ScreenSkeleton({ variant = 'default', cardCount = 3 }: ScreenSkeletonProps) {
  return (
    <Screen>
      <View style={styles.header}>
        <View style={[styles.line, styles.eyebrow]} />
        <View style={[styles.line, styles.title]} />
        <View style={[styles.line, styles.titleShort]} />
        <View style={[styles.line, styles.subtitle]} />
      </View>

      {variant === 'dashboard' ? <DashboardSkeleton /> : null}

      {Array.from({ length: cardCount }).map((_, index) => (
        <Card key={index} style={variant === 'list' ? styles.listCard : undefined}>
          {variant === 'detail' ? <DetailCardSkeleton /> : <DefaultCardSkeleton />}
        </Card>
      ))}
    </Screen>
  );
}

export function CardSkeleton({ variant = 'default' }: Pick<ScreenSkeletonProps, 'variant'>) {
  return (
    <Card>
      {variant === 'detail' ? <DetailCardSkeleton /> : <DefaultCardSkeleton />}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <View style={styles.dashboardGrid}>
      {[0, 1].map((item) => (
        <Card key={item} style={styles.dashboardCard}>
          <View style={styles.ring} />
          <View style={[styles.line, styles.cardTitle]} />
          <View style={[styles.line, styles.cardBody]} />
          <View style={[styles.line, styles.cardBodyShort]} />
        </Card>
      ))}
    </View>
  );
}

function DefaultCardSkeleton() {
  return (
    <>
      <View style={styles.row}>
        <View style={styles.icon} />
        <View style={styles.copy}>
          <View style={[styles.line, styles.cardTitle]} />
          <View style={[styles.line, styles.cardBody]} />
          <View style={[styles.line, styles.cardBodyShort]} />
        </View>
      </View>
      <View style={[styles.line, styles.helper]} />
    </>
  );
}

function DetailCardSkeleton() {
  return (
    <>
      <View style={[styles.line, styles.detailTitle]} />
      <View style={[styles.line, styles.detailWide]} />
      <View style={[styles.line, styles.detailWide]} />
      <View style={[styles.line, styles.detailMedium]} />
      <View style={styles.detailButton} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
    paddingTop: 8
  },
  line: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999
  },
  eyebrow: {
    height: 14,
    width: 76
  },
  title: {
    height: 38,
    width: '82%'
  },
  titleShort: {
    height: 38,
    width: '56%'
  },
  subtitle: {
    height: 16,
    width: '88%'
  },
  dashboardGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  dashboardCard: {
    alignItems: 'center',
    flex: 1,
    minHeight: 250,
    minWidth: 150
  },
  ring: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 58,
    height: 116,
    width: 116
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12
  },
  icon: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 48,
    width: 48
  },
  copy: {
    flex: 1,
    gap: 8,
    paddingTop: 2
  },
  cardTitle: {
    height: 18,
    width: '52%'
  },
  cardBody: {
    height: 13,
    width: '86%'
  },
  cardBodyShort: {
    height: 13,
    width: '62%'
  },
  helper: {
    height: 13,
    width: '44%'
  },
  listCard: {
    gap: 10
  },
  detailTitle: {
    height: 24,
    width: '58%'
  },
  detailWide: {
    height: 14,
    width: '94%'
  },
  detailMedium: {
    height: 14,
    width: '66%'
  },
  detailButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    height: 52,
    width: '100%'
  }
});
