import { describe, expect, it } from "vitest";
import { buildIndex, validate } from "./index";
import { BUSINESSES } from "./data";
import { initState, reducer } from "./store";
import type { Booking } from "./types";

const clinic = BUSINESSES.find((b) => b.id === "clinic")!;
const bistro = BUSINESSES.find((b) => b.id === "bistro")!;
const MON = "2026-11-23";
const base = (o: Partial<Booking>): Booking => ({
  id: "x", businessId: "clinic", resourceId: "dr-ivanova", serviceId: "check",
  date: MON, start: 600, end: 630, party: 1, customer: "Тест", ...o,
});

describe("валидация на резервации", () => {
  it("отхвърля припокриване при ресурс с капацитет 1", () => {
    const idx = buildIndex([base({ id: "a", start: 600, end: 660 })]);
    expect(validate(clinic, idx, base({ start: 630, end: 690 }))?.code).toBe("capacity");
  });
  it("допуска долепени интервали (край = начало)", () => {
    const idx = buildIndex([base({ id: "a", start: 600, end: 660 })]);
    expect(validate(clinic, idx, base({ start: 660, end: 690 }))).toBeNull();
  });
  it("сумира гостите спрямо капацитета на масата", () => {
    const b = (o: Partial<Booking>) => base({ businessId: "bistro", resourceId: "t-window", start: 780, end: 870, ...o });
    const idx = buildIndex([b({ id: "a", party: 3 })]);
    expect(validate(bistro, idx, b({ party: 1 }))).toBeNull();
    expect(validate(bistro, idx, b({ party: 2 }))?.code).toBe("capacity");
  });
  it("отхвърля почивен ден и извън работно време", () => {
    expect(validate(clinic, new Map(), base({ date: "2026-11-22" }))?.code).toBe("closed-day");
    expect(validate(clinic, new Map(), base({ start: 1050, end: 1110 }))?.code).toBe("outside-hours");
  });
  it("промяна не се конфликтва със самата себе си", () => {
    let s = initState([base({ id: "a" })]);
    s = reducer(s, { type: "update", id: "a", input: { ...base({}), start: 615, end: 645 } });
    expect(s.lastError).toBeNull();
    expect(s.byId.get("a")?.start).toBe(615);
  });
  it("отказът освобождава слота", () => {
    let s = initState([base({ id: "a" })]);
    s = reducer(s, { type: "cancel", id: "a" });
    s = reducer(s, { type: "create", id: "b", input: base({}) });
    expect(s.lastError).toBeNull();
  });
});
