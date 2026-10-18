import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import {
  BASE_ART,
  BAR_ART,
  BOOM_ART,
  CABLE_ART,
  FRONT_ART,
  PIN_ART,
  PLATE_ART,
  REAR_ART,
  ROD_ART,
  SEAT_ART,
  THIGH_ART,
  TOWER_ART,
  YOKE_ART,
} from "./geometry";
import { LatPulldownLive } from "./live";
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
    <Dots points={BASE_ART.plateScrews} size={0.45} tone="mid" />
  </g>
);

const uprightOf = (index: 0 | 1, key: string) => (
  <g key={key}>
    <Solid paths={TOWER_ART.uprights[index]!} tone="mid" crease="faint" />
    {index === 1 ? <Line d={TOWER_ART.uprightSeams} tone="faint" /> : null}
    {index === 1 ? <Dots points={TOWER_ART.uprightScrews} size={0.5} tone="mid" /> : null}
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
    <Solid paths={TOWER_ART.riser} tone="mid" crease="faint" />
    <Line d={TOWER_ART.riserSeam} tone="faint" />
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

const BOOM = (
  <g key="boom">
    <Solid paths={BOOM_ART.slab} tone="mid" crease="faint" />
    <Line d={BOOM_ART.seam} tone="faint" />
    <Dots points={BOOM_ART.screws} size={0.5} tone="mid" />
  </g>
);

const WRAPS = (
  <g key="wraps">
    <Line d={CABLE_ART.rearWrap} tone="hi" />
    <Line d={CABLE_ART.span} tone="hi" />
    <Line d={CABLE_ART.frontWrap} tone="hi" />
  </g>
);

const SEAT = (
  <g key="seat">
    <Solid paths={SEAT_ART.post} tone="mid" crease="faint" />
    <Line d={SEAT_ART.postSeam} tone="faint" />
    <Dots points={SEAT_ART.holes} size={0.7} tone="lo" />
    <Solid paths={SEAT_ART.collar} tone="lo" crease="faint" />
    <Solid paths={SEAT_ART.bracket} tone="lo" crease="faint" />
    <Solid paths={SEAT_ART.pad} tone="mid" crease="faint" />
    <Line d={SEAT_ART.padSeam} tone="faint" />
    <Dots points={SEAT_ART.padRivets} size={0.45} tone="lo" />
  </g>
);

const THIGH = (
  <g key="thigh">
    <Solid paths={THIGH_ART.post} tone="mid" crease="faint" />
    <Line d={THIGH_ART.postSeam} tone="faint" />
    <Dots points={THIGH_ART.holes} size={0.7} tone="lo" />
    <Solid paths={THIGH_ART.collar} tone="lo" crease="faint" />
    <Solid paths={THIGH_ART.knob} tone="lo" crease="faint" />
    <Solid paths={THIGH_ART.bar} tone="mid" crease="none" />
    {THIGH_ART.pads.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={THIGH_ART.padRings} tone="faint" />
  </g>
);

const BAR = (
  <g key="bar">
    {BAR_ART.caps.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    {BAR_ART.grips.map((paths, index) => (
      <Solid key={index} paths={paths} tone="hi" crease="faint" />
    ))}
    <Solid paths={BAR_ART.shaft} tone="hi" crease="none" />
    <Line d={BAR_ART.knurl} tone="faint" />
    <Line d={BAR_ART.collars} tone="mid" />
    <Solid paths={BAR_ART.clevis} tone="mid" crease="faint" />
    <Dots points={BAR_ART.pinDots} size={0.6} tone="mid" />
    <Solid paths={BAR_ART.swivel} tone="mid" crease="faint" />
    <Line d={BAR_ART.swivelRing} tone="lo" />
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

const RODS_BY_PIN = ROWS.map((pin) => (
  <Solid key={`rod-${pin}`} paths={ROD_ART[pin]!} tone="hi" crease="none" />
));

const PINS_BY_PIN = ROWS.map((pin) => (
  <g key={`pin-${pin}`}>
    <Solid paths={PIN_ART[pin]!.shaft} tone="hi" crease="none" lit />
    <Solid paths={PIN_ART[pin]!.knob} tone="hi" crease="faint" lit />
    <Line d={PIN_ART[pin]!.collar} tone="lit" />
    <Line d={PIN_ART[pin]!.lanyard} tone="lo" />
  </g>
));

const LABEL =
  "Una polea de jalón vista en isométrica. Una torre con doce discos ensartados en dos guías, un pin que atraviesa uno de ellos y decide cuántos suben, un cable que sale del carro, pasa por un agujero de la placa superior, rodea la polea de cabeza, corre bajo el brazo y baja por la polea del extremo hasta la barra. Un asiento con respaldo bajo y dos rodillos que sujetan los muslos. Al tirar de la barra hacia abajo, los discos que están sobre el pin suben exactamente lo mismo.";

export function LatPulldownArt() {
  return (
    <LatPulldownLive
      label={LABEL}
      base={BASE}
      uprightBack={uprightOf(0, "upright-back")}
      uprightFront={uprightOf(1, "upright-front")}
      block={BLOCK}
      rods={RODS}
      head={HEAD}
      rearPulley={pulleyOf(REAR_ART, "rear-pulley")}
      frontPulley={pulleyOf(FRONT_ART, "front-pulley")}
      boom={BOOM}
      wraps={WRAPS}
      seat={SEAT}
      thigh={THIGH}
      bar={BAR}
      platesIdle={ROWS.map((index) => plateOf(index, "mid"))}
      platesLive={ROWS.map((index) => plateOf(index, "hi"))}
      yoke={YOKE}
      selectorRods={RODS_BY_PIN}
      pins={PINS_BY_PIN}
    />
  );
}
