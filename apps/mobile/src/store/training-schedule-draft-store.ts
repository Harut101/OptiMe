import { create } from 'zustand';
import type {
  TrainingScheduleDayRequest,
  TrainingScheduleRequest
} from '@optime/shared-types';

interface TrainingScheduleDraftState {
  draft: TrainingScheduleRequest | null;
  setDraft: (draft: TrainingScheduleRequest | null) => void;
  updateDay: (day: TrainingScheduleDayRequest) => void;
}

export const useTrainingScheduleDraftStore = create<TrainingScheduleDraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  updateDay: (day) =>
    set((state) => ({
      draft: state.draft
        ? {
            ...state.draft,
            days: state.draft.days.map((item) => item.dayOfWeek === day.dayOfWeek ? day : item)
          }
        : state.draft
    }))
}));
