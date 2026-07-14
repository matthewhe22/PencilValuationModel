/**
 * Input validation — mirrors the workbook's error checks (IP_Schedule row 23,
 * the 10-year model bound on other income, and the R&M double-switch check).
 */
import type { ValidationIssue, ValuationInputs } from './types';
import { eomonthISO, modelStartDate, toISO } from './dates';

export function validateInputs(inputs: ValuationInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (location: string, message: string) =>
    issues.push({ severity: 'error', location, message });
  const warn = (location: string, message: string) =>
    issues.push({ severity: 'warning', location, message });

  if (!inputs.general.valuationDate) {
    err('General', 'Valuation date is required.');
    return issues;
  }
  if (!(inputs.general.adoptedValue > 0)) {
    warn('General', 'Adopted value is blank — IRR and yield analysis will be unavailable.');
  }
  if (inputs.tenants.length === 0) {
    err('Tenancy Schedule', 'At least one tenancy row is required.');
  }

  const modelStart = toISO(modelStartDate(inputs.general.valuationDate));
  const modelEnd = eomonthISO(modelStart, inputs.dcf.discountPeriodYears * 12 - 1);

  inputs.tenants.forEach((t, i) => {
    const loc = `Tenant ${i + 1} (${t.suite || 'no suite'})`;
    if (!t.use) err(loc, 'Use is required.');
    if (!(t.nla >= 0)) err(loc, 'NLA must be zero or positive.');
    if (t.status === 'Leased') {
      if (!t.leaseStart) err(loc, 'Lease start date is required for a leased tenancy.');
      if (!t.leaseExpiry) err(loc, 'Lease expiry date is required for a leased tenancy.');
      if (t.leaseStart && t.leaseExpiry && t.leaseStart >= t.leaseExpiry)
        err(loc, 'Lease expiry must be after lease start.');
      if (t.leaseExpiry && t.leaseExpiry < modelStart)
        err(loc, `Lease expiry ${t.leaseExpiry} is before the model start ${modelStart} — mark the tenancy as Vacant instead.`);
      if (!t.nextReviewDate) warn(loc, 'Next review date is blank — no reviews will be applied to the current lease.');
      if (t.nextReviewDate && t.leaseExpiry && t.nextReviewDate > t.leaseExpiry)
        warn(loc, 'Next review date falls after lease expiry — no reviews will be applied.');
    }
    if (t.profileNumber < 1 || t.profileNumber > inputs.profiles.length)
      err(loc, `Vacant space profile number must be between 1 and ${inputs.profiles.length}.`);
    if (t.marketRentPerSqm < 0) err(loc, 'Market rent cannot be negative.');
    if (t.pctOutgoingsRecovered != null && (t.pctOutgoingsRecovered < 0 || t.pctOutgoingsRecovered > 1))
      warn(loc, '% of outgoings recovered is usually between 0% and 100%.');
  });

  inputs.otherIncome.forEach((s, i) => {
    const loc = `Other income ${i + 1}`;
    if (s.switch !== 'On') return;
    if (s.basis === 'Fixed-term') {
      if (!s.endDate) err(loc, 'Fixed-term income needs an end date.');
      else if (s.endDate > modelEnd)
        err(loc, `Error - ${inputs.dcf.discountPeriodYears} Year Model: end date ${s.endDate} is beyond the model end ${modelEnd}.`);
    }
    if (!(s.monthlyAmount > 0)) warn(loc, 'Monthly amount is blank or zero.');
  });

  if (
    inputs.staticAssumptions.structuralRMPctOfIncome.on === 'On' &&
    inputs.staticAssumptions.structuralRMFixedAmount.on === 'On'
  ) {
    err('Static Assumptions', 'You cannot apply both structural R&M allowances — switch one Off.');
  }

  if (!(inputs.staticAssumptions.coreCapRate > 0)) err('Static Assumptions', 'Core capitalisation rate must be positive.');
  if (!(inputs.dcf.terminalYield > 0)) err('DCF Assumptions', 'Terminal yield must be positive.');
  if (!(inputs.dcf.discountRate > 0)) err('DCF Assumptions', 'Discount rate must be positive.');
  if (inputs.dcf.discountPeriodYears < 1 || inputs.dcf.discountPeriodYears > 10)
    err('DCF Assumptions', 'Discount period must be between 1 and 10 years.');

  return issues;
}
