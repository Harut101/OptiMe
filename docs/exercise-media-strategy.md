# Exercise media strategy

An exercise may have zero, one, or many `ExerciseMedia` rows. Types are `PRIMARY`, `TECHNIQUE`, `ANATOMY`, and `ALTERNATE`. Media represents different views of one exercise, not different exercises; Machine Leg Press, Single-Leg Press, and Incline Leg Press are separate identities when technique or safety context differs.

Only one active primary item is allowed per exercise. Active media is ordered deterministically. Dimensions must both be positive or both absent. `ExerciseMediaTranslation` localizes alt text and caption with requested-locale then English fallback.

Rights metadata (`source`, `license`, and `attribution`) is retained internally for audit support but is not legal verification and is not returned by normal mobile APIs. Content must not use random internet images, watermarked assets, placeholder domains, or unlicensed downloads. Missing media is a supported text-only state.

The future Exercise Details UI may use a portrait `4:5` outer media card, horizontal carousel, and pagination dots. Source media must use contain behavior rather than destructive cropping. No carousel or details UI is implemented in this foundation batch.

