import { useEffect, useRef } from 'react';

/**
 * Converts a KeyboardEvent into a canonical shortcut string such as
 * "ctrl+shift+e", "space", "a", "ctrl+arrowup", etc.
 *
 * Rules:
 *  - Ctrl and Meta (Cmd on macOS) are both normalised to "ctrl".
 *  - Space is mapped to "space" instead of " " for readability.
 *  - All other keys are lowercased.
 *  - Modifiers appear in order: ctrl → shift → alt → key.
 */
function buildShortcutKey(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key === ' ' ? 'space' : e.key.toLowerCase());
  return parts.join('+');
}

/**
 * useKeyboardShortcuts(handlers)
 *
 * Registers a single global keydown listener that dispatches to the matching
 * handler in the `handlers` map.  Keys in the map are shortcut strings as
 * returned by buildShortcutKey (e.g. "ctrl+shift+e", "space", "a").
 *
 * The listener is registered once (on mount) and reads handlers through a ref
 * so there is no need to re-register when handlers change between renders.
 *
 * Shortcuts are suppressed when the focused element is an input, textarea, or
 * select — except for Escape, which always fires.
 */
export function useKeyboardShortcuts(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function listener(e) {
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isInput && e.key !== 'Escape') return;

      const key = buildShortcutKey(e);
      const handler = handlersRef.current[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []); // register once; latest handlers always available via ref
}
