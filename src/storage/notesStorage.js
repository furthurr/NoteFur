/**
 * Adaptador de almacenamiento de notas.
 * Único módulo del sistema que toca chrome.storage (RNF-2).
 * Recibe la storageArea por inyección para poder testearse con un fake.
 *
 * Modelo:
 * - Cada nota puede llevar un campo numérico `order` (índice en la lista).
 * - Si alguna nota tiene `order`, `list()` ordena por él; las que no lo
 *   tengan se empujan al final (manteniendo entre sí el orden por updatedAt).
 * - Si ninguna nota tiene `order`, `list()` ordena por updatedAt desc
 *   (comportamiento histórico, preservado para instalaciones existentes).
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
    /** Devuelve las notas ordenadas por `order` (si alguna lo tiene) o por updatedAt desc. */
    async list() {
      const notes = await readAll();
      const hasAnyOrder = notes.some((n) => typeof n.order === "number");
      return [...notes].sort((a, b) => {
        if (hasAnyOrder) {
          const ao = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
          const bo = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
          return ao - bo;
        }
        return b.updatedAt - a.updatedAt;
      });
    },

    /**
     * Crea o actualiza una nota.
     * Al actualizar conserva el createdAt original (invariante 4) y no duplica (Req 2.4).
     * Al crear, asigna `order` al final si ya hay notas ordenadas (mantiene la cola coherente).
     */
    async save(note) {
      const notes = await readAll();
      const index = notes.findIndex((n) => n.id === note.id);
      if (index === -1) {
        const lastOrder = notes.reduce(
          (acc, n) => (typeof n.order === "number" && n.order > acc ? n.order : acc),
          -1,
        );
        notes.push({ ...note, order: lastOrder + 1 });
      } else {
        notes[index] = {
          ...note,
          createdAt: notes[index].createdAt,
          order: notes[index].order,
        };
      }
      await writeAll(notes);
      return note;
    },

    /** Elimina la nota por id de forma permanente (Req 3.2). Idempotente. */
    async remove(id) {
      const notes = await readAll();
      await writeAll(notes.filter((n) => n.id !== id));
    },

    /**
     * Reordena las notas según el array de ids proporcionado y persiste el nuevo orden.
     * A las notas listadas se les asigna `order` secuencial (0, 1, 2...).
     * Las notas existentes que no aparezcan en `orderedIds` se añaden al final
     * (defensa frente a estados inconsistentes).
     * Lanza StorageError si algún id no existe.
     */
    async reorder(orderedIds) {
      if (!Array.isArray(orderedIds)) {
        throw new StorageError("orderedIds debe ser un array");
      }
      const notes = await readAll();
      const seen = new Set();
      const next = [];
      let idx = 0;
      for (const id of orderedIds) {
        if (seen.has(id)) continue;
        const n = notes.find((x) => x.id === id);
        if (!n) throw new StorageError(`Nota no encontrada: ${id}`);
        seen.add(id);
        next.push({ ...n, order: idx++ });
      }
      for (const n of notes) {
        if (!seen.has(n.id)) next.push({ ...n, order: idx++ });
      }
      await writeAll(next);
    },

    /**
     * Combina las notas importadas con las existentes: añade las que no
     * existen por id, conserva las existentes. Las notas añadidas se ponen
     * al final del orden. Lanza StorageError si la entrada no es un array
     * o contiene notas inválidas.
     * @param {Note[]} importedNotes
     * @returns {{ added: number, skipped: number, total: number }}
     */
    async merge(importedNotes) {
      if (!Array.isArray(importedNotes)) {
        throw new StorageError("importedNotes debe ser un array");
      }
      const existing = await readAll();
      const existingIds = new Set(existing.map((n) => n.id));
      const maxOrder = existing.reduce(
        (acc, n) => (typeof n.order === "number" && n.order > acc ? n.order : acc),
        -1,
      );
      let added = 0;
      let skipped = 0;
      const merged = [...existing];
      let cursor = maxOrder + 1;
      for (const raw of importedNotes) {
        if (!isValidImportedNote(raw)) {
          skipped++;
          continue;
        }
        if (existingIds.has(raw.id)) {
          skipped++;
          continue;
        }
        merged.push({ ...raw, order: cursor++ });
        existingIds.add(raw.id);
        added++;
      }
      await writeAll(merged);
      return { added, skipped, total: merged.length };
    },

    /**
     * Reemplaza TODAS las notas por las proporcionadas (operación destructiva).
     * Las notas se persisten en el orden del array y se les reasigna `order`
     * secuencial (0, 1, 2...). Lanza StorageError si la entrada no es un array
     * o contiene notas inválidas.
     * @param {Note[]} newNotes
     */
    async replaceAll(newNotes) {
      if (!Array.isArray(newNotes)) {
        throw new StorageError("newNotes debe ser un array");
      }
      const normalized = [];
      let idx = 0;
      for (const raw of newNotes) {
        if (!isValidImportedNote(raw)) {
          throw new StorageError(
            `Nota inválida en el array de importación: ${JSON.stringify(raw)}`,
          );
        }
        normalized.push({ ...raw, order: idx++ });
      }
      await writeAll(normalized);
    },
  };
}

/** Validador de notas importadas (mismo criterio que el dominio). */
function isValidImportedNote(raw) {
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
