import { Plate } from "@/components/iso/react/draw";
import { LatPulldownArt } from "./art";
import { CAPTION, PIN_REST, readoutOf } from "./machine";
import "@/components/iso/iso.css";
import "./lat-pulldown.css";

export function LatPulldownFigure() {
  return (
    <Plate
      fig="Fig 1"
      title="Jalón con barra"
      hint="Arrastra la barra · ← → peso"
      readout={readoutOf(PIN_REST, 0)}
      keys={[
        { mark: "lit", label: "El pin: elige cuántos discos suben" },
        { mark: "raised", label: "Lo que se mueve contigo" },
        { mark: "edge", label: "El cable, sin reducción" },
      ]}
      caption={CAPTION}
    >
      <LatPulldownArt />
    </Plate>
  );
}
