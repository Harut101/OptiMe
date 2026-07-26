# Training Plan Agent

`TrainingPlanAgentService` is the bounded backend owner of the training-plan
pipeline. It is not an autonomous agent loop and it does not add another OpenAI
request by default.

## Responsibilities

- Request safe, localized candidates from `ExerciseSelectionService`.
- Accept only exercise identities present in `ExerciseLibrary`.
- Validate sets, repetitions, rest, exercise duration, and total session timing.
- Provide one compact repair brief when the configured OpenAI daily-plan provider
  returns an invalid workout.
- Validate the complete retry result again.
- Build a trusted deterministic workout from library candidates when the retry is
  unavailable or remains invalid.

Pain, limitations, pregnancy/postpartum context, age safety, equipment,
experience, target muscles, recovery signals, and requested workout duration
remain inputs to deterministic candidate selection and volume planning.

## Current Boundary

`DailyPlansService` remains the top-level daily-plan orchestrator. It gathers user
context, invokes the plan and nutrition providers, passes generated training to
`TrainingPlanAgentService`, runs deterministic safety and the Safety Agent, and
saves the final plan.

The next architecture batches should:

1. Add a bounded Recovery Agent around normalized health signals and recovery
   recommendations.
2. Extract the complete daily-plan pipeline from `DailyPlansService` into a
   dedicated backend orchestrator.
3. Keep Nutrition, Training, Recovery, and Safety outputs structured and
   independently validated.

RAG and embeddings are not required for this flow. Exercise retrieval is
deterministic and relational through `ExerciseLibrary`.
