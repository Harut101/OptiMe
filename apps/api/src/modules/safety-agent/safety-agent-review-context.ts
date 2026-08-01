import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';

/** Keeps every user-facing safety surface while excluding technical plan metadata. */
export function buildSafetyAgentSemanticPlan(plan: DailyPlanJson) {
  return {
    safety: plan.safety,
    summary: plan.summary,
    nutrition: {
      calorieGuidance: plan.nutrition.calorieGuidance,
      macroGuidance: plan.nutrition.macroGuidance,
      meals: plan.nutrition.meals,
      menuOptions: plan.nutrition.menuOptions,
      hydration: plan.nutrition.hydration,
      foodPlan: plan.nutrition.foodPlan
        ? {
            targetSafety: {
              status: plan.nutrition.foodPlan.nutritionTargetSnapshot.safetyStatus,
              reasons: plan.nutrition.foodPlan.nutritionTargetSnapshot.safetyReasons
            },
            validation: plan.nutrition.foodPlan.validation,
            meals: plan.nutrition.foodPlan.meals.map((meal) => ({
              id: meal.id,
              mealType: meal.mealType,
              title: meal.title,
              shortDescription: meal.shortDescription,
              prepTimeMinutes: meal.prepTimeMinutes,
              servingSummary: meal.servingSummary,
              ingredients: meal.ingredients.map((ingredient) => ({
                name: ingredient.name,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                isOptional: ingredient.isOptional,
                role: ingredient.role,
                measurementState: ingredient.measurementState,
                preparation: ingredient.preparation,
                usage: ingredient.usage
              })),
              preparationSteps: meal.preparationSteps,
              substitutions: meal.substitutions,
              explanation: meal.explanation
            }))
          }
        : undefined
    },
    training: {
      recommendation: plan.training.recommendation,
      intensity: plan.training.intensity,
      notes: plan.training.notes,
      exercises: plan.training.exercises?.map((exercise) => ({
        name: exercise.name,
        targetMuscles: exercise.targetMuscles,
        equipment: exercise.equipment,
        sets: exercise.sets,
        reps: exercise.reps,
        rest: exercise.rest,
        duration: exercise.duration,
        intensityCue: exercise.intensityCue,
        safetyNotes: exercise.safetyNotes,
        notes: exercise.notes,
        instructions: exercise.exerciseSnapshot?.instructions,
        coachingCues: exercise.exerciseSnapshot?.coachingCues,
        librarySafetyNotes: exercise.exerciseSnapshot?.safetyNotes
      }))
    },
    trainingLoad: plan.trainingLoadAgentSnapshot
      ? {
          readiness: plan.trainingLoadAgentSnapshot.readiness,
          adjustments: plan.trainingLoadAgentSnapshot.adjustments,
          userFacingSummary: plan.trainingLoadAgentSnapshot.userFacingSummary,
          trainingGuidanceBullets:
            plan.trainingLoadAgentSnapshot.trainingGuidanceBullets,
          exerciseCautions: plan.trainingLoadAgentSnapshot.exerciseCautions.map(
            (caution) => ({
              exerciseSlug: caution.exerciseSlug,
              cautionCode: caution.cautionCode,
              message: caution.message
            })
          )
        }
      : undefined,
    trainingAdjustment: plan.trainingAdjustmentSnapshot
      ? {
          painAreas: plan.trainingAdjustmentSnapshot.painAreas,
          avoidedMuscleGroups:
            plan.trainingAdjustmentSnapshot.avoidedMuscleGroups,
          replacedExercises:
            plan.trainingAdjustmentSnapshot.replacedExercises?.map(
              (replacement) => ({
                originalExerciseName: replacement.originalExerciseName,
                replacementName: replacement.replacementName
              })
            ),
          unresolvedConflicts:
            plan.trainingAdjustmentSnapshot.unresolvedConflicts,
          reasonCodes: plan.trainingAdjustmentSnapshot.reasonCodes
        }
      : undefined,
    recovery: plan.recovery,
    reminders: plan.reminders
  };
}
