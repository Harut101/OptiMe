import type { SpecificMuscleGroup } from './body-map-selection';

export type BodyMapView = 'front' | 'back';

export interface BodyMapPath {
  id: string;
  view: BodyMapView;
  side: string;
  label: string;
  muscleGroup: SpecificMuscleGroup;
  d: string;
}
