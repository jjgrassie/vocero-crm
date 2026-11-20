"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Lock, Paperclip, Search } from "lucide-react";
import type { ConversationDto, InboxStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { formatTime } from "./helpers";
import {
  COLUMNAS,
  coincide,
  esEtapa,
  esperaMs,
  formatEspera,
  resumen,
} from "@/lib/pipeline-bandeja";

/**
 * Pipeline de la bandeja (fork Cima): las conversaciones en tres columnas
 * que se mueven a mano arrastrando la tarjeta. Las reglas viven en
 * `src/lib/pipeline-bandeja.ts`.
 */
export function InboxPipeline({
  conversations,
  selectedId,
  onOpen,
  onMove,
}: {
  conversations: ConversationDto[] | null;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: InboxStage) => void;
}) {
  const [q, setQ] = useState("");
  const [activa, setActiva] = useState<ConversationDto | null>(null);
  // Reloj de la espera: «Esperando 27 min» sube solo, sin recargar.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Un clic quieto abre el chat; arrastrar empieza a los 6 px.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const todas = useMemo(() => conversations ?? [], [conversations]);
  const visibles = useMemo(() => todas.filter((c) => coincide(c, q)), [todas, q]);
  const r = resumen(todas, ahora);

  function onDragStart(e: DragStartEvent) {
    setActiva(todas.find((c) => c.id === String(e.active.id)) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setActiva(null);
    const destino = e.over?.id;
    if (!esEtapa(destino)) return;
    const c = todas.find((x) => x.id === String(e.active.id));
    if (!c || c.inboxStage === destino) return;
    onMove(c.id, destino);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--hueco)]">
      <header className="flex flex-col gap-3 border-b bg-background px-3 py-3 lg:tarjeta lg:border-b-0 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Pipeline de conversaciones</h2>
            <p className="text-[12px] text-text-3">
              Mueve cada chat a mano para que ningún cliente se quede sin respuesta
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium">
            {r.mayorEsperaMs !== null && (
              <span className="rounded-md bg-danger-soft px-2 py-1 text-danger-text">
                Mayor espera <b className="tabular-nums">{formatEspera(r.mayorEsperaMs)}</b>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-text-3" />
              {r.total} conversaciones
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              {r.sinLeer} sin leer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {r.porAtender} por atender
            </span>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-border-strong bg-subtle px-3 py-2 text-[13px] focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 shrink-0 text-text-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversaciones o contactos…"
            aria-label="Buscar en el pipeline"
            className="w-full bg-transparent outline-none placeholder:text-text-3"
          />
        </label>
      </header>

      <div className="min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto px-3 pb-3 sm:snap-none lg:px-0">
        {conversations === null ? (
          <p className="p-6 text-[13px] text-text-3">Cargando conversaciones…</p>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex h-full gap-3">
              {COLUMNAS.map((col) => (
                <Columna
                  key={col.id}
                  col={col}
                  convs={visibles.filter((c) => c.inboxStage === col.id)}
                  ahora={ahora}
                  selectedId={selectedId}
                  onOpen={onOpen}
                />
              ))}
            </div>
            <DragOverlay>
              {activa ? <Tarjeta c={activa} ahora={ahora} overlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function Columna({
  col,
  convs,
  ahora,
  selectedId,
  onOpen,
}: {
  col: (typeof COLUMNAS)[number];
  convs: ConversationDto[];
  ahora: number;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={col.titulo}
      data-columna={col.id}
      className={cn(
        "flex h-full w-[300px] shrink-0 snap-start flex-col rounded-lg border border-border-strong bg-subtle transition-[box-shadow,border-color] xl:w-auto xl:min-w-[280px] xl:flex-1",
        isOver && "border-brand ring-[3px] ring-brand-soft"
      )}
    >
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13.5px] font-bold tracking-tight">
            <span className={cn("h-2 w-2 rounded-full", col.punto)} />
            {col.titulo}
          </span>
          <span className="rounded-full border border-border-strong bg-background px-2 py-0.5 font-mono text-[11px] text-text-3">
            {convs.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-text-3">{col.descripcion}</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {convs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-[12px] text-text-3">
            Suelta aquí una conversación
          </p>
        ) : (
          convs.map((c) => (
            <Arrastrable
              key={c.id}
              c={c}
              ahora={ahora}
              selected={c.id === selectedId}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Arrastrable({
  c,
  ahora,
  selected,
  onOpen,
}: {
  c: ConversationDto;
  ahora: number;
  selected: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(c.id);
        }
      }}
      aria-label={`Abrir la conversación con ${c.contact.name}`}
      data-conversacion={c.id}
      className={cn("rounded-md", isDragging && "opacity-40")}
    >
      <Tarjeta c={c} ahora={ahora} selected={selected} />
    </div>
  );
}

function Tarjeta({
  c,
  ahora,
  selected = false,
  overlay = false,
}: {
  c: ConversationDto;
  ahora: number;
  selected?: boolean;
  overlay?: boolean;
}) {
  const espera = esperaMs(c, ahora);
  const ventanaCerrada = !c.windowOpen && !c.humanWindow?.open;
  const esAdjunto = c.preview !== null && /^(image|audio|video|document|sticker|location|contacts)$/.test(c.preview);
  return (
    <div
      className={cn(
        "cursor-grab rounded-md border border-border-strong bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        selected && "border-brand ring-2 ring-brand-soft",
        overlay && "rotate-2 shadow-pop"
      )}
    >
      <div className="flex items-start gap-2.5">
        <ContactAvatar name={c.contact.name} seed={c.contact.id} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13.5px] font-semibold">{c.contact.name}</p>
            {espera !== null ? (
              <span className="shrink-0 text-[11px] font-medium text-danger-text">
                Esperando {formatEspera(espera)}
              </span>
            ) : (
              <span className="shrink-0 font-mono text-[10.5px] text-text-3">
                {formatTime(c.lastMessageAt)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-text-2">
            {esAdjunto ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> Archivo o mensaje multimedia
              </span>
            ) : (
              c.preview ?? "Sin mensajes"
            )}
          </p>
        </div>
      </div>
      {(espera !== null || c.unreadCount > 0 || ventanaCerrada) && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          {ventanaCerrada && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-medium text-warning-text">
              <Lock className="h-2.5 w-2.5" /> Ventana cerrada
            </span>
          )}
          {espera !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-medium text-danger-text">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" /> por atender
            </span>
          )}
          {c.unreadCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-success px-1 text-[10.5px] font-bold text-white">
              {c.unreadCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
