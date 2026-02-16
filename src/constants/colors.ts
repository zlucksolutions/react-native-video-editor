// Color constants
export const COLORS = {
  // Segment colors
  AUDIO_SEGMENT: '#FF3040',
  VOICEOVER_SEGMENT: '#9C27B0',
  TEXT_SEGMENT: 'rgba(255, 255, 255, 0.15)',
  TRIM_BORDER: '#FFD700', // Yellow/Gold

  // UI colors
  BACKGROUND: '#000000',
  BACKGROUND_SECONDARY: '#1a1a1a',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.7)',
  BORDER: 'rgba(255, 255, 255, 0.1)',

  // Queryloom Colors
  PRIMARY_GRADIENT: ['#E3196A', '#FE9050'], // Pink to Orange
  ACCENT_PINK: '#E3196A',
  ACCENT_PINK_GRADIENT: '#E3196A',
  ACCENT_ORANGE: '#FE9050',
  PRIMARY_YELLOW: '#FFD700',
  DISCARD_PINK: '#FFE4E1',
  KEEP_GREEN: '#E0FFE0',
};

// Text/Caption color options
export const TEXT_COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#9C27B0', // Purple
  '#FF69B4', // Pink
  '#FFA500', // Orange
  '#8B4513', // Brown
  '#808080', // Gray
  '#00FFFF', // Cyan
];

// Caption background colors (includes transparent)
export const CAPTION_BG_COLORS = [
  'transparent',
  '#00000080', // Semi-transparent black
  '#FFFFFF80', // Semi-transparent white
  '#FF000080', // Semi-transparent red
  '#0000FF80', // Semi-transparent blue
  ...TEXT_COLORS.map((c) => c + '80'),
];
