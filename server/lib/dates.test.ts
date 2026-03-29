import { describe, it, expect } from "vitest";
import { startOfDay, startOfWeek, startOfMonth } from "./dates";

describe("startOfDay", () => {
  it("sets hours, minutes, seconds, ms to 0", () => {
    const date = new Date("2025-06-15T14:30:45.123Z");
    const result = startOfDay(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("preserves the date", () => {
    const date = new Date("2025-06-15T14:30:45.123Z");
    const result = startOfDay(date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(result.getDate()).toBe(date.getDate());
  });

  it("does not mutate the input date", () => {
    const date = new Date("2025-06-15T14:30:45.123Z");
    const original = date.getTime();
    startOfDay(date);
    expect(date.getTime()).toBe(original);
  });
});

describe("startOfWeek", () => {
  it("returns Sunday of the current week", () => {
    // June 18, 2025 is a Wednesday (day 3)
    const wednesday = new Date(2025, 5, 18, 10, 30);
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(15); // June 15 is that Sunday
  });

  it("returns the same day when input is Sunday", () => {
    const sunday = new Date(2025, 5, 15, 10, 30);
    const result = startOfWeek(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it("zeroes time components", () => {
    const date = new Date(2025, 5, 18, 14, 30, 45, 123);
    const result = startOfWeek(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const date = new Date(2025, 5, 18, 10, 30);
    const original = date.getTime();
    startOfWeek(date);
    expect(date.getTime()).toBe(original);
  });

  it("handles Saturday (end of week)", () => {
    // June 21, 2025 is a Saturday (day 6)
    const saturday = new Date(2025, 5, 21, 10, 30);
    const result = startOfWeek(saturday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(15);
  });
});

describe("startOfMonth", () => {
  it("returns the 1st of the current month", () => {
    const date = new Date(2025, 5, 18, 10, 30);
    const result = startOfMonth(date);
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(5);
    expect(result.getFullYear()).toBe(2025);
  });

  it("returns the same day when input is the 1st", () => {
    const first = new Date(2025, 5, 1, 10, 30);
    const result = startOfMonth(first);
    expect(result.getDate()).toBe(1);
  });

  it("zeroes time components", () => {
    const date = new Date(2025, 5, 18, 14, 30, 45, 123);
    const result = startOfMonth(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const date = new Date(2025, 5, 18, 10, 30);
    const original = date.getTime();
    startOfMonth(date);
    expect(date.getTime()).toBe(original);
  });
});
