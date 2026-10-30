import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const Back = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Search = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

export const More = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="5.5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18.5" cy="12" r="1.8" />
  </svg>
);

export const Pencil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const Chevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const Arrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Trash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
  </svg>
);

export const Aperture = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

export const Camera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 8.5A2 2 0 015.5 6.5h2l1.5-2h6l1.5 2h2a2 2 0 012 2v9a2 2 0 01-2 2h-13a2 2 0 01-2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const Photos = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="M3.5 15.5l4.5-4 4 3.5 3-2.5 5.5 4.5" />
  </svg>
);

export const Ghost = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="12" height="12" rx="2" strokeDasharray="2.5 2.5" />
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
  </svg>
);

export const Fit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);

export const Clock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.2l2.8 1.8" />
  </svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
