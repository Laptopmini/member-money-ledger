// Inline icons from the design handback (20x20 viewBox, currentColor). No external assets.
import type { ReactNode } from "react";

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };
export const ChevronLeft = (p: P) => (
  <Icon {...p}>
    <path d="M12.5 15 7.5 10l5-5" />
  </Icon>
);
export const ChevronRight = (p: P) => (
  <Icon {...p}>
    <path d="m7.5 5 5 5-5 5" />
  </Icon>
);
export const Check = (p: P) => (
  <Icon {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Icon>
);
export const Clock = (p: P) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6v4l2.5 2" />
  </Icon>
);
export const Info = (p: P) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 9v4.5M10 6.5v.1" />
  </Icon>
);
export const Alert = (p: P) => (
  <Icon {...p}>
    <path d="M8.7 3.9 2.4 14.8A1.5 1.5 0 0 0 3.7 17h12.6a1.5 1.5 0 0 0 1.3-2.2L11.3 3.9a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M10 8v3.5M10 14.2v.1" />
  </Icon>
);
export const Refresh = (p: P) => (
  <Icon {...p}>
    <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" />
    <path d="M16.5 3.5v3h-3" />
  </Icon>
);
export const LogOut = (p: P) => (
  <Icon {...p}>
    <path d="M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8M13 13.5 16.5 10 13 6.5M16.5 10H8" />
  </Icon>
);
export const Lightbulb = (p: P) => (
  <Icon {...p}>
    <path d="M7.5 14.5h5M8 17h4M10 3a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z" />
  </Icon>
);
