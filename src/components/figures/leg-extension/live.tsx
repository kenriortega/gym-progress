"use client";

import * as React from "react";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import { frameOf, type Frame } from "./frame";
import { ANGLE_HIGH, ANGLE_LOW, PIN_REST, clampAngle, clampPin, readoutOf } from "./machine";
import { DROP_ANCHOR, DROP_TOP, EYE_TOP, EZ, HEIGHT, PLATES, WIDTH, lift } from "./view";

const EASE = 0.12;
const NUDGE = 9;
const BACK_TO_TOUR = 4600;
const LOOP = 7.2;
const DRAG = 0.55;

const REST: Frame = frameOf(ANGLE_LOW);

const round = (value: number) => Math.round(value * 10) / 10;

/** The cable from the idler down to the carrier, which shortens as it rises. */
const dropPath = (rise: number) => {
  const top = EYE_TOP + rise;
  return `M${round(DROP_ANCHOR[0] + EZ[0] * DROP_TOP)} ${round(DROP_ANCHOR[1] + EZ[1] * DROP_TOP)}L${round(
    DROP_ANCHOR[0] + EZ[0] * top,
  )} ${round(DROP_ANCHOR[1] + EZ[1] * top)}`;
};

const ease = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

function tour(time: number) {
  const span = ANGLE_HIGH - ANGLE_LOW;
  const at = time % LOOP;
  if (at < 1.2) return ANGLE_LOW;
  if (at < 2.6) return ANGLE_LOW + span * ease((at - 1.2) / 1.4);
  if (at < 3.3) return ANGLE_HIGH;
  if (at < 5) return ANGLE_LOW + span * (1 - ease((at - 3.3) / 1.7));
  return ANGLE_LOW;
}

interface Nodes {
  stack: SVGGElement | null;
  camFill: SVGPathElement | null;
  camShades: (SVGPathElement | null)[];
  camTop: SVGPathElement | null;
  camEdge: SVGPathElement | null;
  camRim: SVGPathElement | null;
  arms: (SVGGElement | null)[];
  armFill: (SVGPathElement | null)[];
  cable: SVGPathElement | null;
  roller: SVGGElement | null;
}

export interface LegExtensionLiveProps {
  label: string;
  base: React.ReactNode;
  uprightBack: React.ReactNode;
  uprightFront: React.ReactNode;
  block: React.ReactNode;
  rods: React.ReactNode;
  head: React.ReactNode;
  idler: React.ReactNode;
  wrap: React.ReactNode;
  pivot: React.ReactNode;
  seat: React.ReactNode;
  platesIdle: React.ReactNode[];
  platesLive: React.ReactNode[];
  yoke: React.ReactNode;
  selectorRods: React.ReactNode[];
  pins: React.ReactNode[];
}

/** A solid whose every path is rewritten each frame. */
function Live({
  frame,
  bind,
  tone,
  lit,
}: {
  frame: "cam" | "roller";
  bind: (part: string) => (node: SVGPathElement | null) => void;
  tone: string;
  lit?: boolean;
}) {
  const paths = frame === "cam" ? REST.cam : REST.roller;
  return (
    <g className="iso-solid" data-lit={lit ? "" : undefined}>
      <path ref={bind("fill")} className="iso-fill" d={paths.fill} />
      {[0, 1, 2, 3].map((index) => (
        <path key={index} ref={bind(`shade${index}`)} className="iso-shade" data-shade={index} d={paths.shades[index] ?? ""} />
      ))}
      <path ref={bind("top")} className="iso-top" d={paths.top} />
      <path ref={bind("crease")} className="iso-line" data-tone="faint" d={paths.crease} />
      <path ref={bind("edge")} className="iso-line iso-edge" data-tone={tone} d={paths.outline} />
    </g>
  );
}

export function LegExtensionLive(props: LegExtensionLiveProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const parts = React.useRef<Record<string, SVGPathElement | null>>({});
  const nodesRef = React.useRef<Nodes>({
    stack: null,
    camFill: null,
    camShades: [],
    camTop: null,
    camEdge: null,
    camRim: null,
    arms: [],
    armFill: [],
    cable: null,
    roller: null,
  });
  const shownRef = React.useRef(ANGLE_LOW);
  const targetRef = React.useRef(ANGLE_LOW);
  const clockRef = React.useRef(0);
  const touchedRef = React.useRef(0);
  const dragRef = React.useRef<{ id: number; from: number; at: number } | null>(null);

  const inView = useInView(rootRef);
  const still = useStillness();
  const [pin, setPin] = React.useState(PIN_REST);

  const bindOf = React.useCallback(
    (prefix: string) => (part: string) => (node: SVGPathElement | null) => {
      parts.current[`${prefix}.${part}`] = node;
    },
    [],
  );

  const write = React.useCallback(
    (prefix: string, paths: { fill: string; shades: string[]; top: string; crease: string; outline: string }) => {
      parts.current[`${prefix}.fill`]?.setAttribute("d", paths.fill);
      for (let index = 0; index < 4; index++) {
        parts.current[`${prefix}.shade${index}`]?.setAttribute("d", paths.shades[index] ?? "");
      }
      parts.current[`${prefix}.top`]?.setAttribute("d", paths.top);
      parts.current[`${prefix}.crease`]?.setAttribute("d", paths.crease);
      parts.current[`${prefix}.edge`]?.setAttribute("d", paths.outline);
    },
    [],
  );

  const paint = React.useCallback(
    (deg: number) => {
      const frame = frameOf(deg);
      write("cam", frame.cam);
      write("roller", frame.roller);
      frame.arms.forEach((paths, index) => write(`arm${index}`, paths));
      parts.current["cam.rim"]?.setAttribute("d", frame.camRim);
      parts.current["roller.rings"]?.setAttribute("d", frame.rollerRings);
      parts.current["cable"]?.setAttribute("d", frame.cable);
      parts.current["drop"]?.setAttribute("d", dropPath(frame.rise));
      nodesRef.current.stack?.setAttribute("transform", lift(frame.rise));
      const slot = rootRef.current?.closest(".iso-plate")?.querySelector("[data-readout]");
      const text = readoutOf(pin, deg);
      if (slot && slot.textContent !== text) slot.textContent = text;
    },
    [pin, write],
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

  React.useEffect(() => {
    paint(shownRef.current);
  }, [paint]);

  const turnTo = (value: number) => {
    targetRef.current = clampAngle(value);
    touchedRef.current = Date.now();
    if (still) {
      shownRef.current = targetRef.current;
      paint(shownRef.current);
    }
  };

  const rows = Array.from({ length: PLATES }, (_, index) => index);

  return (
    <div
      ref={rootRef}
      className="le"
      tabIndex={0}
      role="group"
      aria-label="Extensión de cuádriceps: arrastra el rodillo para estirar la pierna, flechas izquierda y derecha para cambiar el peso"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const plate = (event.target as Element).closest?.("[data-plate]");
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
        turnTo(drag.at - (event.clientY - drag.from) * scale * DRAG);
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
        if (event.key === "ArrowUp") turnTo(targetRef.current + by);
        else if (event.key === "ArrowDown") turnTo(targetRef.current - by);
        else if (event.key === "ArrowRight") setPin(clampPin(pin - 1));
        else if (event.key === "ArrowLeft") setPin(clampPin(pin + 1));
        else if (event.key === "Home") turnTo(ANGLE_LOW);
        else if (event.key === "End") turnTo(ANGLE_HIGH);
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
        {props.idler}
        {props.wrap}
        {props.uprightFront}
        <path
          ref={(node) => {
            parts.current["drop"] = node;
          }}
          className="iso-line le-cable"
          data-tone="hi"
          d={dropPath(REST.rise)}
        />
        <path
          ref={(node) => {
            parts.current["cable"] = node;
          }}
          className="iso-line le-cable"
          data-tone="hi"
          d={REST.cable}
        />
        {props.pivot}
        <g>
          <Live frame="cam" bind={bindOf("cam")} tone="hi" />
          <path
            ref={(node) => {
              parts.current["cam.rim"] = node;
            }}
            className="iso-line"
            data-tone="lit"
            d={REST.camRim}
          />
        </g>
        {props.seat}
        {REST.arms.map((paths, index) => (
          <g className="iso-solid" key={index}>
            <path ref={bindOf(`arm${index}`)("fill")} className="iso-fill" d={paths.fill} />
            {[0, 1, 2, 3].map((shade) => (
              <path
                key={shade}
                ref={bindOf(`arm${index}`)(`shade${shade}`)}
                className="iso-shade"
                data-shade={shade}
                d={paths.shades[shade] ?? ""}
              />
            ))}
            <path ref={bindOf(`arm${index}`)("top")} className="iso-top" d={paths.top} />
            <path ref={bindOf(`arm${index}`)("crease")} className="iso-line" data-tone="faint" d={paths.crease} />
            <path ref={bindOf(`arm${index}`)("edge")} className="iso-line iso-edge" data-tone="mid" d={paths.outline} />
          </g>
        ))}
        <g>
          <Live frame="roller" bind={bindOf("roller")} tone="hi" />
          <path
            ref={(node) => {
              parts.current["roller.rings"] = node;
            }}
            className="iso-line"
            data-tone="faint"
            d={REST.rollerRings}
          />
        </g>
      </IsoFigure>
    </div>
  );
}

