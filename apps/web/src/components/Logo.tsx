/** Brand mark: rising bars being drawn by a pencil-stroke trend line. */
export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="pv-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b3f6b" />
          <stop offset="1" stopColor="#151f38" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="11" fill="url(#pv-bg)" />
      <rect x="9" y="27" width="7" height="12" rx="2" fill="#4f7fc9" />
      <rect x="20.5" y="21" width="7" height="18" rx="2" fill="#6f9bd9" />
      <rect x="32" y="14" width="7" height="25" rx="2" fill="#9fbde8" />
      {/* pencil trend-stroke */}
      <path d="M7 36 L33.5 12.5" stroke="#f2a33c" strokeWidth="3.4" strokeLinecap="round" />
      {/* pencil tip */}
      <path d="M34.5 16.5 L41 6.5 L38.2 19.6 Z" fill="#f2a33c" />
      <path d="M39.2 9.2 L41 6.5 L40.4 12.1 Z" fill="#3b2d18" />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <div className="brand">
      <LogoMark />
      <div className="brand-text">
        <span className="brand-name">
          Pencil<span className="brand-accent">.</span>
        </span>
        <span className="brand-sub">Valuation Model</span>
      </div>
    </div>
  );
}
