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

`DailyPlanGenerationContextService` supplies trusted exercise candidates and the
duration/volume contract. `DailyPlanOrchestratorService` passes generated
training to `TrainingPlanAgentService`, and
`DailyPlanSafetyOrchestratorService` runs deterministic exercise safety before
the optional Safety Agent.

`DailyPlanFinalizationService` restores a complete deterministic
library-backed workout when provider output cannot meet the contract.
`DailyPlanPersistenceService` owns the final status and storage. The
controller-facing `DailyPlansService` only delegates to use cases.

The Recovery Agent and the complete generation, safety, finalization, and
persistence boundaries are implemented. Future changes should improve measured
plan quality or operational reliability rather than add an autonomous agent
loop.

RAG and embeddings are not required for this flow. Exercise retrieval is
deterministic and relational through `ExerciseLibrary`.
