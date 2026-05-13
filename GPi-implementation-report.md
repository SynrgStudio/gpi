# GPi — Reporte completo de implementación

Última actualización: 2026-05-12  
Versión actual de la app: `0.0.11`

Este reporte describe, en lenguaje de producto, todo lo que GPi hace actualmente y qué partes ya fueron implementadas. No está escrito como documentación técnica interna, sino como una explicación completa de la app para alguien que quiere entender qué existe hoy.

---

## 1. Qué es GPi

GPi es una aplicación de escritorio para usar Pi de una forma más visual, persistente y cómoda.

La idea central es:

> Pi es el motor. GPi es el cockpit.

Pi sigue siendo el agente que piensa, usa herramientas, lee archivos, edita código y ejecuta tareas. GPi no intenta reemplazarlo. GPi le agrega una interfaz de escritorio para manejar proyectos, sesiones, contexto, actualizaciones, archivos, imágenes y continuidad de trabajo.

En vez de usar Pi solo desde una terminal o una sesión aislada, GPi permite trabajar con una estructura más clara:

- proyectos persistentes;
- sesiones por proyecto;
- historial visual;
- estado del agente;
- archivos del proyecto;
- adjuntos de imagen;
- contexto git;
- actualizaciones de GPi y Pi;
- flujos de continuidad.

---

## 2. Modelo general de la app

GPi organiza el trabajo en tres niveles principales:

### Proyecto

Un proyecto es una carpeta local. Normalmente es un repo o una carpeta donde se quiere trabajar con Pi.

GPi permite elegir una carpeta y guardarla en la barra lateral.

Cada proyecto tiene:

- nombre;
- ruta local;
- sesiones asociadas;
- estado de archivos;
- estado git;
- contexto detectado.

### Sesión Pi

Una sesión es una conversación/trabajo de Pi dentro de un proyecto.

Antes existía la idea de “sesiones locales”, pero fue eliminada. El producto final usa solo sesiones Pi.

Si Pi no está disponible, GPi no crea una sesión falsa. En vez de eso, guía al usuario a instalar o arreglar Pi.

### Mensajes y timeline

Cada sesión tiene una línea de tiempo visual donde se muestran:

- mensajes del usuario;
- respuestas del agente;
- fases de trabajo;
- llamadas a herramientas;
- cambios de archivos;
- diffs;
- estadísticas;
- errores;
- eventos de sistema;
- imágenes enviadas.

---

## 3. Interfaz principal

La app tiene una estructura tipo cockpit.

### Barra lateral izquierda

La barra lateral permite:

- ver proyectos;
- seleccionar proyecto;
- ver sesiones por proyecto;
- crear nueva sesión Pi;
- importar sesiones existentes de Pi;
- archivar sesiones;
- restaurar sesiones archivadas;
- abrir el quick switcher;
- agregar proyectos.

También muestra estados de sesiones mediante indicadores visuales.

### Área central

El área central contiene:

- header del proyecto/sesión actual;
- timeline de conversación;
- composer para enviar prompts;
- panel opcional de archivos del proyecto.

### Header de sesión

El header muestra:

- nombre del proyecto;
- ruta actual (`cwd`);
- título de la sesión;
- badge de estado git del proyecto;
- acceso a settings;
- indicador de updates.

El badge git es uno de los últimos agregados. Usa el logo de Git y cambia de color según el estado del repo.

### Composer

El composer permite:

- escribir prompts;
- enviar mensajes a Pi;
- enviar follow-ups cuando una sesión está ocupada;
- adjuntar imágenes;
- insertar menciones de archivos;
- ver modelo/configuración de sesión;
- compactar sesión;
- abortar ejecución;
- manejar estados de busy/compacting.

---

## 4. Gestión de proyectos

GPi permite agregar carpetas locales como proyectos.

El usuario puede:

- elegir una carpeta;
- editar nombre/ruta;
- eliminar el proyecto de GPi sin borrar archivos reales;
- seleccionar entre proyectos;
- ver sesiones asociadas.

La app no borra el contenido del proyecto. La eliminación de un proyecto solo lo quita del workspace de GPi.

---

## 5. Sesiones Pi

GPi permite crear sesiones Pi desde la UI.

Al crear una sesión:

1. GPi verifica que haya proyecto seleccionado.
2. Verifica que Pi esté disponible.
3. Si Pi está disponible, crea una sesión Pi real en ese proyecto.
4. Muestra estado de conexión mientras se crea.
5. Cuando la sesión está lista, queda seleccionada para trabajar.

Si Pi no está disponible:

- GPi muestra una recuperación clara;
- abre o dirige al usuario a Runtime settings;
- muestra el comando oficial de instalación disponible;
- no crea una sesión falsa.

La app también puede importar sesiones Pi existentes desde el historial de Pi.

---

## 6. Importación de sesiones Pi

GPi puede descubrir e importar sesiones existentes de Pi para un proyecto.

Al importar:

- detecta sesiones asociadas al proyecto;
- crea entradas visuales en la barra lateral;
- muestra previews de mensajes;
- conserva la ruta del archivo de sesión;
- permite reabrir el handle de Pi cuando se necesita continuar.

Si una sesión importada apunta a un archivo que ya no existe, GPi lo muestra como un problema recuperable.

---

## 7. Timeline visual de trabajo

El timeline no es solo chat plano. GPi convierte eventos de Pi en bloques visuales.

Puede mostrar:

- mensaje del usuario;
- respuesta del asistente;
- fase de preparación;
- fase de trabajo;
- herramientas iniciadas/finalizadas;
- archivos creados/modificados/eliminados;
- comandos ejecutados;
- diffs;
- stats de sesión;
- eventos de compaction;
- errores recuperables.

Esto hace que una sesión larga se entienda como una secuencia de trabajo, no como una pared de texto.

---

## 8. Autoscroll interruptible

GPi implementa autoscroll inteligente.

Durante una respuesta larga:

- si el usuario está abajo, GPi sigue el stream automáticamente;
- si el usuario hace scroll hacia arriba, GPi deja de forzar el scroll;
- aparece `Jump to latest`;
- al tocarlo, vuelve al final y reanuda autoscroll.

Esto evita el problema típico de chats donde leer algo anterior se vuelve imposible porque la respuesta en streaming empuja todo hacia abajo.

---

## 9. File tree del proyecto

GPi tiene un panel de archivos del proyecto.

Es read-only: sirve para navegar y mencionar archivos, no para editar desde ahí.

El file tree:

- lista archivos y carpetas del proyecto;
- excluye carpetas pesadas como `node_modules`, `.git`, `dist`, caches, releases, etc.;
- tiene límites de profundidad y cantidad para no congelar la UI;
- evita symlinks;
- mantiene rutas relativas al proyecto;
- muestra loading/error/truncated states;
- permite refrescar.

El panel puede colapsarse y su visibilidad se controla desde Settings → Interface.

---

## 10. Menciones de archivos con `@`

GPi implementa menciones de archivos.

Hay dos formas:

### Click desde file tree

El usuario puede hacer click en un archivo del panel y GPi lo inserta como mención en el composer.

### Autocomplete con `@`

Al escribir `@`, GPi abre sugerencias de archivos del proyecto.

El autocomplete permite:

- filtrar por nombre/ruta;
- navegar con teclado;
- seleccionar con Enter;
- seleccionar con mouse;
- cerrar con Escape.

Las menciones se muestran como chips removibles, no como texto crudo feo dentro del input.

Al enviar el prompt, GPi agrega un bloque de contexto claro al mensaje enviado a Pi:

```text
[GPi Mentioned Project Files]
...
```

Actualmente GPi no inyecta automáticamente el contenido completo de esos archivos; le comunica a Pi qué archivos fueron mencionados para que Pi pueda inspeccionarlos con sus herramientas.

---

## 11. Adjuntos de imagen

GPi soporta adjuntar imágenes al composer y enviarlas a Pi usando soporte nativo del SDK.

No es un fallback por path ni un texto tipo “hay una imagen”. Son imágenes reales entregadas al modelo/agente mediante el canal de imágenes.

Formatos soportados:

- PNG;
- JPG/JPEG;
- WebP;
- GIF.

Límite actual:

- 10 MB por imagen.

Formas de adjuntar:

- botón Attach;
- pegar desde clipboard;
- drag and drop;
- selección múltiple desde picker.

La UI muestra thumbnails, nombre, tamaño/tipo y permite eliminar imágenes antes de enviar.

---

## 12. Envío de imágenes a Pi

Al enviar un prompt con imágenes:

- GPi mantiene el texto del usuario;
- adjunta las imágenes al mensaje;
- las pasa a Pi como imágenes nativas;
- limpia el composer al aceptar el envío;
- muestra la imagen dentro del mensaje del usuario en el timeline.

También soporta imágenes en follow-ups cuando la sesión está ocupada.

Si el prompt está vacío pero hay imágenes, GPi genera un texto útil como:

> Please inspect the attached image(s).

---

## 13. Preview modal de imágenes

Las imágenes enviadas en el timeline son clickeables.

Al hacer click:

- se abre un modal sobre la ventana;
- el fondo se oscurece y desenfoca;
- la imagen se muestra grande y centrada;
- hay una X para cerrar;
- se puede cerrar con click fuera;
- se puede cerrar con Escape.

El diseño se ajustó para que la X esté correctamente centrada.

---

## 14. Persistencia de imágenes

Inicialmente las imágenes no se restauraban después de reiniciar GPi. Eso fue corregido.

Ahora:

- GPi guarda los archivos de imagen en `userData/attachments/images/`;
- el workspace guarda solo metadata liviana y la ruta del archivo;
- al abrir GPi, las imágenes se rehidratan desde disco;
- no se guarda base64 grande dentro del `workspace.json`.

Si el archivo físico desaparece, GPi muestra un placeholder claro:

> Preview unavailable — The stored attachment file could not be loaded.

---

## 15. Runtime Manager de Pi

GPi incluye una sección Runtime para detectar y manejar Pi.

Detecta:

- si `pi` existe en PATH;
- versión instalada de Pi;
- si `pnpm` existe;
- si `npm` existe;
- versiones de npm/pnpm;
- comando recomendado de instalación.

Orden de preferencia:

1. `pnpm add -g @earendil-works/pi-coding-agent`
2. `npm install -g @earendil-works/pi-coding-agent`

La detección es read-only. No modifica nada.

La instalación solo ocurre si el usuario toca explícitamente `Install Pi`.

---

## 16. Install Pi controlado

GPi tiene una API para instalar Pi usando npm/pnpm, pero no la ejecuta automáticamente.

La instalación:

- usa comandos oficiales;
- usa arrays de argumentos, no strings shell sueltos;
- captura output;
- captura errores;
- vuelve a detectar Pi después;
- bloquea instalación si Pi ya está disponible, salvo force explícito.

Si la instalación termina pero Windows todavía no ve `pi` en PATH, GPi muestra una guía clara:

- cerrar y reabrir GPi;
- reiniciar terminal/sesión;
- verificar global bin de npm/pnpm.

---

## 17. Settings

GPi tiene Settings con secciones separadas.

### Runtime

Muestra:

- estado de Pi CLI;
- estado de pnpm;
- estado de npm;
- comando de instalación preferido;
- botón Install Pi si falta Pi;
- botón Update Pi si hay update;
- mensajes de error/log.

### Updates

Muestra updates de GPi como app.

La separación es intencional:

- Runtime = Pi CLI / motor;
- Updates = GPi app.

### Interface

Incluye toggles de UI, como visibilidad del panel de archivos del proyecto.

### Revert

Configura comportamiento de revert-safe edits.

### Onboarding / Continuity

Maneja instalación y actualización de workflow skills.

---

## 18. Updater de GPi

GPi puede detectar nuevas releases desde GitHub.

La app consulta releases de:

```text
https://github.com/SynrgStudio/gpi/releases
```

Cuando hay una versión nueva:

1. Settings muestra que hay update.
2. El usuario toca `Update GPi`.
3. GPi descarga el installer dentro de `userData/updates`.
4. El botón cambia a `Install Update`.
5. Al instalar, GPi lanza el installer y cierra la app.

La app valida que el instalador esté dentro del directorio controlado de updates.

---

## 19. Release notes y changelog

GPi usa `CHANGELOG.md` como fuente de verdad para releases.

El flujo de release:

- exige que haya sección para la versión;
- usa esas notas como cuerpo del GitHub Release;
- falla si falta changelog para el tag.

También existe un modal post-update:

- aparece una vez después de cambiar versión;
- muestra release notes desde GitHub;
- si no hay conexión, usa metadata local guardada durante descarga;
- no aparece como molestia permanente.

---

## 20. Windows installer

GPi tiene packaging de Windows con Inno Setup.

El installer:

- genera `.exe` versionado;
- instala la app;
- usa assets de logo;
- empaqueta recursos necesarios;
- incluye skills necesarios;
- prepara releases de GitHub.

El flujo Windows fue validado end-to-end en releases anteriores.

---

## 21. Startup splash e iconos

GPi tiene splash inicial visual.

Al abrir:

- muestra overlay tipo glass con logo GPi;
- evita pantalla negra mientras carga;
- desaparece cuando la app está lista;
- no bloquea indefinidamente por checks lentos.

También se integraron iconos para app/installer/taskbar.

---

## 22. Continuity Workflow Skills

GPi incluye skills de continuidad:

- `init-cont`
- `plan-cont`
- `start-cont`
- `end-cont`

Sirven para manejar trabajo largo de forma resumible.

El flujo es:

```text
/init-cont  -> inicializar continuidad
/plan-cont  -> planificar cola
/start-cont -> ejecutar cola
/fin-cont   -> cerrar/archivar
```

GPi no instala estos skills sin permiso.

Cuando faltan:

- muestra onboarding;
- permite preview;
- instala solo con aprobación explícita.

También puede actualizar los skills si detecta cambios.

---

## 23. Flujo visual de continuidad

GPi guía el flujo de continuidad desde el composer.

El botón cambia según estado:

- Install;
- Initialize;
- Plan;
- Start;
- End.

También distingue casos donde ya hubo trabajo y conviene mostrar Plan y Start como acciones separadas.

Esto evita que el usuario tenga que recordar comandos exactos.

---

## 24. Revert-safe mode y snapshots

GPi tiene un modo de seguridad para cambios hechos por Pi.

Cuando está activo:

- GPi agrega instrucciones al prompt para que Pi use herramientas de lectura/edición de forma más declarativa;
- GPi captura snapshots antes/después de cambios;
- permite ver preview de revert;
- permite revertir archivos modificados por un mensaje específico;
- detecta conflictos si el archivo cambió después.

Los snapshots se guardan fuera del workspace principal, en el área de datos de usuario.

---

## 25. Compaction

GPi expone controles de compaction de sesión.

Permite:

- compactar una sesión seleccionada;
- abortar compaction;
- ver si una sesión está compactando;
- configurar auto-compaction cuando el handle lo soporta.

Esto ayuda con sesiones largas.

---

## 26. Selector de modelo y thinking level

GPi puede pedir opciones de modelo de una sesión activa y cambiarlas.

Desde la UI se puede:

- ver modelo actual;
- cambiar provider/modelo;
- cambiar thinking level si la sesión lo soporta.

Esto depende de las capacidades expuestas por Pi.

---

## 27. Project Git Context Badge

GPi tiene un badge git en el header de sesión.

Usa el logo oficial de Git como indicador visual.

El color representa estado:

- verde: repo limpio;
- amarillo: cambios locales;
- azul: ahead/behind con remoto;
- violeta: detached HEAD;
- rojo: conflicto/error;
- gris: no git / desconocido.

El badge no muestra texto en el header para no ensuciar la UI.

Al hacer hover o click abre un popover con información completa.

---

## 28. Popover de contexto git

El popover muestra:

- si el proyecto es repo git;
- branch actual;
- si está detached;
- upstream;
- commits ahead/behind;
- staged;
- modified;
- deleted;
- untracked;
- conflicts;
- último commit;
- autor del último commit;
- archivos de contexto detectados.

Se actualiza automáticamente cada pocos segundos mientras la app está visible.

El botón manual de refresh fue eliminado porque el estado debe reflejarse solo.

---

## 29. Archivos de contexto detectados

GPi detecta archivos útiles del proyecto:

- `AGENTS.md`;
- `README.md` o variantes `README.*`;
- `.pi/settings.json`.

El popover muestra si existen o faltan.

Los faltantes se muestran con gris suave para que no parezcan errores graves.

---

## 30. Quick switcher y command palette

GPi tiene navegación rápida por teclado.

Permite:

- abrir selector de proyectos/sesiones;
- buscar sesiones;
- ejecutar comandos de la app;
- saltar a sesiones que requieren atención.

Esto vuelve más cómodo manejar múltiples proyectos/sesiones.

---

## 31. Manejo de errores recuperables

GPi intenta mostrar errores como acciones recuperables, no como fallos crípticos.

Ejemplos:

- falta Pi;
- falta archivo de sesión;
- error de compaction;
- error de modelo;
- error de update;
- path inválido;
- proyecto sin git;
- git no disponible.

La dirección general es que cada problema tenga una explicación y un próximo paso.

---

## 32. Documentación y blog estático

GPi tiene un sitio estático en `docs/`.

Incluye:

- blog posts en Markdown;
- build estático de posts;
- `docs/posts.json` generado;
- GitHub Pages.

Hay scripts para construir docs y publicar contenido.

El estilo buscado es sobrio/editorial, no landing page exagerada.

---

## 33. README renovado

El README fue actualizado con:

- header visual;
- logo;
- badges estilo Shields.io;
- links a Docs / Releases / Changelog;
- descripción más clara;
- atribución del Git logo.

Badges actuales:

- CI;
- release;
- platform;
- runtime;
- status.

---

## 34. Créditos y licencias de assets

El logo de Git usado en el badge fue agregado como asset.

Atribución documentada:

> Git logo by Jason Long, licensed under Creative Commons Attribution 3.0 Unported.

---

## 35. Releases publicadas

Hasta ahora se publicaron releases hasta:

```text
v0.0.11
```

### v0.0.9

Incluyó:

- file tree;
- menciones `@`;
- context injection de archivos;
- toggle de panel de archivos;
- fixes de performance visual del file tree.

### v0.0.10

Incluyó:

- adjuntos de imagen;
- envío nativo de imágenes a Pi;
- runtime detection de Pi/npm/pnpm;
- Runtime settings;
- recovery si falta Pi;
- eliminación de sesiones locales;
- persistencia de imágenes post-restart.

### v0.0.11

Incluyó:

- project git context badge;
- popover de git/context files;
- README renovado;
- Git logo asset y atribución.

---

## 36. Validaciones realizadas

Durante el desarrollo se validó repetidamente:

```bash
npm run check
```

También se corrieron tests unitarios cuando hubo cambios en reducers/store:

```bash
npm run test:unit
```

Validaciones manuales confirmadas por el usuario:

- updater de GPi;
- splash/icon;
- file mentions;
- image paste/send/render;
- image preview modal;
- Runtime settings instalado;
- git badge auto-refresh clean/dirty;
- popover de git context;
- visual del README/header.

---

## 37. Cosas implementadas pero pendientes de validación manual completa

Hay algunas partes que existen pero siguen marcadas como parciales porque requieren entornos concretos:

### Install Pi desde GPi

Implementado, pero falta probar en sandbox o máquina sin Pi.

### `pi update`

Implementado desde Runtime, pero falta validar en una situación donde actualizar Pi globalmente sea aceptable.

### Missing-Pi recovery

Implementado, pero falta simular Pi faltante y crear sesión para validar todo el flujo.

### Estados git raros

El badge funciona, pero sería ideal validar manualmente:

- detached HEAD;
- conflictos;
- ahead/behind real;
- no git folder.

---

## 38. Pendientes grandes del roadmap

### Windows “Open in GPi”

Falta implementar:

- opción en installer;
- context menu de Windows Explorer;
- abrir GPi con folder argument;
- crear/seleccionar proyecto desde ruta recibida;
- manejar segunda instancia.

### Linux packaging

Falta implementar:

- tarball Linux;
- `.deb`;
- assets Linux en release;
- updater platform-aware.

### Project context extendido

El badge git cubre una parte importante de `T017`, pero se podrían agregar más recovery cards y acciones.

---

## 39. Estado actual del producto

GPi ya es una app funcional para trabajar con Pi en modo cockpit.

Hoy permite:

- manejar proyectos;
- crear sesiones Pi;
- importar sesiones Pi;
- enviar prompts;
- ver timeline operativo;
- adjuntar imágenes;
- mencionar archivos;
- ver estado git;
- ver contexto del proyecto;
- gestionar Runtime Pi;
- actualizar GPi;
- usar workflow skills de continuidad;
- usar compaction;
- tener post-update notes;
- trabajar con una UI persistente y visual.

Todavía no es `0.1.0` porque faltan principalmente:

- cerrar validaciones Runtime;
- Windows Open in GPi;
- mejor onboarding inicial;
- decidir alcance Linux;
- polish final de recovery states.

---

## 40. Resumen final

GPi pasó de ser un shell visual/mock-first a una app con funcionalidades reales de producto:

- conecta con Pi;
- maneja sesiones;
- entiende proyectos;
- muestra archivos;
- adjunta imágenes;
- conserva imágenes;
- visualiza git;
- guía instalación/runtime;
- actualiza la app;
- soporta continuidad;
- empieza a tener identidad visual/documental.

La dirección del producto está clara:

> GPi no es otro agente. GPi es la cabina persistente, visual y operativa para trabajar con Pi en proyectos reales.
