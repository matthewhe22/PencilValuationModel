/**
 * Input document schema for the Pencil (REAS) Valuation Model.
 *
 * This mirrors the workbook's three input sheets:
 *   IP_Assumptions, IP_Schedule, IP_Outgoings
 *
 * The document is JSON-serialisable and carries a schemaVersion so future
 * versions (v2 backend/database) can migrate stored valuations.
 */

/** ISO date string, e.g. "2021-06-30" */
export type ISODate = string;

export type Purpose = 'Valuation' | 'Sale Analysis';
export type OnOff = 'On' | 'Off';
export type YesNo = 'Yes' | 'No';
export type RentBasis = 'N' | 'G'; // Net / Gross
export type LeaseType = 'Net' | 'Gross' | 'Semi-Gross';
export type TenantStatus = 'Leased' | 'Vacant';
/** Review types, as in IP_Schedule columns CB..CM */
export type ReviewType = 'CPI' | 'F' | 'M' | 'Man' | null;

/** Names available in the Market Growth list (IP_Assumptions §9.3). */
export type GrowthProfileName =
  | 'CPI'
  | 'Default - Office'
  | 'Default - Retail'
  | 'Car Parking';

export interface ValuerDetails {
  name: string;
  qualifications: string;
  registrationNumber: string;
  position: string;
}

/** IP_Assumptions §1 */
export interface GeneralInputs {
  purpose: Purpose;
  /** Valuation date (or sale date for Sale Analysis) */
  valuationDate: ISODate;
  /** Adopted value (or sale price) */
  adoptedValue: number;
  adoptedValueText: string;
  buildingName: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  vendorOwner: string;
  client: string;
  assetType: string;
  buildingGrade: string;
  inspectionDate: ISODate | '';
  landArea: number;
  typicalFloorPlates: string;
  interestValued: string;
  improvementDescription: string;
  majorBuildingIssues: string;
  marketComment: string;
  valuer: ValuerDetails;
}

/** IP_Assumptions §2 */
export interface CostInputs {
  /** Selling costs, % of sale cost (e.g. 0.01) */
  sellingCostPct: number;
  /** Acquisition costs, % (e.g. 0.06) */
  acquisitionCostPct: number;
}

/** IP_Assumptions §3 — one of up to 10 vacant space profiles */
export interface VacantSpaceProfile {
  label: string;
  leaseTermYears: number;
  /** Review frequency to market in years; null = "None" (treated as 10 years in months) */
  reviewFrequencyYears: number | null;
  ratchetOnNewLeases: YesNo;
  tenantRenewalProbability: number;
  /** Renewal leasing commission, % of year-1 gross rent */
  renewalCommissionPct: number;
  /** New leasing commission, % of year-1 gross rent */
  newCommissionPct: number;
  /** Letting-up allowance months: index 0 = currently vacant space; 1..11 = expiry in model year 1..11 */
  lettingUpMonths: number[];
  /** Incentive %, same indexing as lettingUpMonths */
  incentivePct: number[];
}

/** IP_Assumptions §4 */
export interface StaticAssumptions {
  capitaliseMarketRents: 'Face' | 'Effective';
  coreCapRate: number;
  /** Optional upper-limit cap rate for the value range column */
  coreCapRateUpper: number | null;
  capRateSensitivity: number;
  /** Discount rate applied to PV analysis (annual) */
  pvDiscountRate: number;
  /** Allowance captured for tenants expiring within N months */
  reversionWindowMonths: number;
  deductCapexFromCapitalValue: YesNo;
  capexMonthsDeducted: number;
  capitalisationVacancyAllowance: number;
  /** §7 Cap-approach structural R&M switches */
  structuralRMPctOfIncome: { on: OnOff; pct: number };
  structuralRMFixedAmount: { on: OnOff; amount: number };
  /** Manual adjustment to adjusted core capital value */
  manualAdjustment: number;
}

/** IP_Assumptions §5 */
export interface DcfAssumptions {
  discountPeriodYears: number;
  discountRate: number;
  terminalYield: number;
  discountRateSensitivity: number;
  terminalYieldSensitivity: number;
  adoptedValueIrrSensitivity: number;
}

/** IP_Assumptions §6 — other income source (up to 6) */
export interface OtherIncomeSource {
  switch: OnOff;
  typeOfIncome: string;
  tenantName: string;
  monthlyAmount: number;
  currentlyReceived: YesNo;
  basis: 'Fixed-term' | 'Perpetuity';
  startDate: ISODate | '';
  endDate: ISODate | '';
  capRateOverride: number | null;
  discountRateOverride: number | null;
  /** Growth profile applied from valuation date (name from market-growth list), or null for none */
  growthProfile: GrowthProfileName | null;
}

export interface SpecifiedCapexRow {
  /** Income $ for that model year */
  income: number;
  /** Expenditure $ for that model year */
  expenditure: number;
  comment: string;
}

/** IP_Assumptions §7 */
export interface CapexInputs {
  fixedContribution: { on: OnOff; amountPa: number };
  sinkingFund: { on: OnOff; ratePerSqmPa: number };
  upgradesOnExpiry: { on: OnOff; ratePerSqm: number };
  upgradesOnRenewal: { on: OnOff; ratePerSqm: number };
  specifiedByDate: { on: OnOff; rows: SpecifiedCapexRow[] }; // model years 1..11
}

/** IP_Assumptions §8 — one row per model year 0..11 */
export interface GrowthYearRow {
  cpi: number;
  capex: number;
  outgoings: number;
  carParking: number;
}

/** IP_Assumptions §9.1/9.2 — market rent growth, model years 0..11 */
export interface MarketGrowthInputs {
  /** Gross face growth rate per model year (index 0 unused for growth; kept for symmetry) */
  officeGrowth: number[];
  retailGrowth: number[];
}

export interface TenantIncentiveInputs {
  outstandingRentFreeMonths: number;
  pctRentFree: number;
  upfrontAmount: number;
}

export interface CarParkingInputs {
  spaces: number;
  /** Current passing car parking rent, $ p.a. */
  rentPa: number;
  /** Market rate, $ per space per calendar month */
  marketRatePcm: number;
}

/** One row of IP_Schedule */
export interface TenantRow {
  id: string;
  suite: string;
  use: string; // Office / Retail / Car Parking / ...
  nla: number;
  /** Market rental basis: Net or Gross face */
  marketBasis: RentBasis;
  /** Face market rent, $/m² p.a. (net or gross per marketBasis) */
  marketRentPerSqm: number;
  /** Outgoings override $/m² (blank = building recoverable outgoings / NLA) */
  outgoingsOverridePerSqm: number | null;
  growthProfile: GrowthProfileName;
  status: TenantStatus;
  tenantName: string;
  leaseStart: ISODate | '';
  leaseExpiry: ISODate | '';
  nextReviewDate: ISODate | '';
  /** Area/income tags used by OP_Analysis top-10 grouping (defaults to row order) */
  areaTag: number | null;
  incomeTag: number | null;
  /** Vacant space profile number 1..10 */
  profileNumber: number;
  /** Review types for reviews 1..12 of the current lease */
  reviewTypes: ReviewType[];
  /** Fixed review rate or manual override amount for reviews 1..12 */
  reviewRates: (number | null)[];
  currentLeaseType: LeaseType;
  ratchet: YesNo;
  baseRentPa: number;
  recoveries: YesNo;
  /** Base year recoveries amount $ p.a. (net leases) */
  baseYearRecoveriesPa: number;
  /** % of outgoings recovered (null/blank = 100%) */
  pctOutgoingsRecovered: number | null;
  carParking: CarParkingInputs;
  incentives: TenantIncentiveInputs;
  lettingUpSwitch: OnOff;
  tenantIncentivesSwitch: OnOff;
}

export interface OutgoingLine {
  name: string;
  amount: number;
  pcaBenchmark: number | null;
}

/** IP_Outgoings */
export interface OutgoingsInputs {
  statutory: OutgoingLine[];
  operating: OutgoingLine[];
  nonRecoverable: OutgoingLine[];
}

export interface ValuationInputs {
  schemaVersion: number;
  general: GeneralInputs;
  costs: CostInputs;
  profiles: VacantSpaceProfile[]; // exactly 10
  staticAssumptions: StaticAssumptions;
  dcf: DcfAssumptions;
  otherIncome: OtherIncomeSource[]; // exactly 6
  capex: CapexInputs;
  growth: GrowthYearRow[]; // model years 0..11 (12 rows)
  marketGrowth: MarketGrowthInputs;
  tenants: TenantRow[];
  outgoings: OutgoingsInputs;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface MonthlySeries {
  /** Base lease income (per month) */
  baseLease: number[];
  /** Car park lease income */
  carPark: number[];
  /** Outgoings recovered */
  recoveries: number[];
  /** New lease commissions (cost, positive) */
  commissions: number[];
  /** Tenant incentives (cost, positive) */
  incentives: number[];
  /** Capital upgrades on expiry/renewal (cost, positive) */
  capitalUpgrades: number[];
  /** Annualised gross market income (excl. car parking) */
  annualisedGrossMarket: number[];
  /** Letting-up allowance (vacancy at market, reporting only) */
  lettingUp: number[];
  /** Tenancy generation occupying each month (1..10) or 0 = vacant */
  generation: number[];
}

export interface TenantStatics {
  id: string;
  label: string;
  /** Months to reversion event (from model start) */
  reversionMonths: number;
  /** PV of rental reversion (passing - market to expiry); positive => passing above market */
  pvRentalReversion: number;
  /** PV of letting-up allowance within the reversion window (positive cost) */
  pvLettingUp: number;
  /** PV of leasing commissions within the reversion window (positive cost) */
  pvCommissions: number;
  /** PV of outstanding (contracted) incentives (positive cost) */
  pvOutstandingIncentives: number;
  nominalOutstandingIncentives: number;
  /** PV of tenant incentives on reversion (positive cost) */
  pvTenantIncentives: number;
  /** Gross passing income $ p.a. (base + recoveries dash + car park) */
  grossPassingPa: number;
  basePassingPa: number;
  /** Gross face market income $ p.a. (base incl. og + car park at market) */
  grossFaceMarketPa: number;
  grossEffectiveMarketPa: number;
  netMarketPa: number;
  /** Recoveries $ p.a. shown on dashboards */
  recoveriesPa: number;
  unexpiredTermYears: number;
}

export interface TenantResult {
  input: TenantRow;
  series: MonthlySeries;
  statics: TenantStatics;
}

export interface BuildingCashflowMonth {
  monthIndex: number; // 1-based
  monthEnd: ISODate;
  yearNumber: number;
  annualisedGrossMarket: number;
  grossLeaseIncome: number;
  outgoingsRecovered: number;
  grossPassingRental: number;
  additionalIncome: number;
  grossPassingIncome: number;
  statutoryExpenses: number;
  operatingExpenses: number;
  nonRecoverableExpenses: number;
  totalOutgoings: number;
  commissions: number;
  incentives: number;
  netCashflowPreCapex: number;
  buildingCapexFixed: number;
  buildingCapexSinking: number;
  buildingCapexSpecified: number;
  tenantCapitalUpgrades: number;
  totalCapex: number;
  netCashflow: number;
  /** Cumulative time factor (days/365) for discounting */
  timeFactor: number;
}

export interface BuildingCashflowYear {
  year: number;
  yearEnd: ISODate;
  grossMarketIncome: number;
  grossLeaseIncome: number;
  outgoingsRecovered: number;
  grossPassingRental: number;
  additionalIncome: number;
  grossPassingIncome: number;
  statutoryExpenses: number;
  operatingExpenses: number;
  nonRecoverableExpenses: number;
  totalOutgoings: number;
  commissions: number;
  incentives: number;
  netCashflowPreCapex: number;
  totalCapex: number;
  netCashflow: number;
  runningYieldPreCapex: number;
}

export interface SensitivityCell {
  discountRate: number;
  terminalYield: number;
  value: number;
}

export interface DcfResults {
  monthly: BuildingCashflowMonth[];
  annual: BuildingCashflowYear[];
  discountRate: number;
  terminalYield: number;
  /** Terminal value analysis at the TV month (first month after the discount period) */
  terminal: {
    monthIndex: number;
    annualisedGrossMarket: number;
    annualisedOutgoings: number;
    netIncome: number;
    valueBeforeAdjustments: number;
    rentalReversions: number;
    additionalIncome: number;
    grossRealisation: number;
    sellingCosts: number;
    valueBeforeDiscounting: number;
    discountedTerminalValue: number;
  };
  pvOfCashflows: number;
  presentValueTotal: number; // PV of CF + discounted TV
  lessPurchaseCosts: number;
  capitalValue: number; // after acquisition costs
  capitalValueRounded: number;
  npvSensitivity: SensitivityCell[][]; // 3x3 discount x terminal
  irr: number | null;
  irrSensitivity: { adoptedValue: number; terminalYield: number; irr: number | null }[][];
}

export interface CapResults {
  grossBaseMarketIncome: number;
  carParkingMarketIncome: number;
  outgoingsY1: number;
  estimatedNetMarketIncome: number;
  vacancyAllowance: number;
  rmAllowance: number;
  adjustedNetMarketIncome: number;
  coreCapRate: number;
  coreCapitalValue: number;
  adjustments: {
    pvRentalReversions: number;
    pvLettingUp: number;
    pvCommissions: number;
    pvOutstandingIncentives: number;
    pvTenantIncentives: number;
    pvCapex: number;
    additionalIncome: number;
    manualAdjustment: number;
  };
  adjustedCoreCapitalValue: number;
  ratePerSqm: number;
  capitalisationValue: number; // rounded to -5
  /** Yield analysis vs adopted value */
  yields: {
    adoptedValue: number;
    netMarketRent: number;
    netPassingIncome: number;
    netPassingFullyLeased: number;
    netPassingInitialYield: number;
    initialYieldFullyLeased: number;
    equivalentMarketYield: number;
    reversionaryYield: number;
    passingMarketRelativity: number;
  };
  sensitivity: { capRate: number; coreValue: number; adjustedValue: number; ratePerSqm: number }[];
}

export interface OtherIncomeResult {
  index: number;
  source: OtherIncomeSource;
  active: boolean;
  annualisedTotal: number;
  capValue: number | null;
  terminalContribution: number;
}

export interface ExpiryBucket {
  label: string;
  yearEnd: ISODate | null;
  tenantCount: number;
  nla: number;
  pctOfNla: number;
}

export interface TopTenRow {
  rank: number;
  name: string;
  value: number; // NLA or income
  pct: number;
  carParks: number;
  ratePerSqm?: number;
}

export interface AnalysisResults {
  wale: { byIncomeYears: number; byAreaYears: number };
  topByArea: TopTenRow[];
  topByIncome: TopTenRow[];
  vacantNla: number;
  vacantPct: number;
  expiryProfile: ExpiryBucket[];
  totalGrossPassingIncome: number;
  weightedNewLeaseTermYears: number;
}

export interface RatesTableRow {
  year: number | 'Current';
  grossFace: number;
  grossFaceGrowth: number | null;
  netFace: number;
  netFaceGrowth: number | null;
  incentive: number;
  grossEffective: number;
  grossEffectiveGrowth: number | null;
  netEffective: number;
  netEffectiveGrowth: number | null;
  outgoings: number;
}

export interface RatesResults {
  office: RatesTableRow[];
  retail: RatesTableRow[];
  officeCompound: { y3: number; y5: number; y10: number; grossEff3: number; grossEff5: number; grossEff10: number };
  retailCompound: { y3: number; y5: number; y10: number; grossEff3: number; grossEff5: number; grossEff10: number };
  cpi10yr: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  location: string;
  message: string;
}

export interface ModelResults {
  inputs: ValuationInputs;
  modelStart: ISODate;
  modelEnd: ISODate;
  nla: number;
  totalMonths: number;
  tenants: TenantResult[];
  otherIncome: OtherIncomeResult[];
  outgoingsTotals: {
    statutory: number;
    operating: number;
    recoverable: number;
    nonRecoverable: number;
    total: number;
    recoverablePerSqm: number;
    totalPerSqm: number;
  };
  dcf: DcfResults;
  cap: CapResults;
  analysis: AnalysisResults;
  rates: RatesResults;
  issues: ValidationIssue[];
}
