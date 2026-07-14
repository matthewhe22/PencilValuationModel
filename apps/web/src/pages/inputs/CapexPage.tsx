import { Field, NumberInput, SelectInput, TextInput } from '../../components/fields';
import { Section } from '../../components/layout';
import { fmtMoney } from '../../format';
import { useStore } from '../../state/store';

export function CapexPage() {
  const { inputs, results, update } = useStore();
  const c = inputs.capex;

  return (
    <>
      <Section
        number="7.0"
        title="Capital Expenditure"
        intro="Building-level capital expenditure in the DCF. Tenant capital upgrades apply per tenancy event (expiry / renewal) and grow with the capex growth rate; specified capex is entered by model year and grown by the compound capex index."
      >
        <div className="grid cols-3">
          <Field label="Fixed contribution" help="A flat annual amount spread monthly across the cash flow.">
            <SelectInput value={c.fixedContribution.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.capex.fixedContribution.on = v))} />
          </Field>
          <Field label="Amount" unit="$ p.a.">
            <NumberInput value={c.fixedContribution.amountPa} disabled={c.fixedContribution.on === 'Off'} onChange={(v) => update((d) => void (d.capex.fixedContribution.amountPa = v ?? 0))} />
          </Field>
          <span />
          <Field label="Sinking fund" help="An annual rate per m² of NLA, spread monthly.">
            <SelectInput value={c.sinkingFund.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.capex.sinkingFund.on = v))} />
          </Field>
          <Field label="Rate" unit="$/m² p.a.">
            <NumberInput value={c.sinkingFund.ratePerSqmPa} disabled={c.sinkingFund.on === 'Off'} onChange={(v) => update((d) => void (d.capex.sinkingFund.ratePerSqmPa = v ?? 0))} />
          </Field>
          <span />
          <Field label="Capital upgrades on expiry" help="One-off cost per m² of the tenancy's NLA charged each time a lease expires (make-good / refurbishment).">
            <SelectInput value={c.upgradesOnExpiry.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.capex.upgradesOnExpiry.on = v))} />
          </Field>
          <Field label="Rate" unit="$/m²">
            <NumberInput value={c.upgradesOnExpiry.ratePerSqm} disabled={c.upgradesOnExpiry.on === 'Off'} onChange={(v) => update((d) => void (d.capex.upgradesOnExpiry.ratePerSqm = v ?? 0))} />
          </Field>
          <span />
          <Field label="Capital upgrades on renewal" help="One-off cost per m² charged at each new tenancy commencement.">
            <SelectInput value={c.upgradesOnRenewal.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.capex.upgradesOnRenewal.on = v))} />
          </Field>
          <Field label="Rate" unit="$/m²">
            <NumberInput value={c.upgradesOnRenewal.ratePerSqm} disabled={c.upgradesOnRenewal.on === 'Off'} onChange={(v) => update((d) => void (d.capex.upgradesOnRenewal.ratePerSqm = v ?? 0))} />
          </Field>
        </div>
      </Section>

      <Section
        title="Specified capex by model year"
        intro="Enter income (e.g. incentive contributions received) and expenditure per model year. The net amount is grown by the compound capex growth index and spread monthly across that year."
      >
        <Field label="Specified capex by date">
          <SelectInput value={c.specifiedByDate.on} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.capex.specifiedByDate.on = v))} />
        </Field>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="compact">
            <thead>
              <tr>
                <th>Model year</th>
                <th style={{ textAlign: 'right' }}>Income $</th>
                <th style={{ textAlign: 'right' }}>Expenditure $</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {c.specifiedByDate.rows.map((row, i) => (
                <tr key={i}>
                  <td>Year {i + 1}</td>
                  <td>
                    <NumberInput value={row.income} disabled={c.specifiedByDate.on === 'Off'} onChange={(v) => update((d) => void (d.capex.specifiedByDate.rows[i].income = v ?? 0))} />
                  </td>
                  <td>
                    <NumberInput value={row.expenditure} disabled={c.specifiedByDate.on === 'Off'} onChange={(v) => update((d) => void (d.capex.specifiedByDate.rows[i].expenditure = v ?? 0))} />
                  </td>
                  <td>
                    <TextInput value={row.comment} onChange={(v) => update((d) => void (d.capex.specifiedByDate.rows[i].comment = v))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Nominal capital expenditure over the discount period:{' '}
          <strong>{fmtMoney(results.dcf.annual.reduce((a, y) => a + y.totalCapex, 0))}</strong> · PV
          deducted from the capitalisation value:{' '}
          <strong>{fmtMoney(-results.cap.adjustments.pvCapex)}</strong>
        </p>
      </Section>
    </>
  );
}
