import { dailyPlanJsonOpenAiSchema } from './daily-plan-json.openai-schema';

describe('DailyPlanJson OpenAI schema', () => {
  it('keeps exercise prescription fields machine-readable across locales', () => {
    const exercise =
      dailyPlanJsonOpenAiSchema.properties.training.properties.exercises.items;

    expect(exercise.properties.reps.description).toContain(
      'Never translate this field'
    );
    expect(exercise.properties.rest.description).toContain('"60 seconds"');
    expect(exercise.properties.duration.description).toContain(
      'For strength use an empty string'
    );
    expect(exercise.properties.sets.description).toContain(
      'Otherwise use an empty string'
    );
  });
});
