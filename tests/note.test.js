import { describe, it, expect } from "vitest";
import {
  createNote,
  validateNote,
  deriveDisplayTitle,
  ValidationError,
  parseBackup,
  serializeBackup,
  isValidImportedNote,
} from "../src/domain/note.js";

const makeNote = (title, body) => ({
  id: "id-1",
  title,
  body,
  createdAt: 1,
  updatedAt: 1,
});

describe("deriveDisplayTitle", () => {
  it("usa el título cuando la nota tiene uno", () => {
    expect(deriveDisplayTitle(makeNote("Compras", "Leche y pan"))).toBe("Compras");
  });

  it("usa las 3 primeras palabras del cuerpo cuando no hay título (Req 4.1)", () => {
    expect(deriveDisplayTitle(makeNote("", "esto es una frase larga del cuerpo"))).toBe(
      "esto es una…",
    );
  });

  it("usa el cuerpo completo cuando tiene menos de 3 palabras (Req 4.2)", () => {
    expect(deriveDisplayTitle(makeNote("", "dos palabras"))).toBe("dos palabras");
  });

  it("muestra (Sin título) cuando no hay ni título ni cuerpo (Req 4.3)", () => {
    expect(deriveDisplayTitle(makeNote("", ""))).toBe("(Sin título)");
  });

  it("nunca devuelve cadena vacía", () => {
    const notes = [makeNote("", ""), makeNote("", "a"), makeNote("", "a b"), makeNote("", "a b c d e")];
    for (const note of notes) {
      expect(deriveDisplayTitle(note).length).toBeGreaterThan(0);
    }
  });
});

describe("validateNote", () => {
  it("rechaza una nota sin título ni cuerpo (Req 1.3)", () => {
    expect(() => validateNote(makeNote("", ""))).toThrow(ValidationError);
  });

  it("acepta una nota solo con título", () => {
    expect(() => validateNote(makeNote("Hola", ""))).not.toThrow();
  });

  it("acepta una nota solo con cuerpo", () => {
    expect(() => validateNote(makeNote("", "cuerpo de la nota"))).not.toThrow();
  });
});

describe("createNote", () => {
  it("recorta espacios y asigna timestamps", () => {
    const note = createNote({ title: "  Título  ", body: "  Cuerpo  " });
    expect(note.title).toBe("Título");
    expect(note.body).toBe("Cuerpo");
    expect(note.id).toBeTruthy();
    expect(note.createdAt).toBe(note.updatedAt);
  });
});

describe("isValidImportedNote", () => {
  it("acepta una nota con la forma mínima correcta", () => {
    expect(
      isValidImportedNote({
        id: "x",
        title: "t",
        body: "b",
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toBe(true);
  });

  it("acepta notas con order opcional", () => {
    expect(
      isValidImportedNote({
        id: "x",
        title: "t",
        body: "b",
        createdAt: 1,
        updatedAt: 2,
        order: 5,
      }),
    ).toBe(true);
  });

  it("rechaza notas con tipos incorrectos o campos faltantes", () => {
    const invalid = [
      null,
      {},
      { id: 1, title: "t", body: "b", createdAt: 1, updatedAt: 1 },
      { id: "x", title: 1, body: "b", createdAt: 1, updatedAt: 1 },
      { id: "x", title: "t", body: "b", createdAt: "1", updatedAt: 1 },
      { id: "", title: "t", body: "b", createdAt: 1, updatedAt: 1 },
    ];
    for (const raw of invalid) expect(isValidImportedNote(raw)).toBe(false);
  });
});

describe("parseBackup", () => {
  const sample = {
    version: 1,
    exportedAt: "2026-08-31T00:00:00.000Z",
    notes: [
      { id: "a", title: "A", body: "", createdAt: 1, updatedAt: 1 },
      { id: "b", title: "B", body: "x", createdAt: 2, updatedAt: 2 },
    ],
  };

  it("parsea un backup válido y devuelve sus notas", () => {
    const parsed = parseBackup(JSON.stringify(sample));
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe("2026-08-31T00:00:00.000Z");
    expect(parsed.notes).toHaveLength(2);
    expect(parsed.notes[0].id).toBe("a");
  });

  it("descarta silenciosamente notas inválidas manteniendo las válidas", () => {
    const dirty = {
      version: 1,
      notes: [
        { id: "ok", title: "t", body: "", createdAt: 1, updatedAt: 1 },
        { id: 2, title: "t", body: "b", createdAt: 1, updatedAt: 1 }, // id no es string
        null,
      ],
    };
    const parsed = parseBackup(JSON.stringify(dirty));
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].id).toBe("ok");
  });

  it("lanza ValidationError ante JSON inválido", () => {
    expect(() => parseBackup("no es json")).toThrow(ValidationError);
  });

  it("lanza ValidationError si falta el array notes", () => {
    expect(() => parseBackup(JSON.stringify({ version: 1 }))).toThrow(ValidationError);
    expect(() => parseBackup(JSON.stringify([1, 2, 3]))).toThrow(ValidationError);
  });
});

describe("serializeBackup", () => {
  it("genera un JSON con version, exportedAt y las notas indicadas", () => {
    const notes = [makeNote("a", "x")];
    const json = serializeBackup(notes);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.notes).toEqual(notes);
  });
});
