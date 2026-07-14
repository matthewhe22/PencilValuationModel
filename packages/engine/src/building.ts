/**
 * Building-level aggregation — port of CF_Building and Calc_DCF §1-2.
 */
import type { Timeline } from './dates';
import { toISO } from './dates';
import { monthlyRate } from './growth';
import type { GrowthContext } from './growth';
import type {
  BuildingCashflowMonth,
  BuildingCashflowYear,
  MonthlySeries,
  OtherIncomeResult,
  OtherIncomeSource,
  ValuationInputs,
} from './types';
import { isoToDays } from './dates';

export interface OutgoingsTotals {
  statutory: number;
  operating: number;
  recoverable: number;
  nonRecoverable: number;
  total: number;
}

export function outgoingsTotals(inputs: ValuationInputs): OutgoingsTotals {
  const sum = (xs: { amount: number }[]) => xs.reduce((a, b) => a + (b.amount || 0), 0);
  const statutory = sum(inputs.outgoings.statutory);
  const operating = sum(inputs.outgoings.operating);
  const nonRecoverable = sum(inputs.outgoings.nonRecoverable);
  return {
    statutory,
    operating,
    recoverable: statutory + operating,
    nonRecoverable,
    total: statutory + operating + nonRecoverable,
  };
}

export interface OtherIncomeMonthly {
  perSource: number[][]; // [source][month]
  total: number[];
  results: OtherIncomeResult[];
}

/** CF_Building §4 — additional income sources */
export function computeOtherIncome(
  inputs: ValuationInputs,
  timeline: Timeline,
  growth: GrowthContext,
  pvRateMonthly: number,
  tvMonthIndex: number,
): OtherIncomeMonthly {
  const N = timeline.totalMonths;
  const perSource: number[][] = [];
  const total = new Array<number>(N).fill(0);
  const results: OtherIncomeResult[] = [];
  const modelStartEomDays = timeline.monthEndDays[0];

  inputs.otherIncome.forEach((src, i) => {
    const series = new Array<number>(N).fill(0);
    const on = src.switch === 'On';
    let capValue: number | null = null;
    let terminalContribution = 0;
    if (on && src.monthlyAmount) {
      const startDays =
        src.currentlyReceived === 'Yes'
          ? modelStartEomDays
          : src.startDate
            ? eomDays(src.startDate)
            : modelStartEomDays;
      const endDays =
        src.basis === 'Fixed-term' && src.endDate ? eomDays(src.endDate) : Number.POSITIVE_INFINITY;
      let factor = 1;
      for (let m = 0; m < N; m++) {
        const me = timeline.monthEndDays[m];
        const active = me >= startDays && me <= endDays;
        if (active && src.growthProfile) {
          factor *= 1 + monthlyRate(growth.market(src.growthProfile, timeline.yearNumbers[m]));
        }
        series[m] = active ? src.monthlyAmount * factor : 0;
        if (active) total[m] += series[m];
      }
      // Cap-approach value (IP_Assumptions §6): fixed-term => PV of the flows;
      // perpetuity => annualised / applied cap rate.
      if (src.basis === 'Fixed-term') {
        let pv = 0;
        for (let m = 0; m < N; m++) {
          pv += series[m] / Math.pow(1 + pvRateMonthly, m + 1);
        }
        capValue = pv;
        terminalContribution = 0;
      } else {
        const capRate = src.capRateOverride ?? inputs.staticAssumptions.coreCapRate;
        capValue = capRate > 0 ? (src.monthlyAmount * 12) / capRate : null;
        const tvAmount = series[Math.min(tvMonthIndex, N - 1)];
        terminalContribution = capRate > 0 ? (tvAmount * 12) / capRate : 0;
      }
    }
    perSource.push(series);
    results.push({
      index: i + 1,
      source: src,
      active: on,
      annualisedTotal: on ? src.monthlyAmount * 12 : 0,
      capValue,
      terminalContribution,
    });
  });

  return { perSource, total, results };
}

function eomDays(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z');
  return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / 86_400_000);
}

export interface BuildingCapex {
  fixed: number[];
  sinking: number[];
  specified: number[];
}

/** CF_Building §2 — building capex allowances */
export function computeBuildingCapex(
  inputs: ValuationInputs,
  timeline: Timeline,
  growth: GrowthContext,
  nla: number,
): BuildingCapex {
  const N = timeline.totalMonths;
  const fixed = new Array<number>(N).fill(0);
  const sinking = new Array<number>(N).fill(0);
  const specified = new Array<number>(N).fill(0);
  const cap = inputs.capex;
  const fixedMonthly = cap.fixedContribution.on === 'On' ? cap.fixedContribution.amountPa / 12 : 0;
  const sinkingMonthly = cap.sinkingFund.on === 'On' ? (cap.sinkingFund.ratePerSqmPa * nla) / 12 : 0;
  for (let m = 0; m < N; m++) {
    fixed[m] = fixedMonthly;
    sinking[m] = sinkingMonthly;
  }
  if (cap.specifiedByDate.on === 'On') {
    cap.specifiedByDate.rows.forEach((row, y) => {
      // model year y+1 => months y*12 .. y*12+11; net amount grown by capex compound index
      const net = ((row.expenditure || 0) - (row.income || 0)) * growth.capexIndex(y);
      const monthly = net / 12;
      for (let m = y * 12; m < Math.min((y + 1) * 12, N); m++) specified[m] += monthly;
    });
  }
  return { fixed, sinking, specified };
}

export interface BuildingSeries {
  months: BuildingCashflowMonth[];
  years: BuildingCashflowYear[];
  otherIncome: OtherIncomeMonthly;
  capex: BuildingCapex;
  /** PV of capex deducted from the capitalisation value (CF_Building D74) */
  pvCapexDeduction: number;
}

export function aggregateBuilding(
  inputs: ValuationInputs,
  timeline: Timeline,
  growth: GrowthContext,
  tenantSeries: MonthlySeries[],
  totals: OutgoingsTotals,
  nla: number,
  pvRateMonthly: number,
  pvRateAnnual: number,
  tvMonthIndex: number,
): BuildingSeries {
  const N = timeline.totalMonths;
  const other = computeOtherIncome(inputs, timeline, growth, pvRateMonthly, tvMonthIndex);
  const capex = computeBuildingCapex(inputs, timeline, growth, nla);

  const months: BuildingCashflowMonth[] = [];
  let statM = totals.statutory / 12;
  let opM = totals.operating / 12;
  let nonRecM = totals.nonRecoverable / 12;
  for (let m = 0; m < N; m++) {
    const year = timeline.yearNumbers[m];
    const g = monthlyRate(growth.outgoings(year));
    statM *= 1 + g;
    opM *= 1 + g;
    nonRecM *= 1 + g;

    const sumOver = (sel: (s: MonthlySeries) => number[]) =>
      tenantSeries.reduce((a, s) => a + sel(s)[m], 0);

    const grossLease = sumOver((s) => s.baseLease) + sumOver((s) => s.carPark);
    const recovered = sumOver((s) => s.recoveries);
    const grossPassingRental = grossLease + recovered;
    const additional = other.total[m];
    const grossPassingIncome = grossPassingRental + additional;
    const totalOutgoings = statM + opM + nonRecM;
    const commissions = sumOver((s) => s.commissions);
    const incentives = sumOver((s) => s.incentives);
    const netPreCapex = grossPassingIncome - totalOutgoings - commissions - incentives;
    const upgrades = sumOver((s) => s.capitalUpgrades);
    const totalCapex = capex.fixed[m] + capex.sinking[m] + capex.specified[m] + upgrades;

    months.push({
      monthIndex: m + 1,
      monthEnd: toISO(timeline.monthEnds[m]),
      yearNumber: year,
      annualisedGrossMarket: sumOver((s) => s.annualisedGrossMarket),
      grossLeaseIncome: grossLease,
      outgoingsRecovered: recovered,
      grossPassingRental,
      additionalIncome: additional,
      grossPassingIncome,
      statutoryExpenses: statM,
      operatingExpenses: opM,
      nonRecoverableExpenses: nonRecM,
      totalOutgoings,
      commissions,
      incentives,
      netCashflowPreCapex: netPreCapex,
      buildingCapexFixed: capex.fixed[m],
      buildingCapexSinking: capex.sinking[m],
      buildingCapexSpecified: capex.specified[m],
      tenantCapitalUpgrades: upgrades,
      totalCapex,
      netCashflow: netPreCapex - totalCapex,
      timeFactor: timeline.timeFactors[m],
    });
  }

  // Annual roll-up over the discount period (Calc_DCF §2)
  const years: BuildingCashflowYear[] = [];
  const numYears = Math.floor(N / 12);
  for (let y = 1; y <= numYears; y++) {
    const slice = months.filter((mm) => mm.yearNumber === y);
    const sum = (sel: (mm: BuildingCashflowMonth) => number) =>
      slice.reduce((a, mm) => a + sel(mm), 0);
    const grossMarketAtYearEnd = months[y * 12 - 1]?.annualisedGrossMarket ?? 0;
    years.push({
      year: y,
      yearEnd: slice[slice.length - 1]?.monthEnd ?? '',
      grossMarketIncome: grossMarketAtYearEnd,
      grossLeaseIncome: sum((mm) => mm.grossLeaseIncome),
      outgoingsRecovered: sum((mm) => mm.outgoingsRecovered),
      grossPassingRental: sum((mm) => mm.grossPassingRental),
      additionalIncome: sum((mm) => mm.additionalIncome),
      grossPassingIncome: sum((mm) => mm.grossPassingIncome),
      statutoryExpenses: sum((mm) => mm.statutoryExpenses),
      operatingExpenses: sum((mm) => mm.operatingExpenses),
      nonRecoverableExpenses: sum((mm) => mm.nonRecoverableExpenses),
      totalOutgoings: sum((mm) => mm.totalOutgoings),
      commissions: sum((mm) => mm.commissions),
      incentives: sum((mm) => mm.incentives),
      netCashflowPreCapex: sum((mm) => mm.netCashflowPreCapex),
      totalCapex: sum((mm) => mm.totalCapex),
      netCashflow: sum((mm) => mm.netCashflow),
      runningYieldPreCapex: 0, // filled in by valuation once capital value is known
    });
  }

  // CF_Building §3 — PV of capex deducted from the capitalisation value
  let pvCapexDeduction = 0;
  if (inputs.staticAssumptions.deductCapexFromCapitalValue === 'Yes') {
    const window = inputs.staticAssumptions.capexMonthsDeducted;
    for (let m = 0; m < Math.min(window, N); m++) {
      const mm = months[m];
      const df = 1 / Math.pow(1 + pvRateAnnual, mm.timeFactor);
      pvCapexDeduction += (mm.totalCapex) * df;
    }
  }

  return { months, years, otherIncome: other, capex, pvCapexDeduction };
}

export { isoToDays };
