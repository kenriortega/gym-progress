import { BlockProgressHistory } from "@/components/block-progress-history";
import { CalisthenicsProgress } from "@/components/calisthenics-progress";
import { and, countDistinct, desc, eq, max, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { exerciseMuscles, exercises, workoutExercises, workouts, workoutSets } from "@/db/schema";
import { SECONDARY_SHARE } from "@/lib/muscles";
import { AppHeader } from "@/components/app-header";
import { MuscleBalanceCard } from "@/components/muscle-balance-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Un mes: suficiente para ver un desequilibrio, corto para que puedas corregirlo. */
const BALANCE_DAYS = 30;

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Volumen por músculo del último mes. El secundario cuenta menos: el press de
  // banca trabaja el tríceps de verdad, pero no como el pecho.
  //
  // El `1::numeric` no es decorativo. Postgres deduce el tipo del case por su
  // primera rama, así que con `then 1` esperaba un entero en el parámetro de la
  // otra y reventaba con "invalid input syntax for type integer: 0.4".
  const muscleRows = await db
    .select({
      muscle: exerciseMuscles.muscle,
      volume: sql<string>`sum(
        ${workoutSets.weight} * ${workoutSets.reps}
        * case ${exerciseMuscles.role} when 'primary' then 1::numeric else ${SECONDARY_SHARE} end
      )`,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, workoutExercises.exerciseId))
    .where(
      and(
        eq(workouts.userId, session.user.id),
        eq(workouts.status, "completed"),
        eq(workoutSets.loadType, "external"), sql`${workoutSets.durationSeconds} is null`, sql`${workoutExercises.variation} is null`,
        sql`${workouts.performedAt} >= now() - interval '${sql.raw(String(BALANCE_DAYS))} days'`,
      ),
    )
    .groupBy(exerciseMuscles.muscle);
  const volumes = muscleRows.map((row) => ({ muscle: row.muscle, volume: Number(row.volume) }));

  const summaries = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      workoutCount: countDistinct(workouts.id),
      bestWeight: max(workoutSets.weight),
      lastPerformedAt: max(workouts.performedAt),
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, session.user.id), eq(workouts.status, "completed"), eq(workoutSets.loadType, "external"), sql`${workoutSets.durationSeconds} is null`, sql`${workoutExercises.variation} is null`))
    .groupBy(exercises.id)
    .orderBy(desc(max(workouts.performedAt)));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <AppHeader backHref="/" eyebrow="Marcas personales" title="Progreso por ejercicio" />

      <MuscleBalanceCard volumes={volumes} days={BALANCE_DAYS} />
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Este reparto usa solo carga externa con repeticiones. La calistenia, las series por tiempo y los WOD tienen sus registros separados a continuación.</p>

      <CalisthenicsProgress userId={session.user.id} />
      <BlockProgressHistory userId={session.user.id} />
      <h2 className="mt-8 text-xl font-bold">Fuerza con carga externa</h2>
      {summaries.length > 0 ? (
        <section className="mt-8 grid gap-3 md:grid-cols-2">
          {summaries.map((exercise) => (
            <Link key={exercise.id} href={`/exercises/${exercise.id}`} className="block min-w-0">
              <Card className="flex-row items-center gap-4 p-4 transition hover:border-foreground/25">
                <Badge variant="secondary" className="size-12 shrink-0 justify-center rounded-xl text-xs font-black">
                  PR
                </Badge>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-foreground">{exercise.name}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{exercise.muscleGroup} · {exercise.workoutCount} {exercise.workoutCount === 1 ? "sesión" : "sesiones"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="whitespace-nowrap font-bold text-foreground">{Number(exercise.bestWeight)} kg</p>
                  <p className="mt-1 text-xs text-muted-foreground">máximo</p>
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <Card className="mt-10 border-dashed px-6 py-12 text-center">
          <CardHeader>
            <CardTitle>Aún no hay progreso calculado</CardTitle>
            <CardDescription>
              Aquí aparecen las marcas de los ejercicios con carga externa y repeticiones.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
