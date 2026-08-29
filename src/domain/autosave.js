/**
 * Debouncer para el guardado automático (autosave).
 * Lógica pura y testable con fake timers.
 */

/**
 * @param {Function} fn - callback a ejecutar cuando se confirma el guardado.
 * @param {number} delayMs - retardo de inactividad (p. ej. 400 ms).
 * @returns {{
 *   schedule: () => void,
 *   flush: () => void,
 *   cancel: () => void
 * }}
 */
export function createDebouncer(fn, delayMs) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;

  return {
    /** Programa (o reprograma) el guardado tras `delayMs` de pausa. */
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delayMs);
    },

    /** Ejecuta el guardado pendiente inmediatamente, una sola vez. */
    flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        fn();
      }
    },

    /** Cancela el guardado pendiente sin ejecutarlo. */
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
