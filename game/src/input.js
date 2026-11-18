// Keyboard and pointer input. Held keys steer and drive; one-shot presses (start,
// pause, enter/exit car, punch, interact) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_INTERACT = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const INTERACT = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseClicked = false;

  function press(code, repeat) {
    if (repeat) return;
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER_CAR.has(code)) actions |= ACTION_ENTER_CAR;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH;
    else if (INTERACT.has(code)) actions |= ACTION_INTERACT;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code) || PAUSE.has(event.code) || ENTER_CAR.has(event.code)
      || PUNCH.has(event.code) || INTERACT.has(event.code)) {
      press(event.code, event.repeat);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Steering / movement axes, each -1, 0 or 1. */
    moveX() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    moveY() {
      return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
    },
    up() { return has(UP); },
    down() { return has(DOWN); },
    left() { return has(LEFT); },
    right() { return has(RIGHT); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Mouse position in canvas pixels, for aiming the pistol. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** True once when the mouse was clicked since the last call. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
  };
}
