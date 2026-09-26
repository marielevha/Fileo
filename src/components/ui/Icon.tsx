import type { SVGProps } from "react";

/**
 * Tiny inline icon set (stroke-based, 24x24 grid) so the site ships with no
 * icon-library dependency. Paths follow the usual outline conventions.
 */
const paths: Record<string, React.ReactNode> = {
  sparkles: (
    <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM18 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9L18 15Z" />
  ),
  shield: <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6L12 3Zm-2.5 8.5 2 2 4-4.5" />,
  users: (
    <path d="M16 19v-1.5a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V19M9.25 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM21.5 19v-1.5a4 4 0 0 0-3-3.87M16.5 3.13a4 4 0 0 1 0 7.75" />
  ),
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c-2.5 2.4-3.75 5.4-3.75 9S9.5 18.6 12 21c2.5-2.4 3.75-5.4 3.75-9S14.5 5.4 12 3ZM3.5 9.5h17M3.5 14.5h17" />,
  code: <path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 4l-3 16" />,
  device: <path d="M15.5 3h-7A1.5 1.5 0 0 0 7 4.5v15A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 15.5 3ZM10.75 17.75h2.5" />,
  wrench: (
    <path d="M20 5.5a4.75 4.75 0 0 1-6.2 4.52l-6.4 6.4a2 2 0 1 1-2.82-2.83l6.4-6.4A4.75 4.75 0 0 1 16.5 1.5l-2.7 2.7.9 2.6 2.6.9L20 5.5Z" />
  ),
  layout: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM4 9.5h16M9.5 9.5V20" />,
  server: (
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v3A1.5 1.5 0 0 1 18.5 10h-13A1.5 1.5 0 0 1 4 8.5v-3ZM4 15.5A1.5 1.5 0 0 1 5.5 14h13a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-3ZM7.5 7h.01M7.5 17h.01" />
  ),
  mail: <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11Zm.7-.6L12 12.5l7.8-6.6" />,
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
  ),
  pin: <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrowRight: <path d="M4.5 12h15m-6-6 6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7m0 0h-8m8 0v8" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5v-2h5v2m-8 0 .8 13h9.4l.8-13M10 10v6M14 10v6" />,
  sun: <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  github: (
    <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5.2v-3.4c0-1 .1-1.4-.5-2 2.3-.3 4.5-1.2 4.5-5.1a4 4 0 0 0-1.1-2.8 3.7 3.7 0 0 0-.1-2.8s-.9-.3-3 1.1a10.3 10.3 0 0 0-5.5 0C7.2 4.1 6.3 4.4 6.3 4.4a3.7 3.7 0 0 0-.1 2.8A4 4 0 0 0 5.1 10c0 3.9 2.2 4.8 4.5 5.1-.5.6-.5 1.1-.5 2v4" />
  ),
  linkedin: <path d="M6.5 9.5V19M6.5 5.5h.01M11 19v-5.25a3.25 3.25 0 0 1 6.5 0V19M11 9.5V19" />,
  twitter: <path d="M21 5.2a7.7 7.7 0 0 1-2.2.6 3.9 3.9 0 0 0 1.7-2.1 7.8 7.8 0 0 1-2.5.9 3.9 3.9 0 0 0-6.6 3.5A11 11 0 0 1 3.4 4a3.9 3.9 0 0 0 1.2 5.2 3.9 3.9 0 0 1-1.8-.5 3.9 3.9 0 0 0 3.1 3.8 3.9 3.9 0 0 1-1.7.1 3.9 3.9 0 0 0 3.6 2.7A7.8 7.8 0 0 1 3 17a11 11 0 0 0 17-9.8A7.9 7.9 0 0 0 21 5.2Z" />,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.9l-5.25 2.8 1-5.85L3.5 9.7l5.9-.9L12 3.5Z" />,
  quote: <path d="M9.5 6C6.9 7.3 5.5 9.6 5.5 13v5h5.5v-6H8.4c.1-1.9.9-3.2 2.4-4L9.5 6Zm9 0c-2.6 1.3-4 3.6-4 7v5H20v-6h-2.6c.1-1.9.9-3.2 2.4-4L18.5 6Z" />,
};

export type IconName = keyof typeof paths;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName | string;
  /** Filled icons (star, quote) look better without a stroke. */
  filled?: boolean;
};

export default function Icon({ name, filled = false, ...props }: IconProps) {
  const d = paths[name];
  if (!d) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {d}
    </svg>
  );
}
