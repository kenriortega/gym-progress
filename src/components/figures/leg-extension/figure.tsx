import { Plate } from "@/components/iso/react/draw";
import { LegExtensionArt } from "./art";
import { ANGLE_LOW, CAPTION, PIN_REST, readoutOf } from "./machine";
import "@/components/iso/iso.css";
import "./leg-extension.css";

export function LegExtensionFigure() {
  return (
    <Plate
      fig="Fig 4"
      title="Extensión de cuádriceps"
      hint="Arrastra el rodillo · ← → peso"
      readout={readoutOf(PIN_REST, ANGLE_LOW)}
      keys={[
        { mark: "lit", label: "La leva: el radio cambia con el ángulo" },
        { mark: "raised", label: "Lo que se mueve contigo" },
        { mark: "edge", label: "El cable, alojado en su canto" },
      ]}
      caption={CAPTION}
    >
      <LegExtensionArt />
    </Plate>
  );
}
