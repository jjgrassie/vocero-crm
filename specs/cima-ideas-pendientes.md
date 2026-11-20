# Ideas pendientes — fork Cima (cimachat.vet-systems.com)

Estado: **en pausa** (2026-11-19). Primero se confirma en uso real que la
vista Pipeline de la bandeja funciona bien (commit `b063514`). Nada de esto
está construido.

## 1. Clasificación de mensajes antes del bot

Objetivo: que el bot (Nea) solo conteste a clientes potenciales y lo demás
quede con el humano.

Propuesta: filtro en el CRM **antes** del despacho al cerebro
(`src/server/dispatch/encolar.ts`), en capas:

1. **Identidad**: número ya registrado (contacto existente, `ai_paused`, o con
   cierta etiqueta) → humano, sin gastar IA.
2. **Palabras clave**: precio, costo, horario, cuánto… → prospecto.
3. **IA** (modelo barato, una vez por conversación nueva) solo para lo ambiguo.
4. Falla la IA o no hay llave → humano (nunca se queda sin atender).

Reglas propuestas:
- La clasificación pone **etiqueta** en la tarjeta; **no mueve columnas** del
  pipeline (solo Terminada → Nuevos es automático).
- Ante la duda → humano. Si gana identidad vs contenido: gana identidad.
- Categoría **Urgencia** (veterinaria): al humano de inmediato, con alerta.
- Reclasificar cuando un chat vuelve de Terminada a Nuevos.
- Medir con el Laboratorio antes de dejarla actuar.

Por decidir:
- Categorías exactas (propuesta: Prospecto, Paciente/cliente, Urgencia, Otro).
- Qué pasa con lo que no es prospecto: silencio y al humano, o mensaje corto
  automático.
- Qué hacer con el primer "Hola" sin contenido.

Hoy, sin programar: importar pacientes con teléfono marcados «sin agente».

## 2. Base de datos de clientes y mascotas + etiquetas

Hoy el contacto tiene: nombre (uno solo), teléfono (llave), notas, `ficha`
(JSON libre), `ai_paused`, origen. Importador CSV: solo nombre + teléfono.
No hay etiquetas.

Diseño propuesto (tablas relacionadas, no columnas mascota1…6):

| Tabla | Qué guarda |
|---|---|
| Contacto (dueño) | lo actual + apellido + expediente (si es por dueño) |
| Mascota | dueño, nombre, especie, raza, expediente (si es por mascota), estado |
| Vacuna | mascota, tipo, fecha aplicada, próxima fecha |
| Etiqueta | catálogo editable (nombre, color) |
| Etiqueta asignada | contacto (o mascota) ↔ etiqueta, varias por contacto |

- El CSV puede venir "ancho" (mascota1…6, fecha1…6); el importador lo acomoda.
- "Hospitalizado" es de la **mascota**, no del dueño.
- "Dr. Titular" mejor como **campo** (catálogo de doctores), no etiqueta.
- Considerar **varios teléfonos por dueño** (familiares).
- Exponer mascotas/vacunas/etiquetas al bot en `/api/bot/context`.
- Futuro: recordatorios de vacuna con plantilla de Meta (costo por mensaje).
- Riesgos: datos que envejecen (reimportar/sincronizar), aviso de privacidad.

Preguntas abiertas:
1. ¿Expediente por dueño o por mascota? (las capturas sugieren por mascota)
2. Vacunas: ¿solo última fecha o historial con tipo y próxima?
3. Etiquetas: ¿dueño, mascota o ambos? Lista definitiva de etiquetas.
4. Sistema veterinario usado y formato de exportación (pedir CSV de ejemplo
   anonimizado).
5. Volumen aproximado de clientes y mascotas.

## Orden sugerido
1. Conectar número + Nea; validar el Pipeline en uso real.
2. Etiquetas de contacto (gestión desde el panel del chat).
3. Clientes/mascotas/vacunas + importador.
4. Clasificación de mensajes (capas 1–4).
