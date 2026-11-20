/**
 * Pipeline de la bandeja (fork Cima): lo puro del tablero de conversaciones.
 * Sin React ni base, para poder probarlo solo.
 *
 * Reglas del producto (no cambiarlas sin preguntar al dueño):
 * - Tres columnas: Nuevos, Seguimiento, Conversación terminada.
 * - Todo chat sin etapa cae en Nuevos. Abrirlo o responderlo NO lo mueve.
 * - Seguimiento y Terminada se llenan solo moviendo a mano, uno por uno.
 * - Única regla automática (en el servidor, `ingest.ts`): un mensaje del
 *   cliente en Terminada la regresa a Nuevos.
 */
import type { ConversationDto, InboxStage } from "@/lib/types";

export const COLUMNAS: ReadonlyArray<{
  id: InboxStage;
  titulo: string;
  descripcion: string;
  punto: string;
}> = [
  {
    id: "nuevos",
    titulo: "Nuevos",
    descripcion: "Conversaciones recientes que acaban de entrar",
    punto: "bg-success",
  },
  {
    id: "seguimiento",
    titulo: "Seguimiento",
    descripcion: "Conversaciones en curso que requieren atención",
    punto: "bg-warning",
  },
  {
    id: "terminada",
    titulo: "Conversación terminada",
    descripcion: "Conversaciones resueltas o cerradas",
    punto: "bg-text-3",
  },
];

export function esEtapa(v: unknown): v is InboxStage {
  return v === "nuevos" || v === "seguimiento" || v === "terminada";
}

/** «27 min», «1 h 14 min», «3 d 2 h». Menos de un minuto: «ahora». */
export function formatEspera(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) {
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d} d ${hr} h` : `${d} d`;
}

/**
 * Espera del cliente en ms, o null si no está esperando. En Terminada no se
 * cuenta: ya se dio por atendida; si el cliente escribe, vuelve a Nuevos.
 */
export function esperaMs(c: ConversationDto, ahora: number): number | null {
  if (!c.waitingSince || c.inboxStage === "terminada") return null;
  return Math.max(0, ahora - Date.parse(c.waitingSince));
}

/** Coincide con el buscador: nombre, teléfono o último mensaje. */
export function coincide(c: ConversationDto, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [c.contact.name, c.contact.phone ?? "", c.preview ?? ""].some((s) =>
    s.toLowerCase().includes(t)
  );
}

export type ResumenTablero = {
  total: number;
  sinLeer: number;
  porAtender: number;
  mayorEsperaMs: number | null;
};

/** Los números de la barra superior. */
export function resumen(convs: ConversationDto[], ahora: number): ResumenTablero {
  let sinLeer = 0;
  let porAtender = 0;
  let mayor: number | null = null;
  for (const c of convs) {
    if (c.unreadCount > 0) sinLeer++;
    const e = esperaMs(c, ahora);
    if (e !== null) {
      porAtender++;
      if (mayor === null || e > mayor) mayor = e;
    }
  }
  return { total: convs.length, sinLeer, porAtender, mayorEsperaMs: mayor };
}
