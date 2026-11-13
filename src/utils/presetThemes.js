export const PRESET_THEMES = [
  { primary: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', tagBg: '#CFFAFE', tagText: '#155E75', badge: 'PRESET 1', dot: '#0891B2' },
  { primary: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', tagBg: '#E0E7FF', tagText: '#3730A3', badge: 'PRESET 2', dot: '#4F46E5' },
  { primary: '#D97706', bg: '#FFFBEB', border: '#FDE68A', tagBg: '#FEF3C7', tagText: '#92400E', badge: 'PRESET 3', dot: '#B45309' },
  { primary: '#059669', bg: '#ECFDF5', border: '#A7F3D0', tagBg: '#D1FAE5', tagText: '#065F46', badge: 'PRESET 4', dot: '#047857' },
  { primary: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', tagBg: '#EDE9FE', tagText: '#5B21B6', badge: 'PRESET 5', dot: '#6D28D9' },
];

export const getPresetTheme = (groupIndex) => {
  return PRESET_THEMES[groupIndex % PRESET_THEMES.length] || PRESET_THEMES[0];
};

