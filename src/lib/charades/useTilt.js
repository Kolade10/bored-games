'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// How far the phone has to move from its resting angle before it counts, and
// how far back it has to come before another gesture is accepted. The gap
// between the two is what stops one tilt firing twice.
const TRIGGER_DEGREES = 42;
const RESET_DEGREES = 20;
const LOCKOUT_MS = 700;

export const TILT_SUPPORTED =
  typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

// iOS 13+ will not send readings until the user grants permission, and the
// request has to come from a tap.
export const TILT_NEEDS_PERMISSION =
  TILT_SUPPORTED && typeof DeviceOrientationEvent.requestPermission === 'function';

export async function requestTiltPermission() {
  if (!TILT_NEEDS_PERMISSION) return TILT_SUPPORTED;
  try {
    return (await DeviceOrientationEvent.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Turns the phone into the controller: tilt down for correct, up for pass.
 *
 * The angle that matters depends on how the phone is being held, so the reading
 * is taken from beta or gamma according to the screen orientation, and the
 * resting position is captured when the turn starts rather than assumed to be
 * flat - people hold a phone at whatever angle is comfortable.
 *
 * @param {object} options
 * @param {boolean} options.active only listen during a live turn
 * @param {boolean} options.inverted flips the two gestures
 * @param {() => void} options.onDown
 * @param {() => void} options.onUp
 */
export function useTilt({ active, inverted = false, onDown, onUp }) {
  const [reading, setReading] = useState(null);
  const neutralRef = useRef(null);
  const armedRef = useRef(true);
  const lockedUntilRef = useRef(0);
  const handlers = useRef({ onDown, onUp });
  handlers.current = { onDown, onUp };

  const recalibrate = useCallback(() => {
    neutralRef.current = null;
    armedRef.current = true;
  }, []);

  useEffect(() => {
    if (!active || !TILT_SUPPORTED) return;

    const onOrientation = (event) => {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      const angle = (typeof screen !== 'undefined' && screen.orientation?.angle) ?? 0;
      // In landscape the up/down movement shows up on gamma, and its sign
      // depends on which way the phone was turned.
      let value;
      if (angle === 90) value = -gamma;
      else if (angle === 270 || angle === -90) value = gamma;
      else value = beta;

      if (neutralRef.current === null) neutralRef.current = value;
      const delta = value - neutralRef.current;
      setReading(delta);

      const now = Date.now();
      if (now < lockedUntilRef.current) return;

      if (!armedRef.current) {
        // Wait for the phone to come back near where it started.
        if (Math.abs(delta) < RESET_DEGREES) armedRef.current = true;
        return;
      }

      if (Math.abs(delta) < TRIGGER_DEGREES) return;

      const isDown = inverted ? delta > 0 : delta < 0;
      armedRef.current = false;
      lockedUntilRef.current = now + LOCKOUT_MS;
      // Re-baseline so a turn held at a new angle keeps working.
      neutralRef.current = value - (isDown ? -RESET_DEGREES : RESET_DEGREES) * 0.5;

      if (isDown) handlers.current.onDown?.();
      else handlers.current.onUp?.();
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [active, inverted]);

  useEffect(() => {
    if (!active) recalibrate();
  }, [active, recalibrate]);

  return { reading, recalibrate };
}
