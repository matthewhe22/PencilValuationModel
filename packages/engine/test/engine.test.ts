import { describe, expect, it } from 'vitest';
import {
  annuityPV,
  defaultInputs,
  migrateInputs,
  modelStartDate,
  runModel,
  toISO,
  validateInputs,
} from '../src/index';
import { buildTimeline, eomonthISO } from '../src/dates';
import type { ValuationInputs } from '../src/types';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('dates', () => {
  it('EOMONTH conventions match Excel', () => {
    expect(eomonthISO('2021-06-30', 0)).toBe('2021-06-30');
    expect(eomonthISO('2021-06-15', 0)).toBe('2021-06-30');
    expect(eomonthISO('2021-06-15', 1)).toBe('2021-07-31');
    expect(eomonthISO('2024-01-31', 1)).toBe('2024-02-29'); // leap year
    expect(eomonthISO('2021-07-01', 119)).toBe('2031-06-30');
  });

  it('model start = valuation date when on the 1st, else first of next month', () => {
    expect(toISO(modelStartDate('2021-06-30'))).toBe('2021-07-01');
    expect(toISO(modelStartDate('2021-07-01'))).toBe('2021-07-01');
    expect(toISO(modelStartDate('2021-07-02'))).toBe('2021-08-01');
  });

  it('timeline time factors accumulate actual days / 365 (Calc_DCF row 15)', () => {
    const tl = buildTimeline('2021-06-30', 24);
    // July 2021 has 31 days
    expect(tl.timeFactors[0]).toBeCloseTo(31 / 365, 10);
    expect(tl.timeFactors[1]).toBeCloseTo((31 + 31) / 365, 10); // + August
    expect(tl.yearNumbers[11]).toBe(1);
    expect(tl.yearNumbers[12]).toBe(2);
  });
});

describe('annuityPV (Excel -PV equivalent)', () => {
  it('matches the closed form', () => {
    // -PV(0.01, 12, 100) in Excel = 1125.5077...
    expect(annuityPV(0.01, 12, 100)).toBeCloseTo(1125.5077, 3);
    expect(annuityPV(0, 12, 100)).toBe(1200);
    expect(annuityPV(0.01, 0, 100)).toBe(0);
  });
});

describe('single tenant, no growth, fully leased mini-case', () => {
  function miniInputs(): ValuationInputs {
    const inputs = defaultInputs();
    inputs.general.valuationDate = '2025-06-30';
    inputs.general.adoptedValue = 1_000_000;
    inputs.growth = inputs.growth.map(() => ({ cpi: 0, capex: 0, outgoings: 0, carParking: 0 }));
    inputs.marketGrowth.officeGrowth = inputs.marketGrowth.officeGrowth.map(() => 0);
    inputs.marketGrowth.retailGrowth = inputs.marketGrowth.retailGrowth.map(() => 0);
    inputs.capex.upgradesOnExpiry.on = 'Off';
    inputs.otherIncome.forEach((s) => (s.switch = 'Off'));
    inputs.outgoings.statutory = [{ name: 'Rates', amount: 12_000, pcaBenchmark: null }];
    inputs.outgoings.operating = [{ name: 'Opex', amount: 24_000, pcaBenchmark: null }];
    inputs.outgoings.nonRecoverable = [{ name: 'NR', amount: 6_000, pcaBenchmark: null }];
    inputs.tenants = [
      {
        ...defaultInputs().tenants[1],
        id: 'only',
        suite: 'Whole',
        use: 'Office',
        nla: 1000,
        marketRentPerSqm: 100, // net face
        marketBasis: 'N',
        status: 'Leased',
        tenantName: 'Solo',
        leaseStart: '2020-07-01',
        leaseExpiry: '2040-06-30', // never expires within the model
        nextReviewDate: '', // no reviews
        profileNumber: 1,
        currentLeaseType: 'Net',
        baseRentPa: 120_000,
        recoveries: 'Yes',
        baseYearRecoveriesPa: 0,
        pctOutgoingsRecovered: null,
        carParking: { spaces: 0, rentPa: 0, marketRatePcm: 0 },
        incentives: { outstandingRentFreeMonths: 0, pctRentFree: 0, upfrontAmount: 0 },
      },
    ];
    return inputs;
  }

  it('monthly income = rent + full recoveries; net CF = rent - non-recoverables', () => {
    const r = runModel(miniInputs());
    const m1 = r.dcf.monthly[0];
    // Base rent 120000/12 = 10000; recoveries = full 36000/12 = 3000 (net lease, 100% share)
    expect(m1.grossLeaseIncome).toBeCloseTo(10_000, 6);
    expect(m1.outgoingsRecovered).toBeCloseTo(3_000, 6);
    expect(m1.totalOutgoings).toBeCloseTo(3_500, 6); // 42000/12
    expect(m1.netCashflow).toBeCloseTo(10_000 + 3_000 - 3_500, 6);
    // stays flat with zero growth
    const m60 = r.dcf.monthly[59];
    expect(m60.netCashflow).toBeCloseTo(m1.netCashflow, 6);
  });

  it('terminal value = (market - outgoings)/terminal yield + reversions, less selling costs', () => {
    const inputs = miniInputs();
    const r = runModel(inputs);
    const t = r.dcf.terminal;
    // gross face psm = net 100 + recoverable outgoings 36000/1000 = 136 => 136000 pa
    expect(t.annualisedGrossMarket).toBeCloseTo(136_000, 4);
    expect(t.annualisedOutgoings).toBeCloseTo(42_000, 4);
    expect(t.netIncome).toBeCloseTo(94_000, 4);
    expect(t.valueBeforeAdjustments).toBeCloseTo(94_000 / inputs.dcf.terminalYield, 2);
    // passing gross = 10000+3000=13000/mo => 156000 pa vs market 136000 => reversions 20000
    expect(t.rentalReversions).toBeCloseTo(156_000 - 136_000, 2);
    expect(t.valueBeforeDiscounting).toBeCloseTo(t.grossRealisation * 0.99, 2);
  });

  it('NPV equals hand-computed discounted sum', () => {
    const inputs = miniInputs();
    const r = runModel(inputs);
    let pv = 0;
    for (const m of r.dcf.monthly.slice(0, 120)) {
      pv += m.netCashflow / Math.pow(1 + inputs.dcf.discountRate, m.timeFactor);
    }
    expect(r.dcf.pvOfCashflows).toBeCloseTo(pv, 4);
    const tvMonth = r.dcf.monthly[120];
    const tvDisc =
      r.dcf.terminal.valueBeforeDiscounting /
      Math.pow(1 + inputs.dcf.discountRate, tvMonth.timeFactor);
    expect(r.dcf.presentValueTotal).toBeCloseTo(pv + tvDisc, 4);
    expect(r.dcf.capitalValue).toBeCloseTo((pv + tvDisc) / 1.06, 4);
  });

  it('cap value = adjusted net market income / cap rate + adjustments', () => {
    const inputs = miniInputs();
    const r = runModel(inputs);
    expect(r.cap.grossBaseMarketIncome).toBeCloseTo(136_000, 4);
    expect(r.cap.estimatedNetMarketIncome).toBeCloseTo(94_000, 4);
    expect(r.cap.coreCapitalValue).toBeCloseTo(94_000 / inputs.staticAssumptions.coreCapRate, 2);
    // Passing above market => positive reversion adjustment, no LUA/commissions
    // (expiry far outside the 12-month window)
    expect(r.cap.adjustments.pvLettingUp).toBeCloseTo(0, 10);
    expect(r.cap.adjustments.pvCommissions).toBeCloseTo(0, 10);
    expect(r.cap.adjustments.pvRentalReversions).toBeGreaterThan(0);
  });

  it('IRR reproduces the adopted value when adopted = capital value', () => {
    const inputs = miniInputs();
    const first = runModel(inputs);
    inputs.general.adoptedValue = first.dcf.capitalValue;
    const r = runModel(inputs);
    // If you pay exactly the DCF capital value (plus costs), IRR == discount rate
    expect(r.dcf.irr).not.toBeNull();
    expect(r.dcf.irr!).toBeCloseTo(inputs.dcf.discountRate, 4);
  });
});

describe('vacant tenancy behaviour', () => {
  it('vacant space earns nothing during letting-up, then market rent', () => {
    const inputs = defaultInputs();
    inputs.growth = inputs.growth.map(() => ({ cpi: 0, capex: 0, outgoings: 0, carParking: 0 }));
    inputs.marketGrowth.officeGrowth = inputs.marketGrowth.officeGrowth.map(() => 0);
    inputs.capex.upgradesOnExpiry.on = 'Off';
    inputs.otherIncome.forEach((s) => (s.switch = 'Off'));
    inputs.outgoings.statutory = [];
    inputs.outgoings.operating = [];
    inputs.outgoings.nonRecoverable = [];
    inputs.profiles[0].lettingUpMonths = [6, ...Array(11).fill(6)];
    inputs.tenants = [
      {
        ...defaultInputs().tenants[2],
        id: 'v1',
        suite: 'L2',
        use: 'Office',
        nla: 100,
        marketRentPerSqm: 100,
        marketBasis: 'N',
        status: 'Vacant',
        profileNumber: 1,
        baseRentPa: 0,
        carParking: { spaces: 0, rentPa: 0, marketRatePcm: 0 },
      },
    ];
    const r = runModel(inputs);
    const s = r.tenants[0].series;
    // 6 months letting up => months 1..6 vacant, month 7 onwards leased at market
    for (let m = 0; m < 6; m++) expect(s.baseLease[m]).toBe(0);
    expect(s.baseLease[6]).toBeCloseTo((100 * 100) / 12, 6); // net market (no outgoings)
    // letting-up allowance recorded during vacancy
    expect(s.lettingUp[0]).toBeGreaterThan(0);
    expect(s.lettingUp[6]).toBe(0);
    // a new-lease commission lands at commencement
    expect(s.commissions[6]).toBeGreaterThan(0);
    // static adjustments: vacant tenancy has letting-up + commission PV costs
    expect(r.cap.adjustments.pvLettingUp).toBeLessThan(0);
    expect(r.cap.adjustments.pvCommissions).toBeLessThan(0);
  });
});

describe('lease expiry and renewal cycle', () => {
  it('expiry within the model creates probability-weighted downtime', () => {
    const inputs = defaultInputs();
    inputs.general.valuationDate = '2025-06-30';
    inputs.growth = inputs.growth.map(() => ({ cpi: 0, capex: 0, outgoings: 0, carParking: 0 }));
    inputs.marketGrowth.officeGrowth = inputs.marketGrowth.officeGrowth.map(() => 0);
    inputs.otherIncome.forEach((s) => (s.switch = 'Off'));
    inputs.capex.upgradesOnExpiry.on = 'Off';
    inputs.outgoings.statutory = [];
    inputs.outgoings.operating = [];
    inputs.outgoings.nonRecoverable = [];
    inputs.profiles[0].lettingUpMonths = [6, ...Array(11).fill(10)];
    inputs.profiles[0].tenantRenewalProbability = 0.7; // ceil(10*0.3)=3 months downtime
    inputs.profiles[0].leaseTermYears = 5;
    inputs.tenants = [
      {
        ...defaultInputs().tenants[1],
        id: 'e1',
        suite: 'L1',
        use: 'Office',
        nla: 100,
        marketRentPerSqm: 100,
        marketBasis: 'N',
        status: 'Leased',
        tenantName: 'Expirer',
        leaseStart: '2023-07-01',
        leaseExpiry: '2026-06-30', // expires end of model year 1
        nextReviewDate: '',
        profileNumber: 1,
        currentLeaseType: 'Net',
        baseRentPa: 9_000,
        recoveries: 'No',
        carParking: { spaces: 0, rentPa: 0, marketRatePcm: 0 },
      },
    ];
    const r = runModel(inputs);
    const s = r.tenants[0].series;
    // Months 1..12 (Jul25-Jun26): occupied gen 1 at passing 750/mo
    expect(s.generation[0]).toBe(1);
    expect(s.baseLease[0]).toBeCloseTo(750, 6);
    expect(s.generation[11]).toBe(1);
    // Months 13..15: downtime (ceil(10 * (1-0.7)) = 3)
    expect(s.generation[12]).toBe(0);
    expect(s.generation[14]).toBe(0);
    // Month 16: renewal at market (net 100*100/12)
    expect(s.generation[15]).toBe(2);
    expect(s.baseLease[15]).toBeCloseTo(10_000 / 12, 4);
    // Commission paid at renewal commencement: blended rate on annualised gross
    const blended = 0.06 * 0.7 + 0.12 * 0.3;
    expect(s.commissions[15]).toBeCloseTo(10_000 * blended, 3);
  });
});

describe('validation', () => {
  it('flags missing lease dates and double R&M switches', () => {
    const inputs = defaultInputs();
    inputs.tenants[0].leaseStart = '';
    inputs.staticAssumptions.structuralRMPctOfIncome.on = 'On';
    inputs.staticAssumptions.structuralRMFixedAmount.on = 'On';
    const issues = validateInputs(inputs);
    expect(issues.some((i) => i.message.includes('Lease start date'))).toBe(true);
    expect(issues.some((i) => i.message.includes('both structural R&M'))).toBe(true);
  });

  it('flags fixed-term other income beyond the model end', () => {
    const inputs = defaultInputs();
    inputs.otherIncome[0] = {
      ...inputs.otherIncome[0],
      switch: 'On',
      basis: 'Fixed-term',
      monthlyAmount: 100,
      endDate: '2099-01-01',
    };
    const issues = validateInputs(inputs);
    expect(issues.some((i) => i.message.includes('Year Model'))).toBe(true);
  });
});

describe('migrations & defaults', () => {
  it('default inputs produce a full, coherent result', () => {
    const r = runModel(defaultInputs());
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.nla).toBe(1220);
    expect(r.dcf.monthly).toHaveLength(132);
    expect(r.dcf.capitalValue).toBeGreaterThan(0);
    expect(r.cap.adjustedCoreCapitalValue).toBeGreaterThan(0);
    expect(r.analysis.expiryProfile.length).toBe(11);
    expect(r.rates.office).toHaveLength(12);
    expect(r.dcf.npvSensitivity[1][1].value).toBeCloseTo(r.dcf.capitalValue, 2);
  });

  it('migrateInputs round-trips and fills gaps', () => {
    const doc = clone(defaultInputs()) as unknown as Record<string, unknown>;
    delete (doc as { capex?: unknown }).capex;
    const migrated = migrateInputs(doc);
    expect(migrated.capex.upgradesOnExpiry.on).toBe('On');
    expect(migrated.tenants).toHaveLength(3);
  });
});

describe('other income', () => {
  it('perpetuity source adds to income, cap value and terminal value', () => {
    const inputs = defaultInputs();
    inputs.otherIncome[0] = {
      switch: 'On',
      typeOfIncome: 'Signage',
      tenantName: 'Telco',
      monthlyAmount: 1000,
      currentlyReceived: 'Yes',
      basis: 'Perpetuity',
      startDate: '',
      endDate: '',
      capRateOverride: null,
      discountRateOverride: null,
      growthProfile: null,
    };
    const r = runModel(inputs);
    expect(r.dcf.monthly[0].additionalIncome).toBeCloseTo(1000, 6);
    const oi = r.otherIncome[0];
    expect(oi.capValue).toBeCloseTo(12_000 / inputs.staticAssumptions.coreCapRate, 2);
    expect(oi.terminalContribution).toBeGreaterThan(0);
  });
});
