/**
 * Modelo de nota de la extensión.
 * @typedef {Object} Note
 * @property {string} id - Identificador único.
 * @property {string} title - Título de la nota (puede ser vacío).
 * @property {string} body - Cuerpo de la nota (puede ser vacío).
 * @property {number} createdAt - Timestamp epoch ms (inmutable tras creación).
 * @property {number} updatedAt - Timestamp epoch ms (se refresca en cada guardado).
 */

/** Error de validación de una nota (datos inválidos de entrada). */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Genera un id único con fallback para entornos sin crypto.randomUUID. */
function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Crea una nueva nota a partir de título y cuerpo.
 * @param {{title?: string, body?: string}} [input]
 * @returns {Note}
 */
export function createNote({ title = "", body = "" } = {}) {
  const now = Date.now();
  return {
    id: generateId(),
    title: title.trim(),
    body: body.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Valida que una nota no esté completamente vacía (sin título ni cuerpo).
 * @param {Note} note
 * @throws {ValidationError} si título y cuerpo están vacíos.
 */
export function validateNote(note) {
  if (note.title.trim() === "" && note.body.trim() === "") {
    throw new ValidationError("La nota está vacía: escribe un título o un cuerpo.");
  }
}

/**
 * Deriva el título mostrado en la lista:
 * - Título no vacío -> el título.
 * - Sin título, cuerpo con 3+ palabras -> primeras 3 palabras + "…".
 * - Sin título, cuerpo con < 3 palabras -> cuerpo completo.
 * - Sin título ni cuerpo -> "(Sin título)".
 * Nunca devuelve cadena vacía.
 * @param {Note} note
 * @returns {string}
 */
export function deriveDisplayTitle(note) {
  const title = note.title.trim();
  if (title !== "") return title;

  const words = note.body.trim().split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) return "(Sin título)";
  if (words.length <= 3) return words.join(" ");
  return `${words.slice(0, 3).join(" ")}…`;
}
