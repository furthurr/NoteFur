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

/**
 * Comprueba que un objeto tiene la forma mínima de una Note importada.
 * `order` es opcional.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidImportedNote(raw) {
  return (
    raw != null &&
    typeof raw === "object" &&
    typeof raw.id === "string" &&
    raw.id.length > 0 &&
    typeof raw.title === "string" &&
    typeof raw.body === "string" &&
    typeof raw.createdAt === "number" &&
    Number.isFinite(raw.createdAt) &&
    typeof raw.updatedAt === "number" &&
    Number.isFinite(raw.updatedAt)
  );
}

/**
 * Parsea el contenido de un archivo de backup (JSON) y devuelve las notas válidas.
 * Las notas con forma inválida se descartan silenciosamente; si la estructura
 * raíz no es la esperada, lanza ValidationError.
 * @param {string} jsonText
 * @returns {{ version: number, exportedAt: string|null, notes: Note[] }}
 * @throws {ValidationError}
 */
export function parseBackup(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new ValidationError(`Archivo no es JSON válido: ${err.message}`);
  }
  if (data == null || typeof data !== "object" || !Array.isArray(data.notes)) {
    throw new ValidationError(
      "Estructura del archivo inválida: se esperaba un objeto con array 'notes'.",
    );
  }
  const notes = data.notes.filter(isValidImportedNote);
  return {
    version: typeof data.version === "number" ? data.version : 0,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null,
    notes,
  };
}

/** Construye el texto JSON de un backup a partir de la lista de notas. */
export function serializeBackup(notes, { version = 1 } = {}) {
  return JSON.stringify(
    {
      version,
      exportedAt: new Date().toISOString(),
      notes,
    },
    null,
    2,
  );
}
