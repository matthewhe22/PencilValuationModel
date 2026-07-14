import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { downloadJson, pickJsonFile } from './platform/files';
import { fmtPct } from './format';
import { LogoWordmark } from './components/Logo';
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
  kicker?: string;
  group: 'Inputs' | 'Outputs';
  component: () => JSX.Element;
}

const ROUTES: Route[] = [
  { path: 'general', label: 'General & Costs', kicker: '1', group: 'Inputs', component: GeneralPage },
  { path: 'profiles', label: 'Vacant Space Profiles', kicker: '2', group: 'Inputs', component: ProfilesPage },
  { path: 'valuation', label: 'Valuation Assumptions', kicker: '3', group: 'Inputs', component: ValuationAssumptionsPage },
  { path: 'other-income', label: 'Other Income', kicker: '4', group: 'Inputs', component: OtherIncomePage },
  { path: 'capex', label: 'Capital Expenditure', kicker: '5', group: 'Inputs', component: CapexPage },
  { path: 'growth', label: 'Growth Rates', kicker: '6', group: 'Inputs', component: GrowthPage },
  { path: 'tenancy', label: 'Tenancy Schedule', kicker: '7', group: 'Inputs', component: TenancyInputPage },
  { path: 'outgoings', label: 'Outgoings', kicker: '8', group: 'Inputs', component: OutgoingsPage },
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

const fmtCompact = (v: number): string =>
  Math.abs(v) >= 1e6
    ? `$${(v / 1e6).toFixed(2)}m`
    : Math.abs(v) >= 1e3
      ? `$${Math.round(v / 1e3)}k`
      : `$${Math.round(v)}`;

export function App() {
  const route = useHashRoute();
  const store = useStore();
  const errorCount = store.results.issues.filter((i) => i.severity === 'error').length;
  const warnCount = store.results.issues.filter((i) => i.severity === 'warning').length;
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
        <LogoWordmark />

        {(['Inputs', 'Outputs'] as const).map((group) => (
          <nav className="nav-group" key={group}>
            <p className="nav-group-title">{group}</p>
            {ROUTES.filter((r) => r.group === group).map((r) => (
              <a
                key={r.path}
                href={`#/${r.path}`}
                className={`nav-link${r.path === active.path ? ' active' : ''}`}
              >
                {r.kicker ? <span className="nav-kicker">{r.kicker}</span> : <span className="nav-dot" />}
                <span className="nav-label">{r.label}</span>
                {r.path === 'tenancy' && errorCount > 0 ? (
                  <span className="nav-badge">{errorCount}</span>
                ) : null}
              </a>
            ))}
          </nav>
        ))}

        <nav className="nav-group nav-library">
          <p className="nav-group-title">Valuation library</p>
          <ul className="library-list">
            {store.library.map((v) => (
              <li key={v.id} className={v.id === store.docId ? 'current' : ''}>
                <span className="name" title={v.name} onClick={() => void store.openValuation(v.id)}>
                  {v.name}
                </span>
                <button
                  className="lib-delete"
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
          <button className="btn btn-sidebar" onClick={() => store.newValuation()}>
            + New valuation
          </button>
        </nav>

        <p className="sidebar-foot">All data stays in your browser.</p>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <p className="topbar-kicker">
              {active.group} {active.kicker ? `· Sheet ${active.kicker}` : ''}
            </p>
            <h1>{active.label}</h1>
            <p className="topbar-subtitle">
              {store.inputs.general.buildingName || 'Unnamed property'}
              {store.inputs.general.address ? ` · ${store.inputs.general.address}` : ''}
            </p>
          </div>
          <div className="topbar-right">
            <input
              className="docname"
              type="text"
              value={store.docName}
              onChange={(e) => store.setDocName(e.target.value)}
              aria-label="Valuation name"
            />
            <button className="btn" onClick={exportJson}>Export JSON</button>
            <button className="btn" onClick={() => void importJson()}>Import JSON</button>
          </div>
        </header>

        <div className="ribbon">
          <span className={`ribbon-status ${errorCount > 0 ? 'bad' : 'good'}`}>
            <span className="dot" />
            {errorCount > 0
              ? `${errorCount} input error${errorCount > 1 ? 's' : ''}`
              : warnCount > 0
                ? `Inputs OK · ${warnCount} warning${warnCount > 1 ? 's' : ''}`
                : 'Inputs OK'}
          </span>
          <span className="ribbon-chip">
            <span className="chip-label">Capitalisation</span>
            {fmtCompact(store.results.cap.adjustedCoreCapitalValue)}
          </span>
          <span className="ribbon-chip">
            <span className="chip-label">DCF</span>
            {fmtCompact(store.results.dcf.capitalValue)}
          </span>
          <span className="ribbon-chip">
            <span className="chip-label">Adopted</span>
            {fmtCompact(store.inputs.general.adoptedValue)}
          </span>
          <span className="ribbon-chip">
            <span className="chip-label">IRR</span>
            {store.results.dcf.irr == null ? 'n/a' : fmtPct(store.results.dcf.irr)}
          </span>
          <span className="ribbon-live" title="Recalculates on every input change">live</span>
        </div>

        <Page />
      </main>
    </div>
  );
}
