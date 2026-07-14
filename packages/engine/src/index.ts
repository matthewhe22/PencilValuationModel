/**
 * @pencil/engine — pure TypeScript port of the REAS (Pencil) Valuation Model.
 *
 * The single entry point is runModel(inputs): a stateless, synchronous pure
 * function, so it runs identically in the browser (v1) or on a server (v2).
 */
import { computeAnalysis, computeRates } from './analysis';
import { aggregateBuilding, outgoingsTotals } from './building';
import { buildTimeline, eomonthISO, modelStartDate, toISO, toDays } from './dates';
import { buildGrowthContext, monthlyRate } from './growth';
import { deriveTenant } from './schedule';
import type { ScheduleContext } from './schedule';
import { runTenant } from './tenant';
import type { TenantEngineContext } from './tenant';
import type { ModelResults, TenantResult, ValuationInputs } from './types';
import { computeCap, computeDcf } from './valuation';
import { validateInputs } from './validate';

export * from './types';
export { defaultInputs, SCHEMA_VERSION } from './defaults';
export { validateInputs } from './validate';
export { migrateInputs } from './migrations';
export { eomonthISO, modelStartDate, toISO } from './dates';
export { annuityPV, tenantLabel } from './schedule';

export function runModel(inputs: ValuationInputs): ModelResults {
  const issues = validateInputs(inputs);
  const fatal = issues.some((i) => i.severity === 'error');

  const totals = outgoingsTotals(inputs);
  const nla = inputs.tenants.reduce((a, t) => a + (t.nla || 0), 0);
  const totalMonths = inputs.dcf.discountPeriodYears * 12 + 12;
  const timeline = buildTimeline(inputs.general.valuationDate || '2025-01-01', totalMonths);
  const growth = buildGrowthContext(inputs);
  const pvRateMonthly = monthlyRate(inputs.staticAssumptions.pvDiscountRate);

  const modelStartISO = toISO(timeline.start);
  const reversionWindowEnd = eomonthISO(
    modelStartISO,
    inputs.staticAssumptions.reversionWindowMonths - 1,
  );

  const scheduleCtx: ScheduleContext = {
    nla,
    recoverableOutgoings: totals.recoverable,
    totalOutgoings: totals.total,
    pvRateMonthly,
    timeline,
    reversionWindowEndDays: toDays(new Date(reversionWindowEnd + 'T00:00:00Z')),
  };

  const derived = inputs.tenants.map((t, i) => deriveTenant(t, i, inputs, scheduleCtx));

  const engineCtx: TenantEngineContext = {
    inputs,
    timeline,
    growth,
    schedule: scheduleCtx,
    recoverableOutgoings: totals.recoverable,
    nla,
  };

  const tenantResults: TenantResult[] = derived.map((d) => {
    const series = fatal
      ? emptySeries(totalMonths)
      : runTenant(d, engineCtx);
    return {
      input: d.row,
      series,
      statics: {
        id: d.row.id,
        label: d.label,
        reversionMonths: d.reversionMonths,
        pvRentalReversion: d.pvRentalReversion,
        pvLettingUp: d.pvLettingUp,
        pvCommissions: d.pvCommissions,
        pvOutstandingIncentives: d.pvOutstandingIncentives,
        nominalOutstandingIncentives: d.outstandingIncentiveNominal,
        pvTenantIncentives: d.pvTenantIncentives,
        grossPassingPa: d.grossPassingPa,
        basePassingPa: d.basePassingPa,
        grossFaceMarketPa: d.grossFaceMarketPa,
        grossEffectiveMarketPa: d.grossEffectiveMarketPa,
        netMarketPa: d.grossFaceMarketPa - (nla > 0 ? (totals.total / nla) * d.row.nla : 0),
        recoveriesPa:
          d.netRecoveriesPa + (d.row.currentLeaseType !== 'Net' ? d.row.baseYearRecoveriesPa : 0),
        unexpiredTermYears: d.unexpiredTermYears,
      },
    };
  });

  const tvMonthIndex = inputs.dcf.discountPeriodYears * 12; // 0-based index of TV month
  const building = aggregateBuilding(
    inputs,
    timeline,
    growth,
    tenantResults.map((t) => t.series),
    totals,
    nla,
    pvRateMonthly,
    inputs.staticAssumptions.pvDiscountRate,
    tvMonthIndex,
  );

  const dcf = computeDcf(building, inputs);
  const cap = computeCap(inputs, derived, building, totals, nla);
  const analysis = computeAnalysis(inputs, derived, timeline, nla);
  const rates = computeRates(inputs, derived, nla > 0 ? totals.recoverable / nla : 0);

  return {
    inputs,
    modelStart: modelStartISO,
    modelEnd: eomonthISO(modelStartISO, inputs.dcf.discountPeriodYears * 12 - 1),
    nla,
    totalMonths,
    tenants: tenantResults,
    otherIncome: building.otherIncome.results,
    outgoingsTotals: {
      ...totals,
      recoverablePerSqm: nla > 0 ? totals.recoverable / nla : 0,
      totalPerSqm: nla > 0 ? totals.total / nla : 0,
    },
    dcf,
    cap,
    analysis,
    rates,
    issues,
  };
}

function emptySeries(n: number) {
  const z = () => new Array<number>(n).fill(0);
  return {
    baseLease: z(),
    carPark: z(),
    recoveries: z(),
    commissions: z(),
    incentives: z(),
    capitalUpgrades: z(),
    annualisedGrossMarket: z(),
    lettingUp: z(),
    generation: z(),
  };
}
