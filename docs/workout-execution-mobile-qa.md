# Workout Execution Mobile QA

Use a generated Daily Plan that includes `training.exercises`.

## Start And Resume

- Open Plan Details.
- Switch to Training.
- Confirm Today tab did not change.
- Confirm Start workout appears when no session exists.
- Tap Start workout.
- Confirm the Workout screen opens.
- Go back to Plan Details.
- Confirm Continue workout appears.
- Tap Continue workout and confirm the same progress is shown.

## Set Tracking

- Toggle the first set of a set-based exercise.
- Confirm the set button changes to completed.
- Toggle it again.
- Confirm it returns to incomplete.
- Complete every set for one exercise.
- Confirm the exercise is marked complete.

## Duration Exercise

- Find an exercise without sets.
- Tap Mark exercise done.
- Confirm progress increases.
- Tap again if available before finishing and confirm it can be undone.

## Finish Workout

- Finish with incomplete sets.
- Confirm the partial-completion dialog appears.
- Cancel and confirm the workout remains in progress.
- Finish again and confirm.
- Confirm the screen becomes read-only.
- Confirm Plan Details shows completed workout state.

## Compatibility

- Open an older plan without exercises and confirm no workout section appears.
- Open a free-text exercise plan and confirm it can be tracked without Exercise Details.
- Confirm no raw debug IDs or protocol internals are shown.

## Safety And Offline Behavior

- Confirm the safety reminder is visible on the workout screen.
- Disable network before toggling a set.
- Confirm the app keeps the screen stable and shows a friendly save error.
- Re-enable network and confirm progress can be saved.
