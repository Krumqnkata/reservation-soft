/** Универсален модел: всеки бизнес се описва само чрез конфигурация. */
export type Minutes = number; // минути от полунощ

export interface Resource {
  id: string;
  name: string;
  /** Колко "места" поема едновременно (маса за 4, зала за 30, стол = 1). */
  capacity: number;
  tags: string[];
}

export interface Service {
  id: string;
  name: string;
  duration: Minutes;
}

export interface BusinessConfig {
  id: string;
  name: string;
  kind: string;
  unitLabel: string; // "човека", "места"...
  open: Minutes;
  close: Minutes;
  slotStep: Minutes;
  /** Дни от седмицата, в които се работи (0 = неделя). */
  workDays: number[];
  maxParty: number;
  resources: Resource[];
  services: Service[];
}

export interface Booking {
  id: string;
  businessId: string;
  resourceId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  start: Minutes;
  end: Minutes;
  party: number;
  customer: string;
}

export type BookingInput = Omit<Booking, "id">;

export type ValidationError =
  | { code: "closed-day" }
  | { code: "outside-hours" }
  | { code: "invalid-range" }
  | { code: "party-too-large"; max: number }
  | { code: "capacity"; used: number; capacity: number }
  | { code: "unknown-resource" }
  | { code: "empty-customer" };
