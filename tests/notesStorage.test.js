import { describe, it, expect } from "vitest";
import { createNotesStorage, StorageError } from "../src/storage/notesStorage.js";

/** Fake de storageArea con API tipo chrome.storage.local. */
function createFakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    async get(keys) {
      if (typeof keys === "string") return { [keys]: store[keys] };
      return { ...store };
    },
    async set(items) {
      Object.assign(store, items);
    },
    _store: store,
  };
}

const note = (id, updatedAt, title = "T", body = "B") => ({
  id,
  title,
  body,
  createdAt: 1,
  updatedAt,
});

describe("createNotesStorage", () => {
  it("devuelve lista vacía cuando no hay notas (Req 2.1)", async () => {
    const storage = createNotesStorage(createFakeStorage());
    expect(await storage.list()).toEqual([]);
  });

  it("persiste una nota nueva (Req 1.2)", async () => {
    const fake = createFakeStorage();
    const storage = createNotesStorage(fake);
    const n = note("a", 10);
    await storage.save(n);
    expect(fake._store.notes).toEqual([{ ...n, order: 0 }]);
  });

  it("lista ordenada por updatedAt descendente (Req 2.1)", async () => {
    const fake = createFakeStorage({
      notes: [note("old", 1), note("new", 3), note("mid", 2)],
    });
    const storage = createNotesStorage(fake);
    const list = await storage.list();
    expect(list.map((n) => n.id)).toEqual(["new", "mid", "old"]);
  });

  it("actualiza sin duplicar y conserva createdAt (Req 2.4, invariante 4)", async () => {
    const fake = createFakeStorage({
      notes: [{ id: "a", title: "v1", body: "", createdAt: 100, updatedAt: 100 }],
    });
    const storage = createNotesStorage(fake);
    await storage.save({ id: "a", title: "v2", body: "x", createdAt: 999, updatedAt: 200 });
    expect(fake._store.notes).toHaveLength(1);
    expect(fake._store.notes[0]).toEqual({
      id: "a",
      title: "v2",
      body: "x",
      createdAt: 100,
      updatedAt: 200,
    });
  });

  it("elimina la nota de forma permanente (Req 3.2)", async () => {
    const fake = createFakeStorage({ notes: [note("a", 1), note("b", 2)] });
    const storage = createNotesStorage(fake);
    await storage.remove("a");
    expect(fake._store.notes.map((n) => n.id)).toEqual(["b"]);
  });

  it("lanza StorageError cuando el storage falla al escribir (camino de error)", async () => {
    const failing = {
      async get() {
        return {};
      },
      async set() {
        throw new Error("quota exceeded");
      },
    };
    const storage = createNotesStorage(failing);
    await expect(storage.save(note("a", 1))).rejects.toBeInstanceOf(StorageError);
  });

  it("lanza StorageError cuando el storage falla al leer", async () => {
    const failing = {
      async get() {
        throw new Error("session ended");
      },
    };
    const storage = createNotesStorage(failing);
    await expect(storage.list()).rejects.toBeInstanceOf(StorageError);
  });

  it("asigna order secuencial a las notas nuevas tras un reorder", async () => {
    const fake = createFakeStorage({
      notes: [note("a", 1), note("b", 2), note("c", 3)],
    });
    const storage = createNotesStorage(fake);
    await storage.reorder(["c", "a", "b"]);
    const list = await storage.list();
    expect(list.map((n) => n.id)).toEqual(["c", "a", "b"]);
    expect(list.map((n) => n.order)).toEqual([0, 1, 2]);
  });

  it("lista por order ascendente cuando hay notes con order", async () => {
    const fake = createFakeStorage({
      notes: [
        { ...note("a", 1), order: 2 },
        { ...note("b", 2), order: 0 },
        { ...note("c", 3), order: 1 },
      ],
    });
    const storage = createNotesStorage(fake);
    const list = await storage.list();
    expect(list.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("reorder preserva createdAt y los datos de la nota", async () => {
    const fake = createFakeStorage({
      notes: [
        { id: "a", title: "A", body: "", createdAt: 100, updatedAt: 1 },
        { id: "b", title: "B", body: "x", createdAt: 200, updatedAt: 2 },
      ],
    });
    const storage = createNotesStorage(fake);
    await storage.reorder(["b", "a"]);
    const stored = fake._store.notes;
    const byId = Object.fromEntries(stored.map((n) => [n.id, n]));
    expect(byId.a.createdAt).toBe(100);
    expect(byId.b.createdAt).toBe(200);
    expect(byId.b.title).toBe("B");
    expect(byId.b.body).toBe("x");
  });

  it("reorder lanza StorageError si un id no existe", async () => {
    const fake = createFakeStorage({
      notes: [note("a", 1), note("b", 2)],
    });
    const storage = createNotesStorage(fake);
    await expect(storage.reorder(["a", "fantasma"])).rejects.toBeInstanceOf(StorageError);
  });

  it("save asigna order incremental a notas nuevas cuando ya hay notas ordenadas", async () => {
    const fake = createFakeStorage({
      notes: [{ ...note("a", 1), order: 0 }, { ...note("b", 2), order: 1 }],
    });
    const storage = createNotesStorage(fake);
    await storage.save(note("c", Date.now()));
    const list = await storage.list();
    expect(list.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(list[2].order).toBe(2);
  });

  it("save conserva el order al actualizar una nota existente", async () => {
    const fake = createFakeStorage({
      notes: [{ ...note("a", 1), order: 5 }, { ...note("b", 2), order: 0 }],
    });
    const storage = createNotesStorage(fake);
    await storage.save({ id: "a", title: "A2", body: "", createdAt: 1, updatedAt: 999 });
    const list = await storage.list();
    const a = list.find((n) => n.id === "a");
    expect(a.order).toBe(5);
    expect(a.title).toBe("A2");
  });

  describe("merge", () => {
    it("añade notas nuevas y conserva las existentes", async () => {
      const fake = createFakeStorage({ notes: [note("a", 1)] });
      const storage = createNotesStorage(fake);
      const result = await storage.merge([note("a", 1), note("b", 2)]);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.total).toBe(2);
      const list = await storage.list();
      expect(list.map((n) => n.id).sort()).toEqual(["a", "b"]);
    });

    it("asigna order al final del existente para las notas añadidas", async () => {
      const fake = createFakeStorage({
        notes: [
          { ...note("a", 1), order: 0 },
          { ...note("b", 2), order: 1 },
        ],
      });
      const storage = createNotesStorage(fake);
      await storage.merge([note("c", 3)]);
      const list = await storage.list();
      const c = list.find((n) => n.id === "c");
      expect(c.order).toBe(2);
      // El orden de listado sigue siendo a, b, c.
      expect(list.map((n) => n.id)).toEqual(["a", "b", "c"]);
    });

    it("omite notas inválidas contándolas como skipped", async () => {
      const fake = createFakeStorage({ notes: [note("a", 1)] });
      const storage = createNotesStorage(fake);
      const result = await storage.merge([
        { id: "b", title: "B", body: "", createdAt: 1, updatedAt: 1 },
        { id: 5, title: "X", body: "y", createdAt: 1, updatedAt: 1 }, // inválida
        null,
      ]);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.total).toBe(2);
    });

    it("lanza StorageError si la entrada no es un array", async () => {
      const storage = createNotesStorage(createFakeStorage());
      await expect(storage.merge("nope")).rejects.toBeInstanceOf(StorageError);
    });
  });

  describe("replaceAll", () => {
    it("reemplaza todas las notas por el array dado (operación destructiva)", async () => {
      const fake = createFakeStorage({
        notes: [note("a", 1), note("b", 2)],
      });
      const storage = createNotesStorage(fake);
      await storage.replaceAll([note("x", 10), note("y", 20), note("z", 30)]);
      const list = await storage.list();
      expect(list.map((n) => n.id)).toEqual(["x", "y", "z"]);
    });

    it("normaliza order secuencialmente desde 0", async () => {
      const fake = createFakeStorage();
      const storage = createNotesStorage(fake);
      await storage.replaceAll([
        { id: "x", title: "X", body: "", createdAt: 1, updatedAt: 1, order: 999 },
        { id: "y", title: "Y", body: "", createdAt: 2, updatedAt: 2, order: 999 },
      ]);
      const list = await storage.list();
      expect(list.map((n) => n.order)).toEqual([0, 1]);
    });

    it("persiste un array vacío (limpia todas las notas)", async () => {
      const fake = createFakeStorage({ notes: [note("a", 1)] });
      const storage = createNotesStorage(fake);
      await storage.replaceAll([]);
      expect(await storage.list()).toEqual([]);
    });

    it("lanza StorageError si contiene notas inválidas y NO modifica nada", async () => {
      const fake = createFakeStorage({ notes: [note("a", 1)] });
      const storage = createNotesStorage(fake);
      await expect(
        storage.replaceAll([note("x", 1), { id: 5, title: "t", body: "b", createdAt: 1, updatedAt: 1 }]),
      ).rejects.toBeInstanceOf(StorageError);
      // Estado intacto.
      const list = await storage.list();
      expect(list.map((n) => n.id)).toEqual(["a"]);
    });

    it("lanza StorageError si la entrada no es un array", async () => {
      const storage = createNotesStorage(createFakeStorage());
      await expect(storage.replaceAll("nope")).rejects.toBeInstanceOf(StorageError);
    });
  });
});
