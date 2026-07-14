/**
 * Default input document — assumption values match the workbook template,
 * seeded with a small worked example so every output page renders.
 */
import type {
  GrowthYearRow,
  OtherIncomeSource,
  TenantRow,
  ValuationInputs,
  VacantSpaceProfile,
} from './types';

export const SCHEMA_VERSION = 1;

const lettingUp = (vacant: number, each: number): number[] => [
  vacant,
  ...Array.from({ length: 11 }, () => each),
];
const incentives = (vacant: number, each: number): number[] => [
  vacant,
  ...Array.from({ length: 11 }, () => each),
];

export function defaultProfiles(): VacantSpaceProfile[] {
  const base = (label: string): VacantSpaceProfile => ({
    label,
    leaseTermYears: 5,
    reviewFrequencyYears: 1,
    ratchetOnNewLeases: 'No',
    tenantRenewalProbability: 0.7,
    renewalCommissionPct: 0.06,
    newCommissionPct: 0.12,
    lettingUpMonths: lettingUp(6, 6),
    incentivePct: incentives(0.2, 0.2),
  });
  return [
    { ...base('Office'), leaseTermYears: 10 },
    {
      ...base('Retail'),
      tenantRenewalProbability: 0.5,
      lettingUpMonths: lettingUp(6, 6),
      incentivePct: incentives(0.1, 0.1),
    },
    {
      ...base('Car Parking'),
      leaseTermYears: 10,
      renewalCommissionPct: 0,
      incentivePct: incentives(0, 0),
    },
    {
      ...base('Communications'),
      leaseTermYears: 1,
      incentivePct: incentives(0, 0),
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      ...base(`Profile ${i + 5}`),
      incentivePct: incentives(0, 0),
    })),
  ];
}

export function defaultOtherIncome(): OtherIncomeSource[] {
  return Array.from({ length: 6 }, () => ({
    switch: 'Off' as const,
    typeOfIncome: '',
    tenantName: '',
    monthlyAmount: 0,
    currentlyReceived: 'Yes' as const,
    basis: 'Perpetuity' as const,
    startDate: '',
    endDate: '',
    capRateOverride: null,
    discountRateOverride: null,
    growthProfile: null,
  }));
}

export function defaultGrowth(): GrowthYearRow[] {
  return Array.from({ length: 12 }, () => ({
    cpi: 0.025,
    capex: 0,
    outgoings: 0.025,
    carParking: 0.025,
  }));
}

function tenant(partial: Partial<TenantRow> & { id: string }): TenantRow {
  return {
    suite: '',
    use: 'Office',
    nla: 0,
    marketBasis: 'N',
    marketRentPerSqm: 0,
    outgoingsOverridePerSqm: null,
    growthProfile: 'Default - Office',
    status: 'Leased',
    tenantName: '',
    leaseStart: '',
    leaseExpiry: '',
    nextReviewDate: '',
    areaTag: null,
    incomeTag: null,
    profileNumber: 1,
    reviewTypes: Array.from({ length: 12 }, () => 'F' as const),
    reviewRates: Array.from({ length: 12 }, () => 0.04),
    currentLeaseType: 'Net',
    ratchet: 'No',
    baseRentPa: 0,
    recoveries: 'Yes',
    baseYearRecoveriesPa: 0,
    pctOutgoingsRecovered: null,
    carParking: { spaces: 0, rentPa: 0, marketRatePcm: 0 },
    incentives: { outstandingRentFreeMonths: 0, pctRentFree: 0, upfrontAmount: 0 },
    lettingUpSwitch: 'On',
    tenantIncentivesSwitch: 'Off',
    ...partial,
  };
}

export function defaultInputs(): ValuationInputs {
  return {
    schemaVersion: SCHEMA_VERSION,
    general: {
      purpose: 'Valuation',
      valuationDate: '2025-06-30',
      adoptedValue: 12_000_000,
      adoptedValueText: 'Twelve million dollars',
      buildingName: 'Example House',
      address: '1 Example Street',
      city: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      vendorOwner: 'Example Nominees Pty Ltd',
      client: 'Example Client Pty Ltd',
      assetType: 'Office',
      buildingGrade: 'B Grade',
      inspectionDate: '2025-06-15',
      landArea: 1200,
      typicalFloorPlates: '450 m²',
      interestValued: 'Unencumbered freehold interest subject to existing tenancies',
      improvementDescription: '',
      majorBuildingIssues: '',
      marketComment: '',
      valuer: { name: '', qualifications: '', registrationNumber: '', position: '' },
    },
    costs: { sellingCostPct: 0.01, acquisitionCostPct: 0.06 },
    profiles: defaultProfiles(),
    staticAssumptions: {
      capitaliseMarketRents: 'Face',
      coreCapRate: 0.065,
      coreCapRateUpper: null,
      capRateSensitivity: 0.0025,
      pvDiscountRate: 0.07,
      reversionWindowMonths: 12,
      deductCapexFromCapitalValue: 'Yes',
      capexMonthsDeducted: 12,
      capitalisationVacancyAllowance: 0,
      structuralRMPctOfIncome: { on: 'Off', pct: 0 },
      structuralRMFixedAmount: { on: 'Off', amount: 0 },
      manualAdjustment: 0,
    },
    dcf: {
      discountPeriodYears: 10,
      discountRate: 0.0725,
      terminalYield: 0.07,
      discountRateSensitivity: 0.005,
      terminalYieldSensitivity: 0.005,
      adoptedValueIrrSensitivity: 0.005,
    },
    otherIncome: defaultOtherIncome(),
    capex: {
      fixedContribution: { on: 'Off', amountPa: 0 },
      sinkingFund: { on: 'Off', ratePerSqmPa: 0 },
      upgradesOnExpiry: { on: 'On', ratePerSqm: 100 },
      upgradesOnRenewal: { on: 'Off', ratePerSqm: 0 },
      specifiedByDate: {
        on: 'Off',
        rows: Array.from({ length: 11 }, () => ({ income: 0, expenditure: 0, comment: '' })),
      },
    },
    growth: defaultGrowth(),
    marketGrowth: {
      officeGrowth: Array.from({ length: 12 }, () => 0.035),
      retailGrowth: Array.from({ length: 12 }, () => 0.025),
    },
    tenants: [
      tenant({
        id: 't1',
        suite: 'Ground',
        use: 'Retail',
        nla: 320,
        marketRentPerSqm: 620,
        growthProfile: 'Default - Retail',
        tenantName: 'Harbour Espresso',
        leaseStart: '2022-07-01',
        leaseExpiry: '2027-06-30',
        nextReviewDate: '2025-07-01',
        profileNumber: 2,
        currentLeaseType: 'Net',
        baseRentPa: 192_000,
        carParking: { spaces: 2, rentPa: 6_000, marketRatePcm: 280 },
      }),
      tenant({
        id: 't2',
        suite: 'Level 1',
        use: 'Office',
        nla: 450,
        marketRentPerSqm: 480,
        tenantName: 'Meridian Consulting',
        leaseStart: '2021-01-01',
        leaseExpiry: '2028-12-31',
        nextReviewDate: '2026-01-01',
        profileNumber: 1,
        currentLeaseType: 'Net',
        baseRentPa: 210_000,
        carParking: { spaces: 4, rentPa: 14_400, marketRatePcm: 300 },
        incentives: { outstandingRentFreeMonths: 0, pctRentFree: 0, upfrontAmount: 0 },
      }),
      tenant({
        id: 't3',
        suite: 'Level 2',
        use: 'Office',
        nla: 450,
        marketRentPerSqm: 470,
        status: 'Vacant',
        tenantName: '',
        profileNumber: 1,
        currentLeaseType: 'Net',
        baseRentPa: 0,
      }),
    ],
    outgoings: {
      statutory: [
        { name: 'Council rates', amount: 38_000, pcaBenchmark: null },
        { name: 'Water rates', amount: 9_500, pcaBenchmark: null },
        { name: 'Land tax', amount: 42_000, pcaBenchmark: null },
        { name: '', amount: 0, pcaBenchmark: null },
        { name: '', amount: 0, pcaBenchmark: null },
        { name: '', amount: 0, pcaBenchmark: null },
      ],
      operating: [
        { name: 'Air conditioning / ventilation', amount: 26_000, pcaBenchmark: null },
        { name: 'Cleaning', amount: 22_000, pcaBenchmark: null },
        { name: 'Electricity & gas', amount: 18_500, pcaBenchmark: null },
        { name: 'Fire protection', amount: 6_500, pcaBenchmark: null },
        { name: 'Insurance', amount: 14_000, pcaBenchmark: null },
        { name: 'Lifts & escalators', amount: 12_000, pcaBenchmark: null },
        { name: 'Management fees', amount: 24_000, pcaBenchmark: null },
        { name: 'Repairs & maintenance', amount: 28_000, pcaBenchmark: null },
        { name: 'Security', amount: 8_000, pcaBenchmark: null },
        ...Array.from({ length: 10 }, () => ({ name: '', amount: 0, pcaBenchmark: null })),
      ],
      nonRecoverable: [
        { name: 'Non-recoverable management', amount: 5_000, pcaBenchmark: null },
        ...Array.from({ length: 5 }, () => ({ name: '', amount: 0, pcaBenchmark: null })),
      ],
    },
  };
}
