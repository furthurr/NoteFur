// NoteFur — controller del Side Panel.
// La UI nunca toca chrome.storage directamente: solo habla con notesStorage (RNF-2).
import { createNote, deriveDisplayTitle } from "../src/domain/note.js";
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
    item.addEventListener("click", () => openEditor(note.id));

    const title = document.createElement("span");
    title.className = "note-item-title";
    title.textContent = deriveDisplayTitle(note); // Req 4.1–4.3

    const date = document.createElement("span");
    date.className = "note-item-date";
    date.textContent = new Date(note.updatedAt).toLocaleString();

    item.append(title, date);
    els.list.appendChild(item);
  }
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

// Carga inicial (RNF-4: al abrir el panel se muestra toda la UI).
renderList().catch((err) => {
  console.error("Error al cargar notas:", err);
  showToast("No se pudo cargar las notas", true);
});
