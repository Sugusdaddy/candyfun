// Candyfun mark: one wrapped candy. Plain SVG so it works anywhere (nav, OG image, favicon).
export function Mark({ size = 24, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={spin ? "candy-spin" : undefined} style={{ display: "block", flex: "none" }}>
      <g transform="rotate(-30 24 24)">
        <path d="M3 13 L15 24 L3 35 Z" fill="#ff9fd0" />
        <path d="M45 13 L33 24 L45 35 Z" fill="#ff9fd0" />
        <circle cx="24" cy="24" r="12" fill="#ff6fb5" />
        <path d="M17 15 C22 19 22 29 17 33" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
        <path d="M25 13 C30 18 30 30 25 35" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
      </g>
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="brand">
      <Mark size={size} />
      candyfun
    </span>
  );
}
