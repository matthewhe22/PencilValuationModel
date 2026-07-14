import { NumberInput, TextInput } from '../../components/fields';
import { Section } from '../../components/layout';
import { fmtMoney, fmtMoney2 } from '../../format';
import { useStore } from '../../state/store';
import type { OutgoingLine } from '@pencil/engine';

export function OutgoingsPage() {
  const { results } = useStore();
  const t = results.outgoingsTotals;

  return (
    <>
      <Section
        title={`Outgoings as at ${results.modelStart}`}
        intro="Annual building outgoings at the model start, exclusive of GST. Statutory + operating expenses are recoverable from net-lease tenants (pro-rata by NLA); non-recoverables are borne by the owner. All lines grow at the outgoings growth rate. The PCA benchmark column is optional and used for comparison only."
      >
        <div className="stat-row">
          <Stat label="Total recoverable" value={fmtMoney(t.recoverable)} sub={`${fmtMoney2(t.recoverablePerSqm)}/m²`} />
          <Stat label="Non-recoverable" value={fmtMoney(t.nonRecoverable)} />
          <Stat label="Total outgoings" value={fmtMoney(t.total)} sub={`${fmtMoney2(t.totalPerSqm)}/m²`} />
        </div>

        <LineTable section="statutory" title="Statutory expenses" />
        <LineTable section="operating" title="Operating expenses" />
        <LineTable section="nonRecoverable" title="Non-recoverable expenses" />
      </Section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

function LineTable({
  section,
  title,
}: {
  section: 'statutory' | 'operating' | 'nonRecoverable';
  title: string;
}) {
  const { inputs, results, update } = useStore();
  const lines = inputs.outgoings[section];
  const nla = results.nla;
  const subtotal = lines.reduce((a, l) => a + (l.amount || 0), 0);

  const setLine = (i: number, fn: (l: OutgoingLine) => void) =>
    update((d) => fn(d.outgoings[section][i]));

  return (
    <div className="table-wrap">
      <div className="table-head">
        <h3>{title}</h3>
        <button
          className="btn btn-ghost"
          onClick={() => update((d) => void d.outgoings[section].push({ name: '', amount: 0, pcaBenchmark: null }))}
        >
          + Add line
        </button>
      </div>
      <div className="table-scroll">
        <table className="compact">
          <thead>
            <tr>
              <th>Expense</th>
              <th style={{ textAlign: 'right' }}>Amount $ p.a.</th>
              <th style={{ textAlign: 'right' }}>$/m² NLA</th>
              <th style={{ textAlign: 'right' }}>PCA benchmark $/m²</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={{ minWidth: 220 }}>
                  <TextInput value={l.name} onChange={(v) => setLine(i, (x) => void (x.name = v))} />
                </td>
                <td>
                  <NumberInput value={l.amount} onChange={(v) => setLine(i, (x) => void (x.amount = v ?? 0))} />
                </td>
                <td>{nla > 0 && l.amount ? fmtMoney2(l.amount / nla) : '–'}</td>
                <td>
                  <NumberInput value={l.pcaBenchmark} placeholder="–" onChange={(v) => setLine(i, (x) => void (x.pcaBenchmark = v))} />
                </td>
                <td>
                  <button className="btn btn-ghost btn-danger" onClick={() => update((d) => void d.outgoings[section].splice(i, 1))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Sub-total</td>
              <td style={{ textAlign: 'right' }}>{fmtMoney(subtotal)}</td>
              <td style={{ textAlign: 'right' }}>{nla > 0 ? fmtMoney2(subtotal / nla) : '–'}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
