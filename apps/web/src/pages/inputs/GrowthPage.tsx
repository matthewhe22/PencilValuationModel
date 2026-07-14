import { PctInput } from '../../components/fields';
import { Section } from '../../components/layout';
import { fmtPct } from '../../format';
import { useStore } from '../../state/store';

export function GrowthPage() {
  const { inputs, results, update } = useStore();

  return (
    <>
      <Section
        number="8.0"
        title="Growth Rates by Model Year"
        intro="Annual growth applied per model year (year 0 is the base row — its CPI seeds year-1 growth). Outgoings growth inflates the expense lines and recoverable outgoings; capex growth inflates capital upgrade rates and specified capex; car parking growth drives car park market rents."
      >
        <div className="table-scroll">
          <table className="compact">
            <thead>
              <tr>
                <th>Model year</th>
                <th>CPI %</th>
                <th>Capex %</th>
                <th>Outgoings %</th>
                <th>Car parking %</th>
              </tr>
            </thead>
            <tbody>
              {inputs.growth.map((row, y) => (
                <tr key={y}>
                  <td>{y}</td>
                  <td><PctInput value={row.cpi} dp={1} onChange={(v) => update((d) => void (d.growth[y].cpi = v ?? 0))} /></td>
                  <td><PctInput value={row.capex} dp={1} onChange={(v) => update((d) => void (d.growth[y].capex = v ?? 0))} /></td>
                  <td><PctInput value={row.outgoings} dp={1} onChange={(v) => update((d) => void (d.growth[y].outgoings = v ?? 0))} /></td>
                  <td><PctInput value={row.carParking} dp={1} onChange={(v) => update((d) => void (d.growth[y].carParking = v ?? 0))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">10-year average compound CPI: <strong>{fmtPct(results.rates.cpi10yr)}</strong></p>
      </Section>

      <Section
        number="9.0"
        title="Market Rent Growth Rates"
        intro="Face rent growth per model year for the Office and Retail growth profiles. Tenancies pick a growth profile in the schedule (CPI / Default - Office / Default - Retail / Car Parking); market rents compound monthly at these annual rates. Letting-up months and incentives by expiry year come from the vacant space profiles (page 2)."
      >
        <div className="grid cols-2">
          {(['officeGrowth', 'retailGrowth'] as const).map((key) => (
            <div key={key}>
              <h3>{key === 'officeGrowth' ? 'Office — gross face growth' : 'Retail — gross face growth'}</h3>
              <div className="table-scroll">
                <table className="compact">
                  <thead>
                    <tr>
                      <th>Model year</th>
                      <th>Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputs.marketGrowth[key].map((v, y) =>
                      y === 0 ? null : (
                        <tr key={y}>
                          <td>{y}</td>
                          <td>
                            <PctInput value={v} dp={1} onChange={(nv) => update((d) => void (d.marketGrowth[key][y] = nv ?? 0))} />
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Resulting $/m² forecast tables (face, effective, net of outgoings) are on the{' '}
          <a href="#/rates">Growth Forecasts</a> output page.
        </p>
      </Section>
    </>
  );
}
