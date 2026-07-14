import { Field, DateInput, NumberInput, PctInput, SelectInput, TextInput } from '../../components/fields';
import { IssuePanel, Section } from '../../components/layout';
import { fmtMoney } from '../../format';
import { useStore } from '../../state/store';
import type { GrowthProfileName, ReviewType, TenantRow } from '@pencil/engine';

const USES = ['Office', 'Retail', 'Car Parking', 'Storage', 'Warehouse', 'Hardstand', 'Canopy', 'Land', 'Signage', 'Consulting', 'Laboratory', 'Hospital', 'Pharmacy', 'Data Centre'] as const;
const GROWTH: GrowthProfileName[] = ['CPI', 'Default - Office', 'Default - Retail', 'Car Parking'];
const REVIEW_OPTIONS = [
  { value: '' as const, label: '—' },
  { value: 'CPI' as const, label: 'CPI' },
  { value: 'F' as const, label: 'Fixed %' },
  { value: 'M' as const, label: 'Market' },
  { value: 'Man' as const, label: 'Manual $' },
];

let nextTenantId = 1;
const newTenant = (): TenantRow => ({
  id: `t_${Date.now().toString(36)}_${nextTenantId++}`,
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
  reviewTypes: Array.from({ length: 12 }, () => 'F' as ReviewType),
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
});

export function TenancyInputPage() {
  const { inputs, results, update } = useStore();

  return (
    <>
      <IssuePanel issues={results.issues.filter((i) => i.location.startsWith('Tenant'))} />

      <Section
        title="Tenancy Schedule"
        intro="One card per tenancy (leased suite or vacant space). The grid summarises each row; expand a card for market rent, reviews, recoveries, car parking and incentives. Totals feed every output page. Vacant rows lease up per their assigned vacant space profile."
      >
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => update((d) => void d.tenants.push(newTenant()))}>
            + Add tenancy
          </button>
          <span className="muted">
            {inputs.tenants.length} tenancies · total NLA {results.nla.toLocaleString()} m² · gross
            passing {fmtMoney(inputs.tenants.reduce((a, t) => a + (t.status === 'Vacant' ? 0 : t.baseRentPa + t.carParking.rentPa), 0))} p.a.
          </span>
        </div>

        {inputs.tenants.map((t, i) => (
          <TenantCard key={t.id} t={t} i={i} />
        ))}
      </Section>
    </>
  );
}

function TenantCard({ t, i }: { t: TenantRow; i: number }) {
  const { inputs, update } = useStore();
  const set = (fn: (row: TenantRow) => void) => update((d) => fn(d.tenants[i]));
  const title = `${i + 1}. ${t.suite || 'Suite?'} — ${t.status === 'Vacant' ? 'Vacant' : t.tenantName || 'Unnamed'} (${t.use}, ${t.nla} m²)`;

  return (
    <details className="tenant-card" open={i === 0}>
      <summary>
        {title}
        <button
          className="btn btn-ghost btn-danger"
          style={{ float: 'right' }}
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`Delete tenancy "${title}"?`)) update((d) => void d.tenants.splice(i, 1));
          }}
        >
          Delete
        </button>
        <button
          className="btn btn-ghost"
          style={{ float: 'right' }}
          onClick={(e) => {
            e.preventDefault();
            update((d) => void d.tenants.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(t)), id: newTenant().id }));
          }}
        >
          Duplicate
        </button>
      </summary>

      <div className="grid cols-3">
        <Field label="Suite">
          <TextInput value={t.suite} onChange={(v) => set((r) => void (r.suite = v))} />
        </Field>
        <Field label="Use">
          <SelectInput value={t.use as (typeof USES)[number]} options={USES} onChange={(v) => set((r) => void (r.use = v))} />
        </Field>
        <Field label="NLA" unit="m²">
          <NumberInput value={t.nla} min={0} onChange={(v) => set((r) => void (r.nla = v ?? 0))} />
        </Field>
        <Field label="Status" help="Vacant rows earn nothing until they lease up at market per the assigned profile's vacant letting-up months.">
          <SelectInput value={t.status} options={['Leased', 'Vacant'] as const} onChange={(v) => set((r) => void (r.status = v))} />
        </Field>
        <Field label="Tenant name">
          <TextInput value={t.tenantName} onChange={(v) => set((r) => void (r.tenantName = v))} />
        </Field>
        <Field label="Vacant space profile" help="Profile (page 2) governing renewals, downtime, commissions and incentives for this tenancy.">
          <SelectInput
            value={String(t.profileNumber)}
            options={inputs.profiles.map((p, k) => ({ value: String(k + 1), label: `${k + 1}. ${p.label || '—'}` }))}
            onChange={(v) => set((r) => void (r.profileNumber = Number(v)))}
          />
        </Field>
      </div>

      <h4>Market rental details</h4>
      <div className="grid cols-3">
        <Field label="Market basis" help="Net: market rent is net of outgoings (gross face = net + recoverable outgoings/m²). Gross: rent includes outgoings. Renewal tenancies recover outgoings only when the basis is Net.">
          <SelectInput
            value={t.marketBasis}
            options={[{ value: 'N' as const, label: 'Net' }, { value: 'G' as const, label: 'Gross' }]}
            onChange={(v) => set((r) => void (r.marketBasis = v))}
          />
        </Field>
        <Field label="Market rent" unit="$/m² p.a.">
          <NumberInput value={t.marketRentPerSqm} min={0} onChange={(v) => set((r) => void (r.marketRentPerSqm = v ?? 0))} />
        </Field>
        <Field label="Outgoings override" unit="$/m²" help="Blank uses building recoverable outgoings ÷ NLA when grossing up a net market rent.">
          <NumberInput value={t.outgoingsOverridePerSqm} placeholder="auto" onChange={(v) => set((r) => void (r.outgoingsOverridePerSqm = v))} />
        </Field>
        <Field label="Growth profile" help="Market growth series applied to this tenancy's market rent.">
          <SelectInput value={t.growthProfile} options={GROWTH} onChange={(v) => set((r) => void (r.growthProfile = v))} />
        </Field>
      </div>

      {t.status === 'Leased' && (
        <>
          <h4>Current lease</h4>
          <div className="grid cols-3">
            <Field label="Lease start">
              <DateInput value={t.leaseStart || ''} onChange={(v) => set((r) => void (r.leaseStart = v))} />
            </Field>
            <Field label="Lease expiry">
              <DateInput value={t.leaseExpiry || ''} onChange={(v) => set((r) => void (r.leaseExpiry = v))} />
            </Field>
            <Field label="Next review date" help="First review of the current lease; subsequent reviews recur annually using the review schedule below.">
              <DateInput value={t.nextReviewDate || ''} onChange={(v) => set((r) => void (r.nextReviewDate = v))} />
            </Field>
            <Field label="Lease type" help="Net leases recover their share of outgoings; Semi-Gross recovers increases over the base year; Gross recovers nothing.">
              <SelectInput value={t.currentLeaseType} options={['Net', 'Gross', 'Semi-Gross'] as const} onChange={(v) => set((r) => void (r.currentLeaseType = v))} />
            </Field>
            <Field label="Base rent" unit="$ p.a.">
              <NumberInput value={t.baseRentPa} min={0} onChange={(v) => set((r) => void (r.baseRentPa = v ?? 0))} />
            </Field>
            <Field label="Market ratchet clause" help="If Yes, market reviews cannot reduce the passing rent.">
              <SelectInput value={t.ratchet} options={['Yes', 'No'] as const} onChange={(v) => set((r) => void (r.ratchet = v))} />
            </Field>
          </div>

          <h4>Review schedule (reviews 1–12 of the current lease)</h4>
          <p className="muted">
            Review 1 occurs at the next review date, then annually. Fixed % uses the rate; Manual $
            sets the new annual rent; Market resets to the grown market rent (respecting the
            ratchet); CPI applies that year's CPI.
          </p>
          <div className="table-scroll">
            <table className="compact">
              <thead>
                <tr>
                  <th>Review #</th>
                  {t.reviewTypes.slice(0, 8).map((_, k) => (
                    <th key={k} style={{ textAlign: 'center' }}>{k + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Type</td>
                  {t.reviewTypes.slice(0, 8).map((rt, k) => (
                    <td key={k}>
                      <SelectInput
                        value={(rt ?? '') as '' | 'CPI' | 'F' | 'M' | 'Man'}
                        options={REVIEW_OPTIONS}
                        onChange={(v) => set((r) => void (r.reviewTypes[k] = (v || null) as ReviewType))}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Rate % / Amount $</td>
                  {t.reviewTypes.slice(0, 8).map((rt, k) => (
                    <td key={k}>
                      {rt === 'F' ? (
                        <PctInput value={t.reviewRates[k]} dp={1} onChange={(v) => set((r) => void (r.reviewRates[k] = v))} />
                      ) : rt === 'Man' ? (
                        <NumberInput value={t.reviewRates[k]} onChange={(v) => set((r) => void (r.reviewRates[k] = v))} />
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h4>Recoveries</h4>
          <p className="muted">
            The % of net outgoings recovered applies to both the current lease and renewal
            tenancies (blank = 100%).
          </p>
          <div className="grid cols-3">
            <Field label="Recoveries?" help="Whether this tenancy currently recovers outgoings.">
              <SelectInput value={t.recoveries} options={['Yes', 'No'] as const} onChange={(v) => set((r) => void (r.recoveries = v))} />
            </Field>
            <Field label="Base year recoveries" unit="$ p.a." help="For Semi-Gross leases: the base-year amount above which increases are recovered.">
              <NumberInput value={t.baseYearRecoveriesPa} onChange={(v) => set((r) => void (r.baseYearRecoveriesPa = v ?? 0))} />
            </Field>
            <Field label="% of outgoings recovered">
              <PctInput value={t.pctOutgoingsRecovered} dp={0} onChange={(v) => set((r) => void (r.pctOutgoingsRecovered = v))} />
            </Field>
          </div>

          <h4>Outstanding incentives (rent free)</h4>
          <div className="grid cols-3">
            <Field label="Months rent free remaining">
              <NumberInput value={t.incentives.outstandingRentFreeMonths} min={0} onChange={(v) => set((r) => void (r.incentives.outstandingRentFreeMonths = v ?? 0))} />
            </Field>
            <Field label="% rent free">
              <PctInput value={t.incentives.pctRentFree} dp={0} onChange={(v) => set((r) => void (r.incentives.pctRentFree = v ?? 0))} />
            </Field>
            <Field label="Upfront amount" unit="$" help="Contracted lump-sum incentive still to be paid (applied at model start).">
              <NumberInput value={t.incentives.upfrontAmount} min={0} onChange={(v) => set((r) => void (r.incentives.upfrontAmount = v ?? 0))} />
            </Field>
          </div>
        </>
      )}

      <h4>Car parking</h4>
      <div className="grid cols-3">
        <Field label="Spaces">
          <NumberInput value={t.carParking.spaces} min={0} onChange={(v) => set((r) => void (r.carParking.spaces = v ?? 0))} />
        </Field>
        <Field label="Passing rent" unit="$ p.a.">
          <NumberInput value={t.carParking.rentPa} min={0} onChange={(v) => set((r) => void (r.carParking.rentPa = v ?? 0))} />
        </Field>
        <Field label="Market rate" unit="$/space pcm">
          <NumberInput value={t.carParking.marketRatePcm} min={0} onChange={(v) => set((r) => void (r.carParking.marketRatePcm = v ?? 0))} />
        </Field>
      </div>

      <h4>Switches</h4>
      <div className="grid cols-3">
        <Field label="Letting-up allowance" help="Off removes downtime, letting-up allowances and leasing commissions for this tenancy.">
          <SelectInput value={t.lettingUpSwitch} options={['On', 'Off'] as const} onChange={(v) => set((r) => void (r.lettingUpSwitch = v))} />
        </Field>
        <Field label="Tenant incentives" help="On charges the profile's incentive % (of the new lease's rent × term) at each future commencement, and includes incentives in the cap-approach adjustments.">
          <SelectInput value={t.tenantIncentivesSwitch} options={['On', 'Off'] as const} onChange={(v) => set((r) => void (r.tenantIncentivesSwitch = v))} />
        </Field>
      </div>
    </details>
  );
}
