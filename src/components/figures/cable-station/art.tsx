import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import {
  BAR_ART,
  BASE_ART,
  CARRIAGE_ART,
  CLIP_ART,
  FRONT_ART,
  PIN_ART,
  PLATE_ART,
  RAIL_ART,
  REAR_ART,
  ROD_ART,
  ROPE_ART,
  TOWER_ART,
  YOKE_ART,
} from "./geometry";
import { CableStationLive } from "./live";
import { PLATES } from "./view";

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" crease="faint" />
    ))}
    <Solid paths={BASE_ART.slab} tone="mid" crease="faint" />
    <Line d={BASE_ART.groove} tone="lo" />
    <Line d={BASE_ART.footRings} tone="faint" />
    <Dots points={BASE_ART.screws} size={0.55} tone="mid" />
    <Solid paths={BASE_ART.plate} tone="lo" crease="none" flat />
    <Line d={BASE_ART.plateRule} tone="faint" />
  </g>
);

const uprightOf = (index: 0 | 1, key: string) => (
  <g key={key}>
    <Solid paths={TOWER_ART.uprights[index]!} tone="mid" crease="faint" />
    {index === 1 ? <Line d={TOWER_ART.uprightSeams} tone="faint" /> : null}
  </g>
);

const BLOCK = (
  <g key="block">
    <Solid paths={TOWER_ART.block} tone="lo" crease="faint" />
    <Line d={TOWER_ART.blockSeam} tone="faint" />
    <Dots points={TOWER_ART.blockScrews} size={0.5} tone="mid" />
  </g>
);

const RODS = (
  <g key="rods">
    {TOWER_ART.rods.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
  </g>
);

const HEAD = (
  <g key="head">
    <Solid paths={TOWER_ART.head} tone="mid" crease="faint" />
    <Line d={TOWER_ART.headSeam} tone="faint" />
    <Line d={TOWER_ART.bore} tone="lo" />
    <Dots points={TOWER_ART.headScrews} size={0.5} tone="mid" />
  </g>
);

const CAP = (
  <g key="cap">
    <Solid paths={TOWER_ART.cap} tone="mid" crease="faint" />
    <Line d={TOWER_ART.capSeam} tone="faint" />
    <Dots points={TOWER_ART.capScrews} size={0.5} tone="mid" />
  </g>
);

const pulleyOf = (art: typeof REAR_ART, key: string) => (
  <g key={key}>
    <Solid paths={art.cheeks[0]!} tone="lo" crease="faint" />
    <Solid paths={art.far} tone="mid" crease="faint" />
    <Solid paths={art.core} tone="mid" crease="faint" />
    <Solid paths={art.near} tone="mid" crease="faint" inner={<Line d={art.groove} tone="faint" />} />
    <Solid paths={art.hub} tone="lo" crease="none" />
    <Solid paths={art.cheeks[1]!} tone="lo" crease="faint" />
    <Dots points={art.bolts} size={0.6} tone="mid" />
  </g>
);

const RAIL = (
  <g key="rail">
    <Solid paths={RAIL_ART.foot} tone="lo" crease="faint" />
    <Solid paths={RAIL_ART.post} tone="mid" crease="faint" />
    <Line d={RAIL_ART.channel} tone="faint" />
    <Line d={RAIL_ART.ticks} tone="lo" />
    <Dots points={RAIL_ART.holes} size={0.9} tone="lo" />
  </g>
);

const CARRIAGE = (
  <g key="carriage">
    <Solid paths={CARRIAGE_ART.clamp} tone="hi" crease="faint" />
    <Line d={CARRIAGE_ART.clampSeam} tone="faint" />
    <Dots points={CARRIAGE_ART.clampScrews} size={0.5} tone="mid" />
    <Solid paths={CARRIAGE_ART.wheel.cheeks[0]!} tone="lo" crease="faint" />
    <Solid paths={CARRIAGE_ART.wheel.far} tone="mid" crease="faint" />
    <Solid paths={CARRIAGE_ART.wheel.core} tone="mid" crease="faint" />
    <Solid
      paths={CARRIAGE_ART.wheel.near}
      tone="mid"
      crease="faint"
      inner={<Line d={CARRIAGE_ART.wheel.groove} tone="faint" />}
    />
    <Solid paths={CARRIAGE_ART.wheel.hub} tone="lo" crease="none" />
    <Line d={CARRIAGE_ART.wrap} tone="hi" />
    <Solid paths={CARRIAGE_ART.wheel.cheeks[1]!} tone="lo" crease="faint" />
    <Dots points={CARRIAGE_ART.wheel.bolts} size={0.6} tone="mid" />
    <Solid paths={CARRIAGE_ART.pinShaft} tone="hi" crease="none" lit />
    <Solid paths={CARRIAGE_ART.pinKnob} tone="hi" crease="faint" lit />
    <Line d={CARRIAGE_ART.pinCollar} tone="lit" />
  </g>
);

const CLIP = (
  <g key="clip">
    <Solid paths={CLIP_ART.body} tone="mid" crease="faint" />
    <Line d={CLIP_ART.ring} tone="lo" />
    <Dots points={CLIP_ART.bolt} size={0.5} tone="mid" />
  </g>
);

const BAR = (
  <g key="bar">
    {BAR_ART.caps.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Solid paths={BAR_ART.bracket} tone="mid" crease="faint" />
    <Solid paths={BAR_ART.shaft} tone="hi" crease="none" />
    <Line d={BAR_ART.knurl} tone="faint" />
  </g>
);

const ROPE = (
  <g key="rope">
    <Solid paths={ROPE_ART.collar} tone="mid" crease="faint" />
    <Line d={ROPE_ART.strands} tone="hi" />
    {ROPE_ART.knots.map((paths, index) => (
      <Solid key={index} paths={paths} tone="hi" crease="faint" />
    ))}
  </g>
);

const plateOf = (index: number, tone: "mid" | "hi") => (
  <g key={`plate-${tone}-${index}`}>
    <Solid paths={PLATE_ART[index]!.solid} tone={tone} crease="faint" />
    <Line d={PLATE_ART[index]!.seam} tone="faint" />
    <Line d={PLATE_ART[index]!.edge} tone="faint" />
    <Line d={PLATE_ART[index]!.holes} tone="lo" />
    <Line d={PLATE_ART[index]!.pinHole} tone="lo" />
  </g>
);

const YOKE = (
  <g key="yoke">
    <Solid paths={YOKE_ART.solid} tone="hi" crease="faint" />
    <Line d={YOKE_ART.seam} tone="faint" />
    <Line d={YOKE_ART.holes} tone="lo" />
    <Dots points={YOKE_ART.screws} size={0.5} tone="mid" />
    <Solid paths={YOKE_ART.eye} tone="mid" crease="faint" />
    <Line d={YOKE_ART.eyeRing} tone="lo" />
  </g>
);

const ROWS = Array.from({ length: PLATES }, (_, index) => index);

const RODS_BY_PIN = ROWS.map((pin) => <Solid key={`rod-${pin}`} paths={ROD_ART[pin]!} tone="hi" crease="none" />);

const PINS_BY_PIN = ROWS.map((pin) => (
  <g key={`pin-${pin}`}>
    <Solid paths={PIN_ART[pin]!.shaft} tone="hi" crease="none" lit />
    <Solid paths={PIN_ART[pin]!.knob} tone="hi" crease="faint" lit />
    <Line d={PIN_ART[pin]!.collar} tone="lit" />
  </g>
));

const LABEL =
  "Una columna de poleas vista en isométrica. Una torre con doce discos ensartados en dos guías y un pin que elige cuántos suben; un cable que sale del carro, sube hasta dos poleas de reenvío en la cabeza y baja por delante hasta una polea montada en un carro. El carro se fija con otro pin en cualquiera de los agujeros del raíl, y del cable cuelga el agarre: una cuerda con dos nudos o una barra recta moleteada. Al tirar hacia abajo, los discos que están sobre el pin suben exactamente lo mismo.";

export function CableStationArt() {
  return (
    <CableStationLive
      label={LABEL}
      base={BASE}
      uprightBack={uprightOf(0, "upright-back")}
      uprightFront={uprightOf(1, "upright-front")}
      block={BLOCK}
      rods={RODS}
      head={HEAD}
      cap={CAP}
      rearPulley={pulleyOf(REAR_ART, "rear-pulley")}
      frontPulley={pulleyOf(FRONT_ART, "front-pulley")}
      rail={RAIL}
      carriage={CARRIAGE}
      clip={CLIP}
      bar={BAR}
      rope={ROPE}
      platesIdle={ROWS.map((index) => plateOf(index, "mid"))}
      platesLive={ROWS.map((index) => plateOf(index, "hi"))}
      yoke={YOKE}
      selectorRods={RODS_BY_PIN}
      pins={PINS_BY_PIN}
    />
  );
}
