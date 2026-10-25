/** Datos ficticios usados únicamente por las pruebas. */
export const plansFixture = {
  schemaVersion: 1, userId: "user-a", weightUnit: "kg", generatedAt: 100,
  plans: [{
    id: "00000000-0000-4000-8000-000000000001", name: "Piernas y core", description: "Rutina de prueba", weekday: 1,
    exercises: [{
      id: "00000000-0000-4000-8000-000000000004", exerciseId: "00000000-0000-4000-8000-000000000005", name: "Sentadilla con barra",
      muscleGroup: "Piernas", position: 0, targetSets: 3, targetRepsMin: 8, targetRepsMax: 10,
      notes: "Baja con control y mantén el apoyo.",
      previous: { performedAt: "2026-10-20T12:00:00.000Z", weightUnit: "lb",
        sets: [{ reps: 8, weight: 110, rpe: 7 }] },
    }],
  }, {
    id: "00000000-0000-4000-8000-000000000002", name: "Torso", description: null, weekday: 3, exercises: [],
  }, {
    id: "00000000-0000-4000-8000-000000000003", name: "Movilidad sin día fijo", description: null, weekday: null, exercises: [],
  }],
  reschedules: [{ planId: "00000000-0000-4000-8000-000000000001", fromDate: "2026-10-26", toDate: "2026-10-28" }],
};
