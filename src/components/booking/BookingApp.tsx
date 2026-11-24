import { memo, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { BUSINESSES, addDays, isoDate, seedBookings } from "@/lib/booking/data";
import { buildIndex, fmt, parseTime, slotsFor, validate, type BookingIndex, type Slot } from "@/lib/booking/index";
import { errorText, initState, reducer } from "@/lib/booking/store";
import type { Booking, BookingInput, BusinessConfig } from "@/lib/booking/types";
import { cn } from "@/lib/utils";

const TODAY = isoDate(new Date());
const DAYS = 14;

function createSeed() {
  return seedBookings(TODAY, DAYS, 14, (cfg, list, b) => validate(cfg, buildIndex(list.filter((x) => x.date === b.date && x.resourceId === b.resourceId)), b) === null);
}

export function BookingApp() {
  // Само на клиента: симулираните данни зависят от днешната дата.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-screen bg-background" />;
  return <App />;
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initState(createSeed()));
  const [bizId, setBizId] = useState(BUSINESSES[0]!.id);
  const [date, setDate] = useState(TODAY);
  const [serviceId, setServiceId] = useState(BUSINESSES[0]!.services[0]!.id);
  const [tag, setTag] = useState<string>("all");
  const [onlyFree, setOnlyFree] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [draft, setDraft] = useState<{ resourceId: string; start: number } | null>(null);

  const cfg = useMemo(() => BUSINESSES.find((b) => b.id === bizId)!, [bizId]);
  const service = cfg.services.find((s) => s.id === serviceId) ?? cfg.services[0]!;
  const tags = useMemo(() => [...new Set(cfg.resources.flatMap((r) => r.tags))], [cfg]);
  const resources = useMemo(() => cfg.resources.filter((r) => tag === "all" || r.tags.includes(tag)), [cfg, tag]);

  const switchBiz = useCallback((id: string) => {
    const c = BUSINESSES.find((b) => b.id === id)!;
    setBizId(id); setServiceId(c.services[0]!.id); setTag("all"); setEditing(null); setDraft(null);
  }, []);

  const dayBookings = useMemo(
    () => cfg.resources.flatMap((r) => state.index.get(`${r.id}|${date}`) ?? []).sort((a, b) => a.start - b.start),
    [cfg, state.index, date],
  );

  const onPick = useCallback((resourceId: string, start: number) => { setEditing(null); setDraft({ resourceId, start }); }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-6 py-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Универсална система за резервации</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">{cfg.name}</h1>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Вид бизнес">
            {BUSINESSES.map((b) => (
              <button key={b.id} onClick={() => switchBiz(b.id)}
                className={cn("rounded-sm border px-3 py-1.5 text-sm transition-colors",
                  b.id === bizId ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground")}>
                {b.kind}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_340px]">
        <section>
          <Filters cfg={cfg} date={date} setDate={setDate} serviceId={service.id} setServiceId={setServiceId}
            tags={tags} tag={tag} setTag={setTag} onlyFree={onlyFree} setOnlyFree={setOnlyFree} />
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Работно време {fmt(cfg.open)}–{fmt(cfg.close)} · стъпка {cfg.slotStep} мин · услуга {service.duration} мин · клик върху свободен слот = нова резервация
          </p>
          <div className="mt-4 space-y-4">
            {resources.map((r) => (
              <ResourceRow key={r.id} cfg={cfg} index={state.index} resourceId={r.id} name={r.name}
                capacity={r.capacity} date={date} duration={service.duration} onlyFree={onlyFree} onPick={onPick} />
            ))}
          </div>
          <Legend />
        </section>

        <aside className="space-y-6">
          <BookingForm key={`${editing?.id ?? "new"}-${draft?.resourceId}-${draft?.start}-${bizId}`}
            cfg={cfg} date={date} serviceId={service.id} editing={editing} draft={draft}
            error={state.lastError ? errorText(state.lastError) : null}
            onSubmit={(input) => {
              if (editing) dispatch({ type: "update", id: editing.id, input });
              else dispatch({ type: "create", id: crypto.randomUUID(), input });
            }}
            onDone={() => { setEditing(null); setDraft(null); }}
            index={state.index}
          />
          <BookingList cfg={cfg} bookings={dayBookings} onEdit={(b) => { setDraft(null); setEditing(b); }}
            onCancel={(id) => dispatch({ type: "cancel", id })} />
          <p className="font-mono text-xs text-muted-foreground">Общо резервации в системата: {state.byId.size}</p>
        </aside>
      </main>
    </div>
  );
}

const Filters = memo(function Filters(p: {
  cfg: BusinessConfig; date: string; setDate: (d: string) => void; serviceId: string; setServiceId: (s: string) => void;
  tags: string[]; tag: string; setTag: (t: string) => void; onlyFree: boolean; setOnlyFree: (v: boolean) => void;
}) {
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(TODAY, i)), []);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {days.map((d) => {
          const dt = new Date(`${d}T00:00:00Z`);
          const closed = !p.cfg.workDays.includes(dt.getUTCDay());
          return (
            <button key={d} onClick={() => p.setDate(d)}
              className={cn("min-w-14 rounded-sm border px-2 py-1.5 text-center",
                d === p.date ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground",
                closed && d !== p.date && "opacity-40")}>
              <div className="font-mono text-[10px] uppercase">{dt.toLocaleDateString("bg-BG", { weekday: "short", timeZone: "UTC" })}</div>
              <div className="font-display text-lg leading-none">{dt.getUTCDate()}</div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select value={p.serviceId} onChange={(e) => p.setServiceId(e.target.value)} className="rounded-sm border border-input bg-card px-2 py-1.5">
          {p.cfg.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration} мин</option>)}
        </select>
        <select value={p.tag} onChange={(e) => p.setTag(e.target.value)} className="rounded-sm border border-input bg-card px-2 py-1.5">
          <option value="all">Всички ресурси</option>
          {p.tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.onlyFree} onChange={(e) => p.setOnlyFree(e.target.checked)} className="accent-primary" />
          Само свободни
        </label>
      </div>
    </div>
  );
});

/** Мемоизиран ред: преизчислява слотовете само при промяна в собствената си кофа от индекса. */
const ResourceRow = memo(function ResourceRow(p: {
  cfg: BusinessConfig; index: BookingIndex; resourceId: string; name: string; capacity: number;
  date: string; duration: number; onlyFree: boolean; onPick: (r: string, s: number) => void;
}) {
  const bucket = p.index.get(`${p.resourceId}|${p.date}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => slotsFor(p.cfg, p.index, p.resourceId, p.date, p.duration), [p.cfg, bucket, p.resourceId, p.date, p.duration]);
  const shown = p.onlyFree ? slots.filter((s) => s.free > 0) : slots;
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-medium">{p.name}</h3>
        <span className="font-mono text-xs text-muted-foreground">капацитет {p.capacity}</span>
      </div>
      {slots.length === 0 ? <p className="text-sm text-muted-foreground">Почивен ден.</p> : (
        <div className="flex flex-wrap gap-1">
          {shown.map((s) => <SlotChip key={s.start} slot={s} capacity={p.capacity} onPick={() => p.onPick(p.resourceId, s.start)} />)}
        </div>
      )}
    </div>
  );
});

function SlotChip({ slot, capacity, onPick }: { slot: Slot; capacity: number; onPick: () => void }) {
  const full = slot.free <= 0;
  return (
    <button disabled={full} onClick={onPick} title={`${slot.free}/${capacity} свободни`}
      className={cn("rounded-sm px-2 py-1 font-mono text-xs transition-transform",
        full ? "cursor-not-allowed bg-slot-full text-muted-foreground line-through"
          : slot.free < capacity ? "bg-slot-partial hover:-translate-y-0.5" : "bg-slot-free hover:-translate-y-0.5")}>
      {fmt(slot.start)}{capacity > 1 && !full ? <span className="ml-1 opacity-60">{slot.free}</span> : null}
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex gap-4 font-mono text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-slot-free" /> свободно</span>
      <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-slot-partial" /> частично</span>
      <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-slot-full" /> заето</span>
    </div>
  );
}

function BookingForm(p: {
  cfg: BusinessConfig; date: string; serviceId: string; editing: Booking | null;
  draft: { resourceId: string; start: number } | null; error: string | null; index: BookingIndex;
  onSubmit: (i: BookingInput) => void; onDone: () => void;
}) {
  const e = p.editing;
  const [resourceId, setResourceId] = useState(e?.resourceId ?? p.draft?.resourceId ?? p.cfg.resources[0]!.id);
  const [svc, setSvc] = useState(e?.serviceId ?? p.serviceId);
  const [start, setStart] = useState(fmt(e?.start ?? p.draft?.start ?? p.cfg.open));
  const [party, setParty] = useState(e?.party ?? 1);
  const [customer, setCustomer] = useState(e?.customer ?? "");
  const [submitted, setSubmitted] = useState(false);
  const duration = p.cfg.services.find((s) => s.id === svc)?.duration ?? 30;
  const input: BookingInput = {
    businessId: p.cfg.id, resourceId, serviceId: svc, date: e?.date ?? p.date,
    start: parseTime(start), end: parseTime(start) + duration, party, customer,
  };
  // Живa проверка за конфликт, преди изпращане.
  const live = validate(p.cfg, p.index, input, e?.id);
  const liveMsg = live && live.code !== "empty-customer" ? errorText(live) : null;

  return (
    <form className="rounded-sm border border-foreground bg-card p-5"
      onSubmit={(ev) => { ev.preventDefault(); setSubmitted(true); p.onSubmit(input); if (!live) p.onDone(); }}>
      <h2 className="text-2xl font-bold">{e ? "Промяна" : "Нова резервация"}</h2>
      <p className="font-mono text-xs text-muted-foreground">{input.date}</p>
      <div className="mt-4 space-y-3 text-sm">
        <Field label="Ресурс">
          <select value={resourceId} onChange={(x) => setResourceId(x.target.value)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5">
            {p.cfg.resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Услуга">
          <select value={svc} onChange={(x) => setSvc(x.target.value)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5">
            {p.cfg.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration} мин</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Начало (до ${fmt(input.end)})`}>
            <input type="time" step={p.cfg.slotStep * 60} value={start} onChange={(x) => setStart(x.target.value)} className="w-full rounded-sm border border-input bg-background px-2 py-1.5" />
          </Field>
          <Field label={`Брой ${p.cfg.unitLabel}`}>
            <input type="number" min={1} max={p.cfg.maxParty} value={party} onChange={(x) => setParty(Math.max(1, Number(x.target.value)))} className="w-full rounded-sm border border-input bg-background px-2 py-1.5" />
          </Field>
        </div>
        <Field label="Клиент">
          <input value={customer} onChange={(x) => setCustomer(x.target.value)} placeholder="Име" className="w-full rounded-sm border border-input bg-background px-2 py-1.5" />
        </Field>
      </div>
      {(liveMsg || (submitted && p.error)) && (
        <p role="alert" className="mt-3 rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{liveMsg ?? p.error}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={!!liveMsg}
          className="flex-1 rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {e ? "Запази" : "Резервирай"}
        </button>
        {(e || p.draft) && <button type="button" onClick={p.onDone} className="rounded-sm border border-border px-3 py-2">Отказ</button>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}

const BookingList = memo(function BookingList(p: {
  cfg: BusinessConfig; bookings: Booking[]; onEdit: (b: Booking) => void; onCancel: (id: string) => void;
}) {
  const resName = (id: string) => p.cfg.resources.find((r) => r.id === id)?.name ?? id;
  return (
    <div>
      <h2 className="text-xl font-bold">Резервации за деня <span className="font-mono text-sm text-muted-foreground">({p.bookings.length})</span></h2>
      <ul className="mt-3 max-h-[480px] divide-y divide-border overflow-y-auto border-y border-border">
        {p.bookings.length === 0 && <li className="py-3 text-sm text-muted-foreground">Няма резервации.</li>}
        {p.bookings.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-mono text-xs">{fmt(b.start)}–{fmt(b.end)} · {b.party} {p.cfg.unitLabel}</div>
              <div>{b.customer} <span className="text-muted-foreground">· {resName(b.resourceId)}</span></div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => p.onEdit(b)} className="rounded-sm border border-border px-2 py-1 text-xs hover:border-foreground">Промени</button>
              <button onClick={() => p.onCancel(b.id)} className="rounded-sm border border-border px-2 py-1 text-xs text-destructive hover:border-destructive">Откажи</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
