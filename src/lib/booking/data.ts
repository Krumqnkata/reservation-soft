import type { Booking, BusinessConfig } from "./types";

export const BUSINESSES: BusinessConfig[] = [
  {
    id: "clinic", name: "Дентален кабинет „Усмивка“", kind: "Кабинет", unitLabel: "пациент",
    open: 8 * 60, close: 18 * 60, slotStep: 30, workDays: [1, 2, 3, 4, 5], maxParty: 1,
    resources: [
      { id: "dr-ivanova", name: "Д-р Иванова", capacity: 1, tags: ["ортодонт"] },
      { id: "dr-petrov", name: "Д-р Петров", capacity: 1, tags: ["хирург"] },
      { id: "hyg", name: "Хигиенист", capacity: 1, tags: ["почистване"] },
    ],
    services: [
      { id: "check", name: "Преглед", duration: 30 },
      { id: "clean", name: "Почистване", duration: 60 },
      { id: "surgery", name: "Манипулация", duration: 90 },
    ],
  },
  {
    id: "salon", name: "Салон „Ножица“", kind: "Салон", unitLabel: "клиент",
    open: 9 * 60, close: 20 * 60, slotStep: 15, workDays: [1, 2, 3, 4, 5, 6], maxParty: 1,
    resources: [
      { id: "chair-1", name: "Стол 1 · Мария", capacity: 1, tags: ["дамско"] },
      { id: "chair-2", name: "Стол 2 · Георги", capacity: 1, tags: ["мъжко"] },
      { id: "nails", name: "Маникюр", capacity: 2, tags: ["нокти"] },
    ],
    services: [
      { id: "cut", name: "Подстригване", duration: 45 },
      { id: "color", name: "Боядисване", duration: 120 },
      { id: "mani", name: "Маникюр", duration: 60 },
    ],
  },
  {
    id: "bistro", name: "Бистро „Кайсия“", kind: "Заведение", unitLabel: "гости",
    open: 12 * 60, close: 23 * 60, slotStep: 30, workDays: [0, 1, 2, 3, 4, 5, 6], maxParty: 10,
    resources: [
      { id: "t-window", name: "Маса до прозореца", capacity: 4, tags: ["вътре"] },
      { id: "t-garden", name: "Градина", capacity: 20, tags: ["навън"] },
      { id: "t-bar", name: "Бар", capacity: 6, tags: ["вътре"] },
    ],
    services: [
      { id: "lunch", name: "Обяд", duration: 90 },
      { id: "dinner", name: "Вечеря", duration: 120 },
    ],
  },
  {
    id: "coworking", name: "Коуъркинг „Работилница“", kind: "Зали", unitLabel: "места",
    open: 7 * 60, close: 22 * 60, slotStep: 60, workDays: [1, 2, 3, 4, 5, 6], maxParty: 30,
    resources: [
      { id: "room-a", name: "Зала А", capacity: 12, tags: ["проектор"] },
      { id: "room-b", name: "Зала Б", capacity: 30, tags: ["сцена"] },
      { id: "desks", name: "Открито пространство", capacity: 25, tags: ["бюра"] },
    ],
    services: [
      { id: "hour", name: "1 час", duration: 60 },
      { id: "half", name: "Половин ден", duration: 240 },
    ],
  },
];

const NAMES = ["Анна", "Борис", "Виктория", "Даниел", "Елена", "Иван", "Калина", "Любо", "Мила", "Никола", "Петя", "Стефан"];

/** Детерминиран генератор (mulberry32) – едни и същи симулирани данни при всяко зареждане. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return isoDate(d);
}

/** Генерира симулирани резервации, като спазва капацитета (използва същия валидатор). */
export function seedBookings(
  today: string, days: number, perDay: number,
  validate: (cfg: BusinessConfig, list: Booking[], b: Booking) => boolean,
): Booking[] {
  const r = rng(42);
  const out: Booking[] = [];
  let n = 0;
  for (const cfg of BUSINESSES) {
    for (let d = 0; d < days; d++) {
      const date = addDays(today, d);
      for (let i = 0; i < perDay; i++) {
        const res = cfg.resources[Math.floor(r() * cfg.resources.length)]!;
        const svc = cfg.services[Math.floor(r() * cfg.services.length)]!;
        const steps = Math.floor((cfg.close - cfg.open - svc.duration) / cfg.slotStep);
        const start = cfg.open + Math.floor(r() * (steps + 1)) * cfg.slotStep;
        const party = 1 + Math.floor(r() * Math.min(cfg.maxParty, res.capacity, 6));
        const b: Booking = {
          id: `seed-${n++}`, businessId: cfg.id, resourceId: res.id, serviceId: svc.id,
          date, start, end: start + svc.duration, party, customer: NAMES[Math.floor(r() * NAMES.length)]!,
        };
        if (validate(cfg, out, b)) out.push(b);
      }
    }
  }
  return out;
}
