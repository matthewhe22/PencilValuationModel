import { Field, DateInput, NumberInput, PctInput, SelectInput, TextInput } from '../../components/fields';
import { IssuePanel, Section } from '../../components/layout';
import { fmtDate, fmtMoney } from '../../format';
import { useStore } from '../../state/store';

export function GeneralPage() {
  const { inputs, results, update } = useStore();
  const g = inputs.general;

  return (
    <>
      <IssuePanel issues={results.issues.filter((i) => i.location === 'General')} />

      <Section
        number="1.1"
        title="Valuation and Building Parameters"
        intro="Core identification of the valuation. The model start date is the valuation date if it falls on the 1st of a month, otherwise the first day of the following month; the cash flow runs monthly from that date."
      >
        <div className="grid cols-3">
          <Field label="Purpose of model" help="Valuation values the asset; Sale Analysis analyses a known sale price. Labels elsewhere switch accordingly (Adopted Value vs Sale Price, Client vs Purchaser).">
            <SelectInput
              value={g.purpose}
              options={['Valuation', 'Sale Analysis'] as const}
              onChange={(v) => update((d) => void (d.general.purpose = v))}
            />
          </Field>
          <Field label={g.purpose === 'Sale Analysis' ? 'Sale date' : 'Valuation date'}>
            <DateInput value={g.valuationDate} onChange={(v) => update((d) => void (d.general.valuationDate = v))} />
          </Field>
          <Field
            label={g.purpose === 'Sale Analysis' ? 'Sale price' : 'Adopted value'}
            unit="$"
            help="The value adopted for yield analysis and the IRR calculation. Typically set after reviewing the DCF and capitalisation results."
          >
            <NumberInput value={g.adoptedValue} onChange={(v) => update((d) => void (d.general.adoptedValue = v ?? 0))} />
          </Field>
          <Field label="Adopted value in words" help="e.g. Twelve million dollars — appears on the executive summary.">
            <TextInput value={g.adoptedValueText} onChange={(v) => update((d) => void (d.general.adoptedValueText = v))} />
          </Field>
          <Field label="Building name">
            <TextInput value={g.buildingName} onChange={(v) => update((d) => void (d.general.buildingName = v))} />
          </Field>
          <Field label="Property address">
            <TextInput value={g.address} onChange={(v) => update((d) => void (d.general.address = v))} />
          </Field>
          <Field label="City / suburb">
            <TextInput value={g.city} onChange={(v) => update((d) => void (d.general.city = v))} />
          </Field>
          <Field label="State">
            <TextInput value={g.state} onChange={(v) => update((d) => void (d.general.state = v))} />
          </Field>
          <Field label="Postcode">
            <TextInput value={g.postcode} onChange={(v) => update((d) => void (d.general.postcode = v))} />
          </Field>
          <Field label="Vendor / owner">
            <TextInput value={g.vendorOwner} onChange={(v) => update((d) => void (d.general.vendorOwner = v))} />
          </Field>
          <Field label={g.purpose === 'Sale Analysis' ? 'Purchaser' : 'Client'}>
            <TextInput value={g.client} onChange={(v) => update((d) => void (d.general.client = v))} />
          </Field>
          <Field label="Asset type" help="e.g. Office, Retail, Industrial — used for headings only.">
            <TextInput value={g.assetType} onChange={(v) => update((d) => void (d.general.assetType = v))} />
          </Field>
          <Field label="Building grade (PCA)">
            <TextInput value={g.buildingGrade} onChange={(v) => update((d) => void (d.general.buildingGrade = v))} />
          </Field>
          <Field label="Date of inspection">
            <DateInput value={g.inspectionDate || ''} onChange={(v) => update((d) => void (d.general.inspectionDate = v))} />
          </Field>
          <Field label="Land area" unit="m²">
            <NumberInput value={g.landArea} onChange={(v) => update((d) => void (d.general.landArea = v ?? 0))} />
          </Field>
          <Field label="Typical floor plates">
            <TextInput value={g.typicalFloorPlates} onChange={(v) => update((d) => void (d.general.typicalFloorPlates = v))} />
          </Field>
          <Field label="Interest valued">
            <TextInput value={g.interestValued} onChange={(v) => update((d) => void (d.general.interestValued = v))} />
          </Field>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Model start <strong>{fmtDate(results.modelStart)}</strong> · model end{' '}
          <strong>{fmtDate(results.modelEnd)}</strong> · building NLA{' '}
          <strong>{results.nla.toLocaleString()} m²</strong> (sum of the tenancy schedule) ·{' '}
          {inputs.tenants.length} tenancies modelled.
        </p>
      </Section>

      <Section number="1.3" title="Valuer's Details">
        <div className="grid cols-3">
          <Field label="Name">
            <TextInput value={g.valuer.name} onChange={(v) => update((d) => void (d.general.valuer.name = v))} />
          </Field>
          <Field label="Qualifications" help="e.g. AAPI, FAPI — shown alongside the name on the executive summary.">
            <TextInput value={g.valuer.qualifications} onChange={(v) => update((d) => void (d.general.valuer.qualifications = v))} />
          </Field>
          <Field label="Registration number">
            <TextInput value={g.valuer.registrationNumber} onChange={(v) => update((d) => void (d.general.valuer.registrationNumber = v))} />
          </Field>
          <Field label="Position" help="e.g. Senior Manager, Director.">
            <TextInput value={g.valuer.position} onChange={(v) => update((d) => void (d.general.valuer.position = v))} />
          </Field>
        </div>
      </Section>

      <Section
        number="2.0"
        title="Selling & Acquisition Costs"
        intro="Selling costs are deducted from the terminal value in the DCF. Acquisition costs are deducted from the present value to derive the capital value (the DCF result is quoted after acquisition costs)."
      >
        <div className="grid cols-3">
          <Field label="Selling costs" unit="% of sale" help="Applied to the gross realisation at the end of the cash flow (agent fees, legals, marketing).">
            <PctInput value={inputs.costs.sellingCostPct} onChange={(v) => update((d) => void (d.costs.sellingCostPct = v ?? 0))} />
          </Field>
          <Field label="Acquisition costs" unit="%" help="Stamp duty, legals and due diligence as a % of price. The DCF capital value = present value ÷ (1 + this rate). Also applied when computing the IRR on the adopted value.">
            <PctInput value={inputs.costs.acquisitionCostPct} onChange={(v) => update((d) => void (d.costs.acquisitionCostPct = v ?? 0))} />
          </Field>
        </div>
      </Section>

      <Section title="Commentary (report text)">
        <div className="grid cols-2">
          <Field label="Improvement description">
            <textarea value={g.improvementDescription} onChange={(e) => update((d) => void (d.general.improvementDescription = e.target.value))} />
          </Field>
          <Field label="Major building issues">
            <textarea value={g.majorBuildingIssues} onChange={(e) => update((d) => void (d.general.majorBuildingIssues = e.target.value))} />
          </Field>
          <Field label="Market comment">
            <textarea value={g.marketComment} onChange={(e) => update((d) => void (d.general.marketComment = e.target.value))} />
          </Field>
        </div>
      </Section>

      <p className="muted">
        Current results with these inputs — Capitalisation:{' '}
        <strong>{fmtMoney(results.cap.adjustedCoreCapitalValue)}</strong> · DCF (after acquisition
        costs): <strong>{fmtMoney(results.dcf.capitalValue)}</strong>
      </p>
    </>
  );
}
