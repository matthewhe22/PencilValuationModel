const aud0 = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});
const aud2 = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const num0 = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const fmtMoney = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '–' : aud0.format(v);
export const fmtMoney2 = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '–' : aud2.format(v);
export const fmtNum = (v: number | null | undefined, dp = 0): string =>
  v == null || Number.isNaN(v) ? '–' : dp === 0 ? num0.format(v) : num2.format(v);
export const fmtPct = (v: number | null | undefined, dp = 2): string =>
  v == null || Number.isNaN(v) ? '–' : `${(v * 100).toFixed(dp)}%`;
export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const fmtYears = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '–' : `${v.toFixed(2)} yrs`;
