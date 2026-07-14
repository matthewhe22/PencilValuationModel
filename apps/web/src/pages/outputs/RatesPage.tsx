import { DataTable, Section } from '../../components/layout';
import { fmtMoney2, fmtPct } from '../../format';
import { useStore } from '../../state/store';
import type { RatesTableRow } from '@pencil/engine';

export function RatesPage() {
  const { inputs, results } = useStore();

  return (
    <>
      <Section
        title={`Commercial growth rates forecast — ${inputs.general.valuationDate}`}
        intro="Face and effective $/m² forecasts (OP_Rates). Gross face rates start from the area-weighted market rents in the tenancy schedule and grow at the market growth rates; net rates deduct grown recoverable outgoings; effective rates deduct the incentive for that expiry year."
      >
        <RatesTable title="Office rates" rows={results.rates.office} compound={results.rates.officeCompound} />
        <RatesTable title="Retail rates" rows={results.rates.retail} compound={results.rates.retailCompound} />
        <p className="muted">CPI 10-year compound average: {fmtPct(results.rates.cpi10yr)}</p>
      </Section>
    </>
  );
}

function RatesTable({
  title,
  rows,
  compound,
}: {
  title: string;
  rows: RatesTableRow[];
  compound: { y3: number; y5: number; y10: number; grossEff3: number; grossEff5: number; grossEff10: number };
}) {
  return (
    <DataTable
      title={title}
      columns={['Year', 'Gross face $/m²', '% gross', 'Net face $/m²', '% net', 'Incentive', 'Gross eff. $/m²', '% gross eff.', 'Net eff. $/m²', '% net eff.', 'Outgoings $/m²']}
      csvName={`${title.toLowerCase().replace(/\s+/g, '-')}.csv`}
      rows={[
        ...rows.map((r) => [
          String(r.year),
          fmtMoney2(r.grossFace),
          r.grossFaceGrowth == null ? '–' : fmtPct(r.grossFaceGrowth, 1),
          fmtMoney2(r.netFace),
          r.netFaceGrowth == null ? '–' : fmtPct(r.netFaceGrowth, 1),
          fmtPct(r.incentive, 0),
          fmtMoney2(r.grossEffective),
          r.grossEffectiveGrowth == null ? '–' : fmtPct(r.grossEffectiveGrowth, 1),
          fmtMoney2(r.netEffective),
          r.netEffectiveGrowth == null ? '–' : fmtPct(r.netEffectiveGrowth, 1),
          fmtMoney2(r.outgoings),
        ]),
        ['3-year compound', '', fmtPct(compound.y3, 2), '', '', '', '', fmtPct(compound.grossEff3, 2), '', '', ''],
        ['5-year compound', '', fmtPct(compound.y5, 2), '', '', '', '', fmtPct(compound.grossEff5, 2), '', '', ''],
        ['10-year compound', '', fmtPct(compound.y10, 2), '', '', '', '', fmtPct(compound.grossEff10, 2), '', '', ''],
      ]}
    />
  );
}
