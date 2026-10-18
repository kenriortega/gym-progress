"use client";

import * as React from "react";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import { PLATES_REST, clampPlates, clampSled, floorOf, readoutOf, topOf } from "./machine";
import { DOWN_PER_PX, HEIGHT, SLED_REST, STROKE, WIDTH, slide } from "./view";

const EASE = 0.1;
const NUDGE = 9;
const BACK_TO_TOUR = 4600;
const LOOP = 7;

const ease = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** One calm rep from wherever the catches let the sled rest. */
function tour(time: number, floor: number) {
  const span = topOf() - floor;
  const at = time % LOOP;
  if (at < 1.1) return floor;
  if (at < 2.5) return floor + span * ease((at - 1.1) / 1.4);
  if (at < 3.1) return topOf();
  if (at < 4.7) return floor + span * (1 - ease((at - 3.1) / 1.6));
  return floor;
}

export interface LegPressLiveProps {
  label: string;
  base: React.ReactNode;
  frame: React.ReactNode;
  railBack: React.ReactNode;
  railFront: React.ReactNode;
  sledBack: React.ReactNode;
  sledFront: React.ReactNode;
  discs: React.ReactNode[];
  catchParked: React.ReactNode;
  catchFree: React.ReactNode;
  seat: React.ReactNode;
  maxDiscs: number;
}

export function LegPressLive(props: LegPressLiveProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sledRef = React.useRef<SVGGElement | null>(null);
  const shownRef = React.useRef(SLED_REST);
  const targetRef = React.useRef(SLED_REST);
  const clockRef = React.useRef(0);
  const touchedRef = React.useRef(0);
  const dragRef = React.useRef<{ id: number; from: number; at: number } | null>(null);

  const inView = useInView(rootRef);
  const still = useStillness();
  const [discs, setDiscs] = React.useState(PLATES_REST);
  const [parked, setParked] = React.useState(false);

  const paint = React.useCallback(
    (s: number) => {
      sledRef.current?.setAttribute("transform", slide(s - SLED_REST));
      const slot = rootRef.current?.closest(".iso-plate")?.querySelector("[data-readout]");
      const text = readoutOf(discs, s);
      if (slot && slot.textContent !== text) slot.textContent = text;
    },
    [discs],
  );

  useLoop(
    (dt, calm) => {
      clockRef.current += dt;
      const floor = floorOf(parked);
      const idle = Date.now() - touchedRef.current > BACK_TO_TOUR;
      const wanted = clampSled(
        !dragRef.current && idle && !calm ? tour(clockRef.current, floor) : targetRef.current,
        parked,
      );
      shownRef.current = calm ? wanted : follow(shownRef.current, wanted, dt, EASE);
      paint(shownRef.current);
      return !calm || Math.abs(shownRef.current - wanted) > 0.01;
    },
    inView && !still,
  );

  // Parking the catches can leave the sled below them, and with the loop idle
  // nothing would lift it back out: it has to be put right here.
  React.useEffect(() => {
    targetRef.current = clampSled(targetRef.current, parked);
    if (still) shownRef.current = targetRef.current;
    paint(shownRef.current);
  }, [paint, parked, still]);

  const pushTo = (value: number) => {
    targetRef.current = clampSled(value, parked);
    touchedRef.current = Date.now();
    if (still) {
      shownRef.current = targetRef.current;
      paint(shownRef.current);
    }
  };

  const load = (next: number) => {
    setDiscs(clampPlates(next));
    touchedRef.current = Date.now();
  };

  return (
    <div
      ref={rootRef}
      className="pr"
      tabIndex={0}
      role="group"
      aria-label="Prensa de piernas: arrastra el carro para hacer la repetición, flechas izquierda y derecha para poner o quitar discos, espacio para los pestillos"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if ((event.target as Element).closest?.("[data-catch]")) {
          setParked((on) => !on);
          touchedRef.current = Date.now();
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { id: event.pointerId, from: event.clientY, at: targetRef.current };
        touchedRef.current = Date.now();
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const box = rootRef.current?.querySelector("svg")?.getBoundingClientRect();
        const scale = box?.width ? WIDTH / box.width : 1;
        pushTo(drag.at + (event.clientY - drag.from) * scale * DOWN_PER_PX);
      }}
      onPointerUp={() => {
        dragRef.current = null;
        touchedRef.current = Date.now();
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onKeyDown={(event) => {
        const by = event.shiftKey ? NUDGE * 2 : NUDGE;
        if (event.key === "ArrowUp") pushTo(targetRef.current + by);
        else if (event.key === "ArrowDown") pushTo(targetRef.current - by);
        else if (event.key === "ArrowRight") load(discs + 1);
        else if (event.key === "ArrowLeft") load(discs - 1);
        else if (event.key === " " || event.key === "Enter") {
          setParked((on) => !on);
          touchedRef.current = Date.now();
        } else if (event.key === "Home") pushTo(SLED_REST);
        else if (event.key === "End") pushTo(SLED_REST + STROKE);
        else return;
        event.preventDefault();
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={props.label}>
        {props.base}
        {props.frame}
        {props.railBack}
        <g
          ref={(node) => {
            sledRef.current = node;
          }}
          transform={slide(0)}
        >
          {props.sledBack}
          {props.discs.slice(0, discs)}
          {props.sledFront}
        </g>
        {props.railFront}
        <g data-catch="">{parked ? props.catchParked : props.catchFree}</g>
        {props.seat}
      </IsoFigure>
    </div>
  );
}
