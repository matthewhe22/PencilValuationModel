import { BarChart, Donut } from '../../components/charts';
import { DataTable, Section, StatTile } from '../../components/layout';
import { fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtYears } from '../../format';
import { useStore } from '../../state/store';

export function AnalysisPage() {
  const { results } = useStore();
  const a = results.analysis;

  const nlaBreakdown = [
    ...a.topByArea.slice(0, 7).map((t) => ({ label: t.name, value: t.value })),
    ...(a.topByArea.length > 7
      ? [{ label: 'Other', value: a.topByArea.slice(7).reduce((x, t) => x + t.value, 0) }]
      : []),
    ...(a.vacantNla > 0 ? [{ label: 'Vacant', value: a.vacantNla }] : []),
  ];
  const incomeBreakdown = [
    ...a.topByIncome.slice(0, 7).map((t) => ({ label: t.name, value: t.value })),
    ...(a.topByIncome.length > 7
      ? [{ label: 'Other', value: a.topByIncome.slice(7).reduce((x, t) => x + t.value, 0) }]
      : []),
  ];

  return (
    <>
      <div className="stat-row">
        <StatTile label="WALE by income" value={fmtYears(a.wale.byIncomeYears)} />
        <StatTile label="WALE by area" value={fmtYears(a.wale.byAreaYears)} />
        <StatTile label="Vacancy" value={fmtPct(a.vacantPct, 1)} sub={`${fmtNum(a.vacantNla)} m²`} />
        <StatTile label="Total gross passing income" value={fmtMoney(a.totalGrossPassingIncome)} />
      </div>

      <div className="chart-grid">
        <Section title="Major tenants — NLA breakdown">
          <Donut data={nlaBreakdown} format={(v) => `${fmtNum(v)} m²`} />
          <DataTable
            compact
            columns={['Tenant', 'NLA m²', '% of NLA', 'Car parks']}
            rows={a.topByArea.map((t) => [`${t.rank}. ${t.name}`, fmtNum(t.value), fmtPct(t.pct, 1), t.carParks])}
            csvName="top-by-area.csv"
          />
        </Section>

        <Section title="Major tenants — income share">
          <Donut data={incomeBreakdown} format={fmtMoney} />
          <DataTable
            compact
            columns={['Tenant', 'Income $ p.a.', '% of income', 'Avg $/m²']}
            rows={a.topByIncome.map((t) => [
              `${t.rank}. ${t.name}`,
              fmtMoney(t.value),
              fmtPct(t.pct, 1),
              t.ratePerSqm != null ? fmtMoney2(t.ratePerSqm) : '–',
            ])}
            csvName="top-by-income.csv"
          />
        </Section>
      </div>

      <Section title="Lease expiry profile" intro="Share of building NLA expiring in each model year (vacant space shown in the first bucket).">
        <BarChart
          data={a.expiryProfile.map((b) => ({
            label: b.label.replace(/\s\(.+\)/, ''),
            value: b.pctOfNla,
            detail: `${fmtNum(b.nla)} m² · ${b.tenantCount} tenancy(ies)`,
          }))}
          format={(v) => fmtPct(v, 1)}
        />
        <DataTable
          compact
          columns={['Period', 'Year end', 'Tenancies', 'NLA m²', '% of NLA']}
          rows={a.expiryProfile.map((b) => [
            b.label,
            b.yearEnd ?? '–',
            b.tenantCount,
            fmtNum(b.nla),
            fmtPct(b.pctOfNla, 1),
          ])}
          csvName="expiry-profile.csv"
        />
      </Section>
    </>
  );
}
