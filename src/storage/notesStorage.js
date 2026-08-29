/**
 * Adaptador de almacenamiento de notas.
 * Único módulo del sistema que toca chrome.storage (RNF-2).
 * Recibe la storageArea por inyección para poder testearse con un fake.
 */

/** Error de infraestructura del almacenamiento. */
export class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "StorageError";
  }
}

const NOTES_KEY = "notes";

/**
 * @param {Object} storageArea - API promisificada tipo chrome.storage.local:
 *   { get(keys) => Promise<Record<string, any>>, set(items) => Promise<void> }
 * @returns {{
 *   list: () => Promise<Note[]>,
 *   save: (note: Note) => Promise<Note>,
 *   remove: (id: string) => Promise<void>
 * }}
 */
export function createNotesStorage(storageArea) {
  async function readAll() {
    try {
      const data = await storageArea.get(NOTES_KEY);
      return Array.isArray(data[NOTES_KEY]) ? data[NOTES_KEY] : [];
    } catch (err) {
      throw new StorageError(`No se pudo leer el almacenamiento: ${err.message}`);
    }
  }

  async function writeAll(notes) {
    try {
      await storageArea.set({ [NOTES_KEY]: notes });
    } catch (err) {
      throw new StorageError(`No se pudo escribir en el almacenamiento: ${err.message}`);
    }
  }

  return {
    /** Devuelve las notas ordenadas por updatedAt descendente (invariante 2). */
    async list() {
      const notes = await readAll();
      return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    /**
     * Crea o actualiza una nota.
     * Al actualizar conserva el createdAt original (invariante 4) y no duplica (Req 2.4).
     */
    async save(note) {
      const notes = await readAll();
      const index = notes.findIndex((n) => n.id === note.id);
      if (index === -1) {
        notes.push(note);
      } else {
        notes[index] = { ...note, createdAt: notes[index].createdAt };
      }
      await writeAll(notes);
      return note;
    },

    /** Elimina la nota por id de forma permanente (Req 3.2). Idempotente. */
    async remove(id) {
      const notes = await readAll();
      await writeAll(notes.filter((n) => n.id !== id));
    },
  };
}
