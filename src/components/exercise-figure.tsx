import { loadFigure } from "@/lib/exercise-figures";
import "@/components/iso/iso-theme.css";

/** Renders the interactive figure of an exercise's machine, or nothing when it has none. */
export async function ExerciseFigure({
  equipmentKey,
  name,
}: {
  equipmentKey: string | null;
  name: string;
}) {
  const load = loadFigure(equipmentKey, name);
  if (!load) return null;
  const Figure = await load();
  return (
    <div className="iso">
      <Figure />
    </div>
  );
}
