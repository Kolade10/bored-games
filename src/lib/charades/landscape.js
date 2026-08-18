// Getting the phone into landscape and keeping it there.
//
// The orientation API only allows a lock while the page is fullscreen, and iOS
// Safari does not implement the lock at all. So there are two layers: ask for a
// real lock where it exists, and where it does not, rotate the game screen with
// CSS so it still reads as landscape on an upright phone.

export async function enterLandscape() {
  const el = typeof document !== 'undefined' ? document.documentElement : null;
  if (!el) return false;

  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  } catch {
    // Fullscreen refused; the CSS fallback still applies.
  }

  try {
    await screen.orientation?.lock?.('landscape');
    return true;
  } catch {
    return false;
  }
}

export async function exitLandscape() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Nothing to unlock.
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
  } catch {
    // Already out of fullscreen.
  }
}

/**
 * Wraps the game screen so it fills the display sideways when the device is
 * upright and the orientation lock was unavailable.
 *
 * Rotating about the top-left corner and shifting a full viewport width to the
 * right puts the rotated box exactly over the screen. Inside it, `vw` and `vh`
 * still describe the real (portrait) viewport, so anything sized in there must
 * use `vmin` or percentages - `vmin` is the same number whichever way up the
 * phone is.
 */
export const rotatedStageStyle = {
  position: 'fixed',
  top: 0,
  left: '100%',
  width: '100vh',
  height: '100vw',
  transformOrigin: '0 0',
  transform: 'rotate(90deg)'
};
