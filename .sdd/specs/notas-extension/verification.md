# Verificación — Extensión Chrome de Notas (NoteFur)

| Requisito | Tarea(s) | Test(s) | Evidencia (path o cmd) | Estado |
|-----------|----------|---------|------------------------|--------|
| Req 1.1 (crear nota con título+cuerpo) | 2.1, 4.1, 4.3 | `createNote` en `note.test.js` | `src/domain/note.js`, `sidepanel/sidepanel.js` | ✅ |
| Req 1.2 (autosave: nota nueva con contenido se persiste) | 3.1, 6.1, 6.3 | `persiste una nota nueva` + `ejecuta tras el delay de 400 ms` | `tests/notesStorage.test.js`, `tests/autosave.test.js` | ✅ |
| Req 1.3 (descartar nota nueva vacía) | 6.3 | `flush sin guardado pendiente no ejecuta nada` + lógica `doSave` | `sidepanel.js` (`if (isNew && title === "" && body === "") return`) | ✅ |
| Req 2.1 (lista ordenada al abrir) | 3.1, 4.2 | `lista ordenada por updatedAt descendente` | `tests/notesStorage.test.js` + `renderList` | ✅ |
| Req 2.2 (seleccionar para leer) | 4.2 | — (UI) | `openEditor` en `sidepanel.js` | ✅ |
| Req 2.3 (editar título y cuerpo) | 4.2, 4.3 | — (UI) | `openEditor` + editor en `sidepanel.html` | ✅ |
| Req 2.4 (modificación → autosave sin duplicar) | 3.1, 6.1, 6.3 | `actualiza sin duplicar y conserva createdAt` + `schedule repetido reinicia` | `tests/notesStorage.test.js`, `tests/autosave.test.js` | ✅ |
| Req 2.5 (flush: pausa 400 ms / blur / volver) | 6.1, 6.3 | `flush ejecuta inmediatamente y solo una vez` | `tests/autosave.test.js` + `sidepanel.js` (blur, `backToList`) | ✅ |
| Req 2.6 (indicador Guardando… / Guardado ✓) | 6.3, 6.4 | — (UI) | `showSaveStatus` en `sidepanel.js` + `#save-status` | ✅ |
| Req 3.1 (confirmación antes de borrar) | 4.4 | — (UI) | `confirm()` en `handleDelete` (`sidepanel.js`) | ✅ |
| Req 3.2 (borrado permanente + refresh) | 3.1, 4.4 | `elimina la nota de forma permanente` | `tests/notesStorage.test.js` + `handleDelete` | ✅ |
| Req 4.1 (3 primeras palabras) | 2.1, 4.2 | `usa las 3 primeras palabras del cuerpo` | `tests/note.test.js` + `renderList` | ✅ |
| Req 4.2 (< 3 palabras → cuerpo completo) | 2.1, 4.2 | `usa el cuerpo completo cuando tiene menos de 3 palabras` | `tests/note.test.js` | ✅ |
| Req 4.3 ("(Sin título)" si vacío) | 2.1, 4.2 | `muestra (Sin título) cuando no hay ni título ni cuerpo` | `tests/note.test.js` | ✅ |
| RNF-1 (MV3 + SW + Side Panel) | 1.2, 1.3 | — (config) | `manifest.json`, `background.js` | ✅ |
| RNF-2 (persistencia encapsulada) | 3.1, 4.2 | — (diseño) | `rg "chrome.storage"` → única referencia real es la inyección en `sidepanel.js`; get/set solo en `notesStorage.js` | ✅ |
| RNF-3 (notas intactas entre cierres) | 4.5 | — (manual) | Pendiente validación en Chrome | ⏳ |
| RNF-4 (clic en ícono abre panel) | 1.2, 1.3, 4.5 | — (config/manual) | `background.js` + validación en Chrome | ⏳ |
| RNF-5 (escrituras asíncronas sin bloquear UI) | 6.1, 6.3 | — (diseño) | `chrome.storage.local.set` async + debounce 400 ms | ✅ |

**Suite de tests:** `pnpm test` → 3 archivos, 22/22 ✅ (vitest 4.1.11)

## Self-check RNF (quality-bar)

| RNF / quality-bar | Evidencia (búsqueda / path) | Estado |
|-------------------|----------------------------|--------|
| Persistencia encapsulada (#6) | `rg "chrome.storage" --glob "!background.js"` → solo `src/storage/notesStorage.js` | ✅ |
| Capas: UI sin storage directo (#1) | `sidepanel/sidepanel.js` solo importa `notesStorage.js` | ✅ |
| DI / composition root (#2) | `createNotesStorage(chrome.storage.local)` único punto de inyección en `sidepanel.js` | ✅ |
| Errores tipados (#5) | `ValidationError`, `StorageError`; sin `catch` vacío (`console.error` en fallos) | ✅ |
| Tests mínimos (#8) | 22 tests; camino de error con fake en `notesStorage.test.js`; debounce con fake timers en `autosave.test.js` | ✅ |
| Tipos (#11) | Excepción documentada en `design.md` (JS + JSDoc, sin TypeScript) | ✅ |

## Notas de cierre
- **Pendiente (4.5):** validación manual en Chrome — cargar carpeta en `chrome://extensions` (modo desarrollador) y probar flujo completo. Instrucciones en la respuesta final.
- **Opción de mejora:** añadir `icons/` al manifest (actualmente usa el ícono genérico de Chrome).

## Estado final
- **GATE 4 aprobado por el usuario** el 2026-08-29. Spec cerrada.
- **Iteración 2 (autosave)** implementada el 2026-08-29: Wave 6 completada, 22/22 tests ✅, requisitos actualizados (Req 1.2, 1.3, 2.4 reescritos; Req 2.5, 2.6 y RNF-5 nuevos).
- Pendiente abierto: tarea 4.5 (validación manual en Chrome, ahora incluye probar el autosave). Si aparece cualquier hallazgo tras la prueba, se abre un `bugfix.md` nuevo para cubrirlo.
