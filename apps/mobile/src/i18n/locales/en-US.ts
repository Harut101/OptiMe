export const enUS = {
  tabs: { today: 'Today', food: 'Food', training: 'Training', profile: 'Profile' },
  common: {
    save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', add: 'Add', continue: 'Continue', retry: 'Try again', loading: 'Loading...', saving: 'Saving...', discard: 'Discard', keepEditing: 'Keep editing', saved: 'Saved', notSet: 'Not set', noneAdded: 'None added', close: 'Close', at: 'at', minutesShort: 'min'
  },
  navigation: { planDetails: 'Plan details', mealDetails: 'Meal details', healthData: 'Health data', goals: 'Goals', designSystem: 'Design system', addWorkout: 'Add workout', editWorkout: 'Edit workout' },
  auth: {
    welcomeTitle: 'A calmer way to plan food, training, and recovery.', welcomeMessage: 'Start with a simple profile and get a supportive daily plan built around consistency.', dailyPlanning: 'Daily planning', dailyPlanningMessage: 'Set up your profile and generate a simple plan for food, training, hydration, and recovery.', createAccount: 'Create account', login: 'Log in', welcomeBack: 'Welcome back', loginMessage: 'Log in to continue your daily plan flow.', loggingIn: 'Logging in...', loginFailed: 'Login failed', email: 'Email', password: 'Password', createTitle: 'Create your account', createMessage: 'We use your setup details to create practical, supportive daily guidance.', creatingAccount: 'Creating account...', createFailed: 'Could not create account', existingAccount: 'I already have an account', consent: 'By continuing, you consent to using your profile and preferences to generate your plan.', preparing: 'Getting things ready', checkingSession: 'Checking your session.', loadingSetup: 'Loading your setup', preparingNextStep: 'We are preparing your next step.'
  },
  onboarding: {
    foundationTitle: 'Your profile', foundationMessage: 'This helps OptiMe keep recommendations age-aware and practical. Safe mode is managed by the backend.', safetyNote: 'Safety note', profileNotSaved: 'Profile was not saved', checkProfile: 'Check your profile', directionTitle: 'Your goal', directionMessage: 'Pick the outcome and app mode that best match the season you are in.', safeGoalTitle: "Let's keep this goal safe", checkGoal: 'Check your goal', foodTitle: 'Nutrition preferences', foodMessage: 'Allergy information keeps your first plan safer. The rest can be refined later from Food.', preferencesNotSaved: 'Preferences were not saved', allergyNeededTitle: 'Allergy information needed', allergyNeededMessage: 'Add any food allergies or confirm that you have no known food allergies so we can keep your plan safer.', personalizeTraining: 'Personalize training', personalizeTrainingMessage: 'Optional. You can finish onboarding without this and update it later from Training.', trainingNotSaved: 'Training preferences were not saved', notNow: 'Not now', continueToday: 'Continue to Today', trainingEnabledTitle: 'Training is enabled', trainingEnabledMessage: 'OptiMe can include training guidance now. Your weekly routine is optional and can be set up when you are ready.', trainingOptionalTitle: 'Training setup is optional', trainingOptionalMessage: 'Would you like to set up your weekly routine now? You can also skip this and start with safe default guidance.', setUpWeeklyRoutine: 'Set up weekly routine', skipTrainingSetup: 'Skip for now', setUpTrainingLater: 'Set up training later', configureTrainingAnytime: 'You can configure training anytime from the Training tab.', activityLevel: 'Activity level'
  },
  today: {
    title: 'Today', tagline: 'Steady, practical, ready.', intro: 'A simple plan for food, training, hydration, and recovery today.', loading: 'Loading Today', loadingMessage: 'Checking whether a plan already exists.', unavailable: 'Today is unavailable', noPlan: 'No plan yet', noPlanMessage: 'Generate a simple plan for food, training, hydration, and recovery today.', generate: 'Generate today plan', generating: 'Generating...', refresh: 'Refresh plan', refreshing: 'Refreshing...', generated: 'Plan generated.', refreshed: 'Plan refreshed', updateFailed: 'Plan update failed', details: 'View plan details', updatedAt: 'Updated {{time}}', safetyNote: 'Safety note', nutrition: 'Nutrition', training: 'Training', trainingOffTitle: 'Training is off', trainingOffMessage: 'You can enable it whenever it fits your goals.', enableTraining: 'Enable training', recovery: 'Recovery', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', limitReached: 'Limit reached', upgradeSoon: 'Upgrade options coming soon.', planUsage: 'Plan usage', usageUnavailable: 'Plan details unavailable', generationsLeft: 'Generations left today: {{count}}', refreshesLeft: 'Refreshes left today: {{count}}', setupNeeded: 'A little setup is needed', setupNeededMessage: 'Please finish the required basics so we can keep your first plan safe.', continueSetup: 'Continue setup', trainingTodayPromptTitle: 'Are you training today?', trainingTodayPromptMessage: 'Today is currently set as a rest day in your Weekly Routine. Rest is useful too, so choose what fits today.', generateRestDayPlan: 'No, generate rest-day plan', setUpTodaysWorkout: 'Yes, train today only', trainingRoutineUpdated: 'Weekly Routine updated', trainingRoutineUpdatedReady: 'Routine saved. Generating your plan now.', trainingRoutineUpdatedExistingPlan: 'Your routine was saved. You already have a plan for today, so refresh only if you want to replace it.', improvePlans: 'Improve future plans', yourAnswer: 'Your answer', listPlaceholder: 'Separate items with commas', chooseOne: 'Choose one', chooseAny: 'Choose any that fit', answer: 'Answer', skip: 'Skip for now', quickDetail: 'One quick detail', numberNeeded: 'Please enter a number, or skip this for now.', optionNeeded: 'Choose an option, or skip this for now.', optionsNeeded: 'Choose at least one option, or skip this for now.', answerNeeded: 'Add an answer, or skip this for now.', answerSaveFailed: 'Could not save this answer', promptSkipFailed: 'Could not skip this prompt', keepUsingToday: 'You can keep using Today.', limitMessage: "You've reached today's limit for this plan. Your {{plan}} plan includes {{limit}} {{action}} per day. {{reset}}", tryAfter: 'Try again after {{time}}.', tryAfterReset: 'Try again after reset.', usageGeneration: 'plan generation', usageRefresh: 'refresh', usageAiGeneration: 'AI plan generation'
  },
  feedback: {
    savedSuccessfully: 'Saved successfully',
    changesSaved: 'Changes saved',
    limitReached: 'Limit reached'
  },
  aiCoach: {
    title: 'AI Coach',
    dailyGuidance: 'Daily guidance',
    createPlanHint: "Create today's plan to see concise coach guidance."
  },
  limits: {
    message: "You've reached today's limit for this plan. Your {{plan}} plan includes {{limit}} {{action}} per day. {{reset}}",
    tryAfter: 'Try again after {{time}}.',
    tryAfterReset: 'Try again after reset.',
    features: {
      dailyPlanGeneration: 'plan generation',
      dailyPlanRefresh: 'refresh',
      aiDailyPlanGeneration: 'AI plan generation',
      mealRegeneration: 'meal regeneration',
      menuRegeneration: 'menu regeneration',
      aiTrainingLoadAgent: 'AI training-load guidance'
    }
  },
  planImpact: {
    label: 'Current plan impact',
    futureOnlySaved: 'Saved for future plans.',
    unavailable: 'Plan impact could not be checked right now.',
    safetyTitle: 'Safety-first update',
    safetyMessage: 'This change may affect safety-sensitive guidance. Review today before continuing hard training.',
    usesGeneration: 'Updating today may use {{count}} plan refresh.',
    mayUseGeneration: 'Updating today may use a plan refresh.',
    noGenerationNeeded: 'You can review this safely without using a plan refresh.',
    titles: {
      UPDATE_TODAY_PLAN: 'Update today’s plan?',
      UPDATE_TODAY_NUTRITION: 'Update today’s nutrition?',
      UPDATE_TODAY_MEALS: 'Update today’s meals?',
      UPDATE_TODAY_WORKOUT: 'Update today’s workout?',
      REVIEW_TODAY_PLAN: 'Review today’s plan?',
      SAFETY_REVIEW_RECOMMENDED: 'Review today for safety?'
    },
    messages: {
      CHANGE_CAN_AFFECT_TODAY_PLAN: 'This change can affect the plan you already have for today.',
      WEIGHT_CAN_AFFECT_NUTRITION: 'Your updated weight can change today’s nutrition target and meal guidance.',
      GOAL_CHANGED: 'Your goal or app mode changed, so today’s nutrition and training guidance may no longer match.',
      FOOD_MAY_APPEAR: 'Today’s meals may include foods you just changed. You can update today or keep this for future plans.',
      TRAINING_ROUTINE_CHANGED: 'Your training setup changed, so today’s workout and nutrition support may need a refresh.',
      USE_LATEST_HEALTH_DATA: 'New health data can help today’s plan reflect your latest activity, sleep, or recovery context.',
      PAIN_LIMITATION_REVIEW: 'Pain or limitations should always reduce intensity. Review today before pushing.'
    },
    actions: {
      UPDATE_TODAY_PLAN: 'Update today’s plan',
      UPDATE_TODAY_MEALS: 'Update today’s meals',
      UPDATE_TODAY_TRAINING: 'Update today’s workout',
      REVIEW_SAFETY: 'Review safely',
      APPLY_TO_FUTURE_ONLY: 'Apply to future plans only',
      KEEP_CURRENT_PLAN: 'Keep current plan'
    }
  },
  todayDashboard: {
    nutritionProgress: 'Nutrition progress',
    trainingProgress: 'Training progress',
    mealsTracked: '{{marked}} of {{total}} meals tracked',
    caloriesTarget: '{{current}} / {{target}} kcal',
    noMealsPlanned: 'No meals planned yet',
    foodLogHelp: 'Track meals from Food or Meal Details.',
    exercisesDone: '{{completed}} of {{total}} exercises done',
    restDay: 'Rest day',
    trainingDisabled: 'Training optional today',
    controlledIntensity: 'Controlled intensity today',
    rest: 'Rest',
    off: 'Off',
    wearableSummary: 'Wearable summary',
    appleHealthIncluded: 'Apple Health included',
    healthDataIncluded: 'Health data included',
    sourceIncluded: '{{source}} included',
    noWearableData: 'No wearable data yet',
    connectAppleHealth: 'Connect Apple Health to personalize your daily plan.',
    steps: 'Steps',
    sleep: 'Sleep',
    activeCalories: 'Active calories',
    workoutMinutes: 'Workout minutes',
    lastSynced: 'Last synced {{value}}',
    today: 'Today',
    yesterday: 'Yesterday',
    kcalValue: '{{value}} kcal',
    minuteValue: '{{value}} min',
    sleepValue: '{{hours}}h {{minutes}}m'
  },
  weight: {
    progressTitle: 'Weight progress',
    currentWeight: 'Current weight',
    targetWeight: 'Target weight',
    startingWeight: 'Starting weight',
    updateWeight: 'Update weight',
    addWeight: 'Add weight',
    setTargetWeight: 'Set target weight',
    remainingToGoal: '{{value}} remaining to target',
    progressPercent: '{{value}} toward target',
    currentValue: 'Current weight: {{value}}',
    targetValue: 'Target weight: {{value}}',
    lastUpdatedValue: 'Last updated {{value}}',
    noCurrentWeight: 'No current weight yet',
    noTargetWeight: 'No target set',
    noWeightEntries: 'No weight entries yet',
    setTargetHint: 'You can set a target from Goals when it feels useful.',
    addCurrentHint: 'Add your current weight to personalize future plans.',
    weightValue: 'Weight ({{unit}})',
    weightInputAccessibility: 'Weight in {{unit}}',
    optionalNote: 'Optional note',
    notePlaceholder: 'Anything useful to remember',
    saveWeight: 'Save weight',
    couldNotSave: 'Could not save weight.',
    invalidWeight: 'Enter a valid weight.',
    futurePlansOnly: 'This updates your current weight for future plans. Previous plans will not change.',
    historyTitle: 'Weight history',
    manualEntry: 'Manual entry',
    safetyLimited: 'Safety-aware view',
    unavailable: 'Weight details unavailable',
    garmin: 'Garmin',
    comingSoon: 'Coming soon'
  },
  plan: {
    title: 'Plan details', loading: 'Loading plan', loadingMessage: 'Opening your plan details.', noPlan: 'No plan yet', noPlanMessage: 'Generate a plan from Today to see details here.', meals: 'Meals', mealsHelp: 'How did each meal go? No worries if it changed — this helps us adapt.', trainingCheckIn: 'Training check-in', trainingHelp: 'Tell us what happened. Resting instead is useful signal, not a failure.', pain: 'I felt pain or discomfort', painHelp: 'We will keep future training guidance more conservative when discomfort is reported.', painThanks: "Thanks for letting us know. We'll use this to keep future training guidance more conservative.", checkInThanks: "Thanks, we'll use this to adapt future plans.", checkInFailed: 'Check-in not saved', planStillHere: 'No worries, your plan is still here.', exercises: 'Suggested exercises', targets: 'Targets: {{value}}', equipment: 'Equipment: {{value}}', sets: 'Sets: {{value}}', setCount_one: '{{count}} set', setCount_other: '{{count}} sets', setsLabel: 'sets', repsLabel: 'Reps', durationLabel: 'Duration', restLabel: 'Rest', reps: 'Reps: {{value}}', rest: 'Rest: {{value}}', duration: 'Duration: {{value}}', hydration: 'Hydration', recovery: 'Recovery', reminders: 'Reminders', helpfulQuestion: 'Was this plan helpful?', helpful: 'Helpful', notHelpful: 'Not helpful', sendFeedback: 'Send feedback', feedbackThanks: 'Thanks for the feedback.', feedbackFailed: 'Feedback not saved', chooseRating: 'Choose Helpful or Not helpful first.', statusCompleted: 'Completed', statusPartial: 'Partial', statusSkipped: 'Skipped', statusSwapped: 'Swapped', statusRested: 'Rested', tagTooMuchFood: 'Too much food', tagTooLittleFood: 'Too little food', tagTrainingTooHard: 'Training too hard', tagTrainingTooEasy: 'Training too easy', tagFeltGood: 'Felt good', tagLowEnergy: 'Low energy', foodTab: 'Food', trainingTab: 'Training', trainingRecommendation: 'Today’s training', openExerciseDetails: 'Open exercise details', mediaUnavailableCards: 'Images are unavailable. Your exercise plan is still here.', limitedDetails: 'Some older exercises have limited details.', noExercises: 'No exercises are planned for today.', exerciseDetailsTitle: 'Exercise details', exerciseUnavailable: 'Exercise details unavailable', exerciseUnavailableMessage: 'This exercise is not available in the current plan.', imageLoading: 'Loading exercise image', imageUnavailable: 'Exercise image unavailable', mediaPage: 'Image {{current}} of {{total}}', planPrescription: 'Your plan', prescriptionUnavailable: 'Use the guidance in your training recommendation.', targetMuscles: 'Target muscles', secondaryMuscles: 'Secondary muscles', equipmentLabel: 'Equipment', noEquipment: 'No equipment', aboutExercise: 'About this exercise', instructions: 'Instructions', coachingCues: 'Coaching cues', safetyNotes: 'Safety notes'
  },
  trainingLoad: {
    title: 'Training load guidance',
    readiness: 'Readiness',
    normal: 'Normal',
    controlled: 'Controlled',
    light: 'Light',
    recoveryFocused: 'Recovery focused',
    unknown: 'Routine-based',
    keepControlled: 'Keep the workout controlled',
    takeLongerRests: 'Take longer rests if needed.',
    recentSleepConsidered: 'Recent sleep considered',
    recentActivityConsidered: 'Recent activity considered',
    savedRoutine: 'Today uses your saved routine.',
    noRecentWearableData: 'No recent wearable data',
    exerciseCaution: 'Exercise caution',
    stopIfPainIncreases: 'Stop if pain increases.',
    adjusted: 'Training load adjusted',
    workoutGuidance: 'Workout guidance'
  },
  workout: {
    title: 'Workout session', loading: 'Loading workout', loadingMessage: 'Opening your saved workout progress.', startWorkout: 'Start workout', continueWorkout: 'Continue workout', resumeWorkout: 'Resume workout', viewWorkout: 'View workout', viewSummary: 'View summary', workoutHistory: 'Workout history', workoutSummary: 'Workout summary', workoutCompleted: 'Workout completed', completedWorkouts: 'Completed workouts', noHistoryTitle: 'No completed workouts yet', noHistoryMessage: 'Completed workouts will appear here after you finish one.', historyIntro: 'Review recent completed workouts without pressure or judgment.', historyHelp: 'See completed workouts and partial sessions.', historyLoading: 'Loading workout history', historyLoadingMessage: 'Opening your completed workouts.', historyUnavailable: 'Workout history unavailable', openWorkoutHistory: 'Open workout history', openCompletedWorkout: 'Open completed workout', finishWorkout: 'Finish workout', completeWorkout: 'Complete workout', finishEarly: 'Finish early', partialTitle: 'Finish with partial completion?', partialMessage: 'Some planned work is still unchecked. You can finish now or continue later.', partial: 'Partial', partialWorkoutSaved: 'Partial workout saved', fullWorkoutCompleted: 'Full workout completed', setNumber: 'Set {{number}}', setCount_one: '{{count}} set', setCount_other: '{{count}} sets', setsLabel: 'sets', exercisesLabel: 'Exercises', repsLabel: 'Reps', durationLabel: 'Duration', restLabel: 'Rest', setsCompleted: '{{completed}} of {{total}} sets completed', exercisesCompleted: '{{completed}} of {{total}} exercises completed', progress: 'Workout progress', progressSummary: '{{completedSets}} of {{totalSets}} sets · {{completedExercises}} of {{totalExercises}} exercises', saving: 'Saving...', saved: 'Saved', saveFailed: 'Workout update failed', progressKept: 'Your visible progress was restored. Please try again.', unavailable: 'Workout unavailable', unavailableMessage: 'This plan does not have executable workout exercises.', statusUnavailable: 'Workout status unavailable. Your plan is still visible.', noExercises: 'Workout has no exercises.', readOnly: 'Completed workout is read-only.', thisWorkoutCompleted: 'This workout is completed, so progress is read-only.', startedAt: 'Started at {{time}}', completedAt: 'Completed at {{time}}', safetyNote: 'Safety note', safetyMessage: 'Stop if you feel pain, dizziness, or unusual discomfort.', markSetComplete: 'Mark set complete', markSetIncomplete: 'Mark set incomplete', markExerciseComplete: 'Mark exercise complete', markExerciseIncomplete: 'Mark exercise incomplete', setAccessibility: '{{exercise}}, set {{index}} of {{total}}, {{status}}', complete: 'complete', incomplete: 'incomplete', readyToStart: 'Ready when you are. Progress will be saved so you can continue later.', preWorkoutCheck: 'Pre-workout check', preWorkoutHelp: 'A quick check for this workout only. You can skip it.', feelToday: 'How do you feel before training?', readinessGood: 'Good', readinessTired: 'Tired', readinessSore: 'Sore', readinessPain: 'Pain or limitation', readinessSkipped: 'Skipped check', painAreas: 'Where do you feel it?', painAreasPlaceholder: 'knee, shoulder, lower back', preWorkoutNote: 'Optional note', preWorkoutNotePlaceholder: 'Anything to keep in mind for this session', continueToWorkout: 'Continue to workout', skipPreWorkoutCheck: 'Skip check', keepWorkoutControlled: 'Keep this workout controlled and stop if discomfort increases.', painAreasSummary: 'Areas: {{value}}.', painConflictTitle: 'This workout targets an area you marked', painConflictMessage: "Consider adjusting today's workout or resting today. Continue only if it feels comfortable, and stop if pain increases.", adjustTodaysWorkout: "Adjust today's workout", restToday: 'Rest today', continueWithCaution: 'Continue with caution', replacementSuggestions: 'Replacement suggestions', saferOptionsFound: 'We found safer options for today.', partialReplacements: 'We found replacements for some exercises. Some still need caution.', noSafeReplacements: "We couldn't find enough safe alternatives with your current setup. Resting today may be safer.", applyReplacements: 'Apply replacements', originalExercise: 'Original exercise', suggestedReplacement: 'Suggested replacement', replacementReason: 'This avoids the area you marked today.', someExercisesStillConflict: 'Some exercises still target the area you marked.', postWorkoutCheckIn: 'Post-workout check-in', postWorkoutHelp: 'Optional. This helps future training stay practical.', howWorkoutFelt: 'How did this workout feel?', postGood: 'Good', postTooEasy: 'Too easy', postTooHard: 'Too hard', postPain: 'Pain during workout', skipCheckIn: 'Skip check-in', saveFeedback: 'Save feedback', feedbackSaved: 'Feedback saved', postWorkoutFeedback: 'Completed workout feedback', postWorkoutNotePlaceholder: 'Anything useful to remember', painAreaCoreAbs: 'Core / Abs', painAreaLowerBack: 'Lower back', painAreaShoulders: 'Shoulders', painAreaChest: 'Chest', painAreaUpperBackLats: 'Upper back / lats', painAreaBiceps: 'Biceps', painAreaTriceps: 'Triceps', painAreaGlutes: 'Glutes', painAreaHamstrings: 'Hamstrings', painAreaQuadriceps: 'Quadriceps', painAreaCalves: 'Calves', painAreaKnees: 'Knees', painAreaWristsForearms: 'Wrists / forearms', painAreaOther: 'Other'
  },
  food: {
    title: 'Food', intro: 'Shape future meal guidance around foods that work for you.', loadingMessage: 'Bringing your saved choices into view.', unavailable: 'Food preferences unavailable', emptyTitle: 'Personalize your meals', emptyMessage: 'Add your dietary preferences and foods you want to avoid to improve future meal recommendations.', setup: 'Set up food preferences', savedMessage: 'Your updated preferences will be used for future plans.', current: 'Current preferences', dietStyle: 'Diet style', mealsPerDay: 'Meals per day', allergies: 'Food allergies', allergiesPlaceholder: 'peanuts, shellfish', noAllergies: 'No known food allergies', noAllergiesHelp: 'Choose this if there are no known food allergies to avoid.', allergyRequired: 'Add allergies or confirm that you have no known food allergies to continue safely.', excludedFoods: 'Excluded foods', excludedPlaceholder: 'foods you prefer to avoid', dislikedFoods: 'Foods you dislike', dislikedPlaceholder: 'foods you would rather avoid', preferredFoods: 'Preferred foods', preferredPlaceholder: 'rice, eggs, berries', notes: 'Food and meal notes', notesPlaceholder: 'meal timing, simple prep, or other preferences', confirmedNoAllergies: 'No known allergies confirmed', mealPlan: 'Meal plan', whatToEatToday: 'What to eat today', mealPlanUnavailable: 'Meal plan unavailable right now.', unableCreateFoodPlan: 'Unable to create a food plan', updateFoodPreferences: 'Update food preferences', totalMacros: '{{kcal}} kcal · {{protein}} g protein · {{carbs}} g carbs · {{fat}} g fat', mealMacros: '{{kcal}} kcal · {{protein}} g protein', calories: 'Calories', fallbackMealPlan: 'We adjusted this plan to keep it safe.', whyMenu: 'Why this menu? Built around your current nutrition target and preferences.', regenerateMenu: 'Regenerate menu', regeneratingMenu: 'Regenerating menu...', replaceMenuTitle: "Replace today's menu?", replaceMenuMessage: "This will replace today's meal plan. Your nutrition target will stay the same. Training, recovery, and reminders will not change.", menuRegenerated: 'Menu updated.', couldNotRegenerateMenu: 'Could not regenerate menu. Your current meal plan was kept.', viewMealDetails: 'View meal details', noMealImage: 'No meal image', mealDetailsLoading: 'Opening meal details.', mealUnavailable: 'Meal unavailable', mealUnavailableMessage: 'This meal is not available in the current plan.', mealActions: 'Meal actions', mealActionsHelp: 'Update this meal status or choose a focused action.', regenerateMeal: 'Regenerate meal', regeneratingMeal: 'Regenerating meal...', replaceMealTitle: 'Replace this meal?', replaceMealMessage: "This will create another option while keeping today's nutrition target the same.", keepCurrentMeal: 'Keep current meal', mealRegenerated: 'Meal updated.', couldNotRegenerateMeal: 'Could not regenerate meal. Your current meal was kept.', excludeIngredient: 'Exclude ingredient', excludeIngredientTitle: 'Exclude {{ingredient}} from future meals?', excludeIngredientMessage: 'This will add {{ingredient}} to excluded foods. It will not automatically change previous plans.', excludeIngredientAccessibility: 'Exclude {{ingredient}} from future meals', ingredientExcluded: 'Ingredient added to excluded foods.', couldNotExcludeIngredient: 'Could not update excluded foods.', approximateNutrition: 'Approximate nutrition', serving: 'Serving', prepTimeValue: '{{minutes}} min prep', ingredients: 'Ingredients', preparation: 'Preparation', substitutions: 'Substitutions', noSubstitutions: 'No substitutions available.', whyMeal: 'Why this meal?', mealAccessibility: '{{type}}, {{title}}, {{kcal}} calories, {{protein}} grams protein. Open meal details.', mealTypes: { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack', PRE_WORKOUT: 'Pre-workout', POST_WORKOUT: 'Post-workout' }, mealReasons: { TARGET_ALIGNED: "Fits today's nutrition target.", PREFERENCE_ALIGNED: 'Uses your preferences where practical.', TRAINING_SUPPORT: "Supports today's training context.", RECOVERY_SUPPORT: 'Keeps recovery in mind.', SIMPLE_PREP: 'Keeps preparation simple.', SAFETY_ADJUSTED: 'Adjusted to keep guidance safer.', BALANCED_ENERGY: 'Supports steady energy.' }, substitutionReasons: { ALLERGY_SAFE_ALTERNATIVE: 'Allergy-safe alternative', EXCLUDED_FOOD_ALTERNATIVE: 'Alternative for an excluded food', PREFERENCE_SWAP: 'Preference-based swap', SIMILAR_MACROS: 'Similar nutrition profile', SIMPLER_PREP: 'Simpler preparation' }
  },
  foodTracking: {
    foodProgress: 'Food progress',
    todaysFoodProgress: "Today's food progress",
    mealsMarked: '{{marked}} of {{total}} meals marked',
    mealStatus: 'Meal status',
    statusPlanned: 'Planned',
    statusEaten: 'Eaten',
    statusPartiallyEaten: 'Partially eaten',
    statusSkipped: 'Skipped',
    markAsEaten: 'Mark eaten',
    markAsPartiallyEaten: 'Mark partial',
    markAsSkipped: 'Mark skipped',
    resetMealStatus: 'Reset to planned',
    updateMealStatus: 'Update meal status',
    updateMealStatusTo: 'Update {{meal}} to {{status}}',
    mealStatusUpdated: 'Meal status updated.',
    couldNotUpdateMealStatus: 'Could not update meal status. Your plan is still here.',
    trackingUnavailable: 'Food tracking unavailable',
    trackingStructuredOnly: 'Meal tracking is available for structured food plans.',
    noMealsMarkedYet: 'No meals marked yet.',
    eatenCount_one: '{{count}} eaten',
    eatenCount_other: '{{count}} eaten',
    partialCount_one: '{{count}} partial',
    partialCount_other: '{{count}} partial',
    skippedCount_one: '{{count}} skipped',
    skippedCount_other: '{{count}} skipped',
    progressAccessibility: '{{progress}}. {{detail}}',
    mealAccessibility: '{{meal}} status: {{status}}'
  },
  nutritionTargets: {
    title: 'Nutrition targets', unavailable: 'Nutrition target details are unavailable right now.', needsMoreInfo: 'More profile info needed', kcal: '{{count}} kcal', why: 'Why these targets?', hideWhy: 'Hide explanation', status: { OK: 'Ready', LIMITED: 'Conservative', NEEDS_MORE_INFO: 'Needs info' }, dayType: { NUTRITION_ONLY: 'Nutrition-only day', TRAINING_DAY: 'Training day target', REST_DAY: 'Rest day target', TRAINING_DISABLED: 'Training disabled' }, titleCodes: { TODAY_TARGET: 'Why this target today', MORE_INFO_NEEDED: 'More information needed' }, primaryGoals: { WEIGHT_LOSS: 'lose weight', WEIGHT_MAINTENANCE: 'maintain weight', WEIGHT_GAIN: 'gain weight', HEALTHY_EATING: 'healthy eating' }, missingFields: { profile: 'profile basics', dateOfBirth: 'date of birth', heightCm: 'height', weightKg: 'weight', activityLevel: 'activity level' }, reasons: { BASED_ON_PRIMARY_GOAL: 'Based on your primary goal: {{primaryGoal}}.', BASED_ON_NORMAL_ACTIVITY: 'Uses your normal activity level and profile basics to keep the target realistic.', BASED_ON_RECENT_ACTIVITY: 'Recent activity context is considered conservatively without aggressive target changes.', NUTRITION_ONLY_MODE: 'Nutrition-only mode is active, so workout energy is not added.', ADJUSTED_FOR_TRAINING_DAY: "Adjusted for today's planned training.", SCHEDULED_REST_DAY: 'Today is a scheduled rest day, so no workout energy was added.', TRAINING_DISABLED: 'Training is currently off, so nutrition is planned independently.', CONSERVATIVE_SAFETY_TARGET: 'The target stays conservative to protect energy, recovery, and consistency.', NEEDS_PROFILE_DETAILS: 'We need your {{missingFields}} to calculate a reliable target.', LIMITED_BY_HEALTH_CONTEXT: 'Health-safety context keeps this target conservative.', MACROS_DERIVED_FROM_TARGET: 'Protein, carbs, and fat are derived from the calorie target.', USING_MAINTENANCE_ESTIMATE: 'Starts from an estimated maintenance target based on your profile.', WEIGHT_LOSS_DEFICIT_APPLIED: 'Uses a small, sustainable deficit for your goal.', WEIGHT_GAIN_SURPLUS_APPLIED: 'Uses a modest surplus to support progress.', HEALTHY_EATING_BALANCED_TARGET: 'Keeps the target balanced for steady energy and healthy habits.' }
  },
  contextNotes: {
    wearableTitle: 'Wearable context',
    appleHealthTitle: 'Apple Health context',
    profileScheduleTitle: 'Profile and schedule',
    trainingLoadTitle: 'Training load note',
    recoveryTitle: 'Recovery context',
    recentActivityAndSleep: 'Recent activity and sleep summaries helped keep today’s plan recovery-aware.',
    recentActivity: 'Recent activity context helped keep today’s plan practical and controlled.',
    recentSleep: 'Recent sleep context helped shape today’s recovery guidance.',
    noRecentWearable: 'No recent wearable data was used, so the plan relies on your profile, preferences, and schedule.',
    wearableStale: 'Wearable data was not recent enough, so the plan stays conservative.',
    keepWorkoutControlled: 'Keep the workout controlled today and reduce effort if energy feels low.',
    takeLongerRests: 'Use a steadier pace and take longer rests if needed.',
    gentlerRecovery: 'Recovery guidance is gentler today because recent context suggests a lighter touch.'
  },
  training: {
    title: 'Training', intro: 'Plan your week, keep each workout realistic, and adjust safely before you start.', section: 'Training section', loadingMessage: 'Checking your preferences and weekly routine.', unavailable: 'Training setup unavailable', disabledTitle: 'Training is currently off', disabledMessage: 'OptiMe can still create your daily nutrition plan. You can enable training whenever you are ready.', enableTraining: 'Enable training', emptyTitle: 'Complete your training setup', emptyMessage: 'Add a simple training focus, level, and any default equipment. Day-specific details live in Weekly Routine.', setup: 'Set up training', editSetup: 'Edit Training Setup', savedMessage: 'Your updated preferences will be used for future plans.', current: 'Training setup', setupSummaryHelp: 'General defaults only. Muscle focus, environment, equipment, and duration can be set per day in Weekly Routine.', focus: 'Focus', level: 'Level', equipment: 'Equipment', defaultEquipment: 'Default equipment', targetMuscles: 'Target muscles', limitations: 'Limitations', trainingFocus: 'Training focus', experienceLevel: 'Experience level', environmentEquipment: 'Environment and equipment', preferredDays: 'Preferred training days', targetHelp: 'Choose the muscle focus for this routine day.', limitationsLabel: 'Limitations or pain areas', limitationsPlaceholder: 'Separate items with commas', scheduleHelp: 'Set day-specific muscle focus, environment, equipment, and duration in Weekly Routine.', preferencesUnavailable: 'Training preferences unavailable', optionalSetup: 'Preparing your optional training setup.', todaysWorkout: "Today's workout", restDayToday: 'Rest day today', generalWorkoutToday: 'General training focus', restDayTodayMessage: 'No workout is scheduled today. Recovery and gentle movement still count.', trainingLoadNote: 'Training load note', trainingLoadMessage: 'Before starting a workout, OptiMe will ask a quick check so pain, soreness, or tiredness can keep this session safer.'
  },
  schedule: {
    title: 'Training schedule', intro: 'Add a planned session if you have one, or choose a light, safe starting point for today.', loading: 'Loading routine', loadingMessage: 'Checking your weekly training setup.', unavailable: 'Routine unavailable', noWorkouts: 'No workouts yet', noWorkoutsMessage: 'Add at least one planned session, or choose no training planned yet.', addWorkout: 'Add workout', editWorkout: 'Edit workout', weekly: 'Weekly routine', weeklyHelp: 'Workout type and duration live here.', weeklySchedule: 'Weekly Routine', weeklyScheduleHelp: 'Set the muscle focus, environment, equipment, and duration for each day.', settings: 'Training setup', noWeeklySchedule: 'No weekly routine yet', noWeeklyScheduleMessage: 'Create a seven-day routine when you want day-specific muscle focus, equipment, and duration.', inactiveHelp: 'Weekly routine is inactive. General training defaults are still available.', createSchedule: 'Create routine', saveSchedule: 'Save routine', savedMessage: 'Weekly routine saved. Future plans will use the resolved day.', deactivateSchedule: 'Deactivate routine', deactivatedMessage: 'Weekly routine deactivated. Future plans will use general training defaults.', trainingDay: 'Training day', restDay: 'Rest day', restDayHelp: 'Today is a scheduled rest day. Focus on recovery and gentle movement if it feels comfortable.', dayUnavailable: 'Day unavailable', dayEditorHelp: 'Customize this routine day or inherit your default training setup.', usualRoutineUpdateHelp: 'This updates your usual weekly routine for this weekday. One-off workout exceptions can come later.', dayType: 'Training or rest', useDefault: 'Use default', customizeForDay: 'Customize for this day', customMuscleFocus: 'Custom muscle focus', muscleFocus: 'Muscle focus', location: 'Environment', equipment: 'Equipment', duration: 'Duration', noOptionalEquipment: 'No optional equipment', equipmentRule: 'Environment does not add or remove equipment. Choose exactly what is available.', usingDefaults: 'Using default values', custom: 'Custom', derivedFrequency_one: '{{count}} day per week', derivedFrequency_other: '{{count}} days per week', noPlanned: 'No planned workouts yet. Safe defaults remain available.', noTraining: 'No training planned yet', noTrainingHelp: "We'll keep today's training guidance light and safe.", personalize: 'Personalize training (optional)', day: 'Day', time: 'Time', sport: 'Sport', durationMinutes: 'Duration (minutes)', intensity: 'Intensity', description: 'Description', saveWorkout: 'Save workout', saveChanges: 'Save changes', saveFailed: 'Workout was not saved', updateFailed: 'Workout was not updated', deleteFailed: 'Could not delete workout'
  },
  trainingOverrides: {
    todayOnly: 'Today only',
    todayOnlyHelp: 'This changes only today. It will not change your usual Weekly Routine.',
    usualRoutineUnaffected: 'Your usual Weekly Routine will stay unchanged.',
    editWeeklyRoutine: 'Edit Weekly Routine',
    restTodayOnly: 'Rest today only',
    skipTodaysWorkout: "Skip today's workout",
    trainTodayOnly: 'Train today only',
    oneTimeTrainingDay: 'One-time training day',
    oneTimeRestDay: 'One-time rest day',
    dailyOverride: 'Daily override',
    moveWorkout: 'Move workout',
    chooseAnotherDay: 'Choose another day',
    returnToGeneratePlan: 'Return to Generate Plan',
    workoutMoved: 'Workout moved',
    dailyOverrideSaved: 'Today-only change saved',
    overrideSavedGenerating: 'Today-only change saved. Generating your plan now.',
    overrideSavedExistingPlan: 'Your today-only change was saved. You already have a plan for today, so refresh only if you want to replace it.',
    restOverrideExistingPlan: 'Today is now set as rest today only. Refresh only if you want to replace your existing plan.',
    restTodayTitle: 'Rest today only?',
    restTodayConfirm: 'This will not change your usual Weekly Routine.',
    restTodayHelp: 'This one-time rest day keeps your usual Weekly Routine unchanged.',
    saveFailed: "Could not save today's training change"
  },
  profile: {
    title: 'Profile', sections: { personal: 'Personal', health: 'Health', connections: 'Connections', settings: 'Settings' }, firstName: 'First name', lastName: 'Last name', dateOfBirth: 'Date of birth', datePlaceholder: 'YYYY-MM-DD', height: 'Height ({{unit}})', weight: 'Weight ({{unit}})', gender: 'Gender', activity: 'Activity level', healthContext: 'Optional health context', pregnancyContext: 'Pregnancy / postpartum context', pregnancyHelp: 'Optional. Used only to keep nutrition and training guidance safer.', chooseToday: 'Choose what fits today', preparing: 'Preparing your profile.', unavailable: 'Profile unavailable', savedMessage: 'Personal details saved. Future recommendations will use your updates.', personal: 'Personal', nameMissing: 'Name not added', bornSummary: 'Born {{date}} · {{height}} · {{weight}}', activitySummary: 'Activity: {{value}}', currentGoal: 'Current goal', goalsAndMode: 'Goals and mode', modeSummary: 'App mode: {{mode}}', trainingOptional: 'Training is optional. Nutrition planning still works when training is off.', noGoal: 'No goal saved', goalHelp: 'Goal updates remain owned by the goal resource, not the profile payload.', editGoals: 'Edit goals', addGoals: 'Add goals', wellnessSafety: 'Wellness safety', safeMode: 'Safe mode is active.', standardMode: 'Standard wellness mode is active.', ageSafety: 'Age-aware safety is derived by the backend from your date of birth.', healthContextTitle: 'Health context', healthContextCopy: 'Pregnancy and postpartum context can be updated under Personal when relevant.', important: 'Important'
  },
  goals: {
    title: 'Goals', intro: 'Update the direction OptiMe should consider for future recommendations.', loadingMessage: 'Bringing your saved direction into view.', unavailable: 'Goals unavailable', emptyTitle: 'Set your goals', emptyMessage: 'Add the outcome you want OptiMe to consider when creating future recommendations.', add: 'Add goals', current: 'Current goal', targetSummary: 'Target: {{weight}} · {{days}} days', savedMessage: 'Your updated goals will be used for future plans.', goal: 'Goal', primaryGoal: 'Primary goal', appMode: 'App mode', modeSummary: 'Mode: {{mode}}', targetWeight: 'Target weight ({{unit}})', timeline: 'Timeline (days)', adjustThrough: 'Adjust through', confirmTitle: 'Apply to future plans?', enableTrainingConfirm: 'Training will be enabled for future plans. Your nutrition targets may change on workout days. Your previous plans will not change.', disableTrainingConfirm: 'Training will be turned off for future plans. Your saved training settings will be kept. Your nutrition plan will no longer include workout energy. Your previous plans will not change.', goalChangeConfirm: 'This affects future daily plans only. Existing saved plans will not change.', futurePlansOnly: 'This affects future daily plans only. Existing saved plans will not change.', checkGoal: 'Please review your goal.'
  },
  appModes: { nutritionOnly: 'Nutrition only', nutritionTraining: 'Nutrition + Training' },
  designSystem: { title: 'Design system preview', intro: 'Internal preview for OptiMe UI foundations.', colors: 'Colors', lightTheme: 'Light theme palette', darkTheme: 'Dark theme palette', semanticColors: 'Semantic health colors', typography: 'Typography', components: 'Components', icons: 'Icons', emptyState: 'Empty state', emptyMessage: 'A quiet empty state for optional setup.', errorState: 'Error state', errorMessage: 'A friendly error state with a clear next action.' },
  health: {
    title: 'Health data', intro: 'Optional health summaries can improve future planning. Plan generation still works without them.', connectionsTitle: 'Health Connections', connectionsIntro: 'Health integrations will help OptiMe personalize nutrition, training, and recovery using activity, sleep, and recovery signals.', optional: 'Wearable data is optional. You can connect later and keep using OptiMe without it.', loadingConnections: 'Checking health connection options.', appleHealthDescription: 'Apple Health can share iPhone activity, sleep, and workout signals for safer personalization.', appleHealthIosOnly: 'Available on iPhone in a development or production build. Expo Go shows a safe unavailable state.', connectAppleHealth: 'Connect Apple Health', syncAppleHealth: 'Sync Apple Health', disconnectAppleHealth: 'Disconnect Apple Health', appleHealthConnected: 'Apple Health is connected.', appleHealthUnavailableTitle: 'Apple Health unavailable', appleHealthUnavailable: 'Apple Health is unavailable on this device.', appleHealthNativeUnavailable: 'Apple Health requires an iOS development build. Expo Go does not include the native HealthKit module.', appleHealthPermissionDenied: 'Apple Health permission was not granted. You can manage permissions in iOS Settings.', appleHealthSynced: 'Apple Health data synced.', appleHealthNoData: 'No Apple Health data found for today.', appleHealthPartialData: 'Some Apple Health metrics were not available for this sync.', appleHealthDisconnected: 'Apple Health is disconnected in OptiMe. Permissions can be managed in iOS Settings.', openIosSettings: 'Open iOS Settings', healthConnect: 'Health Connect', healthConnectDescription: 'Health Connect support is planned for Android health data.', whoopDescription: 'WHOOP support is planned for recovery, sleep, and strain signals.', garminDescription: 'Garmin support is planned for future activity, training, and weight context.', readinessUpdateTitle: 'Update health data?', readinessUpdateBody: "Your latest Apple Health data can help personalize today’s nutrition, training, and recovery plan.", readinessConnectTitle: 'Connect health data?', readinessConnectBody: 'Apple Health can help OptiMe personalize your plan using steps, sleep, active energy, and exercise minutes.', readinessNoDataTitle: 'No Apple Health data found for today', readinessNoDataBody: 'You can still generate your plan using your profile, preferences, and routine.', readinessUnavailableContinue: 'You can still generate your plan without health data.', healthDataOptional: 'Health data is optional', healthDataOptionalCopy: 'Health data can make today’s plan more personalized. You can continue without it.', syncNow: 'Sync now', continueWithoutLatestData: 'Continue without latest data', continueWithoutHealthData: 'Continue without health data', notNow: 'Not now', permissionDeniedContinue: 'Permission was not granted. You can still generate your plan without health data.', syncFailedContinue: 'Health sync could not finish right now. You can still continue without latest data.', wearableSnapshot: 'Wearable snapshot', wearableDataConnected: "Today's plan can use recent activity and recovery signals.", wearableDataStale: 'No recent wearable data is available, so today’s plan uses your saved profile and schedule.', noRecentWearableData: 'No recent wearable data', noRecentWearableDataHelp: 'Using your profile, preferences, and schedule for today’s plan.', activity: 'Activity', sleep: 'Sleep', recovery: 'Recovery', strain: 'Strain', steps: 'Steps', activeCalories: 'Active calories', sleepDuration: 'Sleep duration', workoutMinutes: 'Workout minutes', recoveryScore: 'Recovery score', mockData: 'Mock health data', mockDataHelp: 'Development-only sample data for testing the wearable foundation.', createMockSnapshot: 'Create mock snapshot', mockSnapshotCreated: 'Mock health snapshot created.', mockSnapshotFailed: 'Could not create mock health data.', connectionAccessibility: '{{provider}}, {{status}}', snapshotAccessibility: '{{source}} wearable snapshot for {{date}}', noConnectedSource: 'No connected health source yet.', connectSourceToSync: 'Connect a source to sync health data.', needsAttention: 'Needs attention', disabled: 'Disabled', comingSoon: 'Coming soon', providerUnavailable: 'Native health data is unavailable in this build.', status: 'Status', permissions: 'Permissions', connect: 'Connect', connecting: 'Connecting...', manage: 'Manage connection', disconnect: 'Disconnect', disconnecting: 'Disconnecting...', sync: 'Sync now', syncing: 'Syncing health data...', lastSync: 'Last sync: {{value}}', lastSynced: 'Last synced: {{value}}', todayAt: 'Today, {{time}}', yesterdayAt: 'Yesterday, {{time}}', notSynced: 'Not synced yet', deleteData: 'Delete synced health data', deleting: 'Deleting...', review: 'Review connection explanation', updated: 'Updated', unavailable: 'Health data unavailable', connected: 'Connected', notConnected: 'Not connected', permissionDenied: 'Permission denied', syncError: 'Sync error', explanation: 'You choose what to share. Disconnecting stops future sync; deleting removes imported summaries from OptiMe.', continue: 'Continue', disconnectConfirm: 'Disconnect health data?', deleteConfirm: 'Delete imported health data?', actionCannotUndo: 'This action cannot be undone.', connectionEnabled: '{{provider}} connection is enabled.', disconnectedMessage: '{{provider}} is disconnected. Synced summaries remain until you delete them.', deletedCount: 'Deleted {{count}} synced health summaries.', synced: 'Health summaries synced.', syncedEmpty: 'Health sync completed. No daily summaries were available.', nativeBuildHelp: 'Native sync requires a development build with health support. Expo Go shows a safe unavailable message.', syncHelp: 'OptiMe can request permission for steps, sleep, workouts, and activity, then sync daily summaries for the last 7 days.', syncScope: 'Weight and heart-rate data are not included in this foundation.', beforeConnect: 'Before you connect', manageHelp: 'Disconnecting stops future use. It does not delete stored summaries.'
  },
  bodyMap: {
    front: 'Front', back: 'Back', selected: 'Selected: {{muscles}}', instruction: 'Tap the areas you want your training to emphasize.', select: 'Select {{muscle}} on the {{side}}', deselect: 'Deselect {{muscle}} on the {{side}}', sideLeft: 'left', sideRight: 'right', sideCenter: 'center'
  },
  settings: {
    title: 'Settings', account: 'Account', signedIn: 'Signed in', subscription: 'Subscription', application: 'Application settings', language: 'Language', languageHelp: 'Choose the language used by the application shell.', measurementSystem: 'Measurement system', measurementHelp: 'Choose how measurements are displayed. Stored values remain unchanged.', metric: 'Metric', imperial: 'Imperial', save: 'Save settings', saved: 'Settings updated.', loadError: 'Settings are unavailable right now.', saveError: 'Settings could not be saved.', planUnavailable: 'Plan details unavailable', usageUnavailable: 'Usage details unavailable', usageToday: 'Usage limits are shown on Today when available.', upgradeSoon: 'Upgrade options coming soon.', futureControls: 'Notification controls are planned. No unsaved setting is presented as active.', privacyAccount: 'Privacy and account', privacyCopy: 'Health data management is available under Connections. Account export and deletion remain future settings work.', logout: 'Log out'
  },
  progressive: {
    excludedFoodsTitle: 'Any foods you prefer to avoid?', excludedFoodsDescription: 'We will keep these out of regular suggestions when possible.', preferredFoodsTitle: 'Any foods you want us to use more often?', preferredFoodsDescription: 'A few favorites help future meals feel easier and more familiar.', limitationsTitle: 'Any pain or limitations we should respect?', limitationsDescription: 'Share anything that should keep training guidance gentler or more careful.', equipmentTitle: 'What equipment do you usually have?', equipmentDescription: 'This helps future exercise suggestions fit your real setup.', trainingLevelTitle: 'What is your training level?', trainingLevelDescription: 'This helps keep future exercise guidance realistic.', musclesTitle: 'Any body areas you want to improve?', musclesDescription: 'This will help future training suggestions feel more targeted.', cookingTimeTitle: 'How much cooking time usually fits?', cookingTimeDescription: 'This will help future meals match your day.', mealPrepTitle: 'How do you like to prep meals?', mealPrepDescription: 'This will help future plans feel more practical.', mealTimingTitle: 'Any meal timing preference?', mealTimingDescription: 'This can help future plans work around training and your daily rhythm.', dietTypeTitle: 'Do you follow a diet style?', dietTypeDescription: 'Optional. This helps future meal suggestions fit your preferences.', mealsPerDayTitle: 'How many meals usually fit your day?', mealsPerDayDescription: 'This helps future nutrition guidance match your routine.', trainingOutcomeTitle: 'What do you want training to emphasize?', trainingOutcomeDescription: 'This will help future recommendations lean toward the right style.', options: { VERY_QUICK: 'Very quick', FIFTEEN_TO_THIRTY: '15-30 minutes', LONGER: 'I can cook longer', FRESH: 'Fresh each meal', BATCH_PREP: 'Batch prep', MIXED: 'Mix of both', EARLIER: 'Earlier meals', EVENLY_SPACED: 'Evenly spaced', LATER: 'Later meals', FLEXIBLE: 'Flexible' }
  },
  enums: {
    goalType: { HEALTHY_LIFESTYLE: 'Healthy lifestyle', IMPROVE_FITNESS: 'Improve fitness', BUILD_MUSCLE: 'Build muscle', IMPROVE_ENDURANCE: 'Improve endurance', REDUCE_WEIGHT: 'Reduce weight safely' },
    goalImpact: { NUTRITION_ONLY: 'Nutrition only', NUTRITION_AND_TRAINING: 'Nutrition + training' },
    primaryGoal: { WEIGHT_LOSS: 'Lose weight', WEIGHT_MAINTENANCE: 'Maintain weight', WEIGHT_GAIN: 'Gain weight', HEALTHY_EATING: 'Healthy eating' },
    gender: { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefer not to say' },
    pregnancyStatus: { NOT_PREGNANT: 'Not pregnant', PREGNANT: 'Pregnant', POSTPARTUM: 'Postpartum', BREASTFEEDING: 'Breastfeeding', PREFER_NOT_TO_SAY: 'Prefer not to say', UNKNOWN: 'Unknown' },
    activityLevel: { LOW: 'Low', LIGHT: 'Light', MODERATE: 'Moderate', HIGH: 'High', ATHLETE: 'Athlete' },
    dietType: { NONE: 'None', OMNIVORE: 'Omnivore', VEGETARIAN: 'Vegetarian', VEGAN: 'Vegan', PESCATARIAN: 'Pescatarian', KETO: 'Keto', LOW_CARB: 'Low carb', MEDITERRANEAN: 'Mediterranean', HALAL: 'Halal', KOSHER: 'Kosher' },
    trainingOutcome: { STRENGTH: 'Strength', MUSCLE_GROWTH: 'Muscle growth', ENDURANCE: 'Endurance', MOBILITY: 'Mobility', GENERAL_FITNESS: 'General fitness' },
    trainingLevel: { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' },
    equipment: { GYM: 'Gym', HOME: 'Home', DUMBBELLS: 'Dumbbells', BODYWEIGHT: 'Bodyweight', MACHINES: 'Machines' },
    trainingEnvironment: { HOME: 'Home', GYM: 'Gym', OUTDOOR: 'Outdoor' },
    dayOfWeek: { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday' },
    exerciseEquipment: { NONE: 'No equipment', BODYWEIGHT: 'Bodyweight', DUMBBELLS: 'Dumbbells', BARBELL: 'Barbell', KETTLEBELL: 'Kettlebell', RESISTANCE_BANDS: 'Resistance bands', MACHINES: 'Machines', BENCH: 'Bench', PULL_UP_BAR: 'Pull-up bar', CABLE_MACHINE: 'Cable machine', CARDIO_MACHINE: 'Cardio machine' },
    exerciseCategory: { STRENGTH: 'Strength', MOBILITY: 'Mobility', CARDIO: 'Cardio', RECOVERY: 'Recovery' },
    movementPattern: { SQUAT: 'Squat', HINGE: 'Hinge', HORIZONTAL_PUSH: 'Horizontal push', VERTICAL_PUSH: 'Vertical push', HORIZONTAL_PULL: 'Horizontal pull', VERTICAL_PULL: 'Vertical pull', LUNGE: 'Lunge', CARRY: 'Carry', ROTATION: 'Rotation', ANTI_ROTATION: 'Anti-rotation', CORE_FLEXION: 'Core flexion', CORE_STABILITY: 'Core stability', ISOLATION: 'Isolation', MOBILITY: 'Mobility', CARDIO: 'Cardio', RECOVERY: 'Recovery' },
    muscleGroup: { CHEST: 'Chest', TRAPS: 'Traps', LATS: 'Lats', LOWER_BACK: 'Lower back', ABS: 'Abs', OBLIQUES: 'Obliques', BICEPS: 'Biceps', TRICEPS: 'Triceps', FOREARMS: 'Forearms', QUADRICEPS: 'Quadriceps', HAMSTRINGS: 'Hamstrings', ADDUCTORS: 'Adductors', ABDUCTORS: 'Abductors', CALVES: 'Calves', BACK: 'Back', LEGS: 'Legs', GLUTES: 'Glutes', CORE: 'Core', SHOULDERS: 'Shoulders', ARMS: 'Arms', FULL_BODY: 'Full body' },
    sportType: { RUNNING: 'Running', CYCLING: 'Cycling', GYM: 'Gym', STRENGTH: 'Strength', HIIT: 'HIIT', YOGA: 'Yoga', SWIMMING: 'Swimming', WALKING: 'Walking', TEAM_SPORT: 'Team sport', OTHER: 'Other' },
    intensity: { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' },
    measurementSystem: { METRIC: 'Metric', IMPERIAL: 'Imperial' },
    healthProvider: { APPLE_HEALTH: 'Apple Health', HEALTH_CONNECT: 'Health Connect', WHOOP: 'WHOOP', GARMIN: 'Garmin', MANUAL: 'Manual', MOCK: 'Mock' },
    subscriptionPlan: { FREE: 'Free', PLUS: 'Plus', PRO: 'Pro' },
    planQualityMode: { BASIC: 'Basic', PERSONALIZED: 'Personalized', ADAPTIVE: 'Adaptive' },
    readiness: { PUSH: 'Push', MAINTAIN: 'Maintain', RECOVER: 'Recover' },
    weekdays: { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' }
  },
  safety: { disclaimer: 'OptiMe is an AI wellness assistant, not a medical service. It does not diagnose or treat medical conditions. For injuries, pregnancy/postpartum concerns, medical symptoms, or major lifestyle changes, consider consulting a qualified professional.', goalSteady: "Let's choose a steadier goal that supports energy, training, and recovery.", goalHealthContext: 'For this health context, OptiMe keeps goals focused on steady energy, recovery, hydration, and balanced habits.', goalProfile: 'Please finish your profile first so we can keep this goal safe and realistic.', goalGeneric: 'Please adjust this goal and try again. We want the plan to stay safe, steady, and practical.' },
  unsaved: { title: 'Discard unsaved changes?', message: 'Your updates have not been saved yet.' },
  errors: { network: 'Something went wrong. Please try again.', validation: 'Please review the information you entered.', required: 'This field is required.', unableLoad: 'Unable to load this information.', unableSave: 'Unable to save your changes.', session: 'Your session has expired. Please log in again.', nativeHealthUnsupported: 'Native health data is not available on this device or build.', invalidSettings: 'Choose a supported language and measurement system.' }
} as const;
