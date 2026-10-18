"use client";

import * as React from "react";
import { IsoFigure, Line } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import { CABLE_ART } from "./geometry";
import { GRIPS, PIN_REST, clampHole, clampPin, clampPull, readoutOf, type Grip } from "./machine";
import {
  ANCHOR,
  CLIP_H,
  EZ,
  HANDLE_DROP,
  HEIGHT,
  HOLE_REST,
  PLATES,
  RISE,
  STROKE,
  TOP_Z,
  WIDTH,
  holeZ,
  lift,
} from "./view";

const EASE = 0.1;
const SLIDE = 0.14;
const NUDGE = 9;
const BACK_TO_TOUR = 4600;
const LOOP = 7.4;

const round = (value: number) => Math.round(value * 10) / 10;
const line = (ax: number, ay: number, bx: number, by: number) =>
  `M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}`;

/** A run straight down the z axis, from one world height to another. */
const runAt = (anchor: readonly [number, number], from: number, to: number) =>
  line(anchor[0] + EZ[0] * from, anchor[1] + EZ[1] * from, anchor[0] + EZ[0] * to, anchor[1] + EZ[1] * to);

const REST_CARRIAGE = holeZ(HOLE_REST);
const handleRest = (carriage: number) => carriage - HANDLE_DROP;

const REST_UP = line(ANCHOR.eye[0], ANCHOR.eye[1], ANCHOR.upTop[0], ANCHOR.upTop[1]);
const REST_DROP = runAt(ANCHOR.drop, REST_CARRIAGE, TOP_Z);
const REST_LEAD = runAt(ANCHOR.handle, handleRest(REST_CARRIAGE) + CLIP_H, REST_CARRIAGE);

const ease = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** One calm rep, so the figure shows what it does before anybody touches it. */
function tour(time: number) {
  const at = time % LOOP;
  if (at < 1.2) return 0;
  if (at < 2.5) return STROKE * ease((at - 1.2) / 1.3);
  if (at < 3.2) return STROKE;
  if (at < 4.8) return STROKE * (1 - ease((at - 3.2) / 1.6));
  return 0;
}

interface Nodes {
  stack: SVGGElement | null;
  carriage: SVGGElement | null;
  handle: SVGGElement | null;
  up: SVGPathElement | null;
  drop: SVGPathElement | null;
  lead: SVGPathElement | null;
}

export interface CableStationLiveProps {
  label: string;
  base: React.ReactNode;
  uprightBack: React.ReactNode;
  uprightFront: React.ReactNode;
  block: React.ReactNode;
  rods: React.ReactNode;
  head: React.ReactNode;
  cap: React.ReactNode;
  rearPulley: React.ReactNode;
  frontPulley: React.ReactNode;
  rail: React.ReactNode;
  carriage: React.ReactNode;
  clip: React.ReactNode;
  bar: React.ReactNode;
  rope: React.ReactNode;
  platesIdle: React.ReactNode[];
  platesLive: React.ReactNode[];
  yoke: React.ReactNode;
  selectorRods: React.ReactNode[];
  pins: React.ReactNode[];
}

export function CableStationLive(props: CableStationLiveProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const nodesRef = React.useRef<Nodes>({ stack: null, carriage: null, handle: null, up: null, drop: null, lead: null });
  const pullRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const carriageRef = React.useRef(REST_CARRIAGE);
  const clockRef = React.useRef(0);
  const touchedRef = React.useRef(0);
  const dragRef = React.useRef<{ id: number; from: number; at: number } | null>(null);

  const inView = useInView(rootRef);
  const still = useStillness();
  const [pin, setPin] = React.useState(PIN_REST);
  const [hole, setHole] = React.useState(HOLE_REST);
  const [grip, setGrip] = React.useState<Grip>("cuerda");

  const paint = React.useCallback(
    (pull: number, carriage: number) => {
      const { stack, up, drop, lead } = nodesRef.current;
      stack?.setAttribute("transform", lift(pull));
      nodesRef.current.carriage?.setAttribute("transform", lift(carriage));
      const handle = handleRest(carriage) - pull;
      nodesRef.current.handle?.setAttribute("transform", lift(handle));
      up?.setAttribute(
        "d",
        line(
          ANCHOR.eye[0] + EZ[0] * pull,
          ANCHOR.eye[1] + EZ[1] * pull,
          ANCHOR.upTop[0],
          ANCHOR.upTop[1],
        ),
      );
      // Down the front of the rail, from the head idler to wherever the carriage is pinned.
      drop?.setAttribute("d", runAt(ANCHOR.drop, carriage, TOP_Z));
      // And from the carriage out to the handle.
      lead?.setAttribute("d", runAt(ANCHOR.handle, handle + CLIP_H, carriage));
      const slot = rootRef.current?.closest(".iso-plate")?.querySelector("[data-readout]");
      const text = readoutOf(pin, pull, grip);
      if (slot && slot.textContent !== text) slot.textContent = text;
    },
    [pin, grip],
  );

  useLoop(
    (dt, calm) => {
      clockRef.current += dt;
      const idle = Date.now() - touchedRef.current > BACK_TO_TOUR;
      const wantedPull = !dragRef.current && idle && !calm ? tour(clockRef.current) : targetRef.current;
      const wantedCarriage = holeZ(hole);
      pullRef.current = calm ? wantedPull : follow(pullRef.current, wantedPull, dt, EASE);
      carriageRef.current = calm ? wantedCarriage : follow(carriageRef.current, wantedCarriage, dt, SLIDE);
      paint(pullRef.current, carriageRef.current);
      return !calm || Math.abs(pullRef.current - wantedPull) > 0.01 || Math.abs(carriageRef.current - wantedCarriage) > 0.01;
    },
    inView && !still,
  );

  // Con el bucle parado (reduced motion) nadie acerca el carro a su agujero:
  // hay que colocarlo aquí, o la polea se queda donde estaba.
  React.useEffect(() => {
    if (still) carriageRef.current = holeZ(hole);
    paint(pullRef.current, carriageRef.current);
  }, [paint, hole, still]);

  const pullTo = (value: number) => {
    targetRef.current = clampPull(value);
    touchedRef.current = Date.now();
    if (still) {
      pullRef.current = targetRef.current;
      paint(pullRef.current, carriageRef.current);
    }
  };

  const slideTo = (next: number) => {
    setHole(clampHole(next));
    touchedRef.current = Date.now();
  };

  const swapGrip = () => {
    setGrip((current) => GRIPS[(GRIPS.indexOf(current) + 1) % GRIPS.length]!);
    touchedRef.current = Date.now();
  };

  const rows = Array.from({ length: PLATES }, (_, index) => index);

  return (
    <div
      ref={rootRef}
      className="cs"
      tabIndex={0}
      role="group"
      aria-label="Columna de poleas: arrastra el agarre para hacer la repetición, flechas izquierda y derecha para subir o bajar la polea, espacio para cambiar de agarre"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const target = event.target as Element;
        if (target.closest?.("[data-grip]")) {
          swapGrip();
          return;
        }
        const plate = target.closest?.("[data-plate]");
        if (plate) {
          setPin(clampPin(Number(plate.getAttribute("data-plate"))));
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
        pullTo(drag.at + ((event.clientY - drag.from) * scale) / RISE);
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
        if (event.key === "ArrowDown") pullTo(targetRef.current + by);
        else if (event.key === "ArrowUp") pullTo(targetRef.current - by);
        else if (event.key === "ArrowRight") slideTo(hole + 1);
        else if (event.key === "ArrowLeft") slideTo(hole - 1);
        else if (event.key === " " || event.key === "Enter") swapGrip();
        else if (event.key === "Home") pullTo(0);
        else if (event.key === "End") pullTo(STROKE);
        else return;
        event.preventDefault();
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={props.label}>
        {props.base}
        {props.uprightBack}
        {props.block}
        {props.rods}
        {rows
          .filter((index) => index < pin)
          .map((index) => (
            <g key={index} data-plate={index}>
              {props.platesIdle[index]}
            </g>
          ))}
        <g
          ref={(node) => {
            nodesRef.current.stack = node;
          }}
          transform={lift(0)}
        >
          {props.selectorRods[pin]}
          {rows
            .filter((index) => index >= pin)
            .map((index) => (
              <g key={index} data-plate={index}>
                {props.platesLive[index]}
              </g>
            ))}
          {props.yoke}
          {props.pins[pin]}
        </g>
        {props.head}
        {props.rearPulley}
        {props.uprightFront}
        {props.frontPulley}
        {props.cap}
        <path
          ref={(node) => {
            nodesRef.current.up = node;
          }}
          className="iso-line cs-cable"
          data-tone="hi"
          d={REST_UP}
        />
        <Line d={CABLE_ART.rearWrap} tone="hi" className="cs-cable" />
        <Line d={CABLE_ART.span} tone="hi" className="cs-cable" />
        <Line d={CABLE_ART.frontWrap} tone="hi" className="cs-cable" />
        {props.rail}
        <path
          ref={(node) => {
            nodesRef.current.drop = node;
          }}
          className="iso-line cs-cable"
          data-tone="hi"
          d={REST_DROP}
        />
        <g
          ref={(node) => {
            nodesRef.current.carriage = node;
          }}
          transform={lift(REST_CARRIAGE)}
        >
          {props.carriage}
        </g>
        <path
          ref={(node) => {
            nodesRef.current.lead = node;
          }}
          className="iso-line cs-cable"
          data-tone="hi"
          d={REST_LEAD}
        />
        <g
          ref={(node) => {
            nodesRef.current.handle = node;
          }}
          transform={lift(handleRest(REST_CARRIAGE))}
          data-grip=""
        >
          {props.clip}
          {grip === "cuerda" ? props.rope : props.bar}
        </g>
      </IsoFigure>
    </div>
  );
}

