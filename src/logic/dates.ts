import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  isFriday,
  parseISO,
  startOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  nextSunday,
  isSunday,
} from "date-fns";

/** All app dates are local-time "YYYY-MM-DD" strings. */
export type ISODate = string;

export const WEEK_STARTS_ON = 0; // Sunday (Saudi week: Sun-Thu work, Fri-Sat weekend)

export const toISO = (d: Date): ISODate => format(d, "yyyy-MM-dd");
export const fromISO = (s: ISODate): Date => startOfDay(parseISO(s));
export const todayISO = (): ISODate => toISO(new Date());

export const addDaysISO = (s: ISODate, n: number): ISODate => toISO(addDays(fromISO(s), n));

export const daysBetween = (from: ISODate, to: ISODate): number =>
  differenceInCalendarDays(fromISO(to), fromISO(from));

export const weekStartISO = (s: ISODate): ISODate =>
  toISO(startOfWeek(fromISO(s), { weekStartsOn: WEEK_STARTS_ON }));

export const weekEndISO = (s: ISODate): ISODate =>
  toISO(endOfWeek(fromISO(s), { weekStartsOn: WEEK_STARTS_ON }));

/** Inclusive list of ISO dates from `from` to `to`. Empty if from > to. */
export const eachDayISO = (from: ISODate, to: ISODate): ISODate[] => {
  if (from > to) return [];
  return eachDayOfInterval({ start: fromISO(from), end: fromISO(to) }).map(toISO);
};

/** Days of the calendar week containing `s` (Sun..Sat). */
export const weekDaysISO = (s: ISODate): ISODate[] => eachDayISO(weekStartISO(s), weekEndISO(s));

/** Default sprint start: the next Sunday (today if today is Sunday). */
export const defaultStartDateISO = (from: Date = new Date()): ISODate =>
  isSunday(from) ? toISO(from) : toISO(nextSunday(from));

export const dayOfWeek = (s: ISODate): number => getDay(fromISO(s));

/** Last Friday of the month = the weekly-review nudge day (spec 8). */
export const isLastFridayOfMonth = (s: ISODate): boolean => {
  const d = fromISO(s);
  return isFriday(d) && addDays(d, 7).getMonth() !== d.getMonth();
};

export const formatLong = (s: ISODate): string => format(fromISO(s), "EEEE, d MMM");
export const formatShort = (s: ISODate): string => format(fromISO(s), "EEE d MMM");
export const formatDayName = (s: ISODate): string => format(fromISO(s), "EEEE");

export const minutesToHours = (min: number): string => {
  const h = min / 60;
  if (Number.isInteger(h)) return `${h} h`;
  return `${h.toFixed(1)} h`;
};

export const formatMinutes = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
};
