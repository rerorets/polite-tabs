export type GroupColor = `${chrome.tabGroups.Color}`;

// Swatch colors as Chrome renders tab groups in its dark theme.
export const COLORS: Record<GroupColor, string> = {
  grey: '#BDC1C6',
  blue: '#8AB4F8',
  red: '#F28B82',
  yellow: '#FDD663',
  green: '#81C995',
  pink: '#FF8BCB',
  purple: '#C58AF9',
  cyan: '#78D9EC',
  orange: '#FCAD70',
};

export const COLOR_NAMES = Object.keys(COLORS) as GroupColor[];

export const isGroupColor = (value: string): value is GroupColor => value in COLORS;
