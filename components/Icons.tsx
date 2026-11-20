// Line icons drawn for Candyfun: 24px grid, 1.8 stroke, square ends. No icon font, no AI art.
type P = { size?: number; className?: string };
const S = ({ size = 20, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="square" strokeLinejoin="miter" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IconStart = (p: P) => (
  <S {...p}>
    <path d="M3 20h18" />
    <path d="M5 16l5-5 3 3 6-7" />
    <path d="M15 7h4v4" />
  </S>
);
export const IconBlind = (p: P) => (
  <S {...p}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <path d="M4 20L20 4" />
  </S>
);
export const IconLock = (p: P) => (
  <S {...p}>
    <rect x="4" y="10" width="16" height="11" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <path d="M12 14v3" />
  </S>
);
export const IconPercent = (p: P) => (
  <S {...p}>
    <path d="M19 5L5 19" />
    <circle cx="7" cy="7" r="2.2" />
    <circle cx="17" cy="17" r="2.2" />
  </S>
);
export const IconPairs = (p: P) => (
  <S {...p}>
    <circle cx="8.5" cy="12" r="5.5" />
    <circle cx="15.5" cy="12" r="5.5" />
  </S>
);
export const IconShield = (p: P) => (
  <S {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </S>
);
export const IconFlame = (p: P) => (
  <S {...p}>
    <path d="M12 21c-4 0-7-2.8-7-6.6 0-3.4 2.4-5.4 4-8.4.5 2 1.6 3 3 3.4C12 6 13.6 4 14.5 3c.6 3 4.5 6 4.5 11 0 4-3 7-7 7z" />
  </S>
);
export const IconGift = (p: P) => (
  <S {...p}>
    <rect x="3" y="8" width="18" height="4" />
    <path d="M5 12v9h14v-9" />
    <path d="M12 8v13" />
    <path d="M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zM12 8c1.5-3 5-4 5-1.5S14 8 12 8z" />
  </S>
);
export const IconTrophy = (p: P) => (
  <S {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    <path d="M12 14v4M8 21h8" />
  </S>
);
export const IconBolt = (p: P) => (
  <S {...p}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </S>
);
export const IconCopy = (p: P) => (
  <S {...p}>
    <rect x="8" y="8" width="13" height="13" />
    <path d="M16 8V3H3v13h5" />
  </S>
);
export const IconExternal = (p: P) => (
  <S {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M18 14v6H4V6h6" />
  </S>
);
export const IconMenu = (p: P) => (
  <S {...p}>
    <path d="M3 7h18M3 12h18M3 17h18" />
  </S>
);
export const IconClose = (p: P) => (
  <S {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </S>
);
export const IconX = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
);
export const IconTelegram = (p: P) => (
  <S {...p}>
    <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" />
    <path d="M9 13l12-9" />
  </S>
);
export const IconGlobe = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" />
  </S>
);
export const IconArrowUpRight = (p: P) => (
  <S {...p}>
    <path d="M7 17L17 7M8 7h9v9" />
  </S>
);
export const IconZero = (p: P) => (
  <S {...p}>
    <ellipse cx="12" cy="12" rx="6" ry="8.5" />
  </S>
);
export const IconCoin = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4" />
  </S>
);
export const IconStack = (p: P) => (
  <S {...p}>
    <ellipse cx="12" cy="6" rx="7" ry="2.5" />
    <path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
  </S>
);
