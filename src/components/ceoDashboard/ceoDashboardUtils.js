export const parseAmt = (amtStr) => {
  if (!amtStr) return 0;
  if (typeof amtStr === 'number') return amtStr;
  const clean = String(amtStr).replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
};
