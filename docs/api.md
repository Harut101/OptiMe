# API Notes

## Workout Sessions

Workout Session endpoints are authenticated and scoped to the current user.

```txt
POST /v1/workout-sessions
GET /v1/workout-sessions/by-plan/:dailyPlanId
GET /v1/workout-sessions/:sessionId
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId/sets
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId
POST /v1/workout-sessions/:sessionId/complete
```

`POST /v1/workout-sessions` is idempotent for `userId + dailyPlanId`. It returns the existing session if one already exists.

Workout Session errors should remain friendly and must not expose raw user IDs, profile data, prompts, tokens, or secrets.
