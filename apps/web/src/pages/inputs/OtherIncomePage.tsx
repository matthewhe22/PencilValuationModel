import { DateInput, NumberInput, PctInput, SelectInput, TextInput } from '../../components/fields';
import { IssuePanel, Section } from '../../components/layout';
import { fmtMoney } from '../../format';
import { useStore } from '../../state/store';
import type { GrowthProfileName } from '@pencil/engine';

const GROWTH_OPTIONS = [
  { value: '' as const, label: 'None' },
  { value: 'CPI' as const, label: 'CPI' },
  { value: 'Default - Office' as const, label: 'Default - Office' },
  { value: 'Default - Retail' as const, label: 'Default - Retail' },
  { value: 'Car Parking' as const, label: 'Car Parking' },
];

export function OtherIncomePage() {
  const { inputs, results, update } = useStore();

  return (
    <>
      <IssuePanel issues={results.issues.filter((i) => i.location.startsWith('Other income'))} />
      <Section
        number="6.0"
        title="Other Income Sources"
        intro="Up to six additional income streams (signage, telco, licences…). Cap approach: a Fixed-term source is valued as the present value of its cash flows at the PV discount rate; a Perpetuity source is capitalised at the core capitalisation rate (or its override). DCF approach: the cash flow is included in the building cash flows, and perpetuity sources contribute to the terminal value."
      >
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Assumption</th>
                {inputs.otherIncome.map((_, i) => (
                  <th key={i} style={{ textAlign: 'center' }}>Source {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Switch" help="Only sources switched On are included anywhere in the model.">
                {(s, i) => (
                  <SelectInput value={s.switch} options={['On', 'Off'] as const} onChange={(v) => update((d) => void (d.otherIncome[i].switch = v))} />
                )}
              </Row>
              <Row label="Type of income">
                {(s, i) => <TextInput value={s.typeOfIncome} onChange={(v) => update((d) => void (d.otherIncome[i].typeOfIncome = v))} placeholder="Signage / Telco…" />}
              </Row>
              <Row label="Tenant / counterparty">
                {(s, i) => <TextInput value={s.tenantName} onChange={(v) => update((d) => void (d.otherIncome[i].tenantName = v))} />}
              </Row>
              <Row label="Monthly amount ($)" help="Base amount of the monthly cash flow at the valuation date.">
                {(s, i) => <NumberInput value={s.monthlyAmount} onChange={(v) => update((d) => void (d.otherIncome[i].monthlyAmount = v ?? 0))} />}
              </Row>
              <Row label="Currently being received?" help="Yes starts the cash flow at the model start; No starts it at the start date below.">
                {(s, i) => <SelectInput value={s.currentlyReceived} options={['Yes', 'No'] as const} onChange={(v) => update((d) => void (d.otherIncome[i].currentlyReceived = v))} />}
              </Row>
              <Row label="Fixed-term or perpetuity">
                {(s, i) => <SelectInput value={s.basis} options={['Perpetuity', 'Fixed-term'] as const} onChange={(v) => update((d) => void (d.otherIncome[i].basis = v))} />}
              </Row>
              <Row label="Start date" help="Only used when not currently received.">
                {(s, i) => <DateInput value={s.startDate || ''} onChange={(v) => update((d) => void (d.otherIncome[i].startDate = v))} />}
              </Row>
              <Row label="End date" help="Required for fixed-term sources; must fall within the model period.">
                {(s, i) => <DateInput value={s.endDate || ''} onChange={(v) => update((d) => void (d.otherIncome[i].endDate = v))} />}
              </Row>
              <Row label="Cap rate override (%)" help="Perpetuity sources only — blank uses the core capitalisation rate.">
                {(s, i) => <PctInput value={s.capRateOverride} onChange={(v) => update((d) => void (d.otherIncome[i].capRateOverride = v))} />}
              </Row>
              <Row label="Growth profile" help="Growth applied from the valuation date while the source is active.">
                {(s, i) => (
                  <SelectInput
                    value={(s.growthProfile ?? '') as GrowthProfileName | ''}
                    options={GROWTH_OPTIONS}
                    onChange={(v) => update((d) => void (d.otherIncome[i].growthProfile = (v || null) as GrowthProfileName | null))}
                  />
                )}
              </Row>
              <tr>
                <td className="muted">Annualised amount</td>
                {inputs.otherIncome.map((s, i) => (
                  <td key={i} style={{ textAlign: 'right' }}>
                    {s.switch === 'On' ? fmtMoney(s.monthlyAmount * 12) : '–'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="muted">Cap-approach value</td>
                {results.otherIncome.map((r, i) => (
                  <td key={i} style={{ textAlign: 'right' }}>
                    {r.capValue == null ? '–' : fmtMoney(r.capValue)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: (s: ReturnType<typeof useStore>['inputs']['otherIncome'][number], i: number) => JSX.Element;
}) {
  const { inputs } = useStore();
  return (
    <tr>
      <td title={help}>{label}</td>
      {inputs.otherIncome.map((s, i) => (
        <td key={i}>{children(s, i)}</td>
      ))}
    </tr>
  );
}
