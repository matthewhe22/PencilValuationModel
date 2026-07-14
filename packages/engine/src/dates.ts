/**
 * Date helpers matching Excel's month-end conventions (EOMONTH etc.).
 * All engine dates are handled as UTC to avoid timezone drift.
 */
import type { ISODate } from './types';

const DAY_MS = 86_400_000;

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Serial day count (days since epoch, UTC). */
export function toDays(d: Date): number {
  return Math.round(d.getTime() / DAY_MS);
}

export function isoToDays(iso: ISODate): number {
  return toDays(parseISO(iso));
}

export function daysToISO(days: number): ISODate {
  return toISO(new Date(days * DAY_MS));
}

/** Excel EOMONTH: last day of the month `offset` months after date d. */
export function eomonth(d: Date, offset: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0));
}

export function eomonthISO(iso: ISODate, offset: number): ISODate {
  return toISO(eomonth(parseISO(iso), offset));
}

/** First day of the month `offset` months after date d. */
export function startOfMonth(d: Date, offset: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}

/**
 * Model start date: the valuation date if it is the 1st of a month,
 * otherwise the first day of the following month (IP_Assumptions C26).
 */
export function modelStartDate(valuationDate: ISODate): Date {
  const d = parseISO(valuationDate);
  if (d.getUTCDate() === 1) return d;
  const eom = eomonth(d, 0);
  return new Date(eom.getTime() + DAY_MS);
}

export interface Timeline {
  /** Model start (first of month) */
  start: Date;
  /** Month-end date for month m (1-based): monthEnds[0] is month 1 */
  monthEnds: Date[];
  monthEndDays: number[];
  /** Cumulative time factor (actual days / 365) at end of month m (index 0 => month 1) */
  timeFactors: number[];
  /** Model year number for month m (1..): ceil(m/12) */
  yearNumbers: number[];
  totalMonths: number;
}

/**
 * Build the monthly timeline (CF_Tenant §2.0 / Calc_DCF rows 12-15).
 * totalMonths should be discountPeriodYears*12 + 12 so the terminal-value
 * month (period+1 .. +12) is available.
 */
export function buildTimeline(valuationDate: ISODate, totalMonths: number): Timeline {
  const start = modelStartDate(valuationDate);
  const monthEnds: Date[] = [];
  const monthEndDays: number[] = [];
  const timeFactors: number[] = [];
  const yearNumbers: number[] = [];
  const startDays = toDays(start);
  let prevDays = startDays;
  let tf = 0;
  for (let m = 1; m <= totalMonths; m++) {
    const me = eomonth(start, m - 1);
    const days = toDays(me);
    monthEnds.push(me);
    monthEndDays.push(days);
    // Calc_DCF row 14/15: days in period from previous period start;
    // the first period runs from model start to first month end (inclusive of the month).
    const periodStartDays = m === 1 ? startDays : prevDays + 1;
    const daysInPeriod = days - periodStartDays + 1;
    tf += daysInPeriod / 365;
    timeFactors.push(tf);
    prevDays = days;
    yearNumbers.push(Math.ceil(m / 12));
  }
  return { start, monthEnds, monthEndDays, timeFactors, yearNumbers, totalMonths };
}

/** Whole years (365.25-day) between model start and a date, rounded up — IP_Schedule DP17. */
export function expiryModelYear(expiryDays: number, modelStartDays: number): number {
  return Math.ceil((expiryDays - modelStartDays) / 365.25);
}
