/**
 * One set of single-path icons on a 24 px grid, drawn at 20 px with a 1.6 px stroke in currentColor.
 * Navigation icons always carry a label, and two pages never share an icon (DESIGN.md §12).
 */
export const ICON_PATHS: Record<string, string> = {
  'external-link': 'M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3z',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  compare: 'M7 3v18M17 3v18M3 7h8M13 17h8',
  chart: 'M3 3v18h18M6 15l5-5 4 3 6-8',
  brief: 'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 10h18c0-3-3-3-3-10M10 22h4',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  pin: 'M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  filter: 'M3 5h18M6 12h12M9 19h6M7 3v4M16 10v4M11 17v4',
  menu: 'M3 6h18M3 12h18M3 18h18',
  check: 'm4 12 5 5L20 6',
  user: 'M20 21v-3a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v3M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  // A menu entry waiting for an admin's approval (a pending account type).
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  // Admin: role requests and the role history of one user.
  'user-check': 'M16 21v-2a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M16 11l2 2 4-4',
  badge: 'M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4zM9 12l2 2 4-4',
  close: 'm5 5 14 14M19 5 5 19',
  layers: 'm12 2 10 6-10 6L2 8zM2 12l10 6 10-6M2 16l10 6 10-6',
  wallet: 'M3 5h17v16H3zM3 5V3h14M15 11h7v5h-7z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  // Navigation (rail, top bar, bottom bar)
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  pipeline: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z',
  applications: 'M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4',
  import: 'M12 4v11M8 11l4 4 4-4M4 17v3h16v-3',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c1.9.8 3 2.9 3 6',
  clients:
    'M4 3h16v18H4zM12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3',
  leads: 'M3 5h18l-7 8v6l-4 2v-8z',
  tasks: 'M10 6h10M10 12h10M10 18h10M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17',
  deals: 'M3 12V3h9l9 9-9 9zM8 7.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1',
  studio:
    'M5 3h14v18H5zM8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  database:
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  quality: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  more: 'M4 12h2M11 12h2M18 12h2',
  'sign-out': 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  'sign-in': 'M9 4H5v16h4M14 8l4 4-4 4M18 12H8',
  'chevron-up': 'M6 15l6-6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
};
