// NoteFur — controller del Side Panel.
// La UI nunca toca chrome.storage directamente: solo habla con notesStorage (RNF-2).
import {
  createNote,
  deriveDisplayTitle,
  parseBackup,
  serializeBackup,
} from "../src/domain/note.js";
import { createDebouncer } from "../src/domain/autosave.js";
import { createNotesStorage } from "../src/storage/notesStorage.js";

// Composition root: único punto donde se inyecta la storageArea real.
const storage = createNotesStorage(chrome.storage.local);

const els = {
  list: document.getElementById("notes-list"),
  editor: document.getElementById("editor"),
  title: document.getElementById("note-title"),
  body: document.getElementById("note-body"),
  status: document.getElementById("save-status"),
  btnNew: document.getElementById("btn-new"),
  btnBack: document.getElementById("btn-back"),
  btnDelete: document.getElementById("btn-delete"),
  btnExport: document.getElementById("btn-export"),
  btnImport: document.getElementById("btn-import"),
  fileImport: document.getElementById("file-import"),
  importDialog: document.getElementById("import-dialog"),
  importSummary: document.getElementById("import-dialog-summary"),
  importCancel: document.getElementById("import-cancel"),
  importMerge: document.getElementById("import-merge"),
  importReplace: document.getElementById("import-replace"),
  toast: document.getElementById("toast"),
};

/** @type {string|null} id de la nota en edición (null = nota nueva). */
let editingId = null;

/** @type {Promise<void>|null} guardado en curso (para esperarlo al volver). */
let pendingSave = null;

let toastTimer = null;
function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2500);
}

let statusTimer = null;
/** Indicador de estado del autosave (Req 2.6). */
function showSaveStatus(state) {
  if (state === "saving") {
    els.status.textContent = "Guardando…";
    els.status.classList.add("visible");
  } else if (state === "saved") {
    els.status.textContent = "Guardado ✓";
    els.status.classList.add("visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => els.status.classList.remove("visible"), 2000);
  }
}

/** Renderiza la lista de notas ordenada por más reciente (Req 2.1). */
async function renderList() {
  const notes = await storage.list();
  els.list.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay notas todavía. ¡Crea la primera!";
    els.list.appendChild(empty);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "note-item";
    item.draggable = true;
    item.dataset.noteId = note.id;

    // El click abre el editor salvo que venga de un drag (suprimido más abajo).
    item.addEventListener("click", () => {
      if (consumeClickSuppression(item)) return;
      openEditor(note.id);
    });

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⋮⋮";

    const title = document.createElement("span");
    title.className = "note-item-title";
    title.textContent = deriveDisplayTitle(note); // Req 4.1–4.3

    const date = document.createElement("span");
    date.className = "note-item-date";
    date.textContent = new Date(note.updatedAt).toLocaleString();

    item.append(handle, title, date);
    attachDragHandlers(item, note.id);
    els.list.appendChild(item);
  }
}

/** Estado compartido entre handlers de drag de los items. */
const dragState = { sourceId: null, didDrag: false };

/**
 * Items cuyo siguiente click debe ignorarse (drag que no terminó en drop).
 * WeakSet para que los items se liberen al re-renderizar.
 */
const clickSuppression = new WeakSet();

function consumeClickSuppression(item) {
  if (clickSuppression.has(item)) {
    clickSuppression.delete(item);
    return true;
  }
  return false;
}

/** Adjunta los listeners HTML5 de drag-and-drop a un note-item. */
function attachDragHandlers(item, id) {
  item.addEventListener("dragstart", (e) => {
    dragState.sourceId = id;
    dragState.didDrag = true;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    clearDropIndicators();
    // Si el drag no terminó en un drop, marcamos para no abrir el editor con el click siguiente.
    if (dragState.didDrag) clickSuppression.add(item);
    dragState.sourceId = null;
    setTimeout(() => {
      dragState.didDrag = false;
    }, 0);
  });

  item.addEventListener("dragover", (e) => {
    if (!dragState.sourceId || dragState.sourceId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = item.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    clearDropIndicators();
    item.classList.add(before ? "drop-before" : "drop-after");
  });

  item.addEventListener("dragleave", () => {
    item.classList.remove("drop-before", "drop-after");
  });

  item.addEventListener("drop", async (e) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || dragState.sourceId;
    if (!sourceId || sourceId === id) return;
    const rect = item.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    item.classList.remove("drop-before", "drop-after");
    try {
      await moveNote(sourceId, id, before);
    } catch (err) {
      console.error("Error al reordenar:", err);
      showToast("No se pudo reordenar la nota", true);
    }
  });
}

function clearDropIndicators() {
  els.list
    .querySelectorAll(".drop-before, .drop-after")
    .forEach((el) => el.classList.remove("drop-before", "drop-after"));
}

/**
 * Mueve la nota `sourceId` a la posición adyacente de `targetId`
 * (`before` decide si va antes o después del target).
 */
async function moveNote(sourceId, targetId, before) {
  const notes = await storage.list();
  const orderedIds = notes.map((n) => n.id);
  const sourceIdx = orderedIds.indexOf(sourceId);
  if (sourceIdx === -1) return;
  orderedIds.splice(sourceIdx, 1);
  const targetIdx = orderedIds.indexOf(targetId);
  if (targetIdx === -1) return;
  const insertIdx = before ? targetIdx : targetIdx + 1;
  orderedIds.splice(insertIdx, 0, sourceId);
  await storage.reorder(orderedIds);
  await renderList();
}

/** Abre una nota existente en modo edición/lectura (Req 2.2, 2.3). */
async function openEditor(id) {
  debouncer.cancel();
  const notes = await storage.list();
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  editingId = note.id;
  els.title.value = note.title;
  els.body.value = note.body;
  els.list.classList.add("hidden");
  els.editor.classList.remove("hidden");
  els.title.focus();
}

/** Abre el editor vacío para una nota nueva (Req 1.1). */
function openNewNote() {
  debouncer.cancel();
  editingId = null;
  els.title.value = "";
  els.body.value = "";
  els.list.classList.add("hidden");
  els.editor.classList.remove("hidden");
  els.title.focus();
}

/** Persiste la nota en edición; una nota nueva vacía se descarta (Req 1.3). */
function saveNow() {
  pendingSave = doSave();
}

async function doSave() {
  const isNew = editingId === null;
  const title = els.title.value.trim();
  const body = els.body.value.trim();

  // Nota nueva sin contenido -> no se crea (Req 1.3).
  if (isNew && title === "" && body === "") return;

  const note = isNew
    ? createNote({ title, body })
    : { id: editingId, title, body, createdAt: 0, updatedAt: Date.now() };

  try {
    await storage.save(note); // Req 1.2 / 2.4 (sin duplicar)
    if (isNew) editingId = note.id; // pasa a ser nota existente
    showSaveStatus("saved");
  } catch (err) {
    console.error("Error al guardar:", err);
    showToast("No se pudo guardar la nota", true);
  }
}

/** Espera a que termine el guardado pendiente, si lo hay (evita races). */
async function flushPendingSave() {
  debouncer.flush();
  if (pendingSave) await pendingSave;
}

async function backToList() {
  await flushPendingSave(); // Req 2.5: guardar pendiente antes de volver
  editingId = null;
  els.status.classList.remove("visible");
  els.editor.classList.add("hidden");
  els.list.classList.remove("hidden");
  try {
    await renderList();
  } catch (err) {
    console.error("Error al refrescar la lista:", err);
    showToast("No se pudo cargar las notas", true);
  }
}

/** Elimina la nota en edición con confirmación previa (Req 3.1, 3.2). */
async function handleDelete() {
  if (!editingId) return;

  const confirmed = confirm("¿Eliminar esta nota? Esta acción no se puede deshacer.");
  if (!confirmed) return;

  debouncer.cancel();
  try {
    await storage.remove(editingId);
    showToast("Nota eliminada");
    backToList();
  } catch (err) {
    console.error("Error al eliminar:", err);
    showToast("No se pudo eliminar la nota", true);
  }
}

// --- Autosave (Req 1.2, 2.4, 2.5) ---
const debouncer = createDebouncer(saveNow, 400);

function onEdit() {
  showSaveStatus("saving");
  debouncer.schedule(); // reinicia el temporizador de 400 ms
}

els.title.addEventListener("input", onEdit);
els.body.addEventListener("input", onEdit);
els.title.addEventListener("blur", () => debouncer.flush()); // Req 2.5
els.body.addEventListener("blur", () => debouncer.flush());

els.btnNew.addEventListener("click", openNewNote);
els.btnBack.addEventListener("click", backToList);
els.btnDelete.addEventListener("click", handleDelete);

// --- Exportar / Importar ---
els.btnExport.addEventListener("click", handleExport);
els.btnImport.addEventListener("click", () => els.fileImport.click());
els.fileImport.addEventListener("change", handleImportFileChosen);
els.importCancel.addEventListener("click", closeImportDialog);
els.importMerge.addEventListener("click", () => applyImport("merge"));
els.importReplace.addEventListener("click", () => applyImport("replace"));
els.importDialog
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeImportDialog);

/** Genera un archivo .json con todas las notas y dispara su descarga. */
async function handleExport() {
  try {
    const notes = await storage.list();
    const json = serializeBackup(notes);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notefur-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exportadas ${notes.length} notas`);
  } catch (err) {
    console.error("Error al exportar:", err);
    showToast("No se pudo exportar", true);
  }
}

/** Notas candidatas a importar en memoria (entre la elección del archivo y la confirmación). */
let pendingImport = null;

/** Lee el archivo seleccionado, valida y abre el modal de confirmación. */
async function handleImportFileChosen(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  // Reset para permitir volver a elegir el mismo archivo.
  input.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseBackup(text);
    if (parsed.notes.length === 0) {
      showToast("El archivo no contiene notas válidas", true);
      return;
    }
    const existing = await storage.list();
    const existingIds = new Set(existing.map((n) => n.id));
    const duplicates = parsed.notes.filter((n) => existingIds.has(n.id)).length;
    pendingImport = parsed.notes;
    els.importSummary.textContent =
      `El archivo contiene ${parsed.notes.length} nota${parsed.notes.length === 1 ? "" : "s"}` +
      (duplicates > 0 ? ` (${duplicates} ya existe${duplicates === 1 ? "" : "n"} en tu lista).` : ".");
    els.importDialog.classList.remove("hidden");
  } catch (err) {
    console.error("Error al leer el archivo:", err);
    showToast(err.message || "Archivo inválido", true);
  }
}

function closeImportDialog() {
  els.importDialog.classList.add("hidden");
  pendingImport = null;
}

/** Ejecuta la importación en el modo elegido y refresca la lista. */
async function applyImport(mode) {
  if (!pendingImport) return;
  const notesToImport = pendingImport;
  closeImportDialog();
  try {
    if (mode === "merge") {
      const result = await storage.merge(notesToImport);
      await renderList();
      showToast(
        `Importadas ${result.added} nota${result.added === 1 ? "" : "s"}` +
          (result.skipped > 0 ? ` (${result.skipped} omitida${result.skipped === 1 ? "" : "s"})` : ""),
      );
    } else {
      await storage.replaceAll(notesToImport);
      await renderList();
      showToast(`Reemplazadas: ${notesToImport.length} notas importadas`);
    }
  } catch (err) {
    console.error("Error al importar:", err);
    showToast("No se pudo importar", true);
  }
}

// Carga inicial (RNF-4: al abrir el panel se muestra toda la UI).
renderList().catch((err) => {
  console.error("Error al cargar notas:", err);
  showToast("No se pudo cargar las notas", true);
});
