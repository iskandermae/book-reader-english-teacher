/** Ctrl+arrows / Shift+Space / Shift+arrows edit text in these, so the player and recorder hotkeys must leave them alone. */
export function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
