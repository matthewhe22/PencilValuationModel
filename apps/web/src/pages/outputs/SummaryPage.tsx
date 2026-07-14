import { DataTable, IssuePanel, Section, StatTile } from '../../components/layout';
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtYears } from '../../format';
import { useStore } from '../../state/store';

export function SummaryPage() {
  const { inputs, results } = useStore();
  const g = inputs.general;
  const { cap, dcf, analysis } = results;

  const uses = [...new Set(inputs.tenants.map((t) => t.use))];
  const rentalProfile = uses.map((use) => {
    const rows = results.tenants.filter((t) => t.input.use === use);
    const area = rows.reduce((a, t) => a + t.input.nla, 0);
    const passing = rows.reduce((a, t) => a + t.statics.basePassingPa, 0);
    const market = rows.reduce((a, t) => a + t.statics.grossFaceMarketPa - (t.input.carParking.marketRatePcm * t.input.carParking.spaces * 12), 0);
    return [
      use,
      fmtMoney(passing),
      area > 0 && passing > 0 ? fmtMoney2(passing / area) : '–',
      fmtMoney(market),
      area > 0 && market > 0 ? fmtMoney2(market / area) : '–',
    ];
  });
  const carPassing = inputs.tenants.reduce((a, t) => a + (t.status === 'Vacant' ? 0 : t.carParking.rentPa), 0);
  const carMarket = inputs.tenants.reduce((a, t) => a + t.carParking.marketRatePcm * t.carParking.spaces * 12, 0);
  const otherIncome = results.otherIncome.reduce((a, r) => a + (r.active ? r.annualisedTotal : 0), 0);
  const recoveries = results.tenants.reduce((a, t) => a + t.statics.recoveriesPa, 0);
  const passingTotal = results.tenants.reduce((a, t) => a + t.statics.basePassingPa, 0) + carPassing + otherIncome;
  const marketTotal = cap.grossBaseMarketIncome + cap.carParkingMarketIncome + otherIncome;

  return (
    <>
      <IssuePanel issues={results.issues} />

      <Section title={`Executive Summary — ${g.buildingName || 'Property'}, ${g.address}`}>
        <div className="grid cols-3">
          <KV k="Owner" v={g.vendorOwner} />
          <KV k={g.purpose === 'Sale Analysis' ? 'Purchaser' : 'Client'} v={g.client} />
          <KV k="Asset type" v={`${g.assetType}: ${g.buildingGrade}`} />
          <KV k={g.purpose === 'Sale Analysis' ? 'Sale date' : 'Valuation date'} v={fmtDate(g.valuationDate)} />
          <KV k="Valuer" v={`${g.valuer.name}${g.valuer.qualifications ? ` (${g.valuer.qualifications})` : ''}${g.valuer.position ? `, ${g.valuer.position}` : ''}`} />
          <KV k="Date of inspection" v={fmtDate(g.inspectionDate)} />
          <KV k="Interest valued" v={g.interestValued} />
          <KV k="Land area (approx.)" v={`${fmtNum(g.landArea)} m²`} />
          <KV k="Building area NLA" v={`${fmtNum(results.nla)} m²`} />
          <KV k="Valuation approaches" v={`${inputs.dcf.discountPeriodYears} year discounted cash flow and capitalisation basis`} />
        </div>
      </Section>

      <div className="stat-row">
        <StatTile label="Capitalisation value" value={fmtMoney(cap.adjustedCoreCapitalValue)} sub={`${fmtMoney2(cap.ratePerSqm)}/m² NLA`} />
        <StatTile label="DCF value (after acq. costs)" value={fmtMoney(dcf.capitalValue)} sub={`${fmtMoney2(results.nla > 0 ? dcf.capitalValue / results.nla : 0)}/m² NLA`} />
        <StatTile label="Adopted value" value={fmtMoney(g.adoptedValue)} sub={g.adoptedValueText} />
        <StatTile label="Resultant IRR" value={dcf.irr == null ? 'n/a' : fmtPct(dcf.irr)} sub="at adopted value" />
      </div>
      <div className="stat-row">
        <StatTile label="Net passing initial yield" value={fmtPct(cap.yields.netPassingInitialYield)} />
        <StatTile label="Initial yield (fully leased)" value={fmtPct(cap.yields.initialYieldFullyLeased)} />
        <StatTile label="Equivalent market yield" value={fmtPct(cap.yields.equivalentMarketYield)} />
        <StatTile label="Reversionary yield" value={fmtPct(cap.yields.reversionaryYield)} />
      </div>

      <Section title="Rental Profile">
        <DataTable
          columns={['Use', 'Passing $ p.a.', 'Passing $/m²', `${inputs.staticAssumptions.capitaliseMarketRents} market $ p.a.`, 'Market $/m²']}
          rows={[
            ...rentalProfile,
            ['Car parking', fmtMoney(carPassing), '–', fmtMoney(carMarket), '–'],
            ['Other income', fmtMoney(otherIncome), '–', fmtMoney(otherIncome), '–'],
            ['Recoverable outgoings', fmtMoney(recoveries), '–', '–', '–'],
            [<strong key="g">Gross income</strong>, <strong key="g1">{fmtMoney(passingTotal + recoveries)}</strong>, '', <strong key="g2">{fmtMoney(marketTotal)}</strong>, ''],
            ['Less outgoings', fmtMoney(-results.outgoingsTotals.total), fmtMoney2(-results.outgoingsTotals.totalPerSqm), fmtMoney(-results.outgoingsTotals.total), ''],
            [<strong key="n">Net income</strong>, <strong key="n1">{fmtMoney(cap.yields.netPassingIncome)}</strong>, '', <strong key="n2">{fmtMoney(cap.yields.netMarketRent)}</strong>, ''],
          ]}
          csvName="rental-profile.csv"
        />
      </Section>

      <div className="chart-grid">
        <Section title="DCF Analysis">
          <DataTable
            compact
            columns={['Item', 'Value']}
            rows={[
              ['Discount rate', fmtPct(dcf.discountRate)],
              ['Terminal yield', fmtPct(dcf.terminalYield)],
              ['CPI (10-yr avg)', fmtPct(results.rates.cpi10yr)],
              ['Acquisition costs', fmtPct(inputs.costs.acquisitionCostPct)],
              ['Selling costs', fmtPct(inputs.costs.sellingCostPct)],
              ['New lease term (NLA weighted)', fmtYears(analysis.weightedNewLeaseTermYears)],
              ['Nominal capex (10 yrs)', fmtMoney(dcf.annual.reduce((a, y) => a + y.totalCapex, 0))],
              ['PV of cash flows', fmtMoney(dcf.pvOfCashflows)],
              ['Discounted terminal value', fmtMoney(dcf.terminal.discountedTerminalValue)],
              ['Total present value', fmtMoney(dcf.presentValueTotal)],
              ['Less purchase costs', fmtMoney(-dcf.lessPurchaseCosts)],
              [<strong key="cv">Capital value</strong>, <strong key="cv2">{fmtMoney(dcf.capitalValueRounded)}</strong>],
            ]}
          />
        </Section>

        <Section title="Capitalisation Analysis">
          <DataTable
            compact
            columns={['Item', 'Value']}
            rows={[
              ['Core capitalisation rate', fmtPct(cap.coreCapRate)],
              [`Gross ${inputs.staticAssumptions.capitaliseMarketRents.toLowerCase()} base market income`, fmtMoney(cap.grossBaseMarketIncome)],
              ['Car parking market income', fmtMoney(cap.carParkingMarketIncome)],
              ['Less outgoings (Y1)', fmtMoney(-cap.outgoingsY1)],
              ['Net market income', fmtMoney(cap.estimatedNetMarketIncome)],
              ['Core capital value', fmtMoney(cap.coreCapitalValue)],
              ['PV of rental reversions', fmtMoney(cap.adjustments.pvRentalReversions)],
              [`PV of letting up (${inputs.staticAssumptions.reversionWindowMonths} mths)`, fmtMoney(cap.adjustments.pvLettingUp)],
              [`PV of leasing commissions (${inputs.staticAssumptions.reversionWindowMonths} mths)`, fmtMoney(cap.adjustments.pvCommissions)],
              ['PV of outstanding incentives', fmtMoney(cap.adjustments.pvOutstandingIncentives)],
              ['PV of tenant incentives', fmtMoney(cap.adjustments.pvTenantIncentives)],
              ['PV of capital expenditure', fmtMoney(cap.adjustments.pvCapex)],
              ['Additional income', fmtMoney(cap.adjustments.additionalIncome)],
              ['Manual adjustment', fmtMoney(cap.adjustments.manualAdjustment)],
              [<strong key="acv">Adjusted core capital value</strong>, <strong key="acv2">{fmtMoney(cap.adjustedCoreCapitalValue)}</strong>],
            ]}
          />
        </Section>
      </div>

      <Section title="Sensitivity — capital value (after acquisition costs)" intro="Rows: discount rate. Columns: terminal yield. Centre cell is the adopted assumption pair.">
        <DataTable
          compact
          columns={['Discount \\ Terminal', ...dcf.npvSensitivity[0].map((c) => fmtPct(c.terminalYield))]}
          rows={dcf.npvSensitivity.map((row, i) => [
            fmtPct(row[0].discountRate),
            ...row.map((c, j) => (
              <span key={j} className={i === 1 && j === 1 ? 'sens-best' : undefined}>
                {fmtMoney(c.value)}
              </span>
            )),
          ])}
          csvName="npv-sensitivity.csv"
        />
        <DataTable
          compact
          title="Capitalisation sensitivity"
          columns={['Cap rate', 'Core value', 'Adjusted value', '$/m² NLA']}
          rows={cap.sensitivity.map((s, i) => [
            <span key={i} className={i === 2 ? 'sens-best' : undefined}>{fmtPct(s.capRate)}</span>,
            fmtMoney(s.coreValue),
            fmtMoney(s.adjustedValue),
            fmtMoney2(s.ratePerSqm),
          ])}
        />
      </Section>
    </>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="stat-label">{k}</div>
      <div>{v || '–'}</div>
    </div>
  );
}
