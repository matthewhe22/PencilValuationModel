import { NumberInput, PctInput, SelectInput, TextInput } from '../../components/fields';
import { Section } from '../../components/layout';
import { useStore } from '../../state/store';

/**
 * IP_Assumptions §3.0 — Vacant Space Profiles.
 * Each tenancy row is assigned one of these ten profiles; the profile drives
 * everything that happens after the current lease expires.
 */
export function ProfilesPage() {
  const { inputs, update } = useStore();
  const applied = (idx: number) =>
    inputs.tenants.filter((t) => t.profileNumber === idx + 1).length;

  const rowInputs = (
    render: (p: (typeof inputs.profiles)[number], i: number) => JSX.Element,
  ) => inputs.profiles.map((p, i) => <td key={i}>{render(p, i)}</td>);

  return (
    <>
      <Section
        number="3.0"
        title="Vacant Space Profiles"
        intro="Ten re-leasing profiles. Every tenancy is assigned a profile which governs its renewal cycle: the new lease term, review structure, renewal probability, leasing commissions, letting-up (downtime) and incentives on each expiry. Downtime between leases = letting-up months × (1 − renewal probability), rounded up."
      >
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Assumption</th>
                {inputs.profiles.map((p, i) => (
                  <th key={i} style={{ textAlign: 'center' }}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td title="Profile label, e.g. Office / Retail.">Label</td>
                {rowInputs((p, i) => (
                  <TextInput value={p.label} onChange={(v) => update((d) => void (d.profiles[i].label = v))} />
                ))}
              </tr>
              <tr>
                <td title="Term of each new/renewal lease created after the current lease expires.">Lease term (years)</td>
                {rowInputs((p, i) => (
                  <NumberInput value={p.leaseTermYears} min={1} onChange={(v) => update((d) => void (d.profiles[i].leaseTermYears = v ?? 1))} />
                ))}
              </tr>
              <tr>
                <td title="How often renewal leases review to market. Blank = None (no reviews within the lease).">Review frequency to market (years)</td>
                {rowInputs((p, i) => (
                  <NumberInput
                    value={p.reviewFrequencyYears}
                    min={0}
                    placeholder="None"
                    onChange={(v) => update((d) => void (d.profiles[i].reviewFrequencyYears = v && v > 0 ? v : null))}
                  />
                ))}
              </tr>
              <tr>
                <td title="If Yes, market reviews on new leases never reduce the rent (MAX of current and market).">Ratchet clauses on new leases</td>
                {rowInputs((p, i) => (
                  <SelectInput value={p.ratchetOnNewLeases} options={['Yes', 'No'] as const} onChange={(v) => update((d) => void (d.profiles[i].ratchetOnNewLeases = v))} />
                ))}
              </tr>
              <tr>
                <td title="Probability the sitting tenant renews at expiry. Weights downtime, commissions and letting-up allowances.">Tenant renewal probability (%)</td>
                {rowInputs((p, i) => (
                  <PctInput value={p.tenantRenewalProbability} dp={0} onChange={(v) => update((d) => void (d.profiles[i].tenantRenewalProbability = v ?? 0))} />
                ))}
              </tr>
              <tr>
                <td title="Commission payable when the sitting tenant renews, as % of year-1 gross rent.">Renewal leasing commission (%)</td>
                {rowInputs((p, i) => (
                  <PctInput value={p.renewalCommissionPct} dp={0} onChange={(v) => update((d) => void (d.profiles[i].renewalCommissionPct = v ?? 0))} />
                ))}
              </tr>
              <tr>
                <td title="Commission payable on a new letting, as % of year-1 gross rent.">New leasing commission (%)</td>
                {rowInputs((p, i) => (
                  <PctInput value={p.newCommissionPct} dp={0} onChange={(v) => update((d) => void (d.profiles[i].newCommissionPct = v ?? 0))} />
                ))}
              </tr>
              <tr>
                <td className="muted">Applied in tenancy schedule (times)</td>
                {inputs.profiles.map((_, i) => (
                  <td key={i} style={{ textAlign: 'center' }}>
                    <span className="pill">{applied(i)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Tenant letting-up allowances on secondary expiries"
        intro="Months of vacancy allowed when a lease expires, by the model year in which the expiry falls. The 'Vacant space' row applies to space that is vacant at the valuation date. Applied downtime is probability-weighted by the renewal probability above."
      >
        <LettingTable field="lettingUpMonths" unit="months" />
      </Section>

      <Section
        title="Tenant incentives on secondary expiries"
        intro="Incentive (rent-free/fitout equivalent) as a % of the new lease's face rent, by expiry year. Note: whether the incentive is calculated on a net or gross basis follows the market rent basis entered for the tenancy in the schedule. Incentives are only charged in the cash flow for tenancies whose Tenant Incentives switch is On."
      >
        <LettingTable field="incentivePct" unit="%" />
      </Section>
    </>
  );
}

function LettingTable({ field, unit }: { field: 'lettingUpMonths' | 'incentivePct'; unit: string }) {
  const { inputs, update } = useStore();
  const labels = ['Vacant space', ...Array.from({ length: 11 }, (_, i) => `Expiry year ${i + 1}`)];
  return (
    <div className="table-scroll">
      <table className="compact">
        <thead>
          <tr>
            <th>{unit === '%' ? 'Incentive by expiry year' : 'Letting-up by expiry year'}</th>
            {inputs.profiles.map((p, i) => (
              <th key={i} style={{ textAlign: 'center' }}>
                {i + 1}. {p.label || '—'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, y) => (
            <tr key={y}>
              <td>{label}</td>
              {inputs.profiles.map((p, i) => (
                <td key={i}>
                  {unit === '%' ? (
                    <PctInput
                      value={p[field][y] ?? 0}
                      dp={0}
                      onChange={(v) => update((d) => void (d.profiles[i][field][y] = v ?? 0))}
                    />
                  ) : (
                    <NumberInput
                      value={p[field][y] ?? 0}
                      min={0}
                      onChange={(v) => update((d) => void (d.profiles[i][field][y] = v ?? 0))}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
