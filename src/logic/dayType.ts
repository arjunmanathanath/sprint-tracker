import type { DayType } from "../types";
import { dayOfWeek, type ISODate } from "./dates";

/** Saudi week: Tuesday = rest/cushion, Fri+Sat = weekend, Sun/Mon/Wed/Thu = weekday. */
export function dayTypeFor(date: ISODate): DayType {
  const d = dayOfWeek(date); // Sun=0 ... Sat=6
  if (d === 2) return "tuesday";
  if (d === 5 || d === 6) return "weekend";
  return "weekday";
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: "weekday",
  tuesday: "rest / cushion",
  weekend: "weekend",
};
