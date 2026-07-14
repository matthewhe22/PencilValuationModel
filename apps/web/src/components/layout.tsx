import type { ReactNode } from 'react';
import type { ValidationIssue } from '@pencil/engine';
import { downloadCsv } from '../platform/files';

export function Section({
  number,
  title,
  intro,
  children,
}: {
  number?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <h2>
        {number ? <span className="section-number">{number}</span> : null}
        {title}
      </h2>
      {intro ? <p className="section-intro">{intro}</p> : null}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export interface TableColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable({
  title,
  columns,
  rows,
  csvName,
  footer,
  compact,
}: {
  title?: string;
  columns: (string | TableColumn)[];
  rows: (string | number | ReactNode)[][];
  /** raw values for CSV export (strings/numbers only); defaults to rows */
  csvRows?: (string | number)[][];
  csvName?: string;
  footer?: (string | number | ReactNode)[];
  compact?: boolean;
}) {
  const cols = columns.map((c) => (typeof c === 'string' ? { header: c } : c));
  const exportCsv = () => {
    const data: (string | number)[][] = [cols.map((c) => c.header)];
    for (const r of rows)
      data.push(r.map((c) => (typeof c === 'string' || typeof c === 'number' ? c : '')));
    downloadCsv(csvName ?? 'table.csv', data);
  };
  return (
    <div className={`table-wrap${compact ? ' compact' : ''}`}>
      {(title || csvName) && (
        <div className="table-head">
          {title ? <h3>{title}</h3> : <span />}
          {csvName ? (
            <button className="btn btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
          ) : null}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={i} style={{ textAlign: c.align ?? (i === 0 ? 'left' : 'right') }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    style={{ textAlign: cols[ci]?.align ?? (ci === 0 ? 'left' : 'right') }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? (
            <tfoot>
              <tr>
                {footer.map((c, ci) => (
                  <td
                    key={ci}
                    style={{ textAlign: cols[ci]?.align ?? (ci === 0 ? 'left' : 'right') }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export function IssuePanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return <div className="issues ok">Inputs OK — all checks passed.</div>;
  }
  return (
    <div className="issues">
      {issues.map((i, k) => (
        <div key={k} className={`issue ${i.severity}`}>
          <strong>{i.severity === 'error' ? 'Error' : 'Warning'}</strong> · {i.location}:{' '}
          {i.message}
        </div>
      ))}
    </div>
  );
}
