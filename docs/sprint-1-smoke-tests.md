# Sprint 1 Backend Smoke Tests

Set these variables in your shell after each response.

```powershell
$API = "http://localhost:3000/v1"
```

Register:

```powershell
$register = Invoke-RestMethod -Method Post "$API/auth/register" -ContentType "application/json" -Body '{
  "email": "alex@example.com",
  "password": "password123",
  "timezone": "UTC",
  "locale": "en",
  "privacyConsentAccepted": true
}'
$token = $register.accessToken
```

Login:

```powershell
$login = Invoke-RestMethod -Method Post "$API/auth/login" -ContentType "application/json" -Body '{
  "email": "alex@example.com",
  "password": "password123"
}'
$token = $login.accessToken
```

Authenticated user:

```powershell
Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } "$API/me"
```

Profile:

```powershell
Invoke-RestMethod -Method Put "$API/profile" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{
  "firstName": "Alex",
  "lastName": "User",
  "dateOfBirth": "1990-01-01",
  "heightCm": 180,
  "weightKg": 80,
  "activityLevel": "MODERATE",
  "privacyConsentAccepted": true
}'
```

Goal:

```powershell
Invoke-RestMethod -Method Put "$API/goals" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{
  "goalType": "IMPROVE_FITNESS"
}'
```

Nutrition preferences:

```powershell
Invoke-RestMethod -Method Put "$API/nutrition-preferences" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{
  "dietType": "NONE",
  "mealsPerDay": 3,
  "allergies": ["peanuts"],
  "excludedFoods": ["shellfish"],
  "preferredFoods": ["rice", "eggs"]
}'
```

Training schedule:

```powershell
$item = Invoke-RestMethod -Method Post "$API/training-schedule/items" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{
  "dayOfWeek": 1,
  "localTime": "07:30",
  "sportType": "RUNNING",
  "durationMinutes": 30,
  "intensity": "MODERATE",
  "description": "Easy run"
}'

Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } "$API/training-schedule"
Invoke-RestMethod -Method Patch "$API/training-schedule/items/$($item.id)" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{ "durationMinutes": 40 }'
```

Onboarding status:

```powershell
Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } "$API/onboarding/status"
```

Generate daily plan:

```powershell
Invoke-RestMethod -Method Post "$API/daily-plans/generate" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body '{ "forceRegenerate": false }'
```

Get today's plan:

```powershell
Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } "$API/daily-plans/today"
```
