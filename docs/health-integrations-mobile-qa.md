# Health Integrations Mobile QA

This sprint adds Health Connections foundation UI only. It does not request real Apple Health, Health Connect, or WHOOP permissions.

## Manual QA

1. Open Profile.
2. Open Connections / Health data.
3. Confirm Apple Health, Health Connect, and WHOOP cards render.
4. Confirm each card shows a text status, not color alone.
5. Confirm copy says integrations are optional and coming later.
6. Confirm no native permission prompt opens.
7. Confirm no OAuth browser opens.
8. In development, tap "Create mock snapshot".
9. Confirm a wearable snapshot summary appears with activity, sleep, recovery, and strain fields.
10. Return to Today and generate or refresh a plan.
11. Confirm Today remains clean and only shows a small wearable context note when available.
12. Confirm no raw debug data, provider token, or protocol internals are visible.
13. Switch locales to `en-US`, `ru-RU`, `fr-FR`, and `zh-CN` and confirm Health Connections strings render.

## Expected No-Data State

If no wearable snapshot exists, the app should say no recent wearable data is available and continue using profile, preferences, and schedule.

## Expected Stale State

If a snapshot is stale, the app should show a safe stale-data message and plans should not strongly personalize from that snapshot.
