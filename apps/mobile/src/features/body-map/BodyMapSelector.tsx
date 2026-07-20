import type { TargetMuscleGroup } from '@optime/shared-types';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { getMuscleGroupLabel } from '@/i18n/enum-labels';

import { BODY_MAP_ASSETS } from './body-map-assets';
import { BODY_MAP_PATHS } from './body-map-paths.generated';
import {
  normalizeLegacyMuscleGroups,
  toggleSpecificMuscleGroup,
  type SpecificMuscleGroup
} from './body-map-selection';
import type { BodyMapView } from './body-map-types';

const BODY_MAP_SELECTED_COLOR = '#FF2D55';
const BODY_MAP_CARD_ASPECT_RATIO = 4 / 5;
const BODY_MAP_CARD_MAX_WIDTH = 360;
const BODY_MAP_COMPACT_MAX_WIDTH = 280;
const BODY_MAP_COMPACT_WIDTH_RATIO = 0.78;
const CARD_INNER_PADDING = 12;

export function BodyMapSelector({ value, onChange, variant = 'default', debugBodyMapLayout = false }: {
  value: TargetMuscleGroup[];
  onChange: (value: TargetMuscleGroup[]) => void;
  variant?: 'default' | 'compact';
  debugBodyMapLayout?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const [view, setView] = useState<BodyMapView>('front');
  const [selectedMuscles, setSelectedMuscles] = useState(() => normalizeLegacyMuscleGroups(value));
  const [pressedPath, setPressedPath] = useState<string | null>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });
  const asset = BODY_MAP_ASSETS[view];
  const availableCardWidth = Math.min(
    Math.max(0, containerWidth || screenWidth - 32),
    BODY_MAP_CARD_MAX_WIDTH
  );
  const cardWidth = variant === 'compact'
    ? Math.min(availableCardWidth * BODY_MAP_COMPACT_WIDTH_RATIO, BODY_MAP_COMPACT_MAX_WIDTH)
    : availableCardWidth;
  const cardHeight = cardWidth / BODY_MAP_CARD_ASPECT_RATIO;
  const availableMapWidth = Math.max(0, cardWidth - CARD_INNER_PADDING * 2);
  const availableMapHeight = Math.max(0, cardHeight - CARD_INNER_PADDING * 2);
  const mapScale = Math.min(
    availableMapWidth / asset.width,
    availableMapHeight / asset.height
  );
  const renderedMapWidth = asset.width * mapScale;
  const renderedMapHeight = asset.height * mapScale;
  const showLayoutDebug = __DEV__ && debugBodyMapLayout;
  const paths = BODY_MAP_PATHS.filter((item) => item.view === view);

  const toggle = (muscleGroup: SpecificMuscleGroup) => {
    const next = toggleSpecificMuscleGroup(selectedMuscles, muscleGroup);
    setSelectedMuscles(next);
    onChange(next);
  };

  return (
    <View
      style={styles.root}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.viewToggle}>
        {(['front', 'back'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: view === item }}
            onPress={() => setView(item)}
            style={[styles.viewButton, view === item ? styles.viewButtonActive : null]}
          >
            <Text style={view === item ? styles.viewTextActive : styles.viewText}>
              {t(item === 'front' ? 'bodyMap.front' : 'bodyMap.back')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.mapCard, { width: cardWidth, aspectRatio: BODY_MAP_CARD_ASPECT_RATIO }]}>
        <View
          onLayout={(event) => setRenderedSize(event.nativeEvent.layout)}
          style={[
            styles.mapStage,
            { width: renderedMapWidth, height: renderedMapHeight },
            showLayoutDebug ? styles.debugFrame : null
          ]}
        >
          <Image
            source={asset.image}
            resizeMode="contain"
            style={{ width: renderedMapWidth, height: renderedMapHeight }}
            accessible={false}
          />
          <Svg
            width="100%"
            height="100%"
            viewBox={asset.viewBox}
            preserveAspectRatio="xMidYMid meet"
            style={StyleSheet.absoluteFillObject}
          >
            {paths.map((path) => {
              const selected = selectedMuscles.includes(path.muscleGroup);
              const pressed = pressedPath === path.id;
              const opacity = pressed ? 0.25 : selected ? 0.5 : 0;
              return (
                <G key={path.id}>
                  <Path
                    id={`${path.id}-hit`}
                    d={path.d}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={8}
                    onPress={() => toggle(path.muscleGroup)}
                    onPressIn={() => setPressedPath(path.id)}
                    onPressOut={() => setPressedPath(null)}
                    accessible
                    accessibilityLabel={t(selected ? 'bodyMap.deselect' : 'bodyMap.select', {
                      muscle: getMuscleGroupLabel(t, path.muscleGroup),
                      side: getSideLabel(t, path.side)
                    })}
                  />
                  <Path
                    id={path.id}
                    d={path.d}
                    fill={selected || pressed ? BODY_MAP_SELECTED_COLOR : 'transparent'}
                    fillOpacity={opacity}
                    pointerEvents="none"
                  />
                </G>
              );
            })}
          </Svg>
        </View>
      </View>

      <Text variant="muted">
        {selectedMuscles.length > 0
          ? t('bodyMap.selected', { muscles: selectedMuscles.map((item) => getMuscleGroupLabel(t, item)).join(', ') })
          : t('bodyMap.instruction')}
      </Text>
      {showLayoutDebug ? (
        <Text style={styles.debugText}>
          {view}: {asset.viewBox} / {Math.round(renderedSize.width)} x {Math.round(renderedSize.height)} pt
        </Text>
      ) : null}
    </View>
  );
}

function getSideLabel(
  t: (key: 'bodyMap.sideLeft' | 'bodyMap.sideRight' | 'bodyMap.sideCenter') => string,
  side: string
) {
  const normalized = side.toLowerCase();
  if (normalized.includes('left')) return t('bodyMap.sideLeft');
  if (normalized.includes('right')) return t('bodyMap.sideRight');
  return t('bodyMap.sideCenter');
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { gap: 10 },
  viewToggle: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    padding: 4
  },
  viewButton: {
    alignItems: 'center',
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: 16
  },
  viewButtonActive: {
    backgroundColor: colors.card,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1
  },
  viewText: { color: colors.textSecondary, fontWeight: '700' },
  viewTextActive: { color: colors.textPrimary, fontWeight: '800' },
  mapCard: {
    maxWidth: BODY_MAP_CARD_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card
  },
  mapStage: { position: 'relative' },
  debugFrame: { borderColor: '#00C0E8', borderWidth: 1 },
  debugText: { color: colors.textSecondary, fontSize: 12 }
});
