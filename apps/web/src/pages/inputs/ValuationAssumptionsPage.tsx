import { Field, NumberInput, PctInput, SelectInput } from '../../components/fields';
import { IssuePanel, Section } from '../../components/layout';
import { fmtPct } from '../../format';
import { useStore } from '../../state/store';

export function ValuationAssumptionsPage() {
  const { inputs, results, update } = useStore();
  const sa = inputs.staticAssumptions;
  const dcf = inputs.dcf;

  return (
    <>
      <IssuePanel
        issues={results.issues.filter(
          (i) => i.location === 'Static Assumptions' || i.location === 'DCF Assumptions',
        )}
      />

      <Section
        number="4.0"
        title="Static Valuation Assumptions (Capitalisation)"
        intro="The capitalisation approach capitalises net market income at the core capitalisation rate, then adjusts for the present value of rental reversions, letting-up, leasing commissions, incentives and capital expenditure for tenancies expiring within the allowance window."
      >
        <div className="grid cols-3">
          <Field label="Capitalise market rents" help="Face capitalises face market rents; Effective capitalises face rents net of year-1 incentives.">
            <SelectInput value={sa.capitaliseMarketRents} options={['Face', 'Effective'] as const} onChange={(v) => update((d) => void (d.staticAssumptions.capitaliseMarketRents = v))} />
          </Field>
          <Field label="Core capitalisation rate" unit="%" help="Reversionary yield basis — applied to adjusted net market income.">
            <PctInput value={sa.coreCapRate} onChange={(v) => update((d) => void (d.staticAssumptions.coreCapRate = v ?? 0))} />
          </Field>
          <Field label="Cap rate sensitivity" unit="+/- %" help="Step used in the capitalisation sensitivity table.">
            <PctInput value={sa.capRateSensitivity} onChange={(v) => update((d) => void (d.staticAssumptions.capRateSensitivity = v ?? 0))} />
          </Field>
          <Field label="Discount rate for PV adjustments" unit="% p.a." help="Used to present-value the reversion adjustments (reversions, letting-up, commissions, incentives, capex).">
            <PctInput value={sa.pvDiscountRate} onChange={(v) => update((d) => void (d.staticAssumptions.pvDiscountRate = v ?? 0))} />
          </Field>
          <Field label="Reversion allowance window" unit="months" help="Adjustments are captured for tenancies expiring within this many months of the model start (workbook default 12).">
            <NumberInput value={sa.reversionWindowMonths} min={0} onChange={(v) => update((d) => void (d.staticAssumptions.reversionWindowMonths = v ?? 0))} />
          </Field>
          <Field label="Capitalisation vacancy allowance" unit="%" help="General vacancy allowance deducted from gross market income before capitalising.">
            <PctInput value={sa.capitalisationVacancyAllowance} onChange={(v) => update((d) => void (d.staticAssumptions.capitalisationVacancyAllowance = v ?? 0))} />
          </Field>
          <Field label="Deduct capex from capital value" help="If Yes, the PV of capital expenditure over the deduction window is deducted from the capitalisation value.">
            <SelectInput value={sa.deductCapexFromCapitalValue} options={['Yes', 'No'] as const} onChange={(v) => update((d) => void (d.staticAssumptions.deductCapexFromCapitalValue = v))} />
          </Field>
          <Field label="Capex months deducted" unit="months" help="Number of months of capital expenditure present-valued into the deduction.">
            <NumberInput value={sa.capexMonthsDeducted} min={0} onChange={(v) => update((d) => void (d.staticAssumptions.capexMonthsDeducted = v ?? 0))} />
          </Field>
          <Field label="Manual adjustment" unit="$" help="Free adjustment added to the adjusted core capital value (positive or negative).">
            <NumberInput value={sa.manualAdjustment} onChange={(v) => update((d) => void (d.staticAssumptions.manualAdjustment = v ?? 0))} />
          </Field>
        </div>

        <h3 style={{ marginTop: 16 }}>Structural R&M allowance (cap approach)</h3>
        <p className="section-intro">You cannot apply both allowances at once — the model flags this as an error.</p>
        <div className="grid cols-3">
          <Field label="R&M allowance — % of income">
            <SelectInput value={sa.structuralRMPctOfIncome.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.staticAssumptions.structuralRMPctOfIncome.on = v))} />
          </Field>
          <Field label="Rate" unit="% of income">
            <PctInput value={sa.structuralRMPctOfIncome.pct} onChange={(v) => update((d) => void (d.staticAssumptions.structuralRMPctOfIncome.pct = v ?? 0))} />
          </Field>
          <span />
          <Field label="R&M allowance — fixed amount">
            <SelectInput value={sa.structuralRMFixedAmount.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.staticAssumptions.structuralRMFixedAmount.on = v))} />
          </Field>
          <Field label="Amount" unit="$ p.a.">
            <NumberInput value={sa.structuralRMFixedAmount.amount} onChange={(v) => update((d) => void (d.staticAssumptions.structuralRMFixedAmount.amount = v ?? 0))} />
          </Field>
        </div>
      </Section>

      <Section
        number="5.0"
        title="Discounted Cash Flow Assumptions"
        intro="The DCF discounts the monthly net cash flow over the discount period and adds a terminal value: month-121 annualised gross market income less outgoings, capitalised at the terminal yield, adjusted for reversions and selling costs."
      >
        <div className="grid cols-3">
          <Field label="Discount period" unit="years" help="Length of the explicit cash flow (workbook standard: 10 years).">
            <NumberInput value={dcf.discountPeriodYears} min={1} onChange={(v) => update((d) => void (d.dcf.discountPeriodYears = Math.min(Math.max(v ?? 10, 1), 10)))} />
          </Field>
          <Field label="Discount rate" unit="% p.a." help="Applied to monthly net cash flows using actual-days/365 time factors.">
            <PctInput value={dcf.discountRate} onChange={(v) => update((d) => void (d.dcf.discountRate = v ?? 0))} />
          </Field>
          <Field label="Terminal yield" unit="%" help="Capitalisation rate applied to year-11 net market income for the terminal value.">
            <PctInput value={dcf.terminalYield} onChange={(v) => update((d) => void (d.dcf.terminalYield = v ?? 0))} />
          </Field>
          <Field label="Discount rate sensitivity" unit="+/- %">
            <PctInput value={dcf.discountRateSensitivity} onChange={(v) => update((d) => void (d.dcf.discountRateSensitivity = v ?? 0))} />
          </Field>
          <Field label="Terminal yield sensitivity" unit="+/- %">
            <PctInput value={dcf.terminalYieldSensitivity} onChange={(v) => update((d) => void (d.dcf.terminalYieldSensitivity = v ?? 0))} />
          </Field>
          <Field label="Adopted value / IRR sensitivity" unit="+/- %" help="Step applied to the adopted value in the IRR sensitivity matrix.">
            <PctInput value={dcf.adoptedValueIrrSensitivity} onChange={(v) => update((d) => void (d.dcf.adoptedValueIrrSensitivity = v ?? 0))} />
          </Field>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Monthly discount rate: {fmtPct(Math.pow(1 + dcf.discountRate, 1 / 12) - 1, 4)} · monthly
          PV rate: {fmtPct(Math.pow(1 + sa.pvDiscountRate, 1 / 12) - 1, 4)} · resultant IRR at the
          adopted value: <strong>{results.dcf.irr == null ? 'n/a' : fmtPct(results.dcf.irr)}</strong>
        </p>
      </Section>
    </>
  );
}
