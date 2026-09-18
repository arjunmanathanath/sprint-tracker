import { describe, expect, it } from "vitest";
import { isBackupDue, lastDueAt, msUntilNextDue, nextDueAt, parseTime } from "./backupSchedule";

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe("backup schedule", () => {
  it("parses HH:MM and falls back to 23:58", () => {
    expect(parseTime("23:58")).toEqual({ h: 23, m: 58 });
    expect(parseTime("7:05")).toEqual({ h: 7, m: 5 });
    expect(parseTime("24:00")).toEqual({ h: 23, m: 58 });
    expect(parseTime("nope")).toEqual({ h: 23, m: 58 });
  });

  it("finds the last and next scheduled moments around midnight", () => {
    const beforeTonight = at(2026, 9, 18, 21, 0);
    expect(lastDueAt(beforeTonight, "23:58")).toEqual(at(2026, 9, 17, 23, 58));
    expect(nextDueAt(beforeTonight, "23:58")).toEqual(at(2026, 9, 18, 23, 58));

    const justAfter = at(2026, 9, 18, 23, 59);
    expect(lastDueAt(justAfter, "23:58")).toEqual(at(2026, 9, 18, 23, 58));
    expect(nextDueAt(justAfter, "23:58")).toEqual(at(2026, 9, 19, 23, 58));

    const exactly = at(2026, 9, 18, 23, 58);
    expect(lastDueAt(exactly, "23:58")).toEqual(exactly);
    expect(nextDueAt(exactly, "23:58")).toEqual(at(2026, 9, 19, 23, 58));
  });

  it("is due when the job has not run since the last scheduled moment", () => {
    const morning = at(2026, 9, 19, 9, 0);
    expect(isBackupDue(morning, null, "23:58")).toBe(true);
    // ran last night at 23:58 -> not due this morning
    expect(isBackupDue(morning, at(2026, 9, 18, 23, 58).getTime(), "23:58")).toBe(false);
    // ran two days ago -> catch-up due
    expect(isBackupDue(morning, at(2026, 9, 17, 23, 58).getTime(), "23:58")).toBe(true);
    // ran at 22:00 yesterday, app closed at 23:58 -> due (last scheduled moment was missed)
    expect(isBackupDue(morning, at(2026, 9, 18, 22, 0).getTime(), "23:58")).toBe(true);
  });

  it("waits until the next moment, never less than a second", () => {
    expect(msUntilNextDue(at(2026, 9, 18, 23, 57), "23:58")).toBe(60_000);
    expect(msUntilNextDue(at(2026, 9, 18, 23, 58), "23:58")).toBe(24 * 3_600_000);
  });
});
