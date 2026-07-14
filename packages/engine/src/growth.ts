/**
 * Growth-rate machinery: IP_Assumptions §8 (CPI / capex / outgoings / car parking)
 * and §9 (market rent growth by profile).
 */
import type { GrowthProfileName, ValuationInputs } from './types';

export interface GrowthContext {
  /** Annual rate for a model year (1-based year; year 0 row is the base row) */
  cpi: (year: number) => number;
  capex: (year: number) => number;
  outgoings: (year: number) => number;
  carParking: (year: number) => number;
  /** Market growth for a named profile in a model year (§9.3 "Applied" table) */
  market: (profile: GrowthProfileName, year: number) => number;
  /** Compound capex index for model year y (K191.. : index 1 at year 0) */
  capexIndex: (year: number) => number;
  /** Compound outgoings index for model year y */
  outgoingsIndex: (year: number) => number;
  /** 10-year average compound CPI (IP_Assumptions J204) */
  cpi10yr: number;
}

function clampYear(year: number, max: number): number {
  return Math.min(Math.max(year, 1), max);
}

export function buildGrowthContext(inputs: ValuationInputs): GrowthContext {
  const rows = inputs.growth; // index = model year 0..11
  const maxYear = rows.length - 1;
  const get = (sel: (r: (typeof rows)[number]) => number) => (year: number) =>
    sel(rows[clampYear(year, maxYear)]);

  const cpi = get((r) => r.cpi);
  const capex = get((r) => r.capex);
  const outgoings = get((r) => r.outgoings);
  const carParking = get((r) => r.carParking);

  const market = (profile: GrowthProfileName, year: number): number => {
    const y = clampYear(year, maxYear);
    switch (profile) {
      case 'CPI':
        return cpi(y);
      case 'Default - Office':
        return inputs.marketGrowth.officeGrowth[Math.min(y, inputs.marketGrowth.officeGrowth.length - 1)] ?? 0;
      case 'Default - Retail':
        return inputs.marketGrowth.retailGrowth[Math.min(y, inputs.marketGrowth.retailGrowth.length - 1)] ?? 0;
      case 'Car Parking':
        return carParking(y);
      default:
        return 0;
    }
  };

  const compound = (rate: (y: number) => number) => {
    const idx: number[] = [1];
    for (let y = 1; y <= maxYear; y++) idx.push(idx[y - 1] * (1 + rate(y)));
    return (year: number) => idx[Math.min(Math.max(year, 0), maxYear)];
  };

  const capexIndex = compound(capex);
  const outgoingsIndex = compound(outgoings);

  // J204 = RATE(10, 0, -1, index at year 10)
  const cpiIndex = compound(cpi);
  const cpi10yr = Math.pow(cpiIndex(10), 1 / 10) - 1;

  return { cpi, capex, outgoings, carParking, market, capexIndex, outgoingsIndex, cpi10yr };
}

export const monthlyRate = (annual: number): number => Math.pow(1 + annual, 1 / 12) - 1;

/** RATE(n,0,-pv,fv): compound annual growth between two values */
export function cagr(n: number, from: number, to: number): number {
  if (from <= 0 || to <= 0 || n <= 0) return 0;
  return Math.pow(to / from, 1 / n) - 1;
}
