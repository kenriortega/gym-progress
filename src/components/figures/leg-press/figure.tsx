import { Plate } from "@/components/iso/react/draw";
import { LegPressArt } from "./art";
import { CAPTION, PLATES_REST, readoutOf } from "./machine";
import { SLED_REST } from "./view";
import "@/components/iso/iso.css";
import "./leg-press.css";

export function LegPressFigure() {
  return (
    <Plate
      fig="Fig 3"
      title="Prensa de piernas"
      hint="Arrastra · ← → discos · espacio: pestillos"
      readout={readoutOf(PLATES_REST, SLED_REST)}
      keys={[
        { mark: "lit", label: "Los pestillos: hasta dónde baja el carro" },
        { mark: "raised", label: "Lo que empujas" },
        { mark: "dim", label: "Las muescas del raíl" },
      ]}
      caption={CAPTION}
    >
      <LegPressArt />
    </Plate>
  );
}
