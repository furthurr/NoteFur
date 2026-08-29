# Requisitos — Extensión Chrome de Notas (NoteFur)

## Historia 1: Crear notas
Como usuario quiero crear nuevas notas con título y cuerpo para capturar información rápidamente.

### Criterios (EARS)
- Req 1.1: EL SISTEMA DEBERÁ permitir crear una nueva nota compuesta por un campo de título y un campo de cuerpo.
- Req 1.2: CUANDO una nota nueva recibe contenido (título o cuerpo no vacíos) EL SISTEMA DEBERÁ persistirla automáticamente en el almacenamiento local tras 400 ms sin escritura (debounce).
- Req 1.3: CUANDO el usuario vuelve a la lista con una nota nueva sin título y sin cuerpo EL SISTEMA DEBERÁ descartarla sin crearla en el almacenamiento.

## Historia 2: Listar y seleccionar notas
Como usuario quiero ver un panel con las notas anteriores para poder leerlas o editarlas.

### Criterios (EARS)
- Req 2.1: CUANDO el usuario abre el panel de la extensión EL SISTEMA DEBERÁ mostrar la lista de todas las notas existentes ordenadas de más reciente a más antigua.
- Req 2.2: CUANDO el usuario selecciona una nota de la lista EL SISTEMA DEBERÁ mostrar su título y cuerpo para lectura.
- Req 2.3: CUANDO el usuario pulsa "editar" en una nota EL SISTEMA DEBERÁ permitir modificar su título y su cuerpo.
- Req 2.4: CUANDO una nota existente es modificada EL SISTEMA DEBERÁ actualizarla automáticamente en el almacenamiento sin crear duplicados.
- Req 2.5: CUANDO el usuario deja de escribir 400 ms, pierde el foco del editor o vuelve a la lista EL SISTEMA DEBERÁ forzar el guardado pendiente de la nota en edición.
- Req 2.6: MIENTRAS exista un guardado pendiente EL SISTEMA DEBERÁ mostrar el indicador "Guardando…" y CUANDO el guardado se complete EL SISTEMA DEBERÁ mostrar "Guardado ✓".

## Historia 3: Eliminar notas
Como usuario quiero eliminar notas que ya no necesito para mantener limpia la lista.

### Criterios (EARS)
- Req 3.1: CUANDO el usuario solicita eliminar una nota EL SISTEMA DEBERÁ pedir confirmación antes de borrarla.
- Req 3.2: CUANDO el usuario confirma la eliminación EL SISTEMA DEBERÁ borrar la nota de forma permanente del almacenamiento y refrescar la lista.

## Historia 4: Título derivado del cuerpo
Como usuario quiero que una nota sin título siga siendo identificable en la lista.

### Criterios (EARS)
- Req 4.1: CUANDO una nota no tiene título EL SISTEMA DEBERÁ usar las tres primeras palabras del cuerpo como título mostrado en la lista.
- Req 4.2: CUANDO una nota no tiene título y su cuerpo tiene menos de tres palabras EL SISTEMA DEBERÁ usar el cuerpo completo como título mostrado en la lista.
- Req 4.3: CUANDO una nota no tiene título ni cuerpo EL SISTEMA DEBERÁ mostrar "(Sin título)" como título en la lista.

## Supuestos
- La extensión usa Manifest V3, el estándar actual de Chrome.
- El almacenamiento es local al navegador (`chrome.storage.local`); sin sincronización en la nube en esta versión.
- La interfaz se abre como **panel lateral (Side Panel API)** al hacer clic en el ícono de la extensión; todo el contenido (lista de notas + editor) vive dentro de ese panel.
- No hay categorías, etiquetas, búsqueda ni exportación en esta versión.
- Un solo dispositivo; las notas no se comparten entre navegadores.

## Requisitos no funcionales (RNF)
- RNF-1: EL SISTEMA DEBERÁ implementarse como extensión Manifest V3 con Service Worker y Side Panel.
- RNF-2: EL SISTEMA DEBERÁ encapsular el acceso a `chrome.storage.local` en una capa de almacenamiento separada de la UI.
- RNF-3: EL SISTEMA DEBERÁ mantener las notas intactas al cerrar y reabrir el navegador.
- RNF-4: CUANDO el usuario hace clic en el ícono de la extensión EL SISTEMA DEBERÁ abrir el panel lateral con toda la UI de notas.
- RNF-5: EL SISTEMA DEBERÁ realizar las escrituras automáticas de forma asíncrona sin bloquear la interfaz.
