import { Plate } from "@/components/iso/react/draw";
import { CableStationArt } from "./art";
import { CAPTION, PIN_REST, readoutOf } from "./machine";
import "@/components/iso/iso.css";
import "./cable-station.css";

export function CableStationFigure() {
  return (
    <Plate
      fig="Fig 2"
      title="Columna de poleas"
      hint="Arrastra · ← → polea · espacio: agarre"
      readout={readoutOf(PIN_REST, 0, "cuerda")}
      keys={[
        { mark: "lit", label: "Los dos pines: el peso y la altura" },
        { mark: "raised", label: "Lo que se mueve contigo" },
        { mark: "edge", label: "El cable, sin reducción" },
      ]}
      caption={CAPTION}
    >
      <CableStationArt />
    </Plate>
  );
}
