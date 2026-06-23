# Exercise media catalog alignment

This is a deterministic review package. It does not modify the ExerciseLibrary, rename media, write the database, or call OpenAI. Similar target muscles never establish exercise identity; equipment, loading, body position, laterality, range of motion, and technique all matter.

## Strategy

Preserve all 46 canonical exercises and immutable historical references. Add approved distinct exercises, rename only materially identical aliases, and hold ambiguous or unsupported media outside ingestion. Catalog expansion is safer than replacing stable slugs.

## Projected impact

| Metric | Count |
| --- | ---: |
| Current catalog exercises | 46 |
| Classified unmatched identities | 33 |
| Safe aliases | 2 |
| Proposed new exercises | 31 |
| Duplicate exercises | 0 |
| Excluded media identities | 0 |
| Ambiguous identities | 0 |
| Projected catalog size | 77 |
| Projected media-covered exercises | 46 |
| Remaining catalog exercises without media | 31 |

## Approval boundary

Automatic safe decisions: `cable-row`, `calf-raise`.

Product approval decisions: `back-squat`, `barbell-bench-press`, `barbell-curl`, `barbell-hip-thrust`, `barbell-shoulder-press`, `barbell-shrug`, `bench-dip`, `bent-over-barbell-row`, `butterfly-stretch`, `cable-bicep-curl`, `cable-hip-adduction`, `cable-upright-row`, `crunches`, `deadlift`, `dumbbell-back-fly`, `farmers-carry`, `incline-back-extension`, `kettlebell-sumo-squat`, `lateral-lunge-stretch`, `leg-raise`, `mini-loop-band-side-lying-hip-abduction`, `palms-down-barbell-wrist-curl`, `palms-down-dumbbell-wrist-curl`, `russian-twist`, `seated-machine-calf-press`, `single-leg-kickback`, `standing-barbell-calf-raise`, `standing-hip-abduction`, `stiff-legged-barbell-good-morning`, `superman`, `trap-bar-shrugs`.

Unresolved ambiguities: None.

The `hip-thrust` and `barbell-hip-thrust` media identities remain separate: `hip-thrust_anatomy-01.webp` stays with the existing Hip Thrust exercise, while `barbell-hip-thrust_anatomy-01.webp` is proposed as a new loaded barbell exercise. Russian Twist 01 and 02 are one proposed exercise with two future anatomy media rows: 01 primary/sort 0, 02 secondary/sort 1.

## Remaining catalog exercises without media

`assisted-pull-up`, `bird-dog`, `calf-stretch`, `cat-cow`, `childs-pose`, `dead-bug`, `dumbbell-bench-press`, `dumbbell-shoulder-press`, `elliptical`, `face-pull`, `front-plank`, `glute-bridge`, `glute-bridge-march`, `goblet-squat`, `hammer-curl`, `hip-flexor-stretch`, `incline-push-up`, `leg-extension`, `machine-chest-press`, `machine-row`, `one-arm-dumbbell-row`, `pallof-press`, `reverse-lunge`, `romanian-deadlift`, `seated-calf-raise`, `side-plank`, `stationary-bike`, `step-up`, `thoracic-rotation`, `walking`, `wall-push-up`.

## Decisions

### back-squat

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `back-squat_anatomy-01.webp`
- Proposed canonical slug: `back-squat`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A barbell back squat is a recognized loaded squat and is materially different from a front-loaded goblet squat.
- Material differences: Back-loaded barbell rather than a front-held dumbbell. Higher loading and technique demands justify intermediate and advanced levels.

**Closest current exercise:** Goblet Squat (`goblet-squat`) — STRENGTH, SQUAT, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, primary QUADRICEPS, secondary GLUTES, HAMSTRINGS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Goblet Squat is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `SQUAT`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary QUADRICEPS, GLUTES; secondary HAMSTRINGS, LOWER_BACK; bilateral; active.

**Locale names:** en-US: Back Squat; ru-RU: Приседание со штангой на спине; fr-FR: Squat avec barre sur le dos; zh-CN: 杠铃后蹲.

### barbell-bench-press

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `barbell-bench-press_anatomy-01.webp`
- Proposed canonical slug: `barbell-bench-press`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The fixed barbell load and bilateral hand position create a distinct press from the dumbbell bench press.
- Material differences: Barbell instead of independent dumbbells. Bilateral fixed-bar loading changes stability and range-of-motion characteristics.

**Closest current exercise:** Dumbbell Bench Press (`dumbbell-bench-press`) — STRENGTH, HORIZONTAL_PUSH, equipment DUMBBELLS, BENCH, levels INTERMEDIATE, ADVANCED, primary CHEST, secondary TRICEPS, SHOULDERS, Bilateral or not explicitly modeled, Supine. Dumbbell Bench Press is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HORIZONTAL_PUSH`; equipment BARBELL, BENCH; levels INTERMEDIATE, ADVANCED; primary CHEST; secondary TRICEPS, SHOULDERS; bilateral; active.

**Locale names:** en-US: Barbell Bench Press; ru-RU: Жим штанги лёжа; fr-FR: Développé couché à la barre; zh-CN: 杠铃卧推.

### barbell-curl

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `barbell-curl_anatomy-01.webp`
- Proposed canonical slug: `barbell-curl`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A bilateral fixed-bar curl is distinct from independent dumbbell curls.
- Material differences: Barbell loading rather than dumbbells. Fixed bilateral grip rather than independently moving arms.

**Closest current exercise:** Dumbbell Biceps Curl (`dumbbell-biceps-curl`) — STRENGTH, ISOLATION, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, ADVANCED, primary BICEPS, secondary FOREARMS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Dumbbell Biceps Curl is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BARBELL; levels BEGINNER, INTERMEDIATE, ADVANCED; primary BICEPS; secondary FOREARMS; bilateral; active.

**Locale names:** en-US: Barbell Curl; ru-RU: Сгибание рук со штангой; fr-FR: Curl biceps à la barre; zh-CN: 杠铃弯举.

### barbell-hip-thrust

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `barbell-hip-thrust_anatomy-01.webp`
- Proposed canonical slug: `barbell-hip-thrust`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: Product review confirmed the approved Barbell Hip Thrust image is a loaded barbell setup and is materially different from the existing non-barbell Hip Thrust media identity.
- Material differences: Requires explicit barbell loading rather than the currently approved non-barbell hip-thrust media. Setup and execution context differ because the barbell-loaded variant needs external load placement, padding, and loading-specific prescription. Progression options differ because the barbell variant can be prescribed and progressed separately from the non-barbell variation.

**Closest current exercise:** Hip Thrust (`hip-thrust`) — STRENGTH, HINGE, equipment BENCH, BARBELL, levels INTERMEDIATE, ADVANCED, primary GLUTES, secondary HAMSTRINGS, Bilateral or not explicitly modeled, Supine. Hip Thrust is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HINGE`; equipment BENCH, BARBELL; levels INTERMEDIATE, ADVANCED; primary GLUTES; secondary HAMSTRINGS; bilateral; active.

**Locale names:** en-US: Barbell Hip Thrust; ru-RU: Ягодичный мост со штангой; fr-FR: Hip thrust avec barre; zh-CN: 杠铃臀推.

### barbell-shoulder-press

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `barbell-shoulder-press_anatomy-01.webp`
- Proposed canonical slug: `barbell-shoulder-press`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A fixed barbell overhead press is materially distinct from the dumbbell version.
- Material differences: Barbell rather than dumbbells. Fixed bilateral bar path changes stability and shoulder mechanics.

**Closest current exercise:** Dumbbell Shoulder Press (`dumbbell-shoulder-press`) — STRENGTH, VERTICAL_PUSH, equipment DUMBBELLS, levels INTERMEDIATE, ADVANCED, primary SHOULDERS, secondary TRICEPS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Dumbbell Shoulder Press is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `VERTICAL_PUSH`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary SHOULDERS; secondary TRICEPS; bilateral; active.

**Locale names:** en-US: Barbell Shoulder Press; ru-RU: Жим штанги над головой; fr-FR: Développé épaules à la barre; zh-CN: 杠铃肩上推举.

### barbell-shrug

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `barbell-shrug_anatomy-01.webp`
- Proposed canonical slug: `barbell-shrug`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A loaded scapular elevation shrug is not a horizontal pulling exercise.
- Material differences: Isolation by scapular elevation rather than shoulder external rotation and rowing. Barbell loading instead of cable and rope.

**Closest current exercise:** Face Pull (`face-pull`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary TRAPS, SHOULDERS, secondary LATS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Face Pull is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BARBELL; levels BEGINNER, INTERMEDIATE, ADVANCED; primary TRAPS; secondary FOREARMS; bilateral; active.

**Locale names:** en-US: Barbell Shrug; ru-RU: Шраги со штангой; fr-FR: Haussement d’épaules à la barre; zh-CN: 杠铃耸肩.

### bench-dip

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **MEDIUM**
- Source: `bench-dip_anatomy-01.webp`
- Proposed canonical slug: `bench-dip`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A bodyweight bench dip is a compound pressing movement, not an overhead elbow-extension isolation.
- Material differences: Bodyweight closed-chain movement using a bench. Greater shoulder extension and wrist loading.

**Closest current exercise:** Overhead Triceps Extension (`overhead-triceps-extension`) — STRENGTH, ISOLATION, equipment DUMBBELLS, levels INTERMEDIATE, ADVANCED, primary TRICEPS, secondary SHOULDERS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Overhead Triceps Extension is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HORIZONTAL_PUSH`; equipment BODYWEIGHT, BENCH; levels INTERMEDIATE, ADVANCED; primary TRICEPS; secondary CHEST, SHOULDERS; bilateral; active.

**Locale names:** en-US: Bench Dip; ru-RU: Отжимание от скамьи на трицепс; fr-FR: Dips sur banc; zh-CN: 凳上臂屈伸.

**Enum limitation:** The current MovementPattern enum has no DIP value; HORIZONTAL_PUSH is the closest available representation.

### bent-over-barbell-row

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `bent-over-barbell-row_anatomy-01.webp`
- Proposed canonical slug: `bent-over-barbell-row`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The unsupported hip-hinged barbell row has different loading and torso demands from a seated cable row.
- Material differences: Barbell instead of cable. Unsupported bent-over position adds substantial lower-back isometric load.

**Closest current exercise:** Seated Cable Row (`seated-cable-row`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary LATS, secondary BICEPS, TRAPS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Seated Cable Row is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HORIZONTAL_PULL`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary LATS, BACK; secondary BICEPS, TRAPS, LOWER_BACK; bilateral; active.

**Locale names:** en-US: Bent-Over Barbell Row; ru-RU: Тяга штанги в наклоне; fr-FR: Rowing buste penché à la barre; zh-CN: 杠铃俯身划船.

### butterfly-stretch

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `butterfly-stretch_anatomy-01.webp`
- Proposed canonical slug: `butterfly-stretch`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The seated butterfly targets hip adductors, while the existing stretch targets hip flexors.
- Material differences: Primary target is adductors rather than hip flexors. Seated bilateral hip-abduction position.

**Closest current exercise:** Hip Flexor Stretch (`hip-flexor-stretch`) — MOBILITY, MOBILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, ADVANCED, primary QUADRICEPS, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Hip Flexor Stretch is a gentle mobility exercise for comfortable, controlled movement.

**Proposed metadata:** `MOBILITY` / `MOBILITY`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary ADDUCTORS; secondary GLUTES; bilateral; active.

**Locale names:** en-US: Butterfly Stretch; ru-RU: Растяжка «бабочка»; fr-FR: Étirement papillon; zh-CN: 蝴蝶式拉伸.

### cable-bicep-curl

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `cable-bicep-curl_anatomy-01.webp`
- Proposed canonical slug: `cable-bicep-curl`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: Continuous cable resistance is a distinct loading type from dumbbells.
- Material differences: Cable machine rather than dumbbells. Continuous pulley resistance through the curl.

**Closest current exercise:** Dumbbell Biceps Curl (`dumbbell-biceps-curl`) — STRENGTH, ISOLATION, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, ADVANCED, primary BICEPS, secondary FOREARMS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Dumbbell Biceps Curl is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment CABLE_MACHINE; levels BEGINNER, INTERMEDIATE, ADVANCED; primary BICEPS; secondary FOREARMS; bilateral; active.

**Locale names:** en-US: Cable Biceps Curl; ru-RU: Сгибание рук на нижнем блоке; fr-FR: Curl biceps à la poulie; zh-CN: 绳索二头肌弯举.

### cable-hip-adduction

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `cable-hip-adduction_anatomy-01.webp`
- Proposed canonical slug: `cable-hip-adduction`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: Standing cable hip adduction is unilateral and balance-dependent, unlike the seated bilateral machine exercise.
- Material differences: Cable rather than seated machine. Standing unilateral execution and balance requirement.

**Closest current exercise:** Hip Adduction Machine (`hip-adduction-machine`) — STRENGTH, ISOLATION, equipment MACHINES, levels BEGINNER, INTERMEDIATE, ADVANCED, primary ADDUCTORS, secondary none, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Hip Adduction Machine is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment CABLE_MACHINE; levels BEGINNER, INTERMEDIATE, ADVANCED; primary ADDUCTORS; secondary CORE; unilateral; active.

**Locale names:** en-US: Cable Hip Adduction; ru-RU: Приведение бедра на нижнем блоке; fr-FR: Adduction de hanche à la poulie; zh-CN: 绳索髋内收.

### cable-row

- Status: **SAFE_ALIAS**
- Confidence: **HIGH**
- Source: `cable-row_anatomy-01.webp`
- Proposed canonical slug: `seated-cable-row`
- Existing exercise: `seated-cable-row`
- Action after approval: **RENAME_FILE**
- Reason: Visual inspection confirms a seated bilateral cable row with foot support, matching the seeded Seated Cable Row in equipment, body position, loading, and technique.
- Material differences: No material movement difference; only the approved media filename differs from the canonical identity.

**Closest current exercise:** Seated Cable Row (`seated-cable-row`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary LATS, secondary BICEPS, TRAPS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Seated Cable Row is a controlled strength exercise for building practical movement capacity.

### cable-upright-row

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `cable-upright-row_anatomy-01.webp`
- Proposed canonical slug: `cable-upright-row`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A cable upright row is a vertical elbow-leading pull, not a face pull.
- Material differences: Vertical pulling path rather than horizontal rope pull. Primary shoulder and upper-trapezius emphasis.

**Closest current exercise:** Face Pull (`face-pull`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary TRAPS, SHOULDERS, secondary LATS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Face Pull is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `VERTICAL_PULL`; equipment CABLE_MACHINE; levels INTERMEDIATE, ADVANCED; primary SHOULDERS, TRAPS; secondary BICEPS; bilateral; active.

**Locale names:** en-US: Cable Upright Row; ru-RU: Тяга нижнего блока к подбородку; fr-FR: Tirage vertical à la poulie; zh-CN: 绳索直立划船.

### calf-raise

- Status: **SAFE_ALIAS**
- Confidence: **HIGH**
- Source: `calf-raise_anatomy-01.webp`
- Proposed canonical slug: `standing-calf-raise`
- Existing exercise: `standing-calf-raise`
- Action after approval: **RENAME_FILE**
- Reason: Visual inspection confirms an unsupported standing bodyweight calf raise, matching the seeded exercise in loading, position, range of motion, and target muscles.
- Material differences: No material movement difference; only the approved media filename differs from the canonical identity.

**Closest current exercise:** Standing Calf Raise (`standing-calf-raise`) — STRENGTH, ISOLATION, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary CALVES, secondary none, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Standing Calf Raise is a controlled strength exercise for building practical movement capacity.

### crunches

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `crunches_anatomy-01.webp`
- Proposed canonical slug: `crunches`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A crunch actively flexes the trunk; a dead bug trains anti-extension stability.
- Material differences: CORE_FLEXION rather than CORE_STABILITY. Bilateral trunk curl rather than alternating limb movement.

**Closest current exercise:** Dead Bug (`dead-bug`) — STRENGTH, CORE_STABILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary ABS, secondary OBLIQUES, Bilateral or not explicitly modeled, Supine. Dead Bug is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `CORE_FLEXION`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary ABS; secondary OBLIQUES; bilateral; active.

**Locale names:** en-US: Crunches; ru-RU: Скручивания; fr-FR: Crunchs; zh-CN: 卷腹.

### deadlift

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `deadlift_anatomy-01.webp`
- Proposed canonical slug: `deadlift`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A conventional deadlift starts from the floor with more knee flexion; it is not a Romanian deadlift.
- Material differences: Floor start and concentric first repetition. Greater knee flexion and whole-body loading.

**Closest current exercise:** Romanian Deadlift (`romanian-deadlift`) — STRENGTH, HINGE, equipment BARBELL, levels INTERMEDIATE, ADVANCED, primary HAMSTRINGS, secondary GLUTES, LOWER_BACK, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Romanian Deadlift is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HINGE`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary GLUTES, HAMSTRINGS; secondary LOWER_BACK, TRAPS, FOREARMS; bilateral; active.

**Locale names:** en-US: Conventional Deadlift; ru-RU: Классическая становая тяга; fr-FR: Soulevé de terre classique; zh-CN: 传统硬拉.

### dumbbell-back-fly

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `dumbbell-back-fly_anatomy-01.webp`
- Proposed canonical slug: `incline-dumbbell-reverse-fly`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The approved image shows a chest-supported incline dumbbell reverse fly, distinct from a standing cable face pull.
- Material differences: Dumbbells and incline bench instead of cable and rope. Prone chest-supported reverse-fly arc.

**Closest current exercise:** Face Pull (`face-pull`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary TRAPS, SHOULDERS, secondary LATS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Face Pull is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HORIZONTAL_PULL`; equipment DUMBBELLS, BENCH; levels INTERMEDIATE, ADVANCED; primary SHOULDERS, TRAPS; secondary BACK; bilateral; active.

**Locale names:** en-US: Incline Dumbbell Reverse Fly; ru-RU: Обратная разводка гантелей на наклонной скамье; fr-FR: Oiseau avec haltères sur banc incliné; zh-CN: 上斜凳哑铃反向飞鸟.

### farmers-carry

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `farmers-carry_anatomy-01.webp`
- Proposed canonical slug: `farmers-carry`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A loaded carry pattern is absent from the current catalog.
- Material differences: External bilateral load rather than unloaded cardio walking. Strength-oriented CARRY pattern rather than CARDIO.

**Closest current exercise:** Walking (`walking`) — CARDIO, CARDIO, equipment NONE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary FULL_BODY, secondary none, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Walking is a steady cardio activity that can be adjusted to your current energy.

**Proposed metadata:** `STRENGTH` / `CARRY`; equipment DUMBBELLS; levels BEGINNER, INTERMEDIATE, ADVANCED; primary FULL_BODY, FOREARMS; secondary TRAPS, CORE; bilateral; active.

**Locale names:** en-US: Farmer’s Carry; ru-RU: Прогулка фермера; fr-FR: Marche du fermier; zh-CN: 农夫行走.

### incline-back-extension

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `incline-back-extension_anatomy-01.webp`
- Proposed canonical slug: `incline-back-extension`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A supported back extension uses bodyweight and a bench rather than a standing barbell hinge.
- Material differences: Torso supported on an incline bench. Bodyweight spinal and hip extension rather than barbell loading.

**Closest current exercise:** Romanian Deadlift (`romanian-deadlift`) — STRENGTH, HINGE, equipment BARBELL, levels INTERMEDIATE, ADVANCED, primary HAMSTRINGS, secondary GLUTES, LOWER_BACK, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Romanian Deadlift is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HINGE`; equipment BODYWEIGHT, BENCH; levels INTERMEDIATE, ADVANCED; primary LOWER_BACK; secondary GLUTES, HAMSTRINGS; bilateral; active.

**Locale names:** en-US: Incline Back Extension; ru-RU: Разгибание спины на наклонной скамье; fr-FR: Extension du dos sur banc incliné; zh-CN: 上斜凳背部伸展.

### kettlebell-sumo-squat

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `kettlebell-sumo-squat_anatomy-01.webp`
- Proposed canonical slug: `kettlebell-sumo-squat`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The wide sumo stance and kettlebell loading materially change the squat emphasis.
- Material differences: Kettlebell rather than dumbbell. Wide externally rotated stance increases adductor emphasis.

**Closest current exercise:** Goblet Squat (`goblet-squat`) — STRENGTH, SQUAT, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, primary QUADRICEPS, secondary GLUTES, HAMSTRINGS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Goblet Squat is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `SQUAT`; equipment KETTLEBELL; levels BEGINNER, INTERMEDIATE, ADVANCED; primary QUADRICEPS, GLUTES, ADDUCTORS; secondary HAMSTRINGS; bilateral; active.

**Locale names:** en-US: Kettlebell Sumo Squat; ru-RU: Приседание сумо с гирей; fr-FR: Squat sumo avec kettlebell; zh-CN: 壶铃相扑深蹲.

### lateral-lunge-stretch

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `lateral-lunge-stretch_anatomy-01.webp`
- Proposed canonical slug: `lateral-lunge-stretch`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A lateral lunge stretch targets adductors in a side-to-side stance rather than the hip flexors.
- Material differences: Lateral lunge position. Primary adductor and inner-thigh mobility emphasis.

**Closest current exercise:** Hip Flexor Stretch (`hip-flexor-stretch`) — MOBILITY, MOBILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, ADVANCED, primary QUADRICEPS, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Hip Flexor Stretch is a gentle mobility exercise for comfortable, controlled movement.

**Proposed metadata:** `MOBILITY` / `MOBILITY`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary ADDUCTORS; secondary GLUTES, HAMSTRINGS; unilateral; active.

**Locale names:** en-US: Lateral Lunge Stretch; ru-RU: Растяжка в боковом выпаде; fr-FR: Étirement en fente latérale; zh-CN: 侧弓步拉伸.

### leg-raise

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `leg-raise_anatomy-01.webp`
- Proposed canonical slug: `lying-leg-raise`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The approved image shows a supine straight-leg raise, emphasizing hip flexion and lower abdominal control rather than dead-bug stability.
- Material differences: Straight-leg hip flexion rather than alternating limb stability. Long-lever bilateral movement.

**Closest current exercise:** Dead Bug (`dead-bug`) — STRENGTH, CORE_STABILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary ABS, secondary OBLIQUES, Bilateral or not explicitly modeled, Supine. Dead Bug is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `CORE_FLEXION`; equipment BODYWEIGHT; levels INTERMEDIATE, ADVANCED; primary ABS; secondary none; bilateral; active.

**Locale names:** en-US: Lying Leg Raise; ru-RU: Подъём ног лёжа; fr-FR: Relevé de jambes allongé; zh-CN: 仰卧举腿.

**Enum limitation:** TargetMuscleGroup has no HIP_FLEXORS value, so the valid metadata captures ABS but cannot represent hip-flexor targeting precisely.

### mini-loop-band-side-lying-hip-abduction

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `mini-loop-band-side-lying-hip-abduction_anatomy-01.webp`
- Proposed canonical slug: `mini-loop-band-side-lying-hip-abduction`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A side-lying unilateral mini-band abduction differs from seated machine abduction.
- Material differences: Resistance band rather than machine. Side-lying unilateral execution.

**Closest current exercise:** Hip Abduction Machine (`hip-abduction-machine`) — STRENGTH, ISOLATION, equipment MACHINES, levels BEGINNER, INTERMEDIATE, ADVANCED, primary ABDUCTORS, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Hip Abduction Machine is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment RESISTANCE_BANDS; levels BEGINNER, INTERMEDIATE, ADVANCED; primary ABDUCTORS, GLUTES; secondary CORE; unilateral; active.

**Locale names:** en-US: Mini-Band Side-Lying Hip Abduction; ru-RU: Отведение бедра лёжа на боку с мини-лентой; fr-FR: Abduction de hanche allongée avec mini-bande; zh-CN: 迷你弹力带侧卧髋外展.

### palms-down-barbell-wrist-curl

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `palms-down-barbell-wrist-curl_anatomy-01.webp`
- Proposed canonical slug: `palms-down-barbell-wrist-curl`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A pronated wrist curl isolates wrist extensors and is not an elbow-flexion curl.
- Material differences: Wrist movement rather than elbow flexion. Pronated barbell grip rather than dumbbell elbow flexion.

**Closest current exercise:** Dumbbell Biceps Curl (`dumbbell-biceps-curl`) — STRENGTH, ISOLATION, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, ADVANCED, primary BICEPS, secondary FOREARMS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Dumbbell Biceps Curl is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BARBELL; levels BEGINNER, INTERMEDIATE, ADVANCED; primary FOREARMS; secondary none; bilateral; active.

**Locale names:** en-US: Palms-Down Barbell Wrist Curl; ru-RU: Разгибание запястий со штангой хватом сверху; fr-FR: Flexion des poignets à la barre, paumes vers le bas; zh-CN: 杠铃反握腕弯举.

### palms-down-dumbbell-wrist-curl

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `palms-down-dumbbell-wrist-curl_anatomy-01.webp`
- Proposed canonical slug: `palms-down-dumbbell-wrist-curl`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A palms-down wrist curl isolates the forearms rather than flexing the elbow.
- Material differences: Wrist extension rather than elbow flexion. Pronated grip and forearm isolation.

**Closest current exercise:** Dumbbell Biceps Curl (`dumbbell-biceps-curl`) — STRENGTH, ISOLATION, equipment DUMBBELLS, levels BEGINNER, INTERMEDIATE, ADVANCED, primary BICEPS, secondary FOREARMS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Dumbbell Biceps Curl is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment DUMBBELLS; levels BEGINNER, INTERMEDIATE, ADVANCED; primary FOREARMS; secondary none; bilateral; active.

**Locale names:** en-US: Palms-Down Dumbbell Wrist Curl; ru-RU: Разгибание запястий с гантелями хватом сверху; fr-FR: Flexion des poignets avec haltères, paumes vers le bas; zh-CN: 哑铃反握腕弯举.

### russian-twist

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `russian-twist_anatomy-01.webp`, `russian-twist_anatomy-02.webp`
- Proposed canonical slug: `russian-twist`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A Russian twist is active trunk rotation; a Pallof press is anti-rotation.
- Material differences: ROTATION rather than ANTI_ROTATION. Seated bilateral side-to-side movement rather than standing cable resistance.

**Closest current exercise:** Pallof Press (`pallof-press`) — STRENGTH, ANTI_ROTATION, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary OBLIQUES, ABS, secondary SHOULDERS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Pallof Press is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ROTATION`; equipment BODYWEIGHT; levels INTERMEDIATE, ADVANCED; primary OBLIQUES, ABS; secondary CORE; bilateral; active.

**Locale names:** en-US: Russian Twist; ru-RU: Русский твист; fr-FR: Rotation russe; zh-CN: 俄罗斯转体.

### seated-machine-calf-press

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **MEDIUM**
- Source: `seated-machine-calf-press_anatomy-01.webp`
- Proposed canonical slug: `seated-machine-calf-press`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The approved identity denotes calf pressing on a seated resistance machine rather than the existing seated calf-raise apparatus.
- Material differences: Different machine setup and load path. Pressing platform execution rather than knee-pad calf raise.

**Closest current exercise:** Seated Calf Raise (`seated-calf-raise`) — STRENGTH, ISOLATION, equipment MACHINES, levels BEGINNER, INTERMEDIATE, ADVANCED, primary CALVES, secondary none, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Seated Calf Raise is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment MACHINES; levels BEGINNER, INTERMEDIATE, ADVANCED; primary CALVES; secondary none; bilateral; active.

**Locale names:** en-US: Seated Machine Calf Press; ru-RU: Жим носками в тренажёре сидя; fr-FR: Presse à mollets assise à la machine; zh-CN: 坐姿器械小腿推举.

### single-leg-kickback

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `single-leg-kickback_anatomy-01.webp`
- Proposed canonical slug: `quadruped-leg-kickback`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The approved image shows a quadruped straight-leg glute kickback, not the opposing arm-and-leg stability pattern of bird dog.
- Material differences: Single moving leg without contralateral arm reach. Glute isolation emphasis rather than core balance.

**Closest current exercise:** Bird Dog (`bird-dog`) — STRENGTH, CORE_STABILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary ABS, LOWER_BACK, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Bird Dog is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary GLUTES; secondary HAMSTRINGS, CORE; unilateral; active.

**Locale names:** en-US: Quadruped Leg Kickback; ru-RU: Отведение ноги назад на четвереньках; fr-FR: Extension de jambe à quatre pattes; zh-CN: 跪姿单腿后踢.

### standing-barbell-calf-raise

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `standing-barbell-calf-raise_anatomy-01.webp`
- Proposed canonical slug: `standing-barbell-calf-raise`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: External barbell loading makes this a distinct advanced progression from the bodyweight exercise.
- Material differences: Barbell rather than bodyweight. Greater loading and balance demands.

**Closest current exercise:** Standing Calf Raise (`standing-calf-raise`) — STRENGTH, ISOLATION, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary CALVES, secondary none, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Standing Calf Raise is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary CALVES; secondary CORE; bilateral; active.

**Locale names:** en-US: Standing Barbell Calf Raise; ru-RU: Подъём на носки стоя со штангой; fr-FR: Élévation des mollets debout à la barre; zh-CN: 站姿杠铃提踵.

### standing-hip-abduction

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `standing-hip-abduction_anatomy-01.webp`
- Proposed canonical slug: `standing-hip-abduction`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: The approved image shows unsupported standing bodyweight hip abduction, distinct from a seated machine.
- Material differences: Bodyweight rather than machine. Standing unilateral movement with balance demand.

**Closest current exercise:** Hip Abduction Machine (`hip-abduction-machine`) — STRENGTH, ISOLATION, equipment MACHINES, levels BEGINNER, INTERMEDIATE, ADVANCED, primary ABDUCTORS, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Hip Abduction Machine is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary ABDUCTORS, GLUTES; secondary CORE; unilateral; active.

**Locale names:** en-US: Standing Hip Abduction; ru-RU: Отведение бедра стоя; fr-FR: Abduction de hanche debout; zh-CN: 站姿髋外展.

### stiff-legged-barbell-good-morning

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `stiff-legged-barbell-good-morning_anatomy-01.webp`
- Proposed canonical slug: `stiff-legged-barbell-good-morning`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: A good morning carries the bar on the upper back and hinges the torso; it is not a hand-held Romanian deadlift.
- Material differences: Bar rests on upper back rather than hanging from the hands. Long lever and advanced bracing demands.

**Closest current exercise:** Romanian Deadlift (`romanian-deadlift`) — STRENGTH, HINGE, equipment BARBELL, levels INTERMEDIATE, ADVANCED, primary HAMSTRINGS, secondary GLUTES, LOWER_BACK, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Romanian Deadlift is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `HINGE`; equipment BARBELL; levels ADVANCED; primary HAMSTRINGS, GLUTES; secondary LOWER_BACK; bilateral; active.

**Locale names:** en-US: Stiff-Legged Barbell Good Morning; ru-RU: Наклон «доброе утро» со штангой на прямых ногах; fr-FR: Good morning jambes tendues à la barre; zh-CN: 直腿杠铃早安式.

### superman

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `superman_anatomy-01.webp`
- Proposed canonical slug: `superman`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: Superman is a prone bilateral trunk-and-limb extension; bird dog is quadruped and alternating.
- Material differences: Prone bilateral extension rather than quadruped contralateral movement. Greater spinal-extension emphasis.

**Closest current exercise:** Bird Dog (`bird-dog`) — STRENGTH, CORE_STABILITY, equipment BODYWEIGHT, levels BEGINNER, INTERMEDIATE, primary ABS, LOWER_BACK, secondary GLUTES, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Bird Dog is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `CORE_STABILITY`; equipment BODYWEIGHT; levels BEGINNER, INTERMEDIATE; primary LOWER_BACK; secondary GLUTES, SHOULDERS; bilateral; active.

**Locale names:** en-US: Superman; ru-RU: Супермен; fr-FR: Superman; zh-CN: 超人式.

### trap-bar-shrugs

- Status: **NEW_EXERCISE_CANDIDATE**
- Confidence: **HIGH**
- Source: `trap-bar-shrugs_anatomy-01.webp`
- Proposed canonical slug: `trap-bar-shrugs`
- Existing exercise: none
- Action after approval: **ADD_NEW_EXERCISE**
- Reason: Trap-bar neutral-grip shrugs are a distinct loaded scapular-elevation exercise.
- Material differences: Isolation by scapular elevation rather than horizontal cable pulling. Trap-bar neutral grip rather than cable and rope.

**Closest current exercise:** Face Pull (`face-pull`) — STRENGTH, HORIZONTAL_PULL, equipment CABLE_MACHINE, levels BEGINNER, INTERMEDIATE, ADVANCED, primary TRAPS, SHOULDERS, secondary LATS, Bilateral or not explicitly modeled, Not explicitly modeled in the current seed. Face Pull is a controlled strength exercise for building practical movement capacity.

**Proposed metadata:** `STRENGTH` / `ISOLATION`; equipment BARBELL; levels INTERMEDIATE, ADVANCED; primary TRAPS; secondary FOREARMS; bilateral; active.

**Locale names:** en-US: Trap-Bar Shrugs; ru-RU: Шраги с трэп-грифом; fr-FR: Haussements d’épaules à la barre hexagonale; zh-CN: 六角杠铃耸肩.

**Enum limitation:** ExerciseEquipment has no TRAP_BAR value; BARBELL is the closest valid umbrella equipment value.

## Next batch after approval

Apply the approved catalog expansion, apply the remaining safe media aliases, validate every WebP asset, then ingest ExerciseMedia. No execution from this report is automatic.
