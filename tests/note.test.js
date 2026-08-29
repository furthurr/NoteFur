import { describe, it, expect } from "vitest";
import {
  createNote,
  validateNote,
  deriveDisplayTitle,
  ValidationError,
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
