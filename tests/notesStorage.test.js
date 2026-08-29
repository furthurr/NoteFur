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
    expect(fake._store.notes).toEqual([n]);
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
});
