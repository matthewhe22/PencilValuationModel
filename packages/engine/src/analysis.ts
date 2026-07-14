/**
 * Portfolio analytics — port of OP_Analysis (top-10, expiry profile, WALE)
 * and the OP_Rates growth-forecast tables.
 */
import { eomonth, toISO, isoToDays } from './dates';
import type { Timeline } from './dates';
import { buildGrowthContext, cagr } from './growth';
import type { TenantDerived } from './schedule';
import type {
  AnalysisResults,
  ExpiryBucket,
  RatesResults,
  RatesTableRow,
  TopTenRow,
  ValuationInputs,
} from './types';

export function computeAnalysis(
  inputs: ValuationInputs,
  derived: TenantDerived[],
  timeline: Timeline,
  nla: number,
): AnalysisResults {
  const modelStartDays = timeline.monthEndDays[0] != null ? isoToDays(toISO(timeline.start)) : 0;

  // WALE (IP_Schedule GJ..GL): income- and area-weighted unexpired term
  const totalArea = derived.reduce((a, d) => a + d.row.nla, 0);
  const totalIncome = derived.reduce((a, d) => a + d.grossPassingPa, 0);
  const byAreaYears =
    totalArea > 0
      ? derived.reduce((a, d) => a + d.row.nla * d.unexpiredTermYears, 0) / totalArea
      : 0;
  const byIncomeYears =
    totalIncome > 0
      ? derived.reduce((a, d) => a + d.grossPassingPa * d.unexpiredTermYears, 0) / totalIncome
      : 0;

  // Top-10 by area / income (grouped by tag when provided, else per row)
  const groupBy = (tagOf: (d: TenantDerived) => number | null) => {
    const map = new Map<string, { name: string; nla: number; income: number; carParks: number }>();
    derived.forEach((d, i) => {
      if (d.row.status === 'Vacant') return;
      const tag = tagOf(d);
      const key = tag != null ? `tag:${tag}` : `row:${i}`;
      const cur = map.get(key) ?? {
        name: d.row.tenantName || d.row.suite,
        nla: 0,
        income: 0,
        carParks: 0,
      };
      cur.nla += d.row.nla;
      cur.income += d.grossPassingPa;
      cur.carParks += d.row.carParking.spaces;
      map.set(key, cur);
    });
    return [...map.values()];
  };

  const groupsArea = groupBy((d) => d.row.areaTag);
  const groupsIncome = groupBy((d) => d.row.incomeTag);

  const topByArea: TopTenRow[] = groupsArea
    .sort((a, b) => b.nla - a.nla)
    .slice(0, 10)
    .map((g, i) => ({
      rank: i + 1,
      name: g.name,
      value: g.nla,
      pct: nla > 0 ? g.nla / nla : 0,
      carParks: g.carParks,
    }));

  const totalGrossPassingIncome =
    totalIncome +
    inputs.otherIncome.reduce((a, s) => a + (s.switch === 'On' ? s.monthlyAmount * 12 : 0), 0);
  const topByIncome: TopTenRow[] = groupsIncome
    .sort((a, b) => b.income - a.income)
    .slice(0, 10)
    .map((g, i) => ({
      rank: i + 1,
      name: g.name,
      value: g.income,
      pct: totalGrossPassingIncome > 0 ? g.income / totalGrossPassingIncome : 0,
      carParks: g.carParks,
      ratePerSqm: g.nla > 0 ? g.income / g.nla : undefined,
    }));

  const vacantNla = derived.reduce((a, d) => a + (d.row.status === 'Vacant' ? d.row.nla : 0), 0);

  // Lease expiry profile (IP_Schedule GQ..HA): buckets year 1..10 + vacant
  const buckets: ExpiryBucket[] = [];
  buckets.push({
    label: 'Vacant',
    yearEnd: null,
    tenantCount: derived.filter((d) => d.row.status === 'Vacant').length,
    nla: vacantNla,
    pctOfNla: nla > 0 ? vacantNla / nla : 0,
  });
  let prevEnd = new Date(timeline.start.getTime() - 86_400_000);
  for (let y = 1; y <= 10; y++) {
    const end = eomonth(timeline.start, y * 12 - 1);
    const endDays = Math.round(end.getTime() / 86_400_000);
    const prevDays = Math.round(prevEnd.getTime() / 86_400_000);
    const inBucket = derived.filter((d) => {
      if (d.row.status !== 'Leased' || !d.row.leaseExpiry) return false;
      const e = isoToDays(d.row.leaseExpiry);
      return e > prevDays && e <= endDays;
    });
    const bucketNla = inBucket.reduce((a, d) => a + d.row.nla, 0);
    buckets.push({
      label: `Y${y} (${toISO(end).slice(0, 7)})`,
      yearEnd: toISO(end),
      tenantCount: inBucket.length,
      nla: bucketNla,
      pctOfNla: nla > 0 ? bucketNla / nla : 0,
    });
    prevEnd = end;
  }

  const weightedNewLeaseTermYears =
    nla > 0
      ? derived.reduce((a, d) => a + (d.row.nla / nla) * d.profile.leaseTermYears, 0)
      : 0;

  return {
    wale: { byIncomeYears, byAreaYears },
    topByArea,
    topByIncome,
    vacantNla,
    vacantPct: nla > 0 ? vacantNla / nla : 0,
    expiryProfile: buckets,
    totalGrossPassingIncome,
    weightedNewLeaseTermYears,
  };
}

/* ------------------------------------------------------------------ */
/* OP_Rates: office / retail growth forecast tables                    */
/* ------------------------------------------------------------------ */

export function computeRates(
  inputs: ValuationInputs,
  derived: TenantDerived[],
  totalsRecoverablePerSqm: number,
): RatesResults {
  const growth = buildGrowthContext(inputs);

  // Base gross-face rate: area-weighted average market rent for the use (IP_Assumptions D212)
  const baseRate = (use: string): number => {
    const rows = derived.filter((d) => d.row.use === use && d.row.nla > 0);
    const area = rows.reduce((a, d) => a + d.row.nla, 0);
    if (area === 0) return 0;
    return rows.reduce((a, d) => a + d.grossFacePerSqm * d.row.nla, 0) / area;
  };

  // Outgoings $/m² per model year, grown (IP_Assumptions F191..)
  const ogYear = (y: number): number => totalsRecoverablePerSqm * growth.outgoingsIndex(y);

  const table = (
    use: 'Office' | 'Retail',
    growthOf: (y: number) => number,
    incentiveOf: (y: number) => number,
  ): RatesTableRow[] => {
    const rows: RatesTableRow[] = [];
    let grossFace = baseRate(use);
    let prev: RatesTableRow | null = null;
    for (let y = 0; y <= 11; y++) {
      if (y > 0) grossFace = grossFace * (1 + growthOf(y));
      const og = ogYear(y);
      const netFace = grossFace - og;
      const inc = incentiveOf(y);
      const grossEff = grossFace * (1 - inc);
      const netEff = grossEff - og;
      const row: RatesTableRow = {
        year: y === 0 ? 'Current' : y,
        grossFace,
        grossFaceGrowth: y === 0 ? null : growthOf(y),
        netFace,
        netFaceGrowth: prev && prev.netFace !== 0 ? netFace / prev.netFace - 1 : null,
        incentive: inc,
        grossEffective: grossEff,
        grossEffectiveGrowth:
          prev && prev.grossEffective !== 0 ? grossEff / prev.grossEffective - 1 : null,
        netEffective: netEff,
        netEffectiveGrowth:
          prev && prev.netEffective !== 0 ? netEff / prev.netEffective - 1 : null,
        outgoings: og,
      };
      rows.push(row);
      prev = row;
    }
    return rows;
  };

  // Incentive by expiry year comes from the office (profile 1) / retail (profile 2) columns
  const officeInc = (y: number) => lookup(inputs.profiles[0]?.incentivePct ?? [], y);
  const retailInc = (y: number) => lookup(inputs.profiles[1]?.incentivePct ?? [], y);
  const office = table('Office', (y) => lookup(inputs.marketGrowth.officeGrowth, y), officeInc);
  const retail = table('Retail', (y) => lookup(inputs.marketGrowth.retailGrowth, y), retailInc);

  const compound = (rows: RatesTableRow[]) => ({
    y3: cagr(3, rows[0].grossFace, rows[3].grossFace),
    y5: cagr(5, rows[0].grossFace, rows[5].grossFace),
    y10: cagr(10, rows[0].grossFace, rows[10].grossFace),
    grossEff3: cagr(3, rows[0].grossEffective, rows[3].grossEffective),
    grossEff5: cagr(5, rows[0].grossEffective, rows[5].grossEffective),
    grossEff10: cagr(10, rows[0].grossEffective, rows[10].grossEffective),
  });

  return {
    office,
    retail,
    officeCompound: compound(office),
    retailCompound: compound(retail),
    cpi10yr: growth.cpi10yr,
  };
}

function lookup(arr: number[], year: number): number {
  const idx = Math.min(Math.max(year, 0), arr.length - 1);
  return arr[idx] ?? 0;
}
