import { buildIndex, indexInsert, indexRemove, validate, type BookingIndex } from "./index";
import { BUSINESSES } from "./data";
import type { Booking, BookingInput, ValidationError } from "./types";

/** Нормализирано състояние: byId + индекс по (ресурс, ден). */
export interface State {
  byId: Map<string, Booking>;
  index: BookingIndex;
  lastError: ValidationError | null;
}

export type Action =
  | { type: "create"; input: BookingInput; id: string }
  | { type: "update"; id: string; input: BookingInput }
  | { type: "cancel"; id: string };

export function initState(bookings: Booking[]): State {
  return { byId: new Map(bookings.map((b) => [b.id, b])), index: buildIndex(bookings), lastError: null };
}

const cfgOf = (id: string) => BUSINESSES.find((b) => b.id === id)!;

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "create": {
      const err = validate(cfgOf(action.input.businessId), state.index, action.input);
      if (err) return { ...state, lastError: err };
      const b: Booking = { ...action.input, id: action.id };
      const byId = new Map(state.byId); byId.set(b.id, b);
      return { byId, index: indexInsert(state.index, b), lastError: null };
    }
    case "update": {
      const old = state.byId.get(action.id);
      if (!old) return state;
      const err = validate(cfgOf(action.input.businessId), state.index, action.input, action.id);
      if (err) return { ...state, lastError: err };
      const b: Booking = { ...action.input, id: action.id };
      const byId = new Map(state.byId); byId.set(b.id, b);
      return { byId, index: indexInsert(indexRemove(state.index, old), b), lastError: null };
    }
    case "cancel": {
      const old = state.byId.get(action.id);
      if (!old) return state;
      const byId = new Map(state.byId); byId.delete(action.id);
      return { byId, index: indexRemove(state.index, old), lastError: null };
    }
  }
}

export function errorText(e: ValidationError): string {
  switch (e.code) {
    case "closed-day": return "Бизнесът не работи в избрания ден.";
    case "outside-hours": return "Часът е извън работното време.";
    case "invalid-range": return "Краят трябва да е след началото.";
    case "party-too-large": return `Максимум ${e.max} за този ресурс.`;
    case "capacity": return `Припокриване: заети ${e.used} от ${e.capacity} места в този интервал.`;
    case "unknown-resource": return "Непознат ресурс.";
    case "empty-customer": return "Въведете име на клиент.";
  }
}
