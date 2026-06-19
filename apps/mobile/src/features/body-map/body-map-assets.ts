import type { ImageSourcePropType } from 'react-native';

export interface BodyMapAsset {
  image: ImageSourcePropType;
  width: number;
  height: number;
  viewBox: string;
}

export const BODY_MAP_ASSETS = {
  front: {
    image: require('../../../assets/body-map/front.png'),
    width: 600,
    height: 1220,
    viewBox: '0 0 600 1220'
  },
  back: {
    image: require('../../../assets/body-map/back.png'),
    width: 600,
    height: 1220,
    viewBox: '0 0 600 1220'
  }
} as const satisfies Record<'front' | 'back', BodyMapAsset>;
