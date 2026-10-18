import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { BASE_ART, CATCH_ART, DISC_ART, RAIL_ART, SEAT_ART, SLED_BACK, SLED_FRONT } from "./geometry";
import { LegPressLive } from "./live";
import { PLATES_MAX } from "./view";

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

const FRAME = (
  <g key="frame">
    {RAIL_ART.braces.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" crease="faint" />
    ))}
    {RAIL_ART.posts.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Line d={RAIL_ART.postSeams} tone="faint" />
    <Solid paths={RAIL_ART.tie} tone="mid" crease="faint" />
  </g>
);

const railOf = (index: 0 | 1, key: string) => (
  <g key={key}>
    <Solid paths={RAIL_ART.rails[index]!} tone="mid" crease="faint" />
    {index === 1 ? <Line d={RAIL_ART.seams} tone="faint" /> : null}
    {index === 1 ? <Line d={RAIL_ART.notches} tone="lo" /> : null}
  </g>
);

const SLED_BACK_ART = (
  <g key="sled-back">
    {SLED_BACK.bushes.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" crease="faint" />
    ))}
    {SLED_BACK.horns.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Solid paths={SLED_BACK.body} tone="hi" crease="faint" />
    <Line d={SLED_BACK.hornCollars} tone="faint" />
  </g>
);

const SLED_FRONT_ART = (
  <g key="sled-front">
    <Solid paths={SLED_FRONT.footplate} tone="hi" crease="faint" />
    <Line d={SLED_FRONT.footRibs} tone="lo" />
  </g>
);

const DISCS = DISC_ART.map((pair, index) => (
  <g key={`disc-${index}`}>
    {pair.map((side, which) => (
      <g key={which}>
        <Solid paths={side.disc} tone="mid" crease="faint" />
        <Line d={side.face} tone="faint" />
      </g>
    ))}
  </g>
));

const catchOf = (which: "parked" | "free") => (
  <g key={`catch-${which}`}>
    {CATCH_ART[which].map((side, index) => (
      <g key={index}>
        <Solid paths={side.boss} tone="lo" crease="faint" />
        <Solid paths={side.arm} tone="hi" crease="none" lit />
        <Solid paths={side.grip} tone="hi" crease="faint" lit />
        <Dots points={side.pivotDot} size={0.6} tone="mid" />
      </g>
    ))}
  </g>
);

const SEAT = (
  <g key="seat">
    <Line d={SEAT_ART.footRing} tone="faint" />
    <Solid paths={SEAT_ART.post} tone="mid" crease="faint" />
    <Line d={SEAT_ART.postSeam} tone="faint" />
    <Dots points={SEAT_ART.holes} size={0.7} tone="lo" />
    <Solid paths={SEAT_ART.collar} tone="lo" crease="faint" />
    <Dots points={SEAT_ART.screws} size={0.45} tone="mid" />
    {SEAT_ART.gripPosts.map((paths, index) => (
      <Solid key={index} paths={paths} tone="lo" crease="faint" />
    ))}
    <Solid paths={SEAT_ART.pad} tone="mid" crease="faint" />
    <Line d={SEAT_ART.padSeam} tone="faint" />
    <Dots points={SEAT_ART.padRivets} size={0.45} tone="lo" />
    {SEAT_ART.grips.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
  </g>
);

const LABEL =
  "Una prensa de piernas de 45° vista en isométrica. Dos raíles inclinados suben desde un poste bajo hasta uno alto, con una fila de muescas en su cara exterior. Sobre ellos corre un carro con casquillos, que lleva por delante un reposapiés nervado y a los lados dos brazos con discos. A media altura, un pestillo a cada lado gira sobre su eje: atravesado sobre la muesca, el carro no baja de ahí; girado hacia fuera, el recorrido queda libre. Rampa abajo, una butaca con respaldo inclinado y dos asas.";

export function LegPressArt() {
  return (
    <LegPressLive
      label={LABEL}
      base={BASE}
      frame={FRAME}
      railBack={railOf(0, "rail-back")}
      railFront={railOf(1, "rail-front")}
      sledBack={SLED_BACK_ART}
      sledFront={SLED_FRONT_ART}
      discs={DISCS}
      catchParked={catchOf("parked")}
      catchFree={catchOf("free")}
      seat={SEAT}
      maxDiscs={PLATES_MAX}
    />
  );
}
