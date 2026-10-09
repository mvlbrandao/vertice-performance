import { describe, expect, it } from "vitest";
import { markRecorded, wasRecorded } from "./dedupe";

describe("markRecorded / wasRecorded", () => {
  it("lembra do erro marcado e só dele", () => {
    const a = new Error("a");
    const b = new Error("a");
    expect(wasRecorded(a)).toBe(false);
    markRecorded(a);
    expect(wasRecorded(a)).toBe(true);
    expect(wasRecorded(b)).toBe(false);
  });

  it("ignora o que não é objeto, sem lançar", () => {
    expect(() => markRecorded("texto")).not.toThrow();
    expect(() => markRecorded(null)).not.toThrow();
    expect(wasRecorded("texto")).toBe(false);
    expect(wasRecorded(undefined)).toBe(false);
  });
});
