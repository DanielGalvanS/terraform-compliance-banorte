import type { ReactNode } from 'react'

/**
 * Icon registry. Every glyph is drawn on a 24×24 grid and inherits stroke
 * colour from its parent, so adding one means adding a single entry here.
 */
export const iconPaths = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  pipeline: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M8 5h3a3 3 0 0 1 3 3v1M8 19h3a3 3 0 0 0 3-3v-1" />
    </>
  ),
  inventory: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  findings: (
    <>
      <path d="M10.3 3.6 2.8 17a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  approvals: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  agent: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="3" />
      <path d="M9 11h.01M15 11h.01M9 16h6M12 2v4" />
    </>
  ),
  performance: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  evidence: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h7M9 17h7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  play: <path d="m8 5 11 7-11 7Z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />,
  external: <path d="M14 3h7v7M10 14 21 3M18 13v7H4V6h7" />,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
  cloud: <path d="M17 18H7a5 5 0 0 1-.6-10A7 7 0 0 1 20 10.5 3.8 3.8 0 0 1 17 18Z" />,
  branch: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v10M8 10h5a5 5 0 0 0 5-2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof iconPaths
