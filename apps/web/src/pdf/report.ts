/**
 * Client-side PDF generation of the valuation report (OP_Report equivalent)
 * using jsPDF + autotable.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ModelResults } from '@pencil/engine';
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtYears } from '../format';

const MARGIN = 14;

export function generateReportPdf(results: ModelResults): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const inputs = results.inputs;
  const g = inputs.general;
  let y = MARGIN;

  const heading = (text: string, size = 13) => {
    ensureSpace(14);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > 283) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const table = (head: string[], body: (string | number)[][], opts: { title?: string } = {}) => {
    if (opts.title) heading(opts.title, 11);
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map(String)),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 7.5, cellPadding: 1.4 },
      headStyles: { fillColor: [42, 120, 214], textColor: 255 },
      columnStyles: Object.fromEntries(
        head.map((_, i) => [i, { halign: i === 0 ? 'left' : 'right' } as const]),
      ),
      theme: 'striped',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  /* ---- Title page header ---- */
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Valuation Report', MARGIN, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`${g.buildingName || 'Property'} — ${g.address}, ${g.city} ${g.state} ${g.postcode}`, MARGIN, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  table(
    ['Item', 'Detail'],
    [
      ['Purpose', g.purpose],
      [g.purpose === 'Sale Analysis' ? 'Sale date' : 'Valuation date', fmtDate(g.valuationDate)],
      ['Client', g.client],
      ['Owner / vendor', g.vendorOwner],
      ['Interest valued', g.interestValued],
      ['Asset type', `${g.assetType}: ${g.buildingGrade}`],
      ['Building NLA', `${fmtNum(results.nla)} m²`],
      ['Land area', `${fmtNum(g.landArea)} m²`],
      ['Inspection date', fmtDate(g.inspectionDate)],
      ['Valuer', `${g.valuer.name}${g.valuer.qualifications ? ` (${g.valuer.qualifications})` : ''}${g.valuer.position ? `, ${g.valuer.position}` : ''}`],
      ['Valuation approaches', `${inputs.dcf.discountPeriodYears} year DCF and capitalisation of net market income`],
    ],
  );

  heading('Valuation summary', 12);
  table(
    ['Approach', 'Value', '$/m² NLA'],
    [
      ['Capitalisation of net income', fmtMoney(results.cap.adjustedCoreCapitalValue), fmtMoney2(results.cap.ratePerSqm)],
      ['Discounted cash flow (after acquisition costs)', fmtMoney(results.dcf.capitalValue), fmtMoney2(results.nla > 0 ? results.dcf.capitalValue / results.nla : 0)],
      ['ADOPTED VALUE', fmtMoney(g.adoptedValue), fmtMoney2(results.nla > 0 ? g.adoptedValue / results.nla : 0)],
    ],
  );
  table(
    ['Metric', 'Value'],
    [
      ['Core capitalisation rate', fmtPct(results.cap.coreCapRate)],
      ['Discount rate', fmtPct(results.dcf.discountRate)],
      ['Terminal yield', fmtPct(results.dcf.terminalYield)],
      ['Resultant IRR (at adopted value)', results.dcf.irr == null ? 'n/a' : fmtPct(results.dcf.irr)],
      ['Net passing initial yield', fmtPct(results.cap.yields.netPassingInitialYield)],
      ['Initial yield (fully leased)', fmtPct(results.cap.yields.initialYieldFullyLeased)],
      ['Equivalent market yield', fmtPct(results.cap.yields.equivalentMarketYield)],
      ['Reversionary yield', fmtPct(results.cap.yields.reversionaryYield)],
      ['WALE by income / by area', `${fmtYears(results.analysis.wale.byIncomeYears)} / ${fmtYears(results.analysis.wale.byAreaYears)}`],
    ],
    { title: 'Key metrics' },
  );

  /* ---- Tenancy schedule ---- */
  doc.addPage();
  y = MARGIN;
  heading('Tenancy schedule', 12);
  table(
    ['Suite', 'Tenant', 'Use', 'NLA m²', 'Start', 'Expiry', 'Passing $ p.a.', 'Market $ p.a.'],
    results.tenants.map((t) => [
      t.input.suite,
      t.input.status === 'Vacant' ? 'Vacant' : t.input.tenantName,
      t.input.use,
      fmtNum(t.input.nla),
      t.input.status === 'Vacant' ? '–' : fmtDate(t.input.leaseStart),
      t.input.status === 'Vacant' ? '–' : fmtDate(t.input.leaseExpiry),
      fmtMoney(t.statics.grossPassingPa),
      fmtMoney(t.statics.grossFaceMarketPa),
    ]),
  );

  const vacant = results.tenants.filter((t) => t.input.status === 'Vacant');
  if (vacant.length > 0) {
    table(
      ['Suite', 'Usage', 'Area m²', 'Market rate $/m²', 'Annual rent', 'Letting-up (mths)'],
      vacant.map((t) => [
        t.input.suite,
        t.input.use,
        fmtNum(t.input.nla),
        fmtMoney2(t.input.marketRentPerSqm),
        fmtMoney(t.statics.grossFaceMarketPa),
        String(inputs.profiles[t.input.profileNumber - 1]?.lettingUpMonths[0] ?? 0),
      ]),
      { title: 'Vacancy' },
    );
  }

  const outstanding = results.tenants.filter((t) => t.statics.nominalOutstandingIncentives > 0);
  if (outstanding.length > 0) {
    table(
      ['Suite', 'Tenant', 'Usage', 'Nominal $', 'PV $'],
      outstanding.map((t) => [
        t.input.suite,
        t.input.tenantName,
        t.input.use,
        fmtMoney(t.statics.nominalOutstandingIncentives),
        fmtMoney(t.statics.pvOutstandingIncentives),
      ]),
      { title: 'Outstanding incentives' },
    );
  }

  /* ---- DCF ---- */
  doc.addPage();
  y = MARGIN;
  heading('Discounted cash flow', 12);
  table(
    ['Item', '%', '$'],
    [
      ['Acquisition costs', fmtPct(inputs.costs.acquisitionCostPct), fmtMoney(results.dcf.lessPurchaseCosts)],
      ['Selling costs (on terminal value)', fmtPct(inputs.costs.sellingCostPct), fmtMoney(-results.dcf.terminal.sellingCosts)],
    ],
    { title: 'Transaction costs' },
  );
  table(
    ['Item', 'Value'],
    [
      ['PV of net cash flows', fmtMoney(results.dcf.pvOfCashflows)],
      ['Discounted terminal value', fmtMoney(results.dcf.terminal.discountedTerminalValue)],
      ['Total present value', fmtMoney(results.dcf.presentValueTotal)],
      ['Less purchase costs', fmtMoney(-results.dcf.lessPurchaseCosts)],
      ['Capital value', fmtMoney(results.dcf.capitalValue)],
      ['Capital value (rounded)', fmtMoney(results.dcf.capitalValueRounded)],
    ],
    { title: 'Present value' },
  );
  table(
    ['Item', 'Value'],
    [
      ['Annualised gross market income (month ' + results.dcf.terminal.monthIndex + ')', fmtMoney(results.dcf.terminal.annualisedGrossMarket)],
      ['Annualised outgoings (terminal year)', fmtMoney(-results.dcf.terminal.annualisedOutgoings)],
      ['Net income', fmtMoney(results.dcf.terminal.netIncome)],
      [`Terminal value prior to adjustments (${fmtPct(results.dcf.terminalYield)})`, fmtMoney(results.dcf.terminal.valueBeforeAdjustments)],
      ['Rental reversions', fmtMoney(results.dcf.terminal.rentalReversions)],
      ['Additional income', fmtMoney(results.dcf.terminal.additionalIncome)],
      ['Gross realisation', fmtMoney(results.dcf.terminal.grossRealisation)],
      ['Selling costs', fmtMoney(results.dcf.terminal.sellingCosts)],
      ['Terminal value prior to discounting', fmtMoney(results.dcf.terminal.valueBeforeDiscounting)],
    ],
    { title: 'Terminal value' },
  );
  table(
    ['Discount \\ Terminal', ...results.dcf.npvSensitivity[0].map((c) => fmtPct(c.terminalYield))],
    results.dcf.npvSensitivity.map((row) => [
      fmtPct(row[0].discountRate),
      ...row.map((c) => fmtMoney(c.value)),
    ]),
    { title: 'NPV sensitivity (after acquisition costs)' },
  );
  table(
    ['Adopted value \\ Terminal', ...results.dcf.irrSensitivity[0].map((c) => fmtPct(c.terminalYield))],
    results.dcf.irrSensitivity.map((row) => [
      fmtMoney(row[0].adoptedValue),
      ...row.map((c) => (c.irr == null ? 'n/a' : fmtPct(c.irr))),
    ]),
    { title: 'IRR sensitivity' },
  );

  /* ---- Annual cash flow ---- */
  doc.addPage();
  y = MARGIN;
  heading('Annual cash flow', 12);
  const years = results.dcf.annual.slice(0, inputs.dcf.discountPeriodYears);
  table(
    ['Item', ...years.map((yy) => `Yr ${yy.year}`)],
    [
      ['Gross passing income', ...years.map((yy) => fmtMoney(yy.grossPassingIncome))],
      ['Total outgoings', ...years.map((yy) => fmtMoney(-yy.totalOutgoings))],
      ['Commissions & incentives', ...years.map((yy) => fmtMoney(-yy.commissions - yy.incentives))],
      ['Net cash flow (pre-capex)', ...years.map((yy) => fmtMoney(yy.netCashflowPreCapex))],
      ['Capital expenditure', ...years.map((yy) => fmtMoney(-yy.totalCapex))],
      ['Net cash flow', ...years.map((yy) => fmtMoney(yy.netCashflow))],
    ],
  );

  /* ---- Capitalisation ---- */
  heading('Static investment approach — calculation summary', 12);
  table(
    ['Item', 'Value'],
    [
      [`Gross ${inputs.staticAssumptions.capitaliseMarketRents.toLowerCase()} base market income`, fmtMoney(results.cap.grossBaseMarketIncome)],
      ['Car parking market income', fmtMoney(results.cap.carParkingMarketIncome)],
      ['Less outgoings (Y1)', fmtMoney(-results.cap.outgoingsY1)],
      ['Estimated net market income', fmtMoney(results.cap.estimatedNetMarketIncome)],
      [`Core capital value @ ${fmtPct(results.cap.coreCapRate)}`, fmtMoney(results.cap.coreCapitalValue)],
      ['PV of rental reversions', fmtMoney(results.cap.adjustments.pvRentalReversions)],
      ['PV of letting-up allowances', fmtMoney(results.cap.adjustments.pvLettingUp)],
      ['PV of leasing commissions', fmtMoney(results.cap.adjustments.pvCommissions)],
      ['PV of outstanding incentives', fmtMoney(results.cap.adjustments.pvOutstandingIncentives)],
      ['PV of tenant incentives', fmtMoney(results.cap.adjustments.pvTenantIncentives)],
      ['PV of capital expenditure', fmtMoney(results.cap.adjustments.pvCapex)],
      ['Additional income', fmtMoney(results.cap.adjustments.additionalIncome)],
      ['Manual adjustment', fmtMoney(results.cap.adjustments.manualAdjustment)],
      ['Adjusted core capital value', fmtMoney(results.cap.adjustedCoreCapitalValue)],
    ],
  );

  /* ---- Sign-off ---- */
  ensureSpace(40);
  heading('Adopted value', 12);
  doc.setFontSize(11);
  doc.text(
    `${fmtMoney(g.adoptedValue)}${g.adoptedValueText ? ` (${g.adoptedValueText})` : ''}`,
    MARGIN,
    y,
  );
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'This summary forms part of, and should not be used or read independently of, the full valuation model and its assumptions.',
    MARGIN,
    y,
    { maxWidth: 180 },
  );

  const filename = `${(g.buildingName || 'valuation').replace(/[^\w.-]+/g, '_')}_report.pdf`;
  doc.save(filename);
}
