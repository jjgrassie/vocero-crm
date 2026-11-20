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

## 3. Agenda de varios doctores + recordatorios por WhatsApp

### Lo que trae Vocero hoy (bandera `AGENDA`, apagada en cimachat)
- `calendar_settings`: UN horario semanal por organización (slot, buffer,
  anticipación, días hacia adelante, zona horaria).
- `booking`: citas con estados (agendada/realizada/no_show/cancelada),
  bloqueos, origen manual o IA; pantalla Citas.
- `offered_slot`: el bot solo reserva horarios ofrecidos y libres.
- **Bloqueante para multi-doctor**: el índice único
  `booking_org_active_slot_uq` (organización + hora) impide dos citas a la
  misma hora en todo el negocio.
- Ocupado = solo citas en la base (`availability.ts#getBusyIntervals`).
- Conector Google: solo escribe eventos en un calendario; no lee ocupado.
- No hay recordatorios automáticos; sí envío manual de plantillas.

### Decisiones del dueño (2026-11-19)
- El sistema veterinario tiene agenda pero **no se usa**; hoy usan otra
  agenda que falla sobre todo por **no tener recordatorios**.
- **~10 doctores**, una sola sucursal.
- Citas de **30 a 45 min** (la duración depende del tipo de cita).
- **Sin recursos** (quirófano, consultorio).
- **Recepción agenda** a los clientes con los doctores.
- Recordatorio **24 h antes**, una plantilla, **sin botones** por ahora.
- **Sin Google Calendar**: Vocero es la única agenda (los doctores no lo usan).
- Asignación de doctor (el que elige el cliente vs. el que esté libre):
  **por evaluar**.

### Diseño propuesto
| Pieza | Cambio |
|---|---|
| Doctores | Tabla nueva: nombre, color, activo, usuario de Vocero (opcional) |
| Horario por doctor | Horario semanal + excepciones (vacaciones, días libres, comida) |
| Tipos de cita | Catálogo con duración (30/45 min) |
| Citas | `booking.doctor_id`; índice anti-empalme por doctor (no por negocio) |
| Disponibilidad | Por doctor, o combinada ("el que esté libre") |
| Pantalla | Calendario día/semana con una columna por doctor; alta manual para recepción |
| Recordatorios | Barrido periódico in-process: cita en ~24 h y sin recordatorio → plantilla de utilidad aprobada; marcar enviado (idempotente). Cancelación/reprogramación desde Vocero → su plantilla |
| Bot (Nea) | Al final: ofrecer horarios por doctor/tipo con la garantía de `offered_slot` |

### Preguntas abiertas
1. ¿Qué agenda usan hoy? ¿Hay que **migrar las citas futuras** al arrancar?
2. Asignación: ¿el cliente elige doctor, recepción asigna, o "el que esté libre"?
3. ¿Cómo ven los doctores su agenda? (usuario de Vocero con vista solo de su
   agenda, impresión del día, o resumen diario)
4. Tipos de cita exactos y su duración.
5. Texto de las plantillas (recordatorio, cancelación) para aprobarlas en Meta.
6. Volumen de citas al mes (costo de plantillas fuera de la ventana de 24 h).

## Orden sugerido
1. Conectar número + Nea; validar el Pipeline en uso real.
2. Etiquetas de contacto (gestión desde el panel del chat).
3. Clientes/mascotas/vacunas + importador.
4. Agenda por doctor + recordatorios de 24 h.
5. Bot que agenda (Nea) por doctor.
6. Clasificación de mensajes (capas 1–4).
