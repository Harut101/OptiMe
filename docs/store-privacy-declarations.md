# Store privacy declarations

This is the engineering source of truth for Apple App Privacy and Google Play Data Safety
forms. Store declarations must be completed manually against the exact production build,
published Privacy Policy, processor contracts, and final analytics/crash tooling.

## Current data map

| Category | Examples | Purpose | Linked to user | Tracking |
| --- | --- | --- | --- | --- |
| Contact info | Email address | Account, security email | Yes | No |
| Health and fitness | Activity, sleep, workout, active energy, weight, recovery summaries | Wellness planning and user-requested tracking | Yes | No |
| User content | Goals, preferences, check-ins, feedback, optional notes | Personalized plans and saved history | Yes | No |
| Identifiers | Internal user ID, authenticated session metadata | Account and security | Yes | No |
| Purchases | Subscription tier/entitlement metadata when enabled | Feature access | Yes | No |
| Usage data | Feature counters, plan generation status, retries | Limits and service reliability | Yes | No |
| Diagnostics | Safe error reason, provider/model, latency | Reliability and safety monitoring | Usually | No |

OptiMe does not currently use data for third-party advertising, advertising attribution,
or cross-company tracking. Reassess this statement if analytics, attribution, advertising,
or new SDKs are added.

## Apple App Privacy

- Declare account email as contact information used for app functionality.
- Declare health/fitness summaries, weight, workouts, check-ins, and related user content
  as linked to the user and used for app functionality/personalization.
- Declare operational diagnostics and usage counters according to the exact production
  collection behavior.
- HealthKit data must not be used for advertising, marketing, or sale.
- Provide the public Privacy Policy URL and account-deletion path.
- Confirm that screenshots and review notes explain optional, read-only HealthKit use.

## Google Play Data Safety and Health Connect

- Use the name **Health Connect**, not Google Health.
- Declare only permissions present in the release manifest: steps, sleep, exercise, and
  active calories for the current foundation.
- Explain that sharing is optional, purpose-limited to wellness personalization, and not
  required for core plan generation.
- Describe encryption in transit, account deletion, health-summary deletion, and retention.
- Complete the Health apps declaration and allowed-use review for the exact release scope.

## Release evidence checklist

1. Capture production manifests, entitlements, `Info.plist` usage descriptions, and Android
   permission declarations.
2. Record every production SDK and processor; compare with the table above.
3. Verify Privacy Policy and Terms URLs are public HTTPS pages without authentication.
4. Test in-app links, explicit registration consent, health disconnect/delete, and account
   deletion on release builds.
5. Save store-console answers and screenshots with the release record.
6. Re-run this review whenever data collection, AI providers, analytics, payments, or
   health permissions change.

## Human completion required

- Legal entity, privacy contact, regions, age policy, retention schedule, and transfer basis.
- Final processor/subprocessor list and contracts.
- Apple and Google console declarations.
- Store subscription disclosures once purchases are implemented.
