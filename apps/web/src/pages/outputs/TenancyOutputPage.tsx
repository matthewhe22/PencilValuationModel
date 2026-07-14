import { DataTable, Section } from '../../components/layout';
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtYears } from '../../format';
import { useStore } from '../../state/store';

export function TenancyOutputPage() {
  const { inputs, results } = useStore();

  const totalNla = results.nla;
  const totCarParks = inputs.tenants.reduce((a, t) => a + t.carParking.spaces, 0);
  const totPassing = results.tenants.reduce((a, t) => a + (t.input.status === 'Vacant' ? 0 : t.input.baseRentPa), 0);
  const totParking = results.tenants.reduce((a, t) => a + (t.input.status === 'Vacant' ? 0 : t.input.carParking.rentPa), 0);
  const totRecovered = results.tenants.reduce((a, t) => a + t.statics.recoveriesPa, 0);
  const totGross = results.tenants.reduce((a, t) => a + t.statics.grossPassingPa, 0);

  return (
    <>
      <Section title="Tenancy Summary" intro="Current lease particulars and passing income per tenancy (OP_Tenancy).">
        <DataTable
          columns={['No', 'Suite', 'NLA m²', 'Car parks', 'Status', 'Lease type', 'Tenant', 'Start', 'Expiry', 'Term yrs', 'Passing rent $ p.a.', '$/m²', 'Parking $ p.a.', 'Outgoings recovered', 'Total gross passing']}
          csvName="tenancy-summary.csv"
          rows={results.tenants.map((t, i) => {
            const r = t.input;
            const vac = r.status === 'Vacant';
            return [
              i + 1,
              r.suite,
              fmtNum(r.nla),
              r.carParking.spaces,
              r.status,
              vac ? '–' : r.currentLeaseType,
              vac ? 'Vacant' : r.tenantName,
              vac ? '–' : fmtDate(r.leaseStart),
              vac ? '–' : fmtDate(r.leaseExpiry),
              vac ? '–' : fmtYears(t.statics.unexpiredTermYears),
              vac ? '–' : fmtMoney(r.baseRentPa),
              vac || r.nla === 0 ? '–' : fmtMoney2(r.baseRentPa / r.nla),
              vac ? '–' : fmtMoney(r.carParking.rentPa),
              fmtMoney(t.statics.recoveriesPa),
              fmtMoney(t.statics.grossPassingPa),
            ];
          })}
          footer={[
            'TOTAL', '', fmtNum(totalNla), totCarParks, '', '', '', '', '', '',
            fmtMoney(totPassing), '', fmtMoney(totParking), fmtMoney(totRecovered), fmtMoney(totGross),
          ]}
        />
      </Section>

      <Section
        title="Market Rental Profile"
        intro="Re-leasing assumptions from each tenancy's assigned vacant space profile, alongside its market rent."
      >
        <DataTable
          columns={['No', 'Suite', 'NLA m²', 'Profile', 'Basis', 'New lease term', 'Renewal probability', 'Avg growth (10yr)', 'Incentive (window)', 'Renewal commission', 'New commission', 'Capex on expiry $/m²', 'Market rent $ p.a.', '$/m²']}
          csvName="market-rental-profile.csv"
          rows={results.tenants.map((t, i) => {
            const r = t.input;
            const p = inputs.profiles[r.profileNumber - 1];
            const growthArr = r.growthProfile === 'Default - Retail' ? inputs.marketGrowth.retailGrowth : r.growthProfile === 'Default - Office' ? inputs.marketGrowth.officeGrowth : inputs.growth.map((x) => (r.growthProfile === 'CPI' ? x.cpi : x.carParking));
            const avgGrowth = growthArr.slice(1, 11).reduce((a, b) => a + b, 0) / 10;
            return [
              i + 1,
              r.suite,
              fmtNum(r.nla),
              `${r.profileNumber}. ${p?.label ?? ''}`,
              r.marketBasis === 'N' ? 'Net' : 'Gross',
              `${p?.leaseTermYears ?? '–'} yrs`,
              fmtPct(p?.tenantRenewalProbability ?? 0, 0),
              fmtPct(avgGrowth, 1),
              fmtPct(t.statics.pvTenantIncentives > 0 ? (p?.incentivePct[1] ?? 0) : 0, 0),
              fmtPct(p?.renewalCommissionPct ?? 0, 0),
              fmtPct(p?.newCommissionPct ?? 0, 0),
              inputs.capex.upgradesOnExpiry.on === 'On' ? fmtMoney(inputs.capex.upgradesOnExpiry.ratePerSqm) : '–',
              fmtMoney(t.statics.grossFaceMarketPa),
              r.nla > 0 ? fmtMoney2(t.statics.grossFaceMarketPa / r.nla) : '–',
            ];
          })}
        />
      </Section>
    </>
  );
}
