import type { Booking, BookingInput, BusinessConfig, Minutes, ValidationError } from "./types";

/**
 * BookingIndex: Map<"resourceId|date", Booking[]> сортиран по start.
 * Проверката на конфликт сканира само една кофа (ресурс+ден), а не всички резервации.
 */
export type BookingIndex = Map<string, Booking[]>;

export const bucketKey = (resourceId: string, date: string) => `${resourceId}|${date}`;

/** Двоично търсене: първият индекс с start >= value. O(log n). */
export function lowerBound(list: Booking[], value: Minutes): number {
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.start < value) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function buildIndex(bookings: Booking[]): BookingIndex {
  const idx: BookingIndex = new Map();
  for (const b of bookings) {
    const k = bucketKey(b.resourceId, b.date);
    const arr = idx.get(k);
    if (arr) arr.push(b); else idx.set(k, [b]);
  }
  for (const arr of idx.values()) arr.sort((a, b) => a.start - b.start);
  return idx;
}

/** Инкрементално вмъкване (immutable за кофата) – O(log n + n) вместо пълно преиндексиране. */
export function indexInsert(idx: BookingIndex, b: Booking): BookingIndex {
  const k = bucketKey(b.resourceId, b.date);
  const arr = idx.get(k) ?? [];
  const pos = lowerBound(arr, b.start);
  const next = new Map(idx);
  next.set(k, [...arr.slice(0, pos), b, ...arr.slice(pos)]);
  return next;
}

export function indexRemove(idx: BookingIndex, b: Booking): BookingIndex {
  const k = bucketKey(b.resourceId, b.date);
  const arr = idx.get(k);
  if (!arr) return idx;
  const next = new Map(idx);
  const filtered = arr.filter((x) => x.id !== b.id);
  if (filtered.length) next.set(k, filtered); else next.delete(k);
  return next;
}

/**
 * Максимална едновременна заетост в [start,end) – sweep line по събития.
 * Само резервациите с start < end участват (двоично търсене отрязва останалите).
 */
export function peakUsage(
  list: Booking[], start: Minutes, end: Minutes, ignoreId?: string,
): number {
  const limit = lowerBound(list, end);
  const events: [Minutes, number][] = [];
  for (let i = 0; i < limit; i++) {
    const b = list[i]!;
    if (b.end <= start || b.id === ignoreId) continue;
    events.push([Math.max(b.start, start), b.party], [b.end, -b.party]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, peak = 0;
  for (const [, d] of events) { cur += d; if (cur > peak) peak = cur; }
  return peak;
}

export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function validate(
  cfg: BusinessConfig, idx: BookingIndex, input: BookingInput, ignoreId?: string,
): ValidationError | null {
  const res = cfg.resources.find((r) => r.id === input.resourceId);
  if (!res) return { code: "unknown-resource" };
  if (!input.customer.trim()) return { code: "empty-customer" };
  if (!cfg.workDays.includes(weekday(input.date))) return { code: "closed-day" };
  if (input.end <= input.start) return { code: "invalid-range" };
  if (input.start < cfg.open || input.end > cfg.close) return { code: "outside-hours" };
  const max = Math.min(cfg.maxParty, res.capacity);
  if (input.party > max) return { code: "party-too-large", max };
  const used = peakUsage(idx.get(bucketKey(res.id, input.date)) ?? [], input.start, input.end, ignoreId);
  if (used + input.party > res.capacity) return { code: "capacity", used, capacity: res.capacity };
  return null;
}

export interface Slot { start: Minutes; end: Minutes; free: number; }

/** Всички слотове за ресурс/ден с оставен капацитет. */
export function slotsFor(
  cfg: BusinessConfig, idx: BookingIndex, resourceId: string, date: string, duration: Minutes,
): Slot[] {
  const res = cfg.resources.find((r) => r.id === resourceId);
  if (!res || !cfg.workDays.includes(weekday(date))) return [];
  const list = idx.get(bucketKey(resourceId, date)) ?? [];
  const out: Slot[] = [];
  for (let t = cfg.open; t + duration <= cfg.close; t += cfg.slotStep) {
    out.push({ start: t, end: t + duration, free: res.capacity - peakUsage(list, t, t + duration) });
  }
  return out;
}

export const fmt = (m: Minutes) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseTime = (s: string): Minutes => {
  const [h = "0", m = "0"] = s.split(":");
  return Number(h) * 60 + Number(m);
};
