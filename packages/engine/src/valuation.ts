/**
 * Valuation calculations — ports of Calc_DCF (DCF, terminal value, NPV, IRR,
 * sensitivities) and Calc_Cap (static capitalisation and yield analysis).
 */
import type { BuildingSeries } from './building';
import type { OutgoingsTotals } from './building';
import type { TenantDerived } from './schedule';
import type {
  CapResults,
  DcfResults,
  SensitivityCell,
  ValuationInputs,
} from './types';

/* ------------------------------------------------------------------ */
/* DCF                                                                 */
/* ------------------------------------------------------------------ */

interface TerminalParts {
  monthIndex: number; // 0-based index of TV month (first month after discount period)
  annualisedGrossMarket: number;
  annualisedOutgoings: number;
  netIncome: number;
  rentalReversions: number;
  additionalIncome: number;
}

function terminalParts(building: BuildingSeries, inputs: ValuationInputs): TerminalParts {
  const tvIdx = inputs.dcf.discountPeriodYears * 12; // month 121 (0-based index 120)
  const months = building.months;
  const tv = months[Math.min(tvIdx, months.length - 1)];
  // Annualised outgoings for the TV year (Calc_DCF E95: sum of outgoings in that model year)
  const tvYear = tv.yearNumber;
  const annualOutgoings = months
    .filter((m) => m.yearNumber === tvYear)
    .reduce((a, m) => a + m.totalOutgoings, 0);
  const additional = building.otherIncome.results.reduce(
    (a, r) => a + r.terminalContribution,
    0,
  );
  return {
    monthIndex: tvIdx,
    annualisedGrossMarket: tv.annualisedGrossMarket,
    annualisedOutgoings: annualOutgoings,
    netIncome: tv.annualisedGrossMarket - annualOutgoings,
    rentalReversions: tv.grossPassingRental * 12 - tv.annualisedGrossMarket,
    additionalIncome: additional,
  };
}

function npvAt(
  building: BuildingSeries,
  inputs: ValuationInputs,
  discountRate: number,
  terminalYield: number,
  tp: TerminalParts,
): { pvCF: number; discountedTV: number; total: number } {
  const months = building.months;
  const n = inputs.dcf.discountPeriodYears * 12;
  let pvCF = 0;
  for (let m = 0; m < Math.min(n, months.length); m++) {
    pvCF += months[m].netCashflow / Math.pow(1 + discountRate, months[m].timeFactor);
  }
  const sellingPct = inputs.costs.sellingCostPct;
  const grossRealisation =
    tp.netIncome / terminalYield + tp.rentalReversions + tp.additionalIncome;
  const tvBeforeDiscount = grossRealisation * (1 - sellingPct);
  const tvTimeFactor =
    building.months[Math.min(tp.monthIndex, months.length - 1)].timeFactor;
  const discountedTV = tvBeforeDiscount / Math.pow(1 + discountRate, tvTimeFactor);
  return { pvCF, discountedTV, total: pvCF + discountedTV };
}

/** Solve monthly IRR of {t0 outflow, monthly flows, terminal inflow}; returns annual rate. */
export function solveIrr(
  outflow: number,
  flows: number[],
  timeFactors: number[],
  terminalInflow: number,
  terminalTimeFactor: number,
): number | null {
  const npv = (r: number) => {
    let v = -outflow;
    for (let i = 0; i < flows.length; i++) {
      v += flows[i] / Math.pow(1 + r, timeFactors[i]);
    }
    v += terminalInflow / Math.pow(1 + r, terminalTimeFactor);
    return v;
  };
  // bisection over annual rate
  let lo = -0.99;
  let hi = 5;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (isNaN(fLo) || isNaN(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-10) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function computeDcf(
  building: BuildingSeries,
  inputs: ValuationInputs,
): DcfResults {
  const dr = inputs.dcf.discountRate;
  const ty = inputs.dcf.terminalYield;
  const tp = terminalParts(building, inputs);
  const base = npvAt(building, inputs, dr, ty, tp);

  const acq = inputs.costs.acquisitionCostPct;
  const presentValueTotal = base.total;
  const lessPurchaseCosts = presentValueTotal - presentValueTotal / (1 + acq);
  const capitalValue = presentValueTotal / (1 + acq);

  // sensitivity: rows discount rate -/0/+, cols terminal yield -/0/+ (values after acquisition costs)
  const dSens = inputs.dcf.discountRateSensitivity;
  const tSens = inputs.dcf.terminalYieldSensitivity;
  const npvSensitivity: SensitivityCell[][] = [];
  for (const dd of [dr - dSens, dr, dr + dSens]) {
    const row: SensitivityCell[] = [];
    for (const tt of [ty - tSens, ty, ty + tSens]) {
      const v = npvAt(building, inputs, dd, tt, tp).total / (1 + acq);
      row.push({ discountRate: dd, terminalYield: tt, value: v });
    }
    npvSensitivity.push(row);
  }

  // Terminal detail at base rates
  const sellingPct = inputs.costs.sellingCostPct;
  const grossRealisation =
    tp.netIncome / ty + tp.rentalReversions + tp.additionalIncome;
  const sellingCosts = -grossRealisation * sellingPct;
  const tvBeforeDiscount = grossRealisation + sellingCosts;
  const months = building.months;
  const tvTimeFactor = months[Math.min(tp.monthIndex, months.length - 1)].timeFactor;
  const discountedTV = tvBeforeDiscount / Math.pow(1 + dr, tvTimeFactor);

  // IRR vs adopted value (incl. acquisition costs), receiving net CF + terminal value
  const n = inputs.dcf.discountPeriodYears * 12;
  const flows = months.slice(0, n).map((m) => m.netCashflow);
  const tfs = months.slice(0, n).map((m) => m.timeFactor);
  const adopted = inputs.general.adoptedValue || 0;
  const irr =
    adopted > 0
      ? solveIrr(adopted * (1 + acq), flows, tfs, tvBeforeDiscount, tvTimeFactor)
      : null;

  // IRR sensitivity: adopted value +/- x, terminal yield +/- y
  const avSens = inputs.dcf.adoptedValueIrrSensitivity;
  const irrSensitivity: { adoptedValue: number; terminalYield: number; irr: number | null }[][] =
    [];
  for (const av of [adopted * (1 - avSens), adopted, adopted * (1 + avSens)]) {
    const row: { adoptedValue: number; terminalYield: number; irr: number | null }[] = [];
    for (const tt of [ty - tSens, ty, ty + tSens]) {
      const gr = tp.netIncome / tt + tp.rentalReversions + tp.additionalIncome;
      const tvv = gr * (1 - sellingPct);
      row.push({
        adoptedValue: av,
        terminalYield: tt,
        irr: av > 0 ? solveIrr(av * (1 + acq), flows, tfs, tvv, tvTimeFactor) : null,
      });
    }
    irrSensitivity.push(row);
  }

  // fill running yields (pre-capex net / capital value)
  const years = building.years.map((y) => ({
    ...y,
    runningYieldPreCapex: capitalValue > 0 ? y.netCashflowPreCapex / capitalValue : 0,
  }));

  return {
    monthly: months,
    annual: years,
    discountRate: dr,
    terminalYield: ty,
    terminal: {
      monthIndex: tp.monthIndex + 1,
      annualisedGrossMarket: tp.annualisedGrossMarket,
      annualisedOutgoings: tp.annualisedOutgoings,
      netIncome: tp.netIncome,
      valueBeforeAdjustments: tp.netIncome / ty,
      rentalReversions: tp.rentalReversions,
      additionalIncome: tp.additionalIncome,
      grossRealisation,
      sellingCosts,
      valueBeforeDiscounting: tvBeforeDiscount,
      discountedTerminalValue: discountedTV,
    },
    pvOfCashflows: base.pvCF,
    presentValueTotal,
    lessPurchaseCosts,
    capitalValue,
    capitalValueRounded: Math.round(capitalValue / 1000) * 1000,
    npvSensitivity,
    irr,
    irrSensitivity,
  };
}

/* ------------------------------------------------------------------ */
/* Static capitalisation                                               */
/* ------------------------------------------------------------------ */

export function computeCap(
  inputs: ValuationInputs,
  derived: TenantDerived[],
  building: BuildingSeries,
  totals: OutgoingsTotals,
  nla: number,
): CapResults {
  const sa = inputs.staticAssumptions;
  const useFace = sa.capitaliseMarketRents === 'Face';
  const grossBaseMarketIncome = derived.reduce(
    (a, d) => a + (useFace ? d.grossFaceMarketBasePa : d.grossEffectiveMarketPa - d.carParkMarketPa),
    0,
  );
  const carParkingMarketIncome = derived.reduce((a, d) => a + d.carParkMarketPa, 0);
  const outgoingsY1 = totals.total;
  const estimatedNetMarketIncome = grossBaseMarketIncome + carParkingMarketIncome - outgoingsY1;
  const vacancyAllowance =
    -(grossBaseMarketIncome + carParkingMarketIncome) * sa.capitalisationVacancyAllowance;
  const rmPct = sa.structuralRMPctOfIncome.on === 'On' ? sa.structuralRMPctOfIncome.pct : 0;
  const rmFixed = sa.structuralRMFixedAmount.on === 'On' ? sa.structuralRMFixedAmount.amount : 0;
  const rmAllowance = -((grossBaseMarketIncome + carParkingMarketIncome) * rmPct + rmFixed);
  const adjustedNetMarketIncome = estimatedNetMarketIncome + vacancyAllowance + rmAllowance;

  const coreCapRate = sa.coreCapRate;
  const coreCapitalValue = coreCapRate > 0 ? adjustedNetMarketIncome / coreCapRate : 0;

  const additionalIncomeValue = building.otherIncome.results.reduce(
    (a, r) => a + (r.capValue ?? 0),
    0,
  );

  const adjustments = {
    pvRentalReversions: derived.reduce((a, d) => a + d.pvRentalReversion, 0),
    pvLettingUp: -derived.reduce((a, d) => a + d.pvLettingUp, 0),
    pvCommissions: -derived.reduce((a, d) => a + d.pvCommissions, 0),
    pvOutstandingIncentives: -derived.reduce((a, d) => a + d.pvOutstandingIncentives, 0),
    pvTenantIncentives: -derived.reduce((a, d) => a + d.pvTenantIncentives, 0),
    pvCapex: -building.pvCapexDeduction,
    additionalIncome: additionalIncomeValue,
    manualAdjustment: sa.manualAdjustment || 0,
  };
  const adjSum = Object.values(adjustments).reduce((a, b) => a + b, 0);
  const adjustedCoreCapitalValue = coreCapitalValue + adjSum;

  // Yield analysis (Calc_Cap §1.2)
  const adoptedValue = inputs.general.adoptedValue || 0;
  const additionalIncomePassing = building.otherIncome.results.reduce(
    (a, r) => a + (r.active ? r.annualisedTotal : 0),
    0,
  );
  const netMarketRent =
    grossBaseMarketIncome + carParkingMarketIncome + additionalIncomePassing - outgoingsY1;
  const passingBase = derived.reduce((a, d) => a + (d.row.status === 'Vacant' ? 0 : d.row.baseRentPa), 0);
  const passingCar = derived.reduce(
    (a, d) => a + (d.row.status === 'Vacant' ? 0 : d.row.carParking.rentPa),
    0,
  );
  const recoveries = derived.reduce(
    (a, d) =>
      a +
      (d.row.status === 'Vacant'
        ? 0
        : d.netRecoveriesPa + (d.row.currentLeaseType !== 'Net' ? d.row.baseYearRecoveriesPa : 0)),
    0,
  );
  const netPassingIncome =
    passingBase + passingCar + additionalIncomePassing + recoveries - outgoingsY1;
  const vacantMarket = derived.reduce(
    (a, d) => a + (d.row.status === 'Vacant' ? d.grossFaceMarketBasePa + d.carParkMarketPa : 0),
    0,
  );
  const netPassingFullyLeased = netPassingIncome + vacantMarket;

  const reversionAdjSum =
    adjustments.pvRentalReversions +
    adjustments.pvLettingUp +
    adjustments.pvCommissions +
    adjustments.pvOutstandingIncentives +
    adjustments.pvTenantIncentives +
    adjustments.pvCapex +
    adjustments.manualAdjustment;

  const yields = {
    adoptedValue,
    netMarketRent,
    netPassingIncome,
    netPassingFullyLeased,
    netPassingInitialYield: adoptedValue > 0 ? netPassingIncome / adoptedValue : 0,
    initialYieldFullyLeased: adoptedValue > 0 ? netPassingFullyLeased / adoptedValue : 0,
    equivalentMarketYield:
      adoptedValue - reversionAdjSum !== 0 ? netMarketRent / (adoptedValue - reversionAdjSum) : 0,
    reversionaryYield: adoptedValue > 0 ? netMarketRent / adoptedValue : 0,
    passingMarketRelativity: netMarketRent !== 0 ? netPassingIncome / netMarketRent : 0,
  };

  // Cap rate sensitivity strip (-2s..+2s)
  const s = sa.capRateSensitivity;
  const sensitivity = [-2, -1, 0, 1, 2].map((k) => {
    const rate = coreCapRate + k * s;
    const core = rate > 0 ? adjustedNetMarketIncome / rate : 0;
    const adjusted = core + adjSum;
    return { capRate: rate, coreValue: core, adjustedValue: adjusted, ratePerSqm: nla > 0 ? adjusted / nla : 0 };
  });

  return {
    grossBaseMarketIncome,
    carParkingMarketIncome,
    outgoingsY1,
    estimatedNetMarketIncome,
    vacancyAllowance,
    rmAllowance,
    adjustedNetMarketIncome,
    coreCapRate,
    coreCapitalValue,
    adjustments,
    adjustedCoreCapitalValue,
    ratePerSqm: nla > 0 ? adjustedCoreCapitalValue / nla : 0,
    capitalisationValue: Math.round(adjustedCoreCapitalValue / 100000) * 100000,
    yields,
    sensitivity,
  };
}
