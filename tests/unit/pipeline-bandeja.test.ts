import { describe, expect, it } from "vitest";
import type { ConversationDto } from "@/lib/types";
import {
  coincide,
  esEtapa,
  esperaMs,
  formatEspera,
  resumen,
} from "@/lib/pipeline-bandeja";

const MIN = 60_000;
const AHORA = Date.parse("2026-11-19T20:00:00Z");

function conv(p: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: "cv_1",
    channel: "whatsapp",
    contact: { id: "ct_1", name: "Dorey", phone: "5215512345678" },
    stageName: null,
    aiEnabled: true,
    handoffAt: null,
    handoffReason: null,
    lastInboundAt: null,
    lastMessageAt: null,
    unreadCount: 0,
    inboxStage: "nuevos",
    waitingSince: null,
    windowOpen: true,
    windowRemainingMs: 0,
    humanWindow: null,
    composer: { media: true, structured: true, quoteReply: true },
    preview: "Hola, buenas tardes",
    anuncio: null,
    ...p,
  };
}

describe("formatEspera", () => {
  it("minutos, horas y días", () => {
    expect(formatEspera(20_000)).toBe("ahora");
    expect(formatEspera(27 * MIN)).toBe("27 min");
    expect(formatEspera(74 * MIN)).toBe("1 h 14 min");
    expect(formatEspera(120 * MIN)).toBe("2 h");
    expect(formatEspera((24 * 3 + 2) * 60 * MIN)).toBe("3 d 2 h");
  });
});

describe("esperaMs", () => {
  const esperando = new Date(AHORA - 27 * MIN).toISOString();

  it("cuenta la espera cuando lo último es del cliente", () => {
    expect(esperaMs(conv({ waitingSince: esperando }), AHORA)).toBe(27 * MIN);
    expect(
      esperaMs(conv({ waitingSince: esperando, inboxStage: "seguimiento" }), AHORA)
    ).toBe(27 * MIN);
  });

  it("no cuenta si ya respondimos o si está en Terminada", () => {
    expect(esperaMs(conv(), AHORA)).toBeNull();
    expect(
      esperaMs(conv({ waitingSince: esperando, inboxStage: "terminada" }), AHORA)
    ).toBeNull();
  });
});

describe("resumen", () => {
  it("suma conversaciones, sin leer, por atender y la mayor espera", () => {
    const r = resumen(
      [
        conv({ id: "a", unreadCount: 2, waitingSince: new Date(AHORA - 10 * MIN).toISOString() }),
        conv({ id: "b", waitingSince: new Date(AHORA - 44 * MIN).toISOString() }),
        conv({ id: "c", inboxStage: "terminada", unreadCount: 1, waitingSince: new Date(AHORA - 90 * MIN).toISOString() }),
        conv({ id: "d" }),
      ],
      AHORA
    );
    expect(r).toEqual({ total: 4, sinLeer: 2, porAtender: 2, mayorEsperaMs: 44 * MIN });
  });
});

describe("coincide y esEtapa", () => {
  it("busca por nombre, teléfono o último mensaje", () => {
    const c = conv();
    expect(coincide(c, "")).toBe(true);
    expect(coincide(c, "dor")).toBe(true);
    expect(coincide(c, "5512")).toBe(true);
    expect(coincide(c, "BUENAS")).toBe(true);
    expect(coincide(c, "precio")).toBe(false);
  });

  it("solo acepta las tres columnas", () => {
    expect(esEtapa("nuevos")).toBe(true);
    expect(esEtapa("terminada")).toBe(true);
    expect(esEtapa("ganado")).toBe(false);
    expect(esEtapa(undefined)).toBe(false);
  });
});
