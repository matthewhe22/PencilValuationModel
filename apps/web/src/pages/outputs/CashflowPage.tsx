import { useState } from 'react';
import { DataTable, Section } from '../../components/layout';
import { fmtMoney, fmtPct } from '../../format';
import { useStore } from '../../state/store';
import type { MonthlySeries } from '@pencil/engine';

type Mode = 'annual' | 'monthly';

export function CashflowPage() {
  const { inputs, results } = useStore();
  const [mode, setMode] = useState<Mode>('annual');
  const years = results.dcf.annual.slice(0, inputs.dcf.discountPeriodYears);
  const n = inputs.dcf.discountPeriodYears * 12;
  const months = results.dcf.monthly.slice(0, n);

  return (
    <>
      <div className="toolbar">
        <button className={`btn${mode === 'annual' ? ' btn-primary' : ''}`} onClick={() => setMode('annual')}>
          Annual
        </button>
        <button className={`btn${mode === 'monthly' ? ' btn-primary' : ''}`} onClick={() => setMode('monthly')}>
          Monthly
        </button>
      </div>

      {mode === 'annual' ? <AnnualStatement /> : <MonthlyStatement />}

      <Section
        title={`Per-tenant cash flow — ${mode}`}
        intro="Tenant-level breakdown by category (the OP_CashFlow layout). Letting-up allowances show the market rent forgone during vacancy; they are informational and already reflected in the income lines."
      >
        {(
          [
            ['Base lease income', (s: MonthlySeries) => s.baseLease.map((v, i) => v + s.carPark[i])],
            ['Outgoings recovered', (s: MonthlySeries) => s.recoveries],
            ['Letting-up allowances', (s: MonthlySeries) => s.lettingUp],
            ['New lease commissions', (s: MonthlySeries) => s.commissions],
            ['Incentives', (s: MonthlySeries) => s.incentives],
            ['Capital upgrades', (s: MonthlySeries) => s.capitalUpgrades],
          ] as const
        ).map(([title, sel]) => (
          <TenantCategoryTable key={title} title={title} select={sel} mode={mode} />
        ))}
      </Section>
    </>
  );

  function AnnualStatement() {
    const cols = ['Item', ...years.map((y) => `Yr ${y.year} (${y.yearEnd.slice(0, 7)})`)];
    const line = (label: string, sel: (y: (typeof years)[number]) => number, strong = false, cls?: (v: number) => string | undefined) =>
      [
        strong ? <strong key={label}>{label}</strong> : label,
        ...years.map((y, i) => {
          const v = sel(y);
          const content = fmtMoney(v);
          return strong ? <strong key={i}>{content}</strong> : <span key={i} className={cls?.(v)}>{content}</span>;
        }),
      ];
    return (
      <Section title="Building cash flow — annual">
        <DataTable
          compact
          columns={cols}
          csvName="cashflow-annual.csv"
          rows={[
            line('Gross lease income', (y) => y.grossLeaseIncome),
            line('Outgoings recovered', (y) => y.outgoingsRecovered),
            line('Gross passing rental', (y) => y.grossPassingRental, true),
            line('Additional income', (y) => y.additionalIncome),
            line('Gross passing income', (y) => y.grossPassingIncome, true),
            line('Statutory expenses', (y) => -y.statutoryExpenses),
            line('Operating expenses', (y) => -y.operatingExpenses),
            line('Non-recoverable expenses', (y) => -y.nonRecoverableExpenses),
            line('Total outgoings', (y) => -y.totalOutgoings, true),
            line('New lease commissions', (y) => -y.commissions),
            line('Tenant incentives', (y) => -y.incentives),
            line('Net cash flow (pre-capex)', (y) => y.netCashflowPreCapex, true),
            line('Total capex', (y) => -y.totalCapex),
            line('Net cash flow', (y) => y.netCashflow, true),
            [
              'Running yield (pre-capex)',
              ...years.map((y, i) => <span key={i}>{fmtPct(y.runningYieldPreCapex)}</span>),
            ],
            [
              'Gross market income (yr end)',
              ...years.map((y, i) => <span key={i}>{fmtMoney(y.grossMarketIncome)}</span>),
            ],
          ]}
        />
      </Section>
    );
  }

  function MonthlyStatement() {
    return (
      <Section title={`Building cash flow — monthly (${n} periods)`}>
        <DataTable
          compact
          columns={['Month', 'End', 'Gross lease', 'Recovered', 'Additional', 'Outgoings', 'Commissions', 'Incentives', 'Capex', 'Net CF', 'DF', 'Disc. CF', 'Cumulative NPV']}
          csvName="cashflow-monthly.csv"
          rows={(() => {
            let cum = 0;
            return months.map((m) => {
              const df = 1 / Math.pow(1 + inputs.dcf.discountRate, m.timeFactor);
              const disc = m.netCashflow * df;
              cum += disc;
              return [
                m.monthIndex,
                m.monthEnd,
                fmtMoney(m.grossLeaseIncome),
                fmtMoney(m.outgoingsRecovered),
                fmtMoney(m.additionalIncome),
                fmtMoney(-m.totalOutgoings),
                fmtMoney(-m.commissions),
                fmtMoney(-m.incentives),
                fmtMoney(-m.totalCapex),
                <span key="n" className={m.netCashflow < 0 ? 'neg' : undefined}>{fmtMoney(m.netCashflow)}</span>,
                df.toFixed(4),
                fmtMoney(disc),
                fmtMoney(cum),
              ];
            });
          })()}
        />
      </Section>
    );
  }

  function TenantCategoryTable({
    title,
    select,
    mode,
  }: {
    title: string;
    select: (s: MonthlySeries) => number[];
    mode: Mode;
  }) {
    const periods =
      mode === 'annual'
        ? years.map((y) => ({ label: `Yr ${y.year}`, months: months.filter((m) => m.yearNumber === y.year).map((m) => m.monthIndex - 1) }))
        : months.slice(0, 24).map((m) => ({ label: m.monthEnd.slice(0, 7), months: [m.monthIndex - 1] }));
    const rows = results.tenants.map((t) => {
      const series = select(t.series);
      return [
        t.statics.label,
        ...periods.map((p, i) => <span key={i}>{fmtMoney(p.months.reduce((a, mi) => a + (series[mi] ?? 0), 0))}</span>),
      ];
    });
    const totals = [
      <strong key="t">Total</strong>,
      ...periods.map((p, i) => (
        <strong key={i}>
          {fmtMoney(
            results.tenants.reduce(
              (a, t) => a + p.months.reduce((x, mi) => x + (select(t.series)[mi] ?? 0), 0),
              0,
            ),
          )}
        </strong>
      )),
    ];
    return (
      <DataTable
        compact
        title={mode === 'monthly' ? `${title} (first 24 months)` : title}
        columns={['Tenant', ...periods.map((p) => p.label)]}
        rows={rows}
        footer={totals}
        csvName={`${title.toLowerCase().replace(/\s+/g, '-')}.csv`}
      />
    );
  }
}
