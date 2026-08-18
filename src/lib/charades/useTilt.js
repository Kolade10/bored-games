'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Gravity along the axis pointing out of the screen, in m/s².
//
// Holding the phone up with the screen facing the guessers, that axis is
// horizontal and reads about 0. Tip the screen towards the floor and it goes to
// about -9.8; tip it towards the ceiling and it goes to +9.8. So one number
// describes the whole gesture, and it does not care whether the phone was
// turned to the left or the right to get into landscape.
//
// This replaced a beta/gamma reading, which needed different maths per screen
// orientation and went unstable exactly where this game holds the phone -
// upright, where those two angles start to fight each other.
const TRIGGER = 5.6;   // roughly 35 degrees off the resting angle
const RESET = 2.6;     // must come back to about 15 degrees before firing again
const LOCKOUT_MS = 650;
const SMOOTHING = 0.35;

const hasMotion = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

export const TILT_SUPPORTED = hasMotion();

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

/**
 * Phone as controller: tip the screen down for correct, up to pass.
 *
 * @param {object} options
 * @param {boolean} options.active only listen during a live turn
 * @param {boolean} options.inverted swap the two gestures
 * @param {() => void} options.onDown
 * @param {() => void} options.onUp
 */
export function useTilt({ active, inverted = false, onDown, onUp }) {
  const [reading, setReading] = useState(0);
  const [live, setLive] = useState(false);

  const neutralRef = useRef(null);
  const smoothRef = useRef(null);
  const armedRef = useRef(true);
  const lockedUntilRef = useRef(0);
  const handlers = useRef({ onDown, onUp });
  handlers.current = { onDown, onUp };

  const recalibrate = useCallback(() => {
    neutralRef.current = null;
    smoothRef.current = null;
    armedRef.current = true;
  }, []);

  useEffect(() => {
    if (!active || !TILT_SUPPORTED) return;

    const onMotion = (event) => {
      const g = event.accelerationIncludingGravity;
      if (!g || g.z === null || g.z === undefined) return;

      setLive(true);

      // Light smoothing so a shake of the hand cannot trip a gesture.
      smoothRef.current = smoothRef.current === null
        ? g.z
        : smoothRef.current + (g.z - smoothRef.current) * SMOOTHING;
      const value = smoothRef.current;

      // Whatever angle the actor is holding it at when the turn starts is
      // treated as the resting position.
      if (neutralRef.current === null) neutralRef.current = value;
      const delta = value - neutralRef.current;
      setReading(delta);

      const now = Date.now();
      if (now < lockedUntilRef.current) return;

      if (!armedRef.current) {
        if (Math.abs(delta) < RESET) armedRef.current = true;
        return;
      }
      if (Math.abs(delta) < TRIGGER) return;

      // Screen tipped towards the floor is the "correct" gesture.
      const isDown = inverted ? delta > 0 : delta < 0;
      armedRef.current = false;
      lockedUntilRef.current = now + LOCKOUT_MS;

      if (isDown) handlers.current.onDown?.();
      else handlers.current.onUp?.();
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [active, inverted]);

  useEffect(() => {
    if (!active) {
      recalibrate();
      setLive(false);
    }
  }, [active, recalibrate]);

  return { reading, recalibrate, live };
}
