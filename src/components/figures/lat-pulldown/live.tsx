"use client";

import * as React from "react";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import { PIN_REST, clampPin, clampPull, readoutOf } from "./machine";
import { ANCHOR, EZ, HEIGHT, PLATES, RISE, STROKE, WIDTH, lift } from "./view";

const EASE = 0.1;
const NUDGE = 9;
const BACK_TO_TOUR = 4200;
const LOOP = 6.2;

const round = (value: number) => Math.round(value * 10) / 10;
const line = (ax: number, ay: number, bx: number, by: number) =>
  `M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}`;

const REST_UP = line(ANCHOR.eye[0], ANCHOR.eye[1], ANCHOR.upTop[0], ANCHOR.upTop[1]);
const REST_DOWN = line(ANCHOR.downTop[0], ANCHOR.downTop[1], ANCHOR.barTop[0], ANCHOR.barTop[1]);

const ease = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** One calm rep, so the figure shows what it does before anybody touches it. */
function tour(time: number) {
  const at = time % LOOP;
  if (at < 1) return 0;
  if (at < 2.4) return STROKE * ease((at - 1) / 1.4);
  if (at < 3) return STROKE;
  if (at < 4.6) return STROKE * (1 - ease((at - 3) / 1.6));
  return 0;
}

interface Nodes {
  stack: SVGGElement | null;
  bar: SVGGElement | null;
  up: SVGPathElement | null;
  down: SVGPathElement | null;
}

export interface LatPulldownLiveProps {
  label: string;
  base: React.ReactNode;
  uprightBack: React.ReactNode;
  uprightFront: React.ReactNode;
  block: React.ReactNode;
  rods: React.ReactNode;
  head: React.ReactNode;
  rearPulley: React.ReactNode;
  frontPulley: React.ReactNode;
  boom: React.ReactNode;
  wraps: React.ReactNode;
  seat: React.ReactNode;
  thigh: React.ReactNode;
  bar: React.ReactNode;
  platesIdle: React.ReactNode[];
  platesLive: React.ReactNode[];
  yoke: React.ReactNode;
  selectorRods: React.ReactNode[];
  pins: React.ReactNode[];
}

export function LatPulldownLive(props: LatPulldownLiveProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const nodesRef = React.useRef<Nodes>({ stack: null, bar: null, up: null, down: null });
  const shownRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const clockRef = React.useRef(0);
  const touchedRef = React.useRef(0);
  const dragRef = React.useRef<{ id: number; from: number; at: number } | null>(null);

  const inView = useInView(rootRef);
  const still = useStillness();
  const [pin, setPin] = React.useState(PIN_REST);

  const paint = React.useCallback(
    (pull: number) => {
      const { stack, bar, up, down } = nodesRef.current;
      stack?.setAttribute("transform", lift(pull));
      bar?.setAttribute("transform", lift(-pull));
      up?.setAttribute(
        "d",
        line(ANCHOR.eye[0] + EZ[0] * pull, ANCHOR.eye[1] + EZ[1] * pull, ANCHOR.upTop[0], ANCHOR.upTop[1]),
      );
      down?.setAttribute(
        "d",
        line(ANCHOR.downTop[0], ANCHOR.downTop[1], ANCHOR.barTop[0] - EZ[0] * pull, ANCHOR.barTop[1] - EZ[1] * pull),
      );
      const slot = rootRef.current?.closest(".iso-plate")?.querySelector("[data-readout]");
      const text = readoutOf(pin, pull);
      if (slot && slot.textContent !== text) slot.textContent = text;
    },
    [pin],
  );

  useLoop(
    (dt, calm) => {
      clockRef.current += dt;
      const idle = Date.now() - touchedRef.current > BACK_TO_TOUR;
      const wanted = !dragRef.current && idle && !calm ? tour(clockRef.current) : targetRef.current;
      shownRef.current = calm ? wanted : follow(shownRef.current, wanted, dt, EASE);
      paint(shownRef.current);
      return !calm || Math.abs(shownRef.current - wanted) > 0.01;
    },
    inView && !still,
  );

  // The weight in the readout comes from the pin, so redraw when it moves.
  React.useEffect(() => {
    paint(shownRef.current);
  }, [paint]);

  const pullTo = (value: number) => {
    targetRef.current = clampPull(value);
    touchedRef.current = Date.now();
    if (still) {
      shownRef.current = targetRef.current;
      paint(shownRef.current);
    }
  };

  const movePin = (next: number) => {
    setPin(clampPin(next));
    touchedRef.current = Date.now();
  };

  const rows = Array.from({ length: PLATES }, (_, index) => index);

  return (
    <div
      ref={rootRef}
      className="lp"
      tabIndex={0}
      role="group"
      aria-label="Jalón con barra: arrastra la barra para hacer la repetición, flechas izquierda y derecha para cambiar el peso"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const plate = (event.target as Element).closest?.("[data-plate]");
        if (plate) {
          movePin(Number(plate.getAttribute("data-plate")));
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
        else if (event.key === "ArrowRight") movePin(pin - 1);
        else if (event.key === "ArrowLeft") movePin(pin + 1);
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
        {props.boom}
        <path
          ref={(node) => {
            nodesRef.current.up = node;
          }}
          className="iso-line lp-cable"
          data-tone="hi"
          d={REST_UP}
        />
        {props.wraps}
        {props.frontPulley}
        <path
          ref={(node) => {
            nodesRef.current.down = node;
          }}
          className="iso-line lp-cable"
          data-tone="hi"
          d={REST_DOWN}
        />
        {props.seat}
        {props.thigh}
        <g
          ref={(node) => {
            nodesRef.current.bar = node;
          }}
          transform={lift(0)}
        >
          {props.bar}
        </g>
      </IsoFigure>
    </div>
  );
}
