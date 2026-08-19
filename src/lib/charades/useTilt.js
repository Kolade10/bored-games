'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Reading a tilt from a phone is not something to guess at from first
// principles: which axis moves, and in which direction, depends on how the
// person is holding it, which way they turned it into landscape, and where
// their resting angle sits. Assuming a single axis got one gesture working and
// left the other almost impossible to trigger.
//
// So this does not assume anything. The actor performs the "correct" gesture
// once, and the difference between resting and tilted gravity becomes the
// direction that means correct. Everything after that is a projection of the
// live reading onto that learned direction: positive is the gesture they
// taught it, negative is the opposite one. Whatever axis it really lives on,
// and whichever way round, it works out the same.

const TRIGGER = 4.2;        // m/s² along the learned direction, about 25 degrees
const REARM = 1.8;
const DRIFT = 0.02;
const LOCKOUT_MS = 600;
const SMOOTHING = 0.35;

// Used until the actor calibrates: screen tipping towards the floor.
export const DEFAULT_DOWN_AXIS = { x: 0, y: 0, z: -1 };

export const TILT_SUPPORTED =
  typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

export const TILT_NEEDS_PERMISSION =
  TILT_SUPPORTED && typeof DeviceMotionEvent.requestPermission === 'function';

export async function requestTiltPermission() {
  if (!TILT_NEEDS_PERMISSION) return TILT_SUPPORTED;
  try {
    return (await DeviceMotionEvent.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v) => Math.sqrt(dot(v, v)) || 1;

/** Turns a raw difference between two holds into a usable direction. */
export function normaliseAxis(vector) {
  const len = length(vector);
  return { x: vector.x / len, y: vector.y / len, z: vector.z / len };
}

/**
 * Phone as controller, using a direction the actor taught it.
 *
 * @param {object} options
 * @param {boolean} options.active
 * @param {{x:number,y:number,z:number}} [options.downAxis] learned "correct" direction
 * @param {() => void} options.onDown
 * @param {() => void} options.onUp
 */
export function useTilt({ active, downAxis, onDown, onUp }) {
  const [reading, setReading] = useState(0);
  const [live, setLive] = useState(false);
  const [gravity, setGravity] = useState(null);

  const smoothRef = useRef(null);
  const restRef = useRef(null);
  const armedRef = useRef(true);
  const lockedUntilRef = useRef(0);
  const handlers = useRef({ onDown, onUp });
  handlers.current = { onDown, onUp };

  const axis = downAxis || DEFAULT_DOWN_AXIS;
  const axisRef = useRef(axis);
  axisRef.current = axis;

  const recalibrate = useCallback(() => {
    restRef.current = null;
    smoothRef.current = null;
    armedRef.current = true;
    setReading(0);
  }, []);

  useEffect(() => {
    if (!active || !TILT_SUPPORTED) return;

    const onMotion = (event) => {
      const g = event.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null || g.z === null) return;

      setLive(true);

      const raw = { x: g.x, y: g.y, z: g.z };
      smoothRef.current = smoothRef.current === null
        ? raw
        : {
            x: smoothRef.current.x + (raw.x - smoothRef.current.x) * SMOOTHING,
            y: smoothRef.current.y + (raw.y - smoothRef.current.y) * SMOOTHING,
            z: smoothRef.current.z + (raw.z - smoothRef.current.z) * SMOOTHING
          };
      const value = smoothRef.current;
      setGravity(value);

      // However they are holding it right now is the resting position.
      if (restRef.current === null) restRef.current = { ...value };

      // Positive means they moved it the way they said meant "correct".
      const delta = dot(sub(value, restRef.current), axisRef.current);
      setReading(delta);

      // Let the resting point follow their posture, but only while at rest, so
      // the gesture itself never drags the baseline along with it.
      if (Math.abs(delta) < REARM) {
        const rest = restRef.current;
        restRef.current = {
          x: rest.x + (value.x - rest.x) * DRIFT,
          y: rest.y + (value.y - rest.y) * DRIFT,
          z: rest.z + (value.z - rest.z) * DRIFT
        };
      }

      const now = Date.now();
      if (now < lockedUntilRef.current) return;

      if (!armedRef.current) {
        if (Math.abs(delta) < REARM) armedRef.current = true;
        return;
      }
      if (Math.abs(delta) < TRIGGER) return;

      armedRef.current = false;
      lockedUntilRef.current = now + LOCKOUT_MS;

      if (delta > 0) handlers.current.onDown?.();
      else handlers.current.onUp?.();
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [active]);

  useEffect(() => {
    if (!active) {
      recalibrate();
      setLive(false);
      setGravity(null);
    }
  }, [active, recalibrate]);

  return { reading, live, gravity, recalibrate, trigger: TRIGGER };
}
