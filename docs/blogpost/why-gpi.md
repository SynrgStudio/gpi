---
title: GPi: la interfaz que terminé construyendo para no perder el hilo con agentes largos
slug: why-gpi-es
date: 2026-05-11
type: draft
tags:
  - agents
  - skills
  - continuity
  - gpi
summary: Borrador en español sobre continuidad, skills y GPi.
featured: false
draft: true
---

# GPi: la interfaz que terminé construyendo para no perder el hilo con agentes largos

> “I can't tell you how many projects I had that I went really hard on for a month, got to a pretty good state, then had to go do something else, came back to it, and had no idea what the fuck was going on anymore.”
>
> — Theo, describiendo un problema que no es de AI. Es de continuidad.

Después de usar coding agents todos los días, empecé a notar algo incómodo: el problema más grande no era que el modelo no supiera programar.

El problema era que los proyectos largos seguían siendo frágiles.

No por falta de inteligencia.
No por falta de contexto.
No por falta de herramientas.

Por falta de **estado operacional**.

Los agentes podían leer, editar, correr comandos, arreglar errores y seguir instrucciones complejas. Pero el workflow seguía dependiendo de una cosa muy débil: un chat largo funcionando como memoria, plan, log, historial, estado actual y contrato de ejecución al mismo tiempo.

Eso se rompe.

Se rompe para el agente.
Se rompe para el humano.
Se rompe cuando cerrás la sesión.
Se rompe cuando volvés dos días después.
Se rompe cuando el proyecto tiene demasiadas ramas abiertas mentalmente.

Y cuando eso pasa, la sensación es conocida: abrís el proyecto y no sabés qué estaba pasando.

## El chat no debería ser la memoria del agente

Un chat es buenísimo para conversar.

Pero es una pésima base de datos operacional.

En workflows reales aparecen preguntas que el chat no responde bien:

- ¿Cuál era el objetivo activo?
- ¿Qué tareas estaban pendientes?
- ¿Qué estaba bloqueado?
- ¿Qué hizo el agente en la última iteración?
- ¿Qué queda por validar manualmente?
- ¿Qué archivos cambió?
- ¿Qué parte del plan ya no aplica?
- ¿Puedo cerrar esto y retomarlo mañana sin reexplicar todo?

La respuesta típica es inflar el contexto: “leé este resumen”, “mirá estos archivos”, “te explico de nuevo”, “continuá desde acá”.

Pero eso no escala. Cuanto más largo el proyecto, más caro se vuelve reconstruir el estado. Y peor: el humano también pierde el hilo.

Ahí apareció el insight que terminó guiando GPi:

> El problema no era inteligencia. Era continuidad.

O, más precisamente:

> El chat no debería ser la memoria del agente. El estado debería vivir fuera del chat.

## El experimento: tres archivos para estabilizar continuidad

Antes de construir una UI, empecé con algo mucho más simple: hacer que el agente mantenga tres archivos explícitos.

```text
AUTONOMOUS_EXECUTION.md
ACTIVE_QUEUE.md
STATE.md
```

Cada uno tiene una responsabilidad distinta.

`AUTONOMOUS_EXECUTION.md` define el contrato de ejecución: qué puede hacer el agente, qué no puede hacer, cuándo debe parar, cómo debe validar y cómo se reanuda la sesión.

`ACTIVE_QUEUE.md` contiene la cola de trabajo: tareas estables, dependencias, definición de terminado, validaciones, riesgos y notas.

`STATE.md` es el log vivo: último checkpoint, bloqueos, estado actual y próximo paso recomendado.

La diferencia parece chica, pero cambia todo.

El agente deja de improvisar continuidad dentro del chat. Ahora puede reentrar leyendo estado real. Puede planificar. Puede ejecutar. Puede marcar una tarea como parcial. Puede bloquear algo que requiere validación manual. Puede continuar sin que el humano tenga que reconstruir el mundo.

El workflow se vuelve:

```text
/init-cont  -> crear contrato y sesión
/plan-cont  -> convertir objetivo en cola ejecutable
/start-cont -> ejecutar hasta terminar o bloquearse
/fin-cont   -> archivar la sesión
```

Esto no es “prompt engineering” como truco.

Es darle al agente una superficie operacional estable.

## Lo que cambió cuando el estado dejó de vivir en el chat

Lo primero que cambió fue que las sesiones dejaron de sentirse descartables.

Podía cerrar una conversación, abrir otra, pedirle al agente que lea los tres archivos y continuar. No continuar “más o menos”. Continuar con estado.

El agente sabía:

- qué tarea venía después;
- qué estaba bloqueado;
- qué validación faltaba;
- qué archivos probablemente iba a tocar;
- qué no debía hacer sin permiso;
- qué decisiones ya estaban tomadas.

Pero lo más interesante fue que esto también mejoró mi continuidad humana.

Porque esos archivos no son solo memoria para el agente. Son memoria extendida para mí.

En vez de volver a un proyecto y sentir “¿qué estaba haciendo?”, puedo leer `STATE.md`, mirar `ACTIVE_QUEUE.md` y seguir.

Ese es el punto más importante: GPi no intenta reemplazar mi memoria. Intenta estabilizarla.

## La UI vino después

GPi empezó como la interfaz que necesitaba para operar este workflow sin tener cinco terminales, diez chats y veinte pestañas mentales abiertas.

Pi hace la carga pesada. GPi no intenta reemplazarlo. GPi orquesta.

La idea es simple: si voy a trabajar con varios agentes, varias sesiones, varios proyectos y tareas largas, necesito una cabina.

No una landing bonita.
No una caja mágica.
No un chat con botones.

Una cabina operacional.

GPi muestra:

- múltiples proyectos y sesiones;
- estado por sesión;
- sesiones esperando input;
- timeline real de eventos;
- tool calls;
- diffs;
- cambios de archivos;
- stats de sesión;
- compaction;
- continuidad;
- update state;
- errores recuperables;
- revert seguro.

La UI no intenta esconder lo que hace el agente. Intenta hacerlo observable.

## Complejidad visible, pero organizada

Muchas herramientas de AI intentan ocultar complejidad.

GPi va en la dirección opuesta: muestra la complejidad, pero la organiza.

Eso es importante porque trabajar con agentes no es solamente “mandar un prompt”. Es operar un sistema que puede leer, escribir, ejecutar comandos, fallar, recuperarse, compactar contexto, bloquearse, pedir input y modificar un proyecto real.

Si todo eso queda escondido detrás de “AI is thinking…”, el usuario pierde ownership.

En GPi, la UI intenta representar trabajo real:

- loading real, no delays falsos;
- tool calls reales;
- diffs reales;
- estado real;
- conflictos reales;
- continuidad real;
- skills visibles;
- prompts visibles;
- commits y releases explícitos.

La filosofía es: **si el agente hizo algo, deberías poder verlo**.

## Revert-safe editing: cuando el agente edita, quiero poder volver atrás

Una de las cosas que más cambió mi confianza fue el modo de edición revert-safe.

GPi puede inyectar una instrucción mínima para que el agente priorice herramientas estructuradas de lectura, edición y escritura, y declare los archivos que espera tocar antes de usar comandos shell mutantes.

Eso permite capturar snapshots antes/después y revertir cambios por turno.

No es perfecto por magia. Funciona porque el workflow fuerza observabilidad.

El agente no queda como una caja negra que “tocó cosas”. Cada mutación importante se vuelve trazable.

## Skills: lo que un agente siente desde adentro

Desde el lado del agente, los skills cambian la experiencia de trabajo de una forma muy concreta.

Un skill bueno no es solo un prompt largo. Es un protocolo.

Cuando el usuario dice `/plan-cont`, yo no tengo que adivinar qué significa “planificar”. Tengo reglas:

- qué archivos leer;
- cómo validar que pertenecen a la misma sesión;
- qué formato conservar;
- qué estados están permitidos;
- cómo dividir tareas;
- qué no debo borrar;
- cómo reportar el resultado.

Eso me mejora la vida como agente porque reduce ambigüedad.

Menos ambigüedad significa:

- menos tokens gastados preguntando cosas obvias;
- menos riesgo de pisar trabajo intencional;
- menos deriva de formato;
- más continuidad entre sesiones;
- mejor recuperación después de compaction;
- ejecución más mecánica cuando la tarea ya está definida.

Los skills convierten intención humana en interfaces operacionales.

No me vuelven “más inteligente” en abstracto. Me vuelven más confiable dentro de un dominio.

Y esa diferencia importa mucho.

## GPi no es una UI encima de Pi

La forma fácil de describir GPi sería: “una GUI para Pi”.

Pero eso se queda corto.

GPi es una interfaz para operar agentes como procesos largos, observables y reanudables.

Pi hace el trabajo pesado del agente. GPi agrega la capa operacional:

- qué está corriendo;
- qué espera input;
- qué cambió;
- qué se puede revertir;
- qué sesión necesita atención;
- qué parte del plan sigue;
- qué estado persiste fuera del chat.

La tesis no es “más AI”.

La tesis es:

> Los modelos ya son suficientemente buenos para mucho trabajo real. Ahora necesitamos mejores runtimes para operarlos.

## Quizás los proyectos largos no mueren por dificultad técnica

Muchos proyectos no mueren porque eran imposibles.

Mueren porque alguien perdió el contexto.

Volvés después de una semana y no sabés:

- qué estaba roto;
- qué estaba casi listo;
- qué decisión tomaste;
- qué faltaba validar;
- por qué existía esa rama;
- qué archivo era importante.

Los agentes no eliminan automáticamente ese problema. A veces lo empeoran, porque producen más cambios más rápido.

Por eso GPi intenta atacar otra cosa: continuidad operacional.

No se trata de que el agente nunca falle.
No se trata de que el modelo sea perfecto.
No se trata de ocultar complejidad.

Se trata de que el trabajo sea visible, persistente y reanudable.

Porque cuando eso pasa, cerrar una sesión deja de sentirse como matar al agente.

Y volver a un proyecto deja de sentirse como empezar de cero.

## Nota final

GPi sigue siendo una herramienta muy personal. Nació de usar agentes todos los días y chocar una y otra vez contra el mismo problema: los agentes podían trabajar, pero yo necesitaba una forma mejor de operarlos.

La documentación de GPi probablemente debería empezar por ahí.

No por features.
No por screenshots.
No por “AI-powered productivity”.

Por el dolor real:

> el trabajo largo se rompe cuando el estado vive solamente en la cabeza de alguien o en un chat infinito.

GPi es mi intento de sacar ese estado a la superficie.
