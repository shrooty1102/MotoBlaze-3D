// Unified input: keyboard, on-screen touch buttons and gamepad.

const keys = new Set();
const touch = { left: false, right: false, gas: false, brake: false, nitro: false };

// ?touch=1 forces touch controls (handy for testing on desktop)
export const isTouchDevice = () => new URLSearchParams(location.search).has('touch') || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && document.activeElement?.tagName !== 'INPUT') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); for (const k in touch) touch[k] = false; });

// Bind a DOM element as a hold-button for a touch control
export function bindHold(el, name) {
  const on = (e) => { e.preventDefault(); touch[name] = true; el.classList.add('active'); };
  const off = (e) => { e.preventDefault(); touch[name] = false; el.classList.remove('active'); };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); on(e); });
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function resetTouch() { for (const k in touch) touch[k] = false; }

export function readInput() {
  let steer = 0, throttle = 0, brake = 0, nitro = false;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) steer += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) throttle = 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) brake = 1;
  if (keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyN')) nitro = true;

  if (touch.left) steer -= 1;
  if (touch.right) steer += 1;
  if (touch.gas) throttle = 1;
  if (touch.brake) brake = 1;
  if (touch.nitro) nitro = true;

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.15) steer += ax;
    if (gp.buttons[7]?.value > 0.1) throttle = Math.max(throttle, gp.buttons[7].value);
    if (gp.buttons[0]?.pressed) throttle = 1;
    if (gp.buttons[6]?.value > 0.1) brake = Math.max(brake, gp.buttons[6].value);
    if (gp.buttons[1]?.pressed || gp.buttons[2]?.pressed) nitro = true;
  }
  return { steer: Math.max(-1, Math.min(1, steer)), throttle, brake, nitro };
}
