// Shared helper for CEO Dashboard KPI drill-down -> target page filtering

export const triggerCeoDrilldown = ({
  storageKey,
  eventName,
  targetKeys = [],
  periodLabel = 'Selected Period',
  sourceLabel = 'CEO Dashboard',
  filterTab = 'All',
  navigateTab,
  onNavigateTab
}) => {
  const normalizedKeys = (targetKeys || [])
    .map((k) => String(k || '').trim().toLowerCase())
    .filter(Boolean);

  const payload = {
    targetKeys: normalizedKeys,
    periodLabel,
    sourceLabel,
    filterTab,
    count: normalizedKeys.length
  };

  if (storageKey) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {}
  }

  if (eventName) {
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  if (onNavigateTab && navigateTab) {
    onNavigateTab(navigateTab);
  }
};

export const readInitialDrilldownMeta = (storageKey) => {
  if (!storageKey) return null;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.targetKeys)) {
      return {
        targetKeys: new Set(parsed.targetKeys.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean)),
        periodLabel: parsed.periodLabel || 'Selected Period',
        sourceLabel: parsed.sourceLabel || 'CEO Dashboard',
        filterTab: parsed.filterTab || 'All',
        count: parsed.count ?? parsed.targetKeys.length
      };
    }
  } catch (_) {}
  return null;
};

export const clearDrilldownMeta = (storageKey, setMeta) => {
  if (storageKey) {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (_) {}
  }
  if (setMeta) setMeta(null);
};

export const matchesDrilldownKeys = (targetKeysSet, candidates = []) => {
  if (!targetKeysSet) return true;
  if (targetKeysSet.size === 0) return false;
  return candidates.some((c) => {
    const k = String(c || '').trim().toLowerCase();
    return Boolean(k && targetKeysSet.has(k));
  });
};
