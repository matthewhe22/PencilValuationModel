/**
 * Per-tenant derived values — a port of the hidden calculation columns of
 * IP_Schedule (BJ..HA): passing/market income, tenancy generation dates,
 * and the PV adjustment columns used by the static capitalisation approach.
 */
import { eomonth, expiryModelYear, parseISO, toDays } from './dates';
import type { Timeline } from './dates';
import type { TenantRow, ValuationInputs, VacantSpaceProfile } from './types';

export const MAX_GENERATIONS = 10;

export interface TenancyGeneration {
  /** 1-based generation number */
  gen: number;
  startDays: number;
  expiryDays: number;
}

export interface TenantDerived {
  row: TenantRow;
  profile: VacantSpaceProfile;
  label: string;
  /** Recoverable outgoings $/m² applied for gross-face build-up (L) */
  outgoingsPerSqm: number;
  /** Gross face market rent $/m² (M) */
  grossFacePerSqm: number;
  /** Gross effective market rent $/m² (N) */
  grossEffectivePerSqm: number;
  /** Passing: base component $ p.a. (BJ) */
  basePassingPa: number;
  /** Passing incl. car park $ p.a. (BL) */
  grossPassingPa: number;
  /** Net recoveries $ p.a. shown on dashboard (AS/AT) */
  netRecoveriesPa: number;
  /** Gross face market income $ p.a. excl car park (BR) */
  grossFaceMarketBasePa: number;
  /** Car parking market income $ p.a. (BS) */
  carParkMarketPa: number;
  /** Gross face market income $ p.a. incl car park (BT) */
  grossFaceMarketPa: number;
  /** Gross effective market income $ p.a. incl car park (BY) */
  grossEffectiveMarketPa: number;
  /** Market base rent $ p.a. on the tenant's own basis (CF_Tenant D34) */
  marketBaseRentPa: number;
  generations: TenancyGeneration[];
  /** Static adjustments (reversion window) */
  reversionMonths: number;
  pvRentalReversion: number;
  lettingUpMonthsApplied: number;
  pvLettingUp: number;
  commissionMonths: number;
  commissionRate: number;
  commissionNominal: number;
  pvCommissions: number;
  incentivePctApplied: number;
  incentiveNominal: number;
  pvTenantIncentives: number;
  outstandingIncentiveNominal: number;
  pvOutstandingIncentives: number;
  unexpiredTermYears: number;
}

/** Excel PV-based annuity: -PV(rate, nper, pmt) — supports fractional nper. */
export function annuityPV(rate: number, nper: number, pmt: number): number {
  if (nper <= 0) return 0;
  if (rate === 0) return pmt * nper;
  return (pmt * (1 - Math.pow(1 + rate, -nper))) / rate;
}

export function tenantLabel(t: TenantRow, index: number): string {
  const who = t.status === 'Vacant' ? 'Vacant' : t.tenantName || 'Unnamed';
  return `${index + 1}. ${t.suite} - ${who}`;
}

export interface ScheduleContext {
  nla: number;
  recoverableOutgoings: number;
  totalOutgoings: number;
  pvRateMonthly: number;
  timeline: Timeline;
  reversionWindowEndDays: number;
}

function lookupByYear(arr: number[], year: number): number {
  // arr index 0 = vacant row; 1..11 = expiry year; clamp to last entry
  const idx = Math.min(Math.max(year, 1), arr.length - 1);
  return arr[idx] ?? 0;
}

export function deriveTenant(
  t: TenantRow,
  index: number,
  inputs: ValuationInputs,
  ctx: ScheduleContext,
): TenantDerived {
  const profile = inputs.profiles[t.profileNumber - 1] ?? inputs.profiles[0];
  const { nla, pvRateMonthly } = ctx;
  const startDate = ctx.timeline.start;
  const modelStartDays = toDays(startDate);

  // L / M / N — market rent build-up
  const ogPsm =
    t.marketBasis === 'N' && t.nla > 0
      ? t.outgoingsOverridePerSqm != null && t.outgoingsOverridePerSqm !== 0
        ? t.outgoingsOverridePerSqm
        : nla > 0
          ? ctx.recoverableOutgoings / nla
          : 0
      : 0;
  const grossFacePerSqm = t.marketBasis === 'N' ? t.marketRentPerSqm + ogPsm : t.marketRentPerSqm;
  // N: incentive for year-1 expiries from the office/retail growth table (H213 / H234)
  const officeProfile = inputs.profiles[0];
  const retailProfile = inputs.profiles[1];
  const incYear1 =
    t.use === 'Retail' ? (retailProfile?.incentivePct[1] ?? 0) : (officeProfile?.incentivePct[1] ?? 0);
  const faceForEffective = t.marketBasis === 'G' ? grossFacePerSqm : t.marketRentPerSqm;
  const grossEffectivePerSqm = faceForEffective * (1 - incYear1);

  const area = t.nla === 0 ? 1 : t.nla;
  const grossFaceMarketBasePa = area * grossFacePerSqm;
  const carParkMarketPa = t.carParking.marketRatePcm * t.carParking.spaces * 12;
  const grossFaceMarketPa = grossFaceMarketBasePa + carParkMarketPa;
  const grossEffectiveMarketPa = area * grossEffectivePerSqm + carParkMarketPa;
  const marketBaseRentPa = area * (t.marketBasis === 'G' ? grossFacePerSqm : t.marketRentPerSqm);

  // AS: net recoveries p.a. (dashboard)
  const pct = t.pctOutgoingsRecovered == null ? 1 : t.pctOutgoingsRecovered;
  const leaseModel = t.status === 'Vacant' ? 'G' : t.currentLeaseType === 'Net' ? 'N' : 'G';
  const netRecoveriesPa =
    leaseModel === 'N' && t.recoveries === 'Yes' && nla > 0 ? (ctx.recoverableOutgoings / nla) * t.nla * pct : 0;

  // BJ / BL passing income
  const basePassingPa =
    t.status === 'Vacant'
      ? 0
      : t.nla === 0
        ? t.baseRentPa + t.baseYearRecoveriesPa
        : t.baseRentPa + (leaseModel === 'G' ? t.baseYearRecoveriesPa : netRecoveriesPa);
  const grossPassingPa = basePassingPa + (t.status === 'Vacant' ? 0 : t.carParking.rentPa);

  // Tenancy generations (DZ..ET)
  const generations: TenancyGeneration[] = [];
  const vacantLU = profile.lettingUpMonths[0] ?? 0;
  let g1Start: Date;
  if (t.status === 'Leased' && t.leaseStart) {
    g1Start = parseISO(t.leaseStart);
  } else {
    // EOMONTH(modelStart, vacantLU - 1) + 1 day
    const eom = eomonth(startDate, vacantLU - 1);
    g1Start = new Date(eom.getTime() + 86_400_000);
  }
  let g1Expiry: Date;
  if (t.status === 'Leased' && t.leaseExpiry) {
    g1Expiry = eomonth(parseISO(t.leaseExpiry), 0);
  } else {
    g1Expiry = eomonth(g1Start, profile.leaseTermYears * 12 - 1);
  }
  generations.push({ gen: 1, startDays: toDays(g1Start), expiryDays: toDays(g1Expiry) });
  let prevExpiry = g1Expiry;
  for (let k = 2; k <= MAX_GENERATIONS; k++) {
    const expYear = expiryModelYear(toDays(prevExpiry), modelStartDays);
    const luMonths =
      t.lettingUpSwitch === 'Off' ? 0 : lookupByYear(profile.lettingUpMonths, expYear);
    // ROUNDUP with a 15-significant-digit snap, matching Excel (10*(1-0.7) => 3, not 4)
    const downtime = Math.ceil(luMonths * (1 - profile.tenantRenewalProbability) - 1e-9);
    const start = new Date(eomonth(prevExpiry, downtime).getTime() + 86_400_000);
    const expiry = eomonth(start, profile.leaseTermYears * 12 - 1);
    generations.push({ gen: k, startDays: toDays(start), expiryDays: toDays(expiry) });
    prevExpiry = expiry;
  }

  // EV..FB — rental reversion PV
  const reversionDateDays =
    t.status === 'Leased' && t.leaseExpiry ? isDays(t.leaseExpiry) : modelStartDays;
  const reversionMonths = (reversionDateDays - modelStartDays) / 30.5;
  const monthlyReversion = grossPassingPa / 12 - grossFaceMarketPa / 12;
  const pvRentalReversion = annuityPV(pvRateMonthly, reversionMonths, monthlyReversion);

  // FD..FI — letting-up allowance within reversion window
  const expiryDays = t.leaseExpiry ? isDays(t.leaseExpiry) : Number.POSITIVE_INFINITY;
  const isVacant = t.status === 'Vacant';
  const expiresInWindow = !isVacant && expiryDays < ctx.reversionWindowEndDays;
  const expiryYearNum = expiresInWindow
    ? Math.max(1, Math.ceil((expiryDays - modelStartDays) / 365))
    : 0;
  const luOn = t.lettingUpSwitch === 'On' ? 1 : 0;
  const lettingUpMonthsApplied = isVacant
    ? vacantLU * luOn
    : expiresInWindow
      ? lookupByYear(profile.lettingUpMonths, expiryYearNum) * (1 - profile.tenantRenewalProbability) * luOn
      : 0;
  const pvLettingUp = annuityPV(pvRateMonthly, lettingUpMonthsApplied, grossFaceMarketPa / 12);

  // FK..FP — leasing commissions within reversion window
  const commissionEventDays = isVacant ? toDays(g1Start) : expiresInWindow ? toDays(g1Expiry) : null;
  const commissionMonths =
    commissionEventDays == null ? 0 : (commissionEventDays - modelStartDays) / 30.25;
  const commissionRate = isVacant
    ? profile.newCommissionPct
    : profile.renewalCommissionPct * profile.tenantRenewalProbability +
      profile.newCommissionPct * (1 - profile.tenantRenewalProbability);
  const commissionNominal =
    commissionEventDays == null ? 0 : commissionRate * grossFaceMarketPa * luOn;
  const pvCommissions = commissionNominal / Math.pow(1 + pvRateMonthly, commissionMonths);

  // FR..FZ — tenant incentives within reversion window
  const tiOn = t.tenantIncentivesSwitch === 'On' ? 1 : 0;
  const incentivePctApplied =
    (isVacant
      ? (profile.incentivePct[0] ?? 0)
      : expiresInWindow
        ? lookupByYear(profile.incentivePct, expiryYearNum)
        : 0) * tiOn;
  const incentiveNominal = profile.leaseTermYears * grossFaceMarketPa * incentivePctApplied;
  const pvTenantIncentives = incentiveNominal / Math.pow(1 + pvRateMonthly, commissionMonths);

  // BA..BF — outstanding contracted incentives
  const rentFreeMonthly = (t.baseRentPa / 12) * t.incentives.pctRentFree;
  const outstandingIncentiveNominal =
    rentFreeMonthly * t.incentives.outstandingRentFreeMonths + t.incentives.upfrontAmount;
  const pvOutstandingIncentives =
    annuityPV(pvRateMonthly, t.incentives.outstandingRentFreeMonths, rentFreeMonthly) +
    t.incentives.upfrontAmount;

  const unexpiredTermYears =
    t.status === 'Leased' && t.leaseExpiry
      ? Math.max((isDays(t.leaseExpiry) - modelStartDays) / 365, 0)
      : 0;

  return {
    row: t,
    profile,
    label: tenantLabel(t, index),
    outgoingsPerSqm: ogPsm,
    grossFacePerSqm,
    grossEffectivePerSqm,
    basePassingPa,
    grossPassingPa,
    netRecoveriesPa,
    grossFaceMarketBasePa,
    carParkMarketPa,
    grossFaceMarketPa,
    grossEffectiveMarketPa,
    marketBaseRentPa,
    generations,
    reversionMonths,
    pvRentalReversion,
    lettingUpMonthsApplied,
    pvLettingUp,
    commissionMonths,
    commissionRate,
    commissionNominal,
    pvCommissions,
    incentivePctApplied,
    incentiveNominal,
    pvTenantIncentives,
    outstandingIncentiveNominal,
    pvOutstandingIncentives,
    unexpiredTermYears,
  };
}

function isDays(iso: string): number {
  return toDays(parseISO(iso));
}
