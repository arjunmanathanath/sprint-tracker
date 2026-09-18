import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const IconToday = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <rect x="3" y="4" width="18" height="17" rx="3" />
    <path d="M3 9h18M8 2v4M16 2v4" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);

export const IconProgress = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconScratch = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M5 3h11l4 4v14H5z" />
    <path d="M16 3v4h4M9 12h6M9 16h6" />
  </svg>
);

export const IconSettings = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconChevronLeft = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconChevronRight = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconChevronDown = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconCheck = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size, p)} strokeWidth={3}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const IconPlay = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);

export const IconStop = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const IconPause = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const IconNote = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M4 4h16v12H8l-4 4z" />
  </svg>
);

export const IconTrash = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const IconX = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconPlus = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconAlert = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h.01" />
  </svg>
);

export const IconMoon = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
  </svg>
);
