import { DataTable, Section, StatTile } from '../../components/layout';
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtYears } from '../../format';
import { generateReportPdf } from '../../pdf/report';
import { useStore } from '../../state/store';

export function ReportPage() {
  const { inputs, results } = useStore();
  const g = inputs.general;
  const { cap, dcf } = results;
  const vacant = results.tenants.filter((t) => t.input.status === 'Vacant');
  const outstanding = results.tenants.filter((t) => t.statics.nominalOutstandingIncentives > 0);

  return (
    <>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => generateReportPdf(results)}>
          Download PDF report
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
        <span className="muted">The PDF is generated locally in your browser — nothing is uploaded.</span>
      </div>

      <Section title={`Valuation Report — ${g.buildingName || 'Property'}, ${g.address}`}>
        <div className="stat-row">
          <StatTile label="Adopted value" value={fmtMoney(g.adoptedValue)} sub={g.adoptedValueText} />
          <StatTile label="Capitalisation" value={fmtMoney(cap.adjustedCoreCapitalValue)} />
          <StatTile label="DCF (after acq. costs)" value={fmtMoney(dcf.capitalValue)} />
          <StatTile label="IRR" value={dcf.irr == null ? 'n/a' : fmtPct(dcf.irr)} />
        </div>
        <div className="grid cols-3">
          <div><div className="stat-label">Valuation date</div>{fmtDate(g.valuationDate)}</div>
          <div><div className="stat-label">Client</div>{g.client || '–'}</div>
          <div><div className="stat-label">Valuer</div>{g.valuer.name || '–'}</div>
        </div>
      </Section>

      {vacant.length > 0 && (
        <Section title="Vacancy">
          <DataTable
            compact
            columns={['Suite', 'Usage', 'Area m²', 'Market rate $/m²', 'Annual rent', 'Incentive', 'Letting-up allowance (mths)']}
            rows={vacant.map((t) => [
              t.input.suite,
              t.input.use,
              fmtNum(t.input.nla),
              fmtMoney2(t.input.marketRentPerSqm),
              fmtMoney(t.statics.grossFaceMarketPa),
              fmtPct(inputs.profiles[t.input.profileNumber - 1]?.incentivePct[0] ?? 0, 0),
              inputs.profiles[t.input.profileNumber - 1]?.lettingUpMonths[0] ?? 0,
            ])}
          />
        </Section>
      )}

      {outstanding.length > 0 && (
        <Section title="Outstanding incentives">
          <DataTable
            compact
            columns={['Suite', 'Tenant', 'Usage', 'Nominal amount', 'PV amount']}
            rows={outstanding.map((t) => [
              t.input.suite,
              t.input.tenantName,
              t.input.use,
              fmtMoney(t.statics.nominalOutstandingIncentives),
              fmtMoney(t.statics.pvOutstandingIncentives),
            ])}
          />
        </Section>
      )}

      <Section title="Discounted cash flow — transaction costs & present value">
        <DataTable
          compact
          columns={['Item', '%', '$']}
          rows={[
            ['Acquisition costs', fmtPct(inputs.costs.acquisitionCostPct), fmtMoney(dcf.lessPurchaseCosts)],
            ['Selling costs (terminal)', fmtPct(inputs.costs.sellingCostPct), fmtMoney(-dcf.terminal.sellingCosts)],
          ]}
        />
        <DataTable
          compact
          columns={['Item', 'Value']}
          rows={[
            ['PV of net cash flows', fmtMoney(dcf.pvOfCashflows)],
            ['Discounted terminal value', fmtMoney(dcf.terminal.discountedTerminalValue)],
            ['Total present value', fmtMoney(dcf.presentValueTotal)],
            ['Less purchase costs', fmtMoney(-dcf.lessPurchaseCosts)],
            [<strong key="a">DCF capital value (rounded)</strong>, <strong key="b">{fmtMoney(dcf.capitalValueRounded)}</strong>],
          ]}
        />
      </Section>

      <Section title="Sensitivity analysis">
        <DataTable
          compact
          title="NPV (after acquisition costs)"
          columns={['Discount \\ Terminal', ...dcf.npvSensitivity[0].map((c) => fmtPct(c.terminalYield))]}
          rows={dcf.npvSensitivity.map((row, i) => [
            fmtPct(row[0].discountRate),
            ...row.map((c, j) => (
              <span key={j} className={i === 1 && j === 1 ? 'sens-best' : undefined}>{fmtMoney(c.value)}</span>
            )),
          ])}
        />
        <DataTable
          compact
          title="IRR"
          columns={['Adopted value \\ Terminal', ...dcf.irrSensitivity[0].map((c) => fmtPct(c.terminalYield))]}
          rows={dcf.irrSensitivity.map((row, i) => [
            fmtMoney(row[0].adoptedValue),
            ...row.map((c, j) => (
              <span key={j} className={i === 1 && j === 1 ? 'sens-best' : undefined}>
                {c.irr == null ? 'n/a' : fmtPct(c.irr)}
              </span>
            )),
          ])}
        />
      </Section>

      <Section title="Static investment approach — calculation summary">
        <DataTable
          compact
          columns={['Item', 'Value']}
          rows={[
            [`Gross ${inputs.staticAssumptions.capitaliseMarketRents.toLowerCase()} base market income`, fmtMoney(cap.grossBaseMarketIncome)],
            ['Car parking market income', fmtMoney(cap.carParkingMarketIncome)],
            ['Less outgoings (Y1)', fmtMoney(-cap.outgoingsY1)],
            ['Estimated net market income', fmtMoney(cap.estimatedNetMarketIncome)],
            [`Core capital value @ ${fmtPct(cap.coreCapRate)}`, fmtMoney(cap.coreCapitalValue)],
            ['Total adjustments', fmtMoney(cap.adjustedCoreCapitalValue - cap.coreCapitalValue)],
            [<strong key="a">Adjusted core capital value</strong>, <strong key="b">{fmtMoney(cap.adjustedCoreCapitalValue)}</strong>],
            ['Rate per m² NLA', fmtMoney2(cap.ratePerSqm)],
          ]}
        />
      </Section>

      <Section title="Key portfolio metrics">
        <DataTable
          compact
          columns={['Metric', 'Value']}
          rows={[
            ['WALE by income', fmtYears(results.analysis.wale.byIncomeYears)],
            ['WALE by area', fmtYears(results.analysis.wale.byAreaYears)],
            ['Vacancy (% of NLA)', fmtPct(results.analysis.vacantPct, 1)],
            ['Passing / market rent relativity', fmtPct(cap.yields.passingMarketRelativity, 1)],
            ['Net passing income', fmtMoney(cap.yields.netPassingIncome)],
            ['Net market rent', fmtMoney(cap.yields.netMarketRent)],
          ]}
        />
        <p className="muted">
          *This report summary forms part of, and should not be used or read independently of, the
          full valuation model and its assumptions.
        </p>
      </Section>
    </>
  );
}
