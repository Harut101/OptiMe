import type { ExerciseMediaItem } from '@optime/shared-types';
import { useEffect, useState } from 'react';
import { FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';

import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

export function ExerciseMediaCarousel({ media, t }: { media: ExerciseMediaItem[]; t: TFunction }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const available = media.filter((item) => !failed.has(item.id));

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(available.length - 1, 0)));
  }, [available.length]);

  if (available.length === 0) {
    return (
      <View style={styles.frame} accessibilityLabel={t('plan.imageUnavailable')}>
        <Text variant="muted" style={styles.fallbackText}>{t('plan.imageUnavailable')}</Text>
      </View>
    );
  }

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View>
      <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width ? (
          <FlatList
            data={available}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={onScrollEnd}
            accessibilityLabel={t('plan.mediaPage', { current: String(index + 1), total: String(available.length) })}
            renderItem={({ item }) => (
              <View style={[styles.page, { width }]}>
                {!loaded.has(item.id) ? <Text variant="muted">{t('plan.imageLoading')}</Text> : null}
                <Image
                  source={{ uri: item.url }}
                  resizeMode="contain"
                  style={[styles.image, !loaded.has(item.id) && styles.imageLoading]}
                  accessible
                  accessibilityLabel={item.altText}
                  onLoad={() => setLoaded((current) => new Set(current).add(item.id))}
                  onError={() => setFailed((current) => new Set(current).add(item.id))}
                />
                {item.caption ? <Text variant="muted" style={styles.caption}>{item.caption}</Text> : null}
              </View>
            )}
          />
        ) : <Text variant="muted">{t('plan.imageLoading')}</Text>}
      </View>
      {available.length > 1 ? (
        <View style={styles.dots} accessible accessibilityLabel={t('plan.mediaPage', { current: String(index + 1), total: String(available.length) })}>
          {available.map((item, dotIndex) => (
            <View key={item.id} style={[styles.dot, dotIndex === index && styles.activeDot]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  page: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  imageLoading: { opacity: 0 },
  caption: { position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: 'center' },
  fallbackText: { textAlign: 'center', padding: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  activeDot: { width: 18, backgroundColor: colors.primary }
});
