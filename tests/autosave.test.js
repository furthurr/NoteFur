import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncer } from "../src/domain/autosave.js";

describe("createDebouncer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("no ejecuta antes del delay (Req 2.5)", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.schedule();
    vi.advanceTimersByTime(399);
    expect(fn).not.toHaveBeenCalled();
  });

  it("ejecuta tras el delay de 400 ms", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.schedule();
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("schedule repetido reinicia el temporizador", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.schedule();
    vi.advanceTimersByTime(300);
    debouncer.schedule(); // escribe otra vez -> reinicia
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush ejecuta inmediatamente y solo una vez (Req 2.5)", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.schedule();
    debouncer.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush sin guardado pendiente no ejecuta nada", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel evita la ejecución", () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(fn, 400);
    debouncer.schedule();
    debouncer.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
