import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import {
  BASE_ART,
  IDLER_ART,
  IDLER_WRAP,
  PIN_ART,
  PIVOT_ART,
  PLATE_ART,
  ROD_ART,
  SEAT_ART,
  TOWER_ART,
  YOKE_ART,
} from "./geometry";
import { LegExtensionLive } from "./live";
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
    <Solid paths={TOWER_ART.boom} tone="mid" crease="faint" />
  </g>
);

const IDLER = (
  <g key="idler">
    <Solid paths={IDLER_ART.cheeks[0]!} tone="lo" crease="faint" />
    <Solid paths={IDLER_ART.far} tone="mid" crease="faint" />
    <Solid paths={IDLER_ART.core} tone="mid" crease="faint" />
    <Solid paths={IDLER_ART.near} tone="mid" crease="faint" inner={<Line d={IDLER_ART.groove} tone="faint" />} />
    <Solid paths={IDLER_ART.hub} tone="lo" crease="none" />
    <Solid paths={IDLER_ART.cheeks[1]!} tone="lo" crease="faint" />
    <Dots points={IDLER_ART.bolts} size={0.6} tone="mid" />
  </g>
);

const WRAP = <Line key="wrap" d={IDLER_WRAP} tone="hi" />;

const PIVOT = (
  <g key="pivot">
    <Solid paths={PIVOT_ART.postFar} tone="lo" crease="faint" />
    <Solid paths={PIVOT_ART.post} tone="lo" crease="faint" />
    <Solid paths={PIVOT_ART.shaft} tone="mid" crease="none" />
    {PIVOT_ART.housing.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" crease="faint" />
    ))}
    <Line d={PIVOT_ART.collar} tone="faint" />
    <Dots points={PIVOT_ART.dot} size={0.7} tone="mid" />
  </g>
);

const SEAT = (
  <g key="seat">
    <Line d={SEAT_ART.footRing} tone="faint" />
    <Solid paths={SEAT_ART.post} tone="mid" crease="faint" />
    <Line d={SEAT_ART.postSeam} tone="faint" />
    <Solid paths={SEAT_ART.collar} tone="lo" crease="faint" />
    <Solid paths={SEAT_ART.back} tone="mid" crease="faint" />
    <Line d={SEAT_ART.backSeam} tone="faint" />
    <Dots points={SEAT_ART.backRivets} size={0.45} tone="lo" />
    <Solid paths={SEAT_ART.pad} tone="mid" crease="faint" />
    <Line d={SEAT_ART.padSeam} tone="faint" />
    <Dots points={SEAT_ART.padRivets} size={0.45} tone="lo" />
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

const LABEL =
  "Una extensión de cuádriceps vista en isométrica. A un lado, una torre con doce discos y su pin. Al otro, un asiento con respaldo y, sobre el eje de la rodilla, un brazo con un rodillo acolchado en la punta. Montada en ese mismo eje y hacia fuera del asiento hay una leva: una rueda que no es redonda, con el cable alojado en su canto. Al girar el brazo, la leva gira con él y el cable sale de ella a una distancia del eje que cambia, así que el peso que la pila opone al rodillo cambia también a lo largo del recorrido.";

export function LegExtensionArt() {
  return (
    <LegExtensionLive
      label={LABEL}
      base={BASE}
      uprightBack={uprightOf(0, "upright-back")}
      uprightFront={uprightOf(1, "upright-front")}
      block={BLOCK}
      rods={RODS}
      head={HEAD}
      idler={IDLER}
      wrap={WRAP}
      pivot={PIVOT}
      seat={SEAT}
      platesIdle={ROWS.map((index) => plateOf(index, "mid"))}
      platesLive={ROWS.map((index) => plateOf(index, "hi"))}
      yoke={YOKE}
      selectorRods={ROWS.map((pin) => (
        <Solid key={`rod-${pin}`} paths={ROD_ART[pin]!} tone="hi" crease="none" />
      ))}
      pins={ROWS.map((pin) => (
        <g key={`pin-${pin}`}>
          <Solid paths={PIN_ART[pin]!.shaft} tone="hi" crease="none" lit />
          <Solid paths={PIN_ART[pin]!.knob} tone="hi" crease="faint" lit />
          <Line d={PIN_ART[pin]!.collar} tone="lit" />
        </g>
      ))}
    />
  );
}
