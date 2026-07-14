import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { downloadJson, pickJsonFile } from './platform/files';
import { GeneralPage } from './pages/inputs/GeneralPage';
import { ProfilesPage } from './pages/inputs/ProfilesPage';
import { ValuationAssumptionsPage } from './pages/inputs/ValuationAssumptionsPage';
import { OtherIncomePage } from './pages/inputs/OtherIncomePage';
import { CapexPage } from './pages/inputs/CapexPage';
import { GrowthPage } from './pages/inputs/GrowthPage';
import { TenancyInputPage } from './pages/inputs/TenancyInputPage';
import { OutgoingsPage } from './pages/inputs/OutgoingsPage';
import { SummaryPage } from './pages/outputs/SummaryPage';
import { CashflowPage } from './pages/outputs/CashflowPage';
import { TenancyOutputPage } from './pages/outputs/TenancyOutputPage';
import { AnalysisPage } from './pages/outputs/AnalysisPage';
import { RatesPage } from './pages/outputs/RatesPage';
import { ReportPage } from './pages/outputs/ReportPage';

interface Route {
  path: string;
  label: string;
  group: 'Inputs' | 'Outputs';
  component: () => JSX.Element;
}

const ROUTES: Route[] = [
  { path: 'general', label: '1. General & Costs', group: 'Inputs', component: GeneralPage },
  { path: 'profiles', label: '2. Vacant Space Profiles', group: 'Inputs', component: ProfilesPage },
  { path: 'valuation', label: '3. Valuation Assumptions', group: 'Inputs', component: ValuationAssumptionsPage },
  { path: 'other-income', label: '4. Other Income', group: 'Inputs', component: OtherIncomePage },
  { path: 'capex', label: '5. Capital Expenditure', group: 'Inputs', component: CapexPage },
  { path: 'growth', label: '6. Growth Rates', group: 'Inputs', component: GrowthPage },
  { path: 'tenancy', label: '7. Tenancy Schedule', group: 'Inputs', component: TenancyInputPage },
  { path: 'outgoings', label: '8. Outgoings', group: 'Inputs', component: OutgoingsPage },
  { path: 'summary', label: 'Executive Summary', group: 'Outputs', component: SummaryPage },
  { path: 'cashflow', label: 'Cash Flow', group: 'Outputs', component: CashflowPage },
  { path: 'tenancy-summary', label: 'Tenancy', group: 'Outputs', component: TenancyOutputPage },
  { path: 'analysis', label: 'Analysis', group: 'Outputs', component: AnalysisPage },
  { path: 'rates', label: 'Growth Forecasts', group: 'Outputs', component: RatesPage },
  { path: 'report', label: 'Report & PDF', group: 'Outputs', component: ReportPage },
];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, ''));
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#\/?/, ''));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash || 'summary';
}

export function App() {
  const route = useHashRoute();
  const store = useStore();
  const errorCount = store.results.issues.filter((i) => i.severity === 'error').length;
  const active = ROUTES.find((r) => r.path === route) ?? ROUTES[8];
  const Page = active.component;

  const exportJson = () =>
    downloadJson(`${store.docName.replace(/[^\w.-]+/g, '_') || 'valuation'}.json`, store.inputs);
  const importJson = async () => {
    const raw = await pickJsonFile();
    if (raw) store.importInputs(raw);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Pencil Valuation Model</h1>
        <p className="tagline">DCF & capitalisation valuation</p>

        {(['Inputs', 'Outputs'] as const).map((group) => (
          <nav className="nav-group" key={group}>
            <p className="nav-group-title">{group}</p>
            {ROUTES.filter((r) => r.group === group).map((r) => (
              <a
                key={r.path}
                href={`#/${r.path}`}
                className={`nav-link${r.path === active.path ? ' active' : ''}`}
              >
                {r.label}
                {r.path === 'tenancy' && errorCount > 0 ? (
                  <span className="nav-badge">{errorCount}</span>
                ) : null}
              </a>
            ))}
          </nav>
        ))}

        <nav className="nav-group">
          <p className="nav-group-title">Valuation library</p>
          <ul className="library-list">
            {store.library.map((v) => (
              <li key={v.id}>
                <span
                  className="name"
                  title={v.name}
                  style={{ fontWeight: v.id === store.docId ? 700 : 400 }}
                  onClick={() => void store.openValuation(v.id)}
                >
                  {v.name}
                </span>
                <button
                  className="btn btn-ghost btn-danger"
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Delete "${v.name}"?`)) void store.deleteValuation(v.id);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="btn" style={{ width: '100%' }} onClick={() => store.newValuation()}>
            + New valuation
          </button>
        </nav>
      </aside>

      <main className="main">
        <div className="page-title">
          <h1>{active.label}</h1>
          <span className="subtitle">
            {store.inputs.general.buildingName || 'Unnamed property'} ·{' '}
            {store.inputs.general.address}
          </span>
        </div>
        <div className="toolbar">
          <input
            type="text"
            value={store.docName}
            onChange={(e) => store.setDocName(e.target.value)}
            aria-label="Valuation name"
          />
          <button className="btn" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn" onClick={() => void importJson()}>
            Import JSON
          </button>
        </div>
        <Page />
      </main>
    </div>
  );
}
