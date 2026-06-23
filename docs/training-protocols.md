# Training Protocols and Exercise Selection

`ProtocolSelectorService` remains responsible for deterministic workout intent, recommended intensity, exercise guidance, and safety rules. `ExerciseSelectionService` does not replace it; it ranks eligible catalog exercises against protocol category and movement-pattern intent.

AI may prescribe allowed exercises inside deterministic bounds, but cannot change the protocol or trusted identity. Recovery, no-training, and conservative limitation protocols reduce volume and prefer mobility/recovery candidates.

