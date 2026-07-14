/**
 * Per-tenant monthly cash flow — a port of CF_Tenant.
 *
 * In the workbook, a VBA macro iterated one tenant at a time through CF_Tenant
 * and snapshotted results into the hidden DT_* data tables. Here we simply
 * compute every tenant in a loop.
 */
import type { Timeline } from './dates';
import { monthlyRate } from './growth';
import type { GrowthContext } from './growth';
import type { ScheduleContext, TenantDerived } from './schedule';
import type { MonthlySeries, ValuationInputs } from './types';

export interface TenantEngineContext {
  inputs: ValuationInputs;
  timeline: Timeline;
  growth: GrowthContext;
  schedule: ScheduleContext;
  /** Recoverable outgoings, annual $ at model start (IP_Outgoings C38) */
  recoverableOutgoings: number;
  nla: number;
}

const zeros = (n: number) => new Array<number>(n).fill(0);

export function runTenant(d: TenantDerived, ctx: TenantEngineContext): MonthlySeries {
  const t = d.row;
  const { timeline, growth } = ctx;
  const N = timeline.totalMonths;
  const profile = d.profile;

  const series: MonthlySeries = {
    baseLease: zeros(N),
    carPark: zeros(N),
    recoveries: zeros(N),
    commissions: zeros(N),
    incentives: zeros(N),
    capitalUpgrades: zeros(N),
    annualisedGrossMarket: zeros(N),
    lettingUp: zeros(N),
    generation: zeros(N),
  };

  const nlaT = t.nla === 0 ? 1 : t.nla;

  /* ---- §2.1 occupancy generation per month ---- */
  const gen: number[] = new Array(N).fill(0);
  for (let m = 0; m < N; m++) {
    const me = timeline.monthEndDays[m];
    for (const g of d.generations) {
      if (me >= g.startDays && me <= g.expiryDays) {
        gen[m] = g.gen;
        break;
      }
    }
  }
  series.generation = gen;

  /* ---- §2.5 market rent paths ---- */
  // Gross market rent (monthly, excl car parking) — CF_Tenant row 15
  const grossMarketMonthly: number[] = zeros(N);
  // Market base rent on the tenant's own basis (annual) — CF_Tenant row 138
  const marketBaseAnnual: number[] = zeros(N);
  // Car parking market rent (annual) — CF_Tenant row 143
  const carParkMarketAnnual: number[] = zeros(N);
  {
    let gm = 0;
    let mb = t.nla === 0 ? 0 : d.marketBaseRentPa;
    let cp = d.carParkMarketPa;
    for (let m = 0; m < N; m++) {
      const year = timeline.yearNumbers[m];
      const g = monthlyRate(growth.market(t.growthProfile, year));
      const gCar = monthlyRate(growth.market('Car Parking', year));
      if (m === 0) {
        gm = ((d.grossFacePerSqm * nlaT) / 12) * (1 + g);
        mb = mb * (1 + g);
        cp = cp * (1 + gCar);
      } else {
        gm = gm * (1 + g);
        mb = mb * (1 + g);
        cp = cp * (1 + gCar);
      }
      grossMarketMonthly[m] = gm;
      marketBaseAnnual[m] = mb;
      carParkMarketAnnual[m] = cp;
    }
  }
  for (let m = 0; m < N; m++) series.annualisedGrossMarket[m] = grossMarketMonthly[m] * 12;

  /* ---- recoverable outgoings growth (CF_Tenant §4) ---- */
  const recoverableMonthly: number[] = zeros(N); // building-level, grown
  {
    let v = ctx.recoverableOutgoings / 12;
    for (let m = 0; m < N; m++) {
      const year = timeline.yearNumbers[m];
      v = v * (1 + monthlyRate(growth.outgoings(year)));
      recoverableMonthly[m] = v;
    }
  }

  /* ---- §2.2 review flags & §3.1 generation-1 income ---- */
  const g1 = d.generations[0];
  const isVacant = t.status === 'Vacant';
  const reviewFreqMonths =
    profile.reviewFrequencyYears == null ? 120 : profile.reviewFrequencyYears * 12;
  // First review month for generation 1: EOMONTH(next review) for leased,
  // the commencement month for vacant (CF_Tenant D43 / §2.2 row 90).
  let firstReviewIdx = -1;
  if (isVacant) {
    firstReviewIdx = timeline.monthEndDays.findIndex((dd) => dd >= g1.startDays);
  } else if (t.nextReviewDate) {
    const target = monthEndDaysOf(t.nextReviewDate);
    firstReviewIdx = timeline.monthEndDays.findIndex((dd) => dd === target);
  }
  // Generation-1 review months (0-based indices into the timeline)
  const g1ReviewMonths: number[] = [];
  if (firstReviewIdx >= 0) {
    const freq = isVacant ? reviewFreqMonths : 12; // leased tenants review annually per CB..CM types
    for (let m = firstReviewIdx; m < N; m += freq) {
      if (gen[m] === 1) g1ReviewMonths.push(m);
      else if (timeline.monthEndDays[m] > g1.expiryDays) break;
    }
  }

  const baseLeaseG1: number[] = zeros(N);
  const carParkG1: number[] = zeros(N);
  {
    let annualBase = 0;
    let annualCar = 0;
    let started = false;
    let reviewNo = 0;
    const commenceIdx = timeline.monthEndDays.findIndex(
      (dd) => dd >= g1.startDays && dd <= g1.expiryDays,
    );
    for (let m = 0; m < N; m++) {
      if (m === commenceIdx && gen[m] === 1) {
        annualBase = t.baseRentPa;
        annualCar = t.carParking.rentPa;
        started = true;
      }
      // If the lease pre-dates the model, treat passing rent as current from month 1
      if (!started && gen[m] === 1) {
        annualBase = t.baseRentPa;
        annualCar = t.carParking.rentPa;
        started = true;
      }
      if (started && g1ReviewMonths.includes(m)) {
        reviewNo += 1;
        const year = timeline.yearNumbers[m];
        const type = isVacant ? 'M' : (t.reviewTypes[reviewNo - 1] ?? null);
        const rate = t.reviewRates[reviewNo - 1] ?? 0;
        const market = marketBaseAnnual[m];
        if (type === 'CPI') {
          annualBase *= 1 + growth.cpi(year);
          annualCar *= 1 + growth.cpi(year);
        } else if (type === 'F') {
          annualBase *= 1 + (rate ?? 0);
          annualCar *= 1 + (rate ?? 0);
        } else if (type === 'M') {
          const ratchet = isVacant ? profile.ratchetOnNewLeases === 'Yes' : t.ratchet === 'Yes';
          annualBase = ratchet ? Math.max(annualBase, market) : market;
          annualCar = carParkMarketAnnual[m];
        } else if (type === 'Man') {
          annualBase = rate ?? annualBase;
          annualCar = carParkMarketAnnual[m];
        }
      }
      if (gen[m] === 1) {
        baseLeaseG1[m] = annualBase / 12;
        carParkG1[m] = annualCar / 12;
      }
    }
  }

  /* ---- §3.2 generations 2..10 income ---- */
  const baseLeaseG2: number[] = zeros(N);
  const carParkG2: number[] = zeros(N);
  {
    let monthlyBase = 0;
    let monthlyCar = 0;
    for (let m = 0; m < N; m++) {
      const g = gen[m];
      if (g > 1) {
        const isCommencement = m === 0 ? true : gen[m - 1] !== g;
        if (isCommencement && (m === 0 || gen[m - 1] === 0 || gen[m - 1] !== g)) {
          if (m === 0 || gen[m - 1] === 0) {
            // fresh lease at market
            monthlyBase = marketBaseAnnual[m] / 12;
            monthlyCar = carParkMarketAnnual[m] / 12;
          } else {
            // back-to-back renewal (no downtime): review to market with ratchet
            monthlyBase = Math.max(marketBaseAnnual[m] / 12, monthlyBase);
            monthlyCar = Math.max(carParkMarketAnnual[m] / 12, monthlyCar);
          }
        } else {
          // periodic reviews within the renewal lease (to market, ratcheted — CF_Tenant E208)
          const monthsSinceStart = monthsSince(timeline, m, d.generations[g - 1].startDays);
          if (reviewFreqMonths < 120 && monthsSinceStart > 0 && monthsSinceStart % reviewFreqMonths === 0) {
            monthlyBase = Math.max(marketBaseAnnual[m] / 12, monthlyBase);
            monthlyCar = Math.max(carParkMarketAnnual[m] / 12, monthlyCar);
          }
        }
        baseLeaseG2[m] = monthlyBase;
        carParkG2[m] = monthlyCar;
      }
    }
  }

  for (let m = 0; m < N; m++) {
    series.baseLease[m] = baseLeaseG1[m] + baseLeaseG2[m];
    series.carPark[m] = carParkG1[m] + carParkG2[m];
  }

  /* ---- §4 recoveries ---- */
  const leaseModel = isVacant ? 'G' : t.currentLeaseType === 'Net' ? 'N' : 'G';
  const marketModel = t.marketBasis; // renewal tenancies recover when market basis is Net
  const pct = t.pctOutgoingsRecovered == null ? 1 : t.pctOutgoingsRecovered;
  const shareOfNla = ctx.nla === 0 ? 0 : t.nla / ctx.nla;
  const recoveriesOn = isVacant ? false : t.recoveries === 'Yes';
  for (let m = 0; m < N; m++) {
    const tenantShareAnnual = shareOfNla * recoverableMonthly[m] * 12 * pct;
    let rec = 0;
    if (gen[m] === 1 && recoveriesOn && leaseModel === 'N') {
      rec += tenantShareAnnual / 12;
    }
    if (gen[m] > 1 && marketModel === 'N') {
      rec += tenantShareAnnual / 12;
    }
    // §4.2 base-year (semi-gross) recoveries: gross lease with recoveries on —
    // recover increases over the base-year amount.
    if (gen[m] === 1 && recoveriesOn && leaseModel === 'G' && t.currentLeaseType !== 'Gross') {
      const baseYear =
        t.baseYearRecoveriesPa > 0 ? t.baseYearRecoveriesPa : shareOfNla * ctx.recoverableOutgoings * pct;
      rec += Math.max(tenantShareAnnual - baseYear, 0) / 12;
    }
    series.recoveries[m] = rec;
  }

  /* ---- §5 new lease commissions ---- */
  const luOn = t.lettingUpSwitch === 'On' ? 1 : 0;
  const firstProb = profile.tenantRenewalProbability;
  const newPct = profile.newCommissionPct;
  const renewPct = profile.renewalCommissionPct;
  const blendedPct = renewPct * firstProb + newPct * (1 - firstProb);
  for (let m = 0; m < N; m++) {
    const g = gen[m];
    if (g === 0) continue;
    const isCommencement =
      timeline.monthEndDays[m] >= d.generations[g - 1].startDays &&
      (m === 0
        ? d.generations[g - 1].startDays >= timeline.monthEndDays[0] - 30
        : gen[m - 1] !== g) &&
      monthsSince(timeline, m, d.generations[g - 1].startDays) === 0;
    if (!isCommencement) continue;
    const annualGross = (series.baseLease[m] + series.carPark[m] + series.recoveries[m]) * 12;
    if (g === 1) {
      // Only a genuine new letting (vacant space leasing up) attracts a commission
      if (isVacant) series.commissions[m] = annualGross * newPct * luOn;
    } else {
      series.commissions[m] = annualGross * blendedPct * luOn;
    }
  }

  /* ---- §6 tenant incentives ---- */
  const tiOn = t.tenantIncentivesSwitch === 'On' ? 1 : 0;
  // 6.1 fitout contributions at future commencements (gens 2..10)
  for (let m = 0; m < N; m++) {
    const g = gen[m];
    if (g > 1 && (m === 0 || gen[m - 1] !== g) && monthsSince(timeline, m, d.generations[g - 1].startDays) === 0) {
      const year = timeline.yearNumbers[m];
      const inc = Math.max(lookupIncentive(profile.incentivePct, year), 0);
      series.incentives[m] += inc * profile.leaseTermYears * marketBaseAnnual[m] * tiOn;
    }
  }
  // 6.2 outstanding contracted incentives (rent free + upfront)
  {
    let freeUsed = 0;
    for (let m = 0; m < N; m++) {
      if (gen[m] === 1 && freeUsed < t.incentives.outstandingRentFreeMonths) {
        series.incentives[m] += baseLeaseG1[m] * t.incentives.pctRentFree;
        freeUsed += 1;
      }
    }
    // Workbook adds the upfront amount every month (CF_Tenant E358); we apply it
    // once at model start — documented correction.
    if (t.incentives.upfrontAmount > 0) series.incentives[0] += t.incentives.upfrontAmount;
  }

  /* ---- §7 capital upgrades on expiry / renewal ---- */
  const capexInputs = ctx.inputs.capex;
  const upExpiryOn = capexInputs.upgradesOnExpiry.on === 'On' ? 1 : 0;
  const upRenewOn = capexInputs.upgradesOnRenewal.on === 'On' ? 1 : 0;
  if (upExpiryOn || upRenewOn) {
    let growthFactor = 1;
    for (let m = 0; m < N; m++) {
      const year = timeline.yearNumbers[m];
      growthFactor *= 1 + monthlyRate(growth.capex(year));
      const me = timeline.monthEndDays[m];
      for (const g of d.generations) {
        if (me === g.expiryDays && upExpiryOn) {
          series.capitalUpgrades[m] += capexInputs.upgradesOnExpiry.ratePerSqm * growthFactor * t.nla;
        }
        if (monthsSince(timeline, m, g.startDays) === 0 && me >= g.startDays && me <= g.expiryDays && upRenewOn) {
          series.capitalUpgrades[m] += capexInputs.upgradesOnRenewal.ratePerSqm * growthFactor * t.nla;
        }
      }
    }
  }

  /* ---- §8 letting-up allowance (reporting) ---- */
  for (let m = 0; m < N; m++) {
    if (gen[m] === 0) series.lettingUp[m] = (marketBaseAnnual[m] + carParkMarketAnnual[m]) / 12;
  }

  return series;
}

function lookupIncentive(arr: number[], year: number): number {
  const idx = Math.min(Math.max(year, 1), arr.length - 1);
  return arr[idx] ?? 0;
}

/** Index-safe month distance between month m's month-end and a start date. */
function monthsSince(timeline: Timeline, m: number, startDays: number): number {
  const me = timeline.monthEnds[m];
  const y = me.getUTCFullYear() * 12 + me.getUTCMonth();
  const sd = new Date(startDays * 86_400_000);
  const s = sd.getUTCFullYear() * 12 + sd.getUTCMonth();
  return y - s;
}

function monthEndDaysOf(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z');
  const eom = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / 86_400_000;
  return Math.round(eom);
}
